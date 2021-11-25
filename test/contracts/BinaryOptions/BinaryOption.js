'use strict';

const { artifacts, contract, web3 } = require('hardhat');
const { toBN } = web3.utils;

const { assert, addSnapshotBeforeRestoreAfterEach } = require('../../utils/common');
const {
	fastForward,
	toUnit,
	currentTime,
	multiplyDecimalRound,
	divideDecimalRound,
} = require('../../utils')();
const { toBytes32 } = require('../../../index');
const { setupContract, setupAllContracts } = require('../../utils/setup');

const {
	ensureOnlyExpectedMutativeFunctions,
	onlyGivenAddressCanInvoke,
	getEventByName,
	getDecodedLogs,
	decodedEventEqual,
	convertToDecimals,
} = require('../../utils/helpers');

let BinaryOptionMarketFactory, factory, BinaryOptionMarketManager, manager, addressResolver;
let BinaryOptionMarket,
	priceFeed,
	oracle,
	sUSDSynth,
	binaryOptionMarketMastercopy,
	binaryOptionMastercopy;
let market, long, short, BinaryOption, Synth;

const ZERO_ADDRESS = '0x' + '0'.repeat(40);

const Phase = {
	Trading: toBN(0),
	Maturity: toBN(1),
	Expiry: toBN(2),
};

const MockAggregator = artifacts.require('MockAggregatorV2V3');

