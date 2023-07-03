'use strict';

const { artifacts, contract, web3 } = require('hardhat');
const { toBN } = web3.utils;

const { assert } = require('../../utils/common');
const { fastForward, toUnit, currentTime, multiplyDecimalRound } = require('../../utils')();
const { toBytes32 } = require('../../../index');
const { setupAllContracts } = require('../../utils/setup');

const {
	ensureOnlyExpectedMutativeFunctions,
	onlyGivenAddressCanInvoke,
	convertToDecimals,
} = require('../../utils/helpers');

let factory, manager;
let PositionalMarket,
	priceFeed,
	sUSDSynth,
	positionalMarketMastercopy,
	PositionMastercopy,
	thalesAMM;
let market, up, down, Position, Synth, addressResolver;

const ZERO_ADDRESS = '0x' + '0'.repeat(40);
const DAY = 24 * 60 * 60;
const WEEK = 7 * DAY;

const MockAggregator = artifacts.require('MockAggregatorV2V3');

contract('Position', (accounts) => {
	const [initialCreator, managerOwner, minter, dummy, exersizer] = accounts;
	let creator, owner;
	const sUSDQty = toUnit(10000);
	const AUDKey = toBytes32('sAUD');

	const createMarket = async (man, oracleKey, strikePrice, maturity, initialMint, creator) => {
		const tx = await man
			.connect(creator)
			.createMarket(oracleKey, strikePrice.toString(), maturity, initialMint.toString());
		let receipt = await tx.wait();
		const marketEvent = receipt.events.find(
			(event) => event['event'] && event['event'] === 'MarketCreated'
		);
		return PositionalMarket.at(marketEvent.args.market);
	};

	before(async () => {
		PositionalMarket = artifacts.require('PositionalMarket');
	});

	before(async () => {
		Synth = artifacts.require('Synth');
	});

	before(async () => {
		Position = artifacts.require('Position');
	});

	before(async () => {
		({
			PositionalMarketManager: manager,
			PositionalMarketFactory: factory,
			PositionalMarketMastercopy: positionalMarketMastercopy,
			PositionMastercopy: PositionMastercopy,
			AddressResolver: addressResolver,
			PriceFeed: priceFeed,
			SynthsUSD: sUSDSynth,
		} = await setupAllContracts({
			accounts,
			synths: ['sUSD'],
			contracts: [
				'FeePool',
				'PriceFeed',
				'PositionalMarketManager',
				'PositionalMarketMastercopy',
				'PositionMastercopy',
				'PositionalMarketFactory',
			],
		}));

		[creator, owner] = await ethers.getSigners();

		await manager.connect(creator).setPositionalMarketFactory(factory.address);
		await factory.connect(owner).setPositionalMarketManager(manager.address);
		await factory.connect(owner).setPositionalMarketMastercopy(positionalMarketMastercopy.address);
		await factory.connect(owner).setPositionMastercopy(PositionMastercopy.address);

		await manager.connect(creator).setTimeframeBuffer(1);
		await manager.connect(creator).setPriceBuffer(toUnit(0.05).toString());

		const hour = 60 * 60;
		let ThalesAMM = artifacts.require('ThalesAMM');
		thalesAMM = await ThalesAMM.new();
		await thalesAMM.initialize(
			owner.address,
			priceFeed.address,
			sUSDSynth.address,
			toUnit(1000),
			owner.address,
			toUnit(0.01),
			toUnit(0.05),
			hour * 2
		);

		await factory.connect(owner).setThalesAMM(thalesAMM.address);

		let aggregatorAUD = await MockAggregator.new({ from: managerOwner });
		aggregatorAUD.setDecimals('8');
		const timestamp = await currentTime();
		await aggregatorAUD.setLatestAnswer(convertToDecimals(100, 8), timestamp);

		await priceFeed.connect(owner).addAggregator(AUDKey, aggregatorAUD.address);

		await thalesAMM.setImpliedVolatilityPerAsset(AUDKey, toUnit(100), { from: owner.address });

		await Promise.all([
			sUSDSynth.issue(initialCreator, sUSDQty),
			sUSDSynth.approve(manager.address, sUSDQty, { from: initialCreator }),
			sUSDSynth.issue(minter, sUSDQty),
			sUSDSynth.approve(manager.address, sUSDQty, { from: minter }),
			sUSDSynth.issue(dummy, sUSDQty),
			sUSDSynth.approve(manager.address, sUSDQty, { from: dummy }),
		]);
	});

	describe('Transfers', () => {
		it('Can transfer tokens.', async () => {
			const now = await currentTime();
			await manager.setMarketCreationParameters(now - WEEK + 200, now - 3 * DAY + 200);
			let price = (await priceFeed.rateForCurrency(AUDKey)) / 1e18;
			let strikePriceStep = (await manager.getStrikePriceStep(AUDKey)) / 1e18;

			market = await createMarket(
				manager,
				AUDKey,
				toUnit(price + strikePriceStep),
				now + 200,
				toUnit(2),
				creator
			);
			await fastForward(100);

			const options = await market.options();
			up = await Position.at(options.up);
			down = await Position.at(options.down);

			await up.transfer(minter, toUnit(1), { from: initialCreator });

			await assertAllBnEqual(
				[up.balanceOf(minter), up.balanceOf(initialCreator)],
				[toUnit(1), toUnit(1)]
			);
		});
	});

	describe('Basic Parameters', () => {
		it('Static parameters are set properly', async () => {
			assert.equal(await up.name(), 'Position Up');
			assert.equal(await up.symbol(), 'UP');
			assert.bnEqual(await up.decimals(), toBN(18));
			assert.equal(await up.market(), market.address);
		});

		it('Only expected functions are mutative', async () => {
			ensureOnlyExpectedMutativeFunctions({
				abi: up.abi,
				expected: [
					'initialize',
					'mint',
					'exercise',
					'exerciseWithAmount',
					'expire',
					'transfer',
					'transferFrom',
					'approve',
				],
			});
		});
	});

	describe('Mints', () => {
		it('Can mint during trading.', async () => {
			await market.mint(toUnit(1), { from: minter });
			let fees = await market.fees();
			let _feeMultiplier = toUnit(1).sub(fees[0].add(fees[1]));
			let upBalanceAfterMinting = multiplyDecimalRound(_feeMultiplier, toUnit(1));
			assert.bnEqual(await up.balanceOf(minter), upBalanceAfterMinting.add(toUnit(1)));

			assert.bnEqual(await up.totalSupply(), upBalanceAfterMinting.add(toUnit(2)));
		});

		it('Zero mints are idempotent.', async () => {
			await market.mint(toUnit(0), { from: minter });
			let fees = await market.fees();
			let _feeMultiplier = toUnit(1).sub(fees[0].add(fees[1]));
			let upBalanceAfterMinting = multiplyDecimalRound(_feeMultiplier, toUnit(1));
			assert.bnEqual(await up.balanceOf(minter), upBalanceAfterMinting.add(toUnit(1)), {
				from: minter,
			});
		});

		it('Mint less than one cent fail.', async () => {
			await assert.revert(market.mint(toUnit(0.0099), { from: minter }), 'Balance < $0.01');
		});

		it('Mint cannot be done other than from the market.', async () => {
			await onlyGivenAddressCanInvoke({
				fnc: up.mint,
				args: [minter, toUnit(1)],
				accounts,
				skipPassCheck: true,
				reason: 'Only market allowed',
			});
		});
	});

	describe('Transfer events', () => {
		it('Transfers properly emit events', async () => {
			// Transfer partial quantity.
			const tx = await down.transfer(minter, toUnit(1), { from: initialCreator });

			assert.eventEqual(tx.logs[0], 'Transfer', {
				from: initialCreator,
				to: minter,
				value: toUnit(1),
			});
		});

		it('Cannot transfer on insufficient balance', async () => {
			await assert.revert(
				up.transfer(initialCreator, toUnit(1), { from: exersizer }),
				'Insufficient balance'
			);
		});

		it('Approvals properly update allowance values', async () => {
			await up.approve(minter, toUnit(10), { from: exersizer });
			assert.bnEqual(await up.allowance(exersizer, minter), toUnit(10));
		});

		it('Approvals properly emit events', async () => {
			const tx = await up.approve(minter, toUnit(10), { from: exersizer });

			assert.eventEqual(tx.logs[0], 'Approval', {
				owner: exersizer,
				spender: minter,
				value: toUnit(10),
			});
		});

		it('Can transferFrom tokens.', async () => {
			const now = await currentTime();
			await manager.setMarketCreationParameters(now - WEEK + 200, now - 3 * DAY + 200);
			let price = (await priceFeed.rateForCurrency(AUDKey)) / 1e18;
			let strikePriceStep = (await manager.getStrikePriceStep(AUDKey)) / 1e18;

			market = await createMarket(
				manager,
				AUDKey,
				toUnit(price + 2 * strikePriceStep),
				now + 200,
				toUnit(2),
				creator
			);
			await fastForward(100);

			const options = await market.options();
			up = await Position.at(options.up);
			down = await Position.at(options.down);

			await down.approve(minter, toUnit(10), { from: exersizer });
			await down.transfer(exersizer, toUnit(1), { from: initialCreator });

			const tx = await down.transferFrom(exersizer, minter, toUnit(1), { from: minter });

			assert.eventEqual(tx.logs[0], 'Transfer', {
				from: exersizer,
				to: minter,
				value: toUnit(1),
			});

			await assertAllBnEqual(
				[down.balanceOf(exersizer), down.balanceOf(minter), down.totalSupply()],
				[toUnit(0), toUnit(1), toUnit(2)]
			);

			await assert.revert(
				down.transferFrom(exersizer, minter, toUnit(1), { from: minter }),
				'Insufficient balance'
			);

			await assert.revert(
				down.transferFrom(minter, exersizer, toUnit(1), { from: exersizer }),
				'Insufficient allowance'
			);
		});

		it('Transfers and approvals cannot go to invalid addresses.', async () => {
			await assert.revert(up.transfer(ZERO_ADDRESS, toBN(0)), 'Invalid address');
			await assert.revert(up.transferFrom(ZERO_ADDRESS, ZERO_ADDRESS, toBN(0)), 'Invalid address');
			await assert.revert(up.approve(ZERO_ADDRESS, toBN(100)));
		});
	});

	describe('Exercising Options', () => {
		it('Exercising options updates balances properly', async () => {
			const totalSupply = await down.totalSupply();
			await fastForward(12 * DAY);
			await market.exerciseOptions({ from: minter });
			await assertAllBnEqual([down.balanceOf(minter), down.totalSupply()], [toBN(0), toUnit(1)]);
		});
	});

	describe('Exercising Options with amount', () => {
		it('Exercising options with provided amount zero', async () => {
			let value_1 = toUnit(1);
			let value_2 = toUnit(2);

			const totalSupplyDown = await down.totalSupply(); // 1
			const totalSupplyUp = await up.totalSupply(); // 2
			assert.bnEqual(totalSupplyDown, value_1);
			assert.bnEqual(totalSupplyUp, value_2);

			await fastForward(200);

			await assert.revert(
				market.burnOptions(toUnit(0), { from: minter }),
				'Can not burn zero amount!'
			);
		});

		it('Exercising options with provided amount  which exides MAX sUP', async () => {
			let value_1 = toUnit(1);
			let value_2 = toUnit(2);

			const totalSupplyDown = await down.totalSupply(); // 1
			const totalSupplyUp = await up.totalSupply(); // 2
			assert.bnEqual(totalSupplyDown, value_1);
			assert.bnEqual(totalSupplyUp, value_2);

			await fastForward(200);

			await assert.revert(
				market.burnOptions(value_2, { from: minter }),
				'There is not enough options!'
			);
		});

		it('Exercising options with max amount updates balances properly', async () => {
			let value_1 = toUnit(1);
			let value_2 = toUnit(2);

			const totalSupplyDown = await down.totalSupply(); // 1
			const totalSupplyUp = await up.totalSupply(); // 2
			assert.bnEqual(totalSupplyDown, value_1);
			assert.bnEqual(totalSupplyUp, value_2);

			let minimum = await market.getMaximumBurnable(initialCreator);
			assert.bnEqual(minimum, value_1); // 1

			await fastForward(200);

			const tx = await market.burnOptions(minimum, { from: initialCreator });

			await assertAllBnEqual(
				[down.balanceOf(initialCreator), up.balanceOf(initialCreator)],
				[toBN(0), value_1]
			);
		});

		it('Exercising options with provided amount which exides MAX sDOWN', async () => {
			let value_0 = toUnit(0);
			let value_1 = toUnit(1);

			const totalSupplyDown = await down.totalSupply(); // 1
			const totalSupplyUp = await up.totalSupply(); // 2
			assert.bnEqual(totalSupplyDown, value_0);
			assert.bnEqual(totalSupplyUp, value_1);

			await fastForward(200);

			await assert.revert(
				market.burnOptions(value_1, { from: initialCreator }),
				'There is not enough options!'
			);
		});
	});

	describe('Destruction', () => {
		it('Position can only be destroyed by its parent market', async () => {
			await onlyGivenAddressCanInvoke({
				fnc: up.expire,
				args: [exersizer],
				accounts,
				skipPassCheck: true,
				reason: 'Only market allowed',
			});
		});
	});
});

async function assertAllPromises(promises, expected, assertion, assertionName) {
	if (promises.length !== expected.length) {
		throw new Error('Promise and expected result arrays differ in length.');
	}

	const nameString = assertionName ? `'${assertionName}' ` : '';
	const results = await Promise.all(promises);
	results.forEach((r, i) =>
		assertion(r, expected[i], `Assertion ${nameString}at index ${i} failed.`)
	);
}

async function assertAllBnEqual(promises, expected) {
	return assertAllPromises(promises, expected, assert.bnEqual, 'bnEqual');
}