contract('BinaryOption', accounts => {
	const [initialCreator, managerOwner, minter, dummy, exersizer, secondCreator] = accounts;

	const sUSDQty = toUnit(10000);

	const capitalRequirement = toUnit(2);
	const skewLimit = toUnit(0.05);
	const maxOraclePriceAge = toBN(60 * 61);
	const expiryDuration = toBN(26 * 7 * 24 * 60 * 60);
	const maxTimeToMaturity = toBN(365 * 24 * 60 * 60);

	const initialStrikePrice = toUnit(100);

	const initialPoolFee = toUnit(0.005);
	const initialCreatorFee = toUnit(0.005);

	const initialFeeAddress = 0xfeefeefeefeefeefeefeefeefeefeefeefeefeef;

	const AUDKey = toBytes32('sAUD');
	const iAUDKey = toBytes32('iAUD');

	let timeToMaturity = 200;
	let totalDepositedAfterFees;
	let longOption, shortOption;

	const Side = {
		Long: toBN(0),
		Short: toBN(1),
	};

	const createMarket = async (man, oracleKey, strikePrice, maturity, initialMint, creator) => {
		const tx = await man.createMarket(
			oracleKey,
			strikePrice,
			maturity,
			initialMint,
			false,
			ZERO_ADDRESS,
			{
				from: creator,
			}
		);
		return BinaryOptionMarket.at(getEventByName({ tx, name: 'MarketCreated' }).args.market);
	};

	before(async () => {
		BinaryOptionMarket = artifacts.require('BinaryOptionMarket');
	});

	before(async () => {
		Synth = artifacts.require('Synth');
	});

	before(async () => {
		BinaryOption = artifacts.require('BinaryOption');
	});

	before(async () => {
		({
			BinaryOptionMarketManager: manager,
			BinaryOptionMarketFactory: factory,
			BinaryOptionMarketMastercopy: binaryOptionMarketMastercopy,
			BinaryOptionMastercopy: binaryOptionMastercopy,
			AddressResolver: addressResolver,
			PriceFeed: priceFeed,
			SynthsUSD: sUSDSynth,
		} = await setupAllContracts({
			accounts,
			synths: ['sUSD'],
			contracts: [
				'FeePool',
				'PriceFeed',
				'BinaryOptionMarketMastercopy',
				'BinaryOptionMastercopy',
				'BinaryOptionMarketFactory',
			],
		}));

		manager.setBinaryOptionsMarketFactory(factory.address, { from: managerOwner });

		factory.setBinaryOptionMarketManager(manager.address, { from: managerOwner });
		factory.setBinaryOptionMarketMastercopy(binaryOptionMarketMastercopy.address, {
			from: managerOwner,
		});
		factory.setBinaryOptionMastercopy(binaryOptionMastercopy.address, { from: managerOwner });

		let aggregatorAUD = await MockAggregator.new({ from: managerOwner });
		aggregatorAUD.setDecimals('8');
		const timestamp = await currentTime();
		await aggregatorAUD.setLatestAnswer(convertToDecimals(100, 8), timestamp);

		await priceFeed.addAggregator(AUDKey, aggregatorAUD.address, {
			from: managerOwner,
		});

		console.log('AUD rate', await priceFeed.rateForCurrency(AUDKey));
		console.log('AUD aggregator', await priceFeed.aggregators(AUDKey));

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
			const newValue = toUnit(1);
			await manager.setCreatorCapitalRequirement(newValue, { from: managerOwner });
			let now = await currentTime();
			market = await createMarket(manager, AUDKey, toUnit(1), now + 200, toUnit(2), initialCreator);
			await fastForward(100);

			const options = await market.options();
			long = await BinaryOption.at(options.long);
			short = await BinaryOption.at(options.short);

			await long.transfer(minter, toUnit(1), { from: initialCreator });

			await assertAllBnEqual(
				[long.balanceOf(minter), long.balanceOf(initialCreator)],
				[toUnit(1), toUnit(1)]
			);
		});
	});

	describe('Basic Parameters', () => {
		it('Static parameters are set properly', async () => {
			assert.equal(await long.name(), 'Binary Option Long');
			assert.equal(await long.symbol(), 'sLONG');
			assert.bnEqual(await long.decimals(), toBN(18));
			assert.equal(await long.market(), market.address);
		});

		it('Only expected functions are mutative', async () => {
			ensureOnlyExpectedMutativeFunctions({
				abi: long.abi,
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
			let longBalanceAfterMinting = multiplyDecimalRound(_feeMultiplier, toUnit(1));
			assert.bnEqual(await long.balanceOf(minter), longBalanceAfterMinting.add(toUnit(1)));

			assert.bnEqual(await long.totalSupply(), longBalanceAfterMinting.add(toUnit(2)));
		});

		it('Zero mints are idempotent.', async () => {
			await market.mint(toUnit(0), { from: minter });
			let fees = await market.fees();
			let _feeMultiplier = toUnit(1).sub(fees[0].add(fees[1]));
			let longBalanceAfterMinting = multiplyDecimalRound(_feeMultiplier, toUnit(1));
			assert.bnEqual(await long.balanceOf(minter), longBalanceAfterMinting.add(toUnit(1)), {
				from: minter,
			});
		});

		it('Mint less than one cent fail.', async () => {
			await assert.revert(market.mint(toUnit(0.0099), { from: minter }), 'Balance < $0.01');
		});

		it('Mint cannot be done other than from the market.', async () => {
			await onlyGivenAddressCanInvoke({
				fnc: long.mint,
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
			const tx = await short.transfer(minter, toUnit(1), { from: initialCreator });

			assert.eventEqual(tx.logs[0], 'Transfer', {
				from: initialCreator,
				to: minter,
				value: toUnit(1),
			});
		});

		it('Cannot transfer on insufficient balance', async () => {
			await assert.revert(
				long.transfer(initialCreator, toUnit(1), { from: exersizer }),
				'Insufficient balance'
			);
		});

		it('Approvals properly update allowance values', async () => {
			await long.approve(minter, toUnit(10), { from: exersizer });
			assert.bnEqual(await long.allowance(exersizer, minter), toUnit(10));
		});

		it('Approvals properly emit events', async () => {
			const tx = await long.approve(minter, toUnit(10), { from: exersizer });

			assert.eventEqual(tx.logs[0], 'Approval', {
				owner: exersizer,
				spender: minter,
				value: toUnit(10),
			});
		});

		it('Can transferFrom tokens.', async () => {
			let now = await currentTime();
			market = await createMarket(manager, AUDKey, toUnit(1), now + 200, toUnit(2), initialCreator);
			await fastForward(100);

			const options = await market.options();
			long = await BinaryOption.at(options.long);
			short = await BinaryOption.at(options.short);

			await short.approve(minter, toUnit(10), { from: exersizer });
			await short.transfer(exersizer, toUnit(1), { from: initialCreator });

			const tx = await short.transferFrom(exersizer, minter, toUnit(1), { from: minter });

			assert.eventEqual(tx.logs[0], 'Transfer', {
				from: exersizer,
				to: minter,
				value: toUnit(1),
			});

			await assertAllBnEqual(
				[short.balanceOf(exersizer), short.balanceOf(minter), short.totalSupply()],
				[toUnit(0), toUnit(1), toUnit(2)]
			);

			await assert.revert(
				short.transferFrom(exersizer, minter, toUnit(1), { from: minter }),
				'Insufficient balance'
			);

			await assert.revert(
				short.transferFrom(minter, exersizer, toUnit(1), { from: exersizer }),
				'Insufficient allowance'
			);
		});

		it('Transfers and approvals cannot go to invalid addresses.', async () => {
			await assert.revert(long.transfer(ZERO_ADDRESS, toBN(0)), 'Invalid address');
			await assert.revert(
				long.transferFrom(ZERO_ADDRESS, ZERO_ADDRESS, toBN(0)),
				'Invalid address'
			);
			await assert.revert(long.approve(ZERO_ADDRESS, toBN(100)));
		});
	});

	describe('Exercising Options', () => {
		it('Exercising options updates balances properly', async () => {
			const totalSupply = await short.totalSupply();
			await fastForward(200);
			await market.exerciseOptions({ from: minter });
			await assertAllBnEqual([short.balanceOf(minter), short.totalSupply()], [toBN(0), toUnit(1)]);
		});
	});

	describe('Exercising Options with amount', () => {
		it('Exercising options with provided amount zero', async () => {
	
			let value_1 = toUnit(1);
			let value_2 = toUnit(2);
	
			const totalSupplyShort = await short.totalSupply(); // 1
			const totalSupplyLong = await long.totalSupply(); // 2
			assert.bnEqual(totalSupplyShort, value_1);
			assert.bnEqual(totalSupplyLong, value_2);
	
			await fastForward(200);
	
			await assert.revert(
				market.burnOptions(toUnit(0), { from: minter }),
				'Can not burn zero amount!'
			);
		});

		it('Exercising options with provided amount  which exides MAX sLONG', async () => {
	
			let value_1 = toUnit(1);
			let value_2 = toUnit(2);
	
			const totalSupplyShort = await short.totalSupply(); // 1
			const totalSupplyLong = await long.totalSupply(); // 2
			assert.bnEqual(totalSupplyShort, value_1);
			assert.bnEqual(totalSupplyLong, value_2);
	
			await fastForward(200);
	
			await assert.revert(
				market.burnOptions(value_2, { from: minter }),
				'There is not enough options!'
			);
	
		});
			
		it('Exercising options with max amount updates balances properly', async () => {
	
			let value_1 = toUnit(1);
			let value_2 = toUnit(2);
	
			const totalSupplyShort = await short.totalSupply(); // 1
			const totalSupplyLong = await long.totalSupply(); // 2
			assert.bnEqual(totalSupplyShort, value_1);
			assert.bnEqual(totalSupplyLong, value_2);
				
			let minimum = await market.getMaximumBurnable(); 
			assert.bnEqual(minimum, value_1); // 1
	
			await fastForward(200);
	
			const tx = await market.burnOptions(minimum, { from: initialCreator });
	
			await assertAllBnEqual([short.balanceOf(initialCreator), long.balanceOf(initialCreator)], [toBN(0), value_1]);
	
		});
	
		it('Exercising options with provided amount which exides MAX sSHORT', async () => {

			let value_0 = toUnit(0);
			let value_1 = toUnit(1);

			const totalSupplyShort = await short.totalSupply(); // 1
			const totalSupplyLong = await long.totalSupply(); // 2
			assert.bnEqual(totalSupplyShort, value_0);
			assert.bnEqual(totalSupplyLong, value_1);

			await fastForward(200);

			await assert.revert(
				market.burnOptions(value_1, { from: initialCreator }),
				'There is not enough options!'
			);

		});
	});

	describe('Destruction', () => {
		it('Binary option can only be destroyed by its parent market', async () => {
			await onlyGivenAddressCanInvoke({
				fnc: long.expire,
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
