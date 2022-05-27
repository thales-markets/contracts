'use strict';

const { artifacts, contract, web3 } = require('hardhat');
const { toBN } = web3.utils;

const { assert } = require('../../utils/common');
const {
	fastForward,
	toUnit,
	currentTime,
	multiplyDecimalRound
} = require('../../utils')();
const { toBytes32 } = require('../../../index');
const { setupAllContracts } = require('../../utils/setup');

const {
	onlyGivenAddressCanInvoke,
	getDecodedLogs,
	decodedEventEqual,
	convertToDecimals,
} = require('../../utils/helpers');

let factory, manager;
let PositionalMarket,
	priceFeed,
	sUSDSynth,
	positionalMarketMastercopy,
	PositionMastercopy;
let market, up, down, Position, Synth, addressResolver;

let aggregator_sAUD, aggregator_iAUD, aggregator_sUSD, aggregator_nonRate;

const ZERO_ADDRESS = '0x' + '0'.repeat(40);

const MockAggregator = artifacts.require('MockAggregatorV2V3');

const Phase = {
	Trading: toBN(0),
	Maturity: toBN(1),
	Expiry: toBN(2),
};

async function transactionEvent(tx, eventName) {
	let receipt = await tx.wait();
	return receipt.events.find(event => event['event'] && event['event'] === eventName);
}

async function createMarketAndMintMore(
	sAUDKey,
	initialStrikePrice,
	now,
	initialCreator,
	timeToMaturityParam
) {
	const result = await manager
		.connect(initialCreator)
		.createMarket(
			sAUDKey,
			initialStrikePrice.toString(),
			now + timeToMaturityParam,
			toUnit(2).toString(),
			false,
			ZERO_ADDRESS
		);

	let receipt = await result.wait();
	const marketEvent = receipt.events.find(
		event => event['event'] && event['event'] === 'MarketCreated'
	);
	market = await PositionalMarket.at(marketEvent.args.market);
	await market.mint(toUnit(1), {
		from: initialCreator.address,
	});
}

contract('Position', accounts => {
	const [initialCreator, managerOwner, minter, dummy, exersicer, secondCreator] = accounts;
	let creator, owner, minterSigner, secondCreatorSigner, dummySigner, exerciserSigner;

	const sUSDQty = toUnit(10000);
	const maxOraclePriceAge = toBN(60 * 61);
	const expiryDuration = toBN(26 * 7 * 24 * 60 * 60);
	const maxTimeToMaturity = toBN(365 * 24 * 60 * 60);

	const initialStrikePrice = toUnit(100);
	const initialStrikePriceValue = 100;

	const sAUDKey = toBytes32('sAUD');
	const iAUDKey = toBytes32('iAUD');
	const sUSDKey = toBytes32('sUSD');
	const nonRate = toBytes32('nonExistent');

	let timeToMaturity = 200;
	let totalDeposited;

	const Side = {
		Up: toBN(0),
		Down: toBN(1),
	};

	const createMarket = async (man, oracleKey, strikePrice, maturity, initialMint, creator) => {
		const tx = await man
			.connect(creator)
			.createMarket(
				oracleKey,
				strikePrice.toString(),
				maturity,
				initialMint.toString(),
				false,
				ZERO_ADDRESS
			);
		let receipt = await tx.wait();
		const marketEvent = receipt.events.find(
			event => event['event'] && event['event'] === 'MarketCreated'
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
				'PositionalMarketMastercopy',
				'PositionMastercopy',
				'PositionalMarketFactory',
			],
		}));
		[
			creator,
			owner,
			minterSigner,
			dummySigner,
			exerciserSigner,
			secondCreatorSigner,
		] = await ethers.getSigners();

		await manager.connect(creator).setPositionalMarketFactory(factory.address);

		await factory.connect(owner).setPositionalMarketManager(manager.address);
		await factory
			.connect(owner)
			.setPositionalMarketMastercopy(positionalMarketMastercopy.address);
		await factory.connect(owner).setPositionMastercopy(PositionMastercopy.address);

		aggregator_sAUD = await MockAggregator.new({ from: managerOwner });
		aggregator_iAUD = await MockAggregator.new({ from: managerOwner });
		aggregator_sUSD = await MockAggregator.new({ from: managerOwner });
		aggregator_nonRate = await MockAggregator.new({ from: managerOwner });
		aggregator_sAUD.setDecimals('8');
		aggregator_iAUD.setDecimals('8');
		aggregator_sUSD.setDecimals('8');
		const timestamp = await currentTime();

		await aggregator_sAUD.setLatestAnswer(convertToDecimals(100, 8), timestamp);
		await aggregator_iAUD.setLatestAnswer(convertToDecimals(100, 8), timestamp);
		await aggregator_sUSD.setLatestAnswer(convertToDecimals(100, 8), timestamp);

		await priceFeed.connect(owner).addAggregator(sAUDKey, aggregator_sAUD.address);

		await priceFeed.connect(owner).addAggregator(iAUDKey, aggregator_iAUD.address);

		await priceFeed.connect(owner).addAggregator(sUSDKey, aggregator_sUSD.address);

		await priceFeed.connect(owner).addAggregator(nonRate, aggregator_nonRate.address);

		await Promise.all([
			sUSDSynth.issue(initialCreator, sUSDQty),
			sUSDSynth.approve(manager.address, sUSDQty, { from: initialCreator }),
			sUSDSynth.issue(minter, sUSDQty),
			sUSDSynth.approve(manager.address, sUSDQty, { from: minter }),
			sUSDSynth.issue(dummy, sUSDQty),
			sUSDSynth.approve(manager.address, sUSDQty, { from: dummy }),
		]);
	});

	describe('Basic Parameters', () => {
		it('Created the manager', async () => {
			assert.notEqual(ZERO_ADDRESS, manager.address);
		});

		it('Set capital requirement', async () => {
			const newValue = toUnit(1).toString();
			const tx = await manager.connect(creator).setCreatorCapitalRequirement(newValue);
			assert.bnEqual(await manager.capitalRequirement(), newValue);
			const requirementUpdated = await transactionEvent(tx, 'CreatorCapitalRequirementUpdated');
			assert.bnEqual(requirementUpdated.args.value, newValue);
		});

		it('Only the owner can set the capital requirement', async () => {
			const REVERT = 'Only the contract owner may perform this action';
			await assert.revert(
				manager.connect(minterSigner).setCreatorCapitalRequirement(toUnit(1).toString()),
				REVERT
			);
		});

		it('Set expiry duration', async () => {
			const tx = await manager.connect(creator).setExpiryDuration(expiryDuration.toString());
			assert.bnEqual((await manager.durations()).expiryDuration, expiryDuration.toString());
			const durationUpdated = await transactionEvent(tx, 'ExpiryDurationUpdated');
			assert.bnEqual(durationUpdated.args.duration, expiryDuration);
		});

		it('Only the owner can set the expiry duration', async () => {
			const REVERT = 'Only the contract owner may perform this action';
			await assert.revert(
				manager.connect(minterSigner).setExpiryDuration(expiryDuration.toString()),
				REVERT
			);
		});

		it('Set max time to maturity', async () => {
			const tx = await manager.connect(creator).setMaxTimeToMaturity(maxTimeToMaturity.toString());
			assert.bnEqual((await manager.durations()).maxTimeToMaturity, maxTimeToMaturity);
			const maturityUpdated = await transactionEvent(tx, 'MaxTimeToMaturityUpdated');
			assert.bnEqual(maturityUpdated.args.duration, maxTimeToMaturity);
		});

		it('Only the owner can set the max time to maturity', async () => {
			const REVERT = 'Only the contract owner may perform this action';
			await assert.revert(
				manager.connect(minterSigner).setMaxTimeToMaturity(maxTimeToMaturity.toString()),
				REVERT
			);
		});

		it('Static parameters are set properly', async () => {
			const durations = await manager.durations();
			assert.bnEqual(durations.expiryDuration, expiryDuration);
			assert.bnEqual(durations.maxTimeToMaturity, maxTimeToMaturity);

			const capitalRequirement = await manager.capitalRequirement();
			assert.bnEqual(capitalRequirement, capitalRequirement);
			assert.bnEqual(await manager.totalDeposited(), toUnit(0));
			assert.bnEqual(await manager.marketCreationEnabled(), true);
			assert.equal(await manager.sUSD(), sUSDSynth.address);
			assert.equal(await manager.owner(), accounts[0]);
		});
	});

	describe('PositionalMarketFactory', () => {
		it('Can create a market', async () => {
			const now = await currentTime();

			const result = await manager
				.connect(creator)
				.createMarket(
					sAUDKey,
					initialStrikePrice.toString(),
					now + 200,
					toUnit(2).toString(),
					false,
					ZERO_ADDRESS
				);

			const marketCreatedEvent = await transactionEvent(result, 'MarketCreated');
			let createdMarket = await PositionalMarket.at(marketCreatedEvent.args.market);
			const options = await createdMarket.options();
			up = await Position.at(options.up);
			down = await Position.at(options.down);
			let upAddress = up.address;
			let downAddress = down.address;

			assert.eventEqual(marketCreatedEvent, 'MarketCreated', {
				creator: initialCreator,
				oracleKey: sAUDKey,
				strikePrice: initialStrikePrice,
				maturityDate: toBN(now + timeToMaturity),
				expiryDate: toBN(now + timeToMaturity).add(expiryDuration),
				up: upAddress,
				down: downAddress,
			});

			const receipt = await result.wait();
			const decodedLogs = PositionalMarket.decodeLogs(receipt.events);
			assert.eventEqual(decodedLogs[1], 'Mint', {
				side: Side.Up,
				account: initialCreator,
				value: toUnit(2),
			});
			assert.eventEqual(decodedLogs[2], 'Mint', {
				side: Side.Down,
				account: initialCreator,
				value: toUnit(2),
			});

			market = await PositionalMarket.at(marketCreatedEvent.args.market);

			const times = await market.times();
			assert.bnEqual(times.maturity, toBN(now + 200));
			assert.bnEqual(times.expiry, toBN(now + 200).add(expiryDuration));
			const oracleDetails = await market.oracleDetails();
			assert.equal(oracleDetails.key, sAUDKey);
			assert.bnEqual(oracleDetails.strikePrice, toUnit(100));
			assert.equal(await market.creator(), initialCreator);
			assert.equal(await market.owner(), manager.address);
			assert.equal(await market.sUSD(), sUSDSynth.address);

			assert.bnEqual(await manager.numActiveMarkets(), toBN(1));
			assert.equal((await manager.activeMarkets(0, 100))[0], market.address);
			assert.bnEqual(await manager.numMaturedMarkets(), toBN(0));
			assert.equal((await manager.maturedMarkets(0, 100)).length, 0);
		});

		it('Cannot create markets for invalid keys.', async () => {
			const now = await currentTime();

			await assert.revert(
				manager
					.connect(creator)
					.createMarket(
						sUSDKey,
						toUnit(1).toString(),
						now + 100,
						toUnit(2).toString(),
						false,
						ZERO_ADDRESS
					),
				'Invalid key'
			);

			await assert.revert(
				manager
					.connect(creator)
					.createMarket(
						nonRate,
						toUnit(1).toString(),
						now + 100,
						toUnit(2).toString(),
						false,
						ZERO_ADDRESS
					),
				'Invalid key'
			);
		});

		it('Cannot create a market providing insufficient initial mint', async () => {
			const now = await currentTime();
			await assert.revert(
				manager
					.connect(creator)
					.createMarket(
						sAUDKey,
						toUnit(1).toString(),
						now + 100,
						toUnit(0.1).toString(),
						false,
						ZERO_ADDRESS
					),
				'Insufficient capital'
			);
		});

		it('Cannot create a market too far into the future', async () => {
			const now = await currentTime();
			await assert.revert(
				manager
					.connect(creator)
					.createMarket(
						sAUDKey,
						toUnit(1).toString(),
						now + maxTimeToMaturity + 200,
						toUnit(0.1).toString(),
						false,
						ZERO_ADDRESS
					),
				'Maturity too far in the future'
			);
		});

		it('Cannot create a market if the manager is paused', async () => {
			await manager.connect(creator).setPaused(true);
			const now = await currentTime();
			await assert.revert(
				manager
					.connect(creator)
					.createMarket(
						sAUDKey,
						toUnit(1).toString(),
						now + 200,
						toUnit(5).toString(),
						false,
						ZERO_ADDRESS
					),
				'This action cannot be performed while the contract is paused'
			);
			await manager.connect(creator).setPaused(false);
		});

		it('Market creation can be enabled and disabled.', async () => {
			let tx = await manager.connect(creator).setMarketCreationEnabled(false);
			let event = await transactionEvent(tx, 'MarketCreationEnabledUpdated');
			assert.eventEqual(event, 'MarketCreationEnabledUpdated', {
				enabled: false,
			});
			assert.isFalse(await manager.marketCreationEnabled());

			tx = await manager.connect(creator).setMarketCreationEnabled(true);
			event = await transactionEvent(tx, 'MarketCreationEnabledUpdated');
			assert.eventEqual(event, 'MarketCreationEnabledUpdated', {
				enabled: true,
			});

			assert.isTrue(await manager.marketCreationEnabled());

			tx = await manager.connect(creator).setMarketCreationEnabled(true);
			const receipt = await tx.wait();
			assert.equal(receipt.events.length, 0);
		});

		it('Cannot create a market if market creation is disabled.', async () => {
			await manager.connect(creator).setMarketCreationEnabled(false);
			const now = await currentTime();
			await assert.revert(
				manager
					.connect(creator)
					.createMarket(
						sAUDKey,
						toUnit(1).toString(),
						now + 200,
						toUnit(5).toString(),
						false,
						ZERO_ADDRESS
					),
				'Market creation is disabled'
			);

			await manager.connect(creator).setMarketCreationEnabled(true);
			const tx = await manager
				.connect(creator)
				.createMarket(
					sAUDKey,
					toUnit(1).toString(),
					now + 200,
					toUnit(5).toString(),
					false,
					ZERO_ADDRESS
				);
			const event = await transactionEvent(tx, 'MarketCreated');
			const localMarket = await PositionalMarket.at(event.args.market);

			assert.bnEqual((await localMarket.oracleDetails()).strikePrice, toUnit(1));
		});

		it('Cannot create a market if maturity is in the past.', async () => {
			const now = await currentTime();
			await assert.revert(
				manager
					.connect(creator)
					.createMarket(
						sAUDKey,
						toUnit(1).toString(),
						now - 1,
						toUnit(2).toString(),
						false,
						ZERO_ADDRESS
					),
				'Maturity has to be in the future'
			);
		});
	});

	describe('Market expiry', () => {
		it('Can expire markets', async () => {
			const now = await currentTime();
			const [newMarket, newerMarket] = await Promise.all([
				createMarket(manager, sAUDKey, toUnit(1), now + 200, toUnit(3), creator),
				createMarket(manager, sAUDKey, toUnit(1), now + 100, toUnit(1), creator),
			]);

			assert.bnEqual(await manager.totalDeposited(), toUnit(11));

			const newAddress = newMarket.address;
			const newerAddress = newerMarket.address;

			await fastForward(expiryDuration.add(toBN(1000)));
			await aggregator_sAUD.setLatestAnswer(convertToDecimals(5, 8), await currentTime());

			await manager.resolveMarket(newAddress);
			await manager.resolveMarket(newerAddress);
			const tx = await manager.connect(creator).expireMarkets([newAddress, newerAddress]);

			const receipt = await tx.wait();
			assert.eventEqual(receipt.events[2], 'MarketExpired', { market: newAddress });
			assert.eventEqual(receipt.events[5], 'MarketExpired', { market: newerAddress });
			assert.equal(await web3.eth.getCode(newAddress), '0x');
			assert.equal(await web3.eth.getCode(newerAddress), '0x');
			assert.bnEqual(await manager.totalDeposited(), toUnit(7));
		});

		it('Cannot expire a market that does not exist', async () => {
			await assert.revert(manager.connect(creator).expireMarkets([initialCreator]));
		});

		it('Cannot expire an unresolved market.', async () => {
			const now = await currentTime();
			const newMarket = await createMarket(
				manager,
				sAUDKey,
				toUnit(1),
				now + 200,
				toUnit(3),
				creator
			);
			await assert.revert(
				manager.connect(creator).expireMarkets([newMarket.address]),
				'Unexpired options remaining'
			);

			it('Cannot expire an unexpired market.', async () => {
				const now = await currentTime();
				const newMarket = await createMarket(
					manager,
					sAUDKey,
					toUnit(1),
					now + 200,
					toUnit(3),
					creator
				);

				await fastForward(300);
				await aggregator_sAUD.setLatestAnswer(convertToDecimals(5, 8), await currentTime());

				await manager.resolveMarket(newMarket.address);
				await assert.revert(
					manager.connect(creator).expireMarkets([newMarket.address]),
					'Unexpired options remaining'
				);
			});

			it('Cannot expire a market if the manager is paused.', async () => {
				const now = await currentTime();
				const newMarket = await createMarket(
					manager,
					sAUDKey,
					toUnit(1),
					now + 200,
					toUnit(3),
					creator
				);
				await fastForward(expiryDuration.add(toBN(1000)));
				await aggregator_sAUD.setLatestAnswer(convertToDecimals(5, 8), await currentTime());

				await manager.resolveMarket(newMarket.address);

				await manager.connect(creator).setPaused(true);
				await assert.revert(
					manager.connect(minterSigner).expireMarkets([newMarket.address]),
					'This action cannot be performed while the contract is paused'
				);
				await manager.connect(creator).setPaused(false);
			});
		});
	});

	describe('PositionalMarket and balances', () => {
		it('Total Minted options', async () => {
			let totalSupplies = await market.totalSupplies();
			assert.bnEqual(totalSupplies[0], toUnit(2));
		});

		it('Minimum Supplies', async () => {
			let minimum = await market.getMaximumBurnable(initialCreator);
			assert.bnEqual(minimum, toUnit(2));
		});

		it('Held by owner', async () => {
			const options = await market.options();
			up = await Position.at(options.up);
			down = await Position.at(options.down);
			assert.bnEqual(await up.balanceOf(initialCreator), toUnit(2));
			assert.bnEqual(await down.balanceOf(initialCreator), toUnit(2));
			assert.bnEqual(await up.totalSupply(), toUnit(2));
			assert.bnEqual(await down.totalSupply(), toUnit(2));
		});

		it('Mint more and check balance', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(sAUDKey, initialStrikePrice, now, creator, timeToMaturity);

			const options = await market.options();
			up = await Position.at(options.up);
			down = await Position.at(options.down);

			let value = toUnit(3);
			totalDeposited = value;
			assert.bnEqual(await up.balanceOf(initialCreator), value);
			assert.bnEqual(await down.balanceOf(initialCreator), value);

			let minimum = await market.getMaximumBurnable(initialCreator);
			assert.bnEqual(minimum, value);

			const totalSupplies = await market.totalSupplies();
			assert.bnEqual(totalSupplies.up, value);
			assert.bnEqual(totalSupplies.down, value);
		});

		it('Position instances cannot transfer if the system is suspended or paused', async () => {
			await manager.connect(creator).setPaused(true);
			await assert.revert(
				up.transfer(market.address, toUnit(1), { from: initialCreator }),
				'This action cannot be performed while the contract is paused'
			);
			await manager.connect(creator).setPaused(false);
		});

		it('Bad constructor parameters revert.', async () => {
			// Insufficient capital
			let now = await currentTime();
			await assert.revert(
				manager
					.connect(creator)
					.createMarket(
						sAUDKey,
						initialStrikePrice.toString(),
						now + timeToMaturity,
						toUnit(0).toString(),
						false,
						ZERO_ADDRESS
					),
				'Insufficient capital'
			);
		});

		it('Current oracle price is correct.', async () => {
			const price = 0.7;
			await aggregator_sAUD.setLatestAnswer(convertToDecimals(price, 8), await currentTime());

			const result = await market.oraclePrice();

			assert.bnEqual(result, toUnit(price));
		});

		it('Result can fluctuate while unresolved, but is fixed after resolution.', async () => {
			const two = toBN(2);
			assert.isFalse(await market.resolved());

			let now = await currentTime();
			await aggregator_sAUD.setLatestAnswer(convertToDecimals(initialStrikePriceValue / 2, 8), now); // initialStrikePrice.div(two)

			assert.bnEqual(await market.result(), Side.Down);
			now = await currentTime();
			await aggregator_sAUD.setLatestAnswer(convertToDecimals(initialStrikePriceValue * 2, 8), now);
			assert.bnEqual(await market.result(), Side.Up);

			await fastForward(timeToMaturity + 10);
			now = await currentTime();

			await aggregator_sAUD.setLatestAnswer(convertToDecimals(initialStrikePriceValue * 2, 8), now);
			await manager.resolveMarket(market.address);

			assert.isTrue(await market.resolved());
			now = await currentTime();
			await aggregator_sAUD.setLatestAnswer(convertToDecimals(initialStrikePriceValue / 2, 8), now);

			assert.bnEqual(await market.result(), Side.Up);
			now = await currentTime();
			await aggregator_sAUD.setLatestAnswer(convertToDecimals(initialStrikePriceValue * 2, 8), now);

			assert.bnEqual(await market.result(), Side.Up);
		});

		it('Result resolves correctly up.', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(sAUDKey, initialStrikePrice, now, creator, timeToMaturity);
			now = await currentTime();
			await fastForward(timeToMaturity + 1);
			now = await currentTime();
			const price = initialStrikePrice.add(toUnit(1));
			await aggregator_sAUD.setLatestAnswer(convertToDecimals(initialStrikePriceValue + 1, 8), now);

			const tx = await manager.resolveMarket(market.address);
			assert.bnEqual(await market.result(), Side.Up);
			assert.isTrue(await market.resolved());
			assert.bnEqual((await market.oracleDetails()).finalPrice, price);

			const receipt = await tx.wait();
			const log = PositionalMarket.decodeLogs(receipt.events)[0];
			assert.eventEqual(log, 'MarketResolved', {
				result: Side.Up,
				oraclePrice: price,
				deposited: totalDeposited,
				poolFees: 0,
				creatorFees: 0,
			});
			assert.equal(log.event, 'MarketResolved');
			assert.bnEqual(log.args.result, Side.Up);
			assert.bnEqual(log.args.oraclePrice, price);
		});

		it('Result resolves correctly down.', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(sAUDKey, initialStrikePrice, now, creator, timeToMaturity);
			await fastForward(timeToMaturity + 1);
			now = await currentTime();
			const price = initialStrikePrice.sub(toUnit(1));

			await aggregator_sAUD.setLatestAnswer(convertToDecimals(initialStrikePriceValue - 1, 8), now);

			const tx = await manager.resolveMarket(market.address);
			assert.isTrue(await market.resolved());
			assert.bnEqual(await market.result(), Side.Down);
			assert.bnEqual((await market.oracleDetails()).finalPrice, price);

			const receipt = await tx.wait();
			const log = PositionalMarket.decodeLogs(receipt.events)[0];
			assert.equal(log.event, 'MarketResolved');
			assert.bnEqual(log.args.result, Side.Down);
			assert.bnEqual(log.args.oraclePrice, price);
		});

		it('A result equal to the strike price resolves up.', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(sAUDKey, initialStrikePrice, now, creator, timeToMaturity);
			await fastForward(timeToMaturity + 1);
			now = await currentTime();
			await aggregator_sAUD.setLatestAnswer(convertToDecimals(initialStrikePriceValue, 8), now);

			await manager.connect(creator).resolveMarket(market.address);
			assert.isTrue(await market.resolved());
			assert.bnEqual(await market.result(), Side.Up);
			assert.bnEqual((await market.oracleDetails()).finalPrice, initialStrikePrice);
		});

		it('Resolution cannot occur before maturity.', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(sAUDKey, initialStrikePrice, now, creator, timeToMaturity);
			assert.isFalse(await market.canResolve());
			await assert.revert(manager.connect(creator).resolveMarket(market.address), 'Not yet mature');
		});

		it('Resolution can only occur once.', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(sAUDKey, initialStrikePrice, now, creator, timeToMaturity);
			await fastForward(timeToMaturity + 1);
			now = await currentTime();
			await aggregator_sAUD.setLatestAnswer(convertToDecimals(initialStrikePriceValue, 8), now);

			assert.isTrue(await market.canResolve());
			await manager.resolveMarket(market.address);
			assert.isFalse(await market.canResolve());
			await assert.revert(manager.resolveMarket(market.address), 'Not an active market');
		});

		it('Resolution can occur if the price was updated within the maturity window but before maturity.', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(sAUDKey, initialStrikePrice, now, creator, timeToMaturity);
			await fastForward(timeToMaturity + 1);
			now = await currentTime();
			await aggregator_sAUD.setLatestAnswer(
				convertToDecimals(initialStrikePriceValue, 8),
				now - (maxOraclePriceAge - 60)
			);
			assert.isTrue(await market.canResolve());
			await manager.resolveMarket(market.address);
		});

		it('Empty mints do nothing.', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(sAUDKey, initialStrikePrice, now, creator, timeToMaturity);
			const tx1 = await market.mint(toUnit(0), {
				from: dummy,
			});

			assert.equal(tx1.logs.length, 0);
			assert.equal(tx1.receipt.rawLogs, 0);

			assert.bnEqual(await up.balanceOf(dummy), 0);
		});

		it('Burn options maximum', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(sAUDKey, initialStrikePrice, now, creator, timeToMaturity);

			const options = await market.options();
			up = await Position.at(options.up);
			down = await Position.at(options.down);

			// before burn
			let value = toUnit(3);
			totalDeposited = value;
			assert.bnEqual(await up.balanceOf(initialCreator), value);
			assert.bnEqual(await down.balanceOf(initialCreator), value);

			let minimum = await market.getMaximumBurnable(initialCreator);
			assert.bnEqual(minimum, value);

			const totalSupplies = await market.totalSupplies();
			assert.bnEqual(totalSupplies.up, value);
			assert.bnEqual(totalSupplies.down, value);

			// burn all
			const tx = await market.burnOptionsMaximum({ from: initialCreator });

			// after burn
			let valueZero = toUnit(0);
			totalDeposited = value;
			assert.bnEqual(await up.balanceOf(initialCreator), valueZero);
			assert.bnEqual(await down.balanceOf(initialCreator), valueZero);

			let minimum_after = await market.getMaximumBurnable(initialCreator);
			assert.bnEqual(minimum_after, valueZero);

			assert.eventEqual(tx.logs[0], 'OptionsBurned', {
				account: initialCreator,
				value: toUnit(3),
			});
		});

		it('Burn options some number lower then maximum', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(sAUDKey, initialStrikePrice, now, creator, timeToMaturity);

			const options = await market.options();
			up = await Position.at(options.up);
			down = await Position.at(options.down);

			// before burn
			let value = toUnit(3);
			totalDeposited = value;
			assert.bnEqual(await up.balanceOf(initialCreator), value);
			assert.bnEqual(await down.balanceOf(initialCreator), value);

			let minimum = await market.getMaximumBurnable(initialCreator);
			assert.bnEqual(minimum, value);

			const totalSupplies = await market.totalSupplies();
			assert.bnEqual(totalSupplies.up, value);
			assert.bnEqual(totalSupplies.down, value);

			// burn only one
			const tx = await market.burnOptions(toUnit(1), { from: initialCreator });

			// after burn
			let valueTwo = toUnit(2);
			totalDeposited = valueTwo;
			assert.bnEqual(await up.balanceOf(initialCreator), valueTwo);
			assert.bnEqual(await down.balanceOf(initialCreator), valueTwo);

			let minimum_after = await market.getMaximumBurnable(initialCreator);
			assert.bnEqual(minimum_after, valueTwo);

			assert.eventEqual(tx.logs[0], 'OptionsBurned', {
				account: initialCreator,
				value: toUnit(1),
			});
		});

		it('Burn options some number more then maximum', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(sAUDKey, initialStrikePrice, now, creator, timeToMaturity);

			const options = await market.options();
			up = await Position.at(options.up);
			down = await Position.at(options.down);

			// before burn
			let value = toUnit(3);
			totalDeposited = value;
			assert.bnEqual(await up.balanceOf(initialCreator), value);
			assert.bnEqual(await down.balanceOf(initialCreator), value);

			let minimum = await market.getMaximumBurnable(initialCreator);
			assert.bnEqual(minimum, value);

			const totalSupplies = await market.totalSupplies();
			assert.bnEqual(totalSupplies.up, value);
			assert.bnEqual(totalSupplies.down, value);

			// burn 5 but has 3
			await assert.revert(
				market.burnOptions(toUnit(5), { from: initialCreator }),
				'There is not enough options!'
			);
		});

		it('Burn options zero amount', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(sAUDKey, initialStrikePrice, now, creator, timeToMaturity);

			const options = await market.options();
			up = await Position.at(options.up);
			down = await Position.at(options.down);

			// before burn
			let value = toUnit(3);
			totalDeposited = value;
			assert.bnEqual(await up.balanceOf(initialCreator), value);
			assert.bnEqual(await down.balanceOf(initialCreator), value);

			let minimum = await market.getMaximumBurnable(initialCreator);
			assert.bnEqual(minimum, value);

			const totalSupplies = await market.totalSupplies();
			assert.bnEqual(totalSupplies.up, value);
			assert.bnEqual(totalSupplies.down, value);

			// burn 5 but has 3
			await assert.revert(
				market.burnOptions(toUnit(0), { from: initialCreator }),
				'Can not burn zero amount!'
			);
		});

		it('Mint less than $0.01 revert.', async () => {
			await assert.revert(market.mint(toUnit('0.0099'), { from: dummy }), 'Balance < $0.01');
		});
	});

	describe('Pauses', () => {
		it('Resolution cannot occur if the manager is paused', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(sAUDKey, initialStrikePrice, now, creator, timeToMaturity);
			await fastForward(timeToMaturity + 1);

			await aggregator_sAUD.setLatestAnswer(convertToDecimals(0.7, 8), await currentTime());

			await manager.connect(creator).setPaused(true);
			await assert.revert(
				manager.connect(creator).resolveMarket(market.address),
				'This action cannot be performed while the contract is paused'
			);
		});
		it('Minting fails when the manager is paused.', async () => {
			await manager.connect(creator).setPaused(false);
			let now = await currentTime();
			await createMarketAndMintMore(sAUDKey, initialStrikePrice, now, creator, timeToMaturity);
			await manager.connect(creator).setPaused(true);
			await assert.revert(
				market.mint(toUnit(1), { from: dummy }),
				'This action cannot be performed while the contract is paused'
			);
		});
	});

	describe('Phases', () => {
		it('Can proceed through the phases properly.', async () => {
			await manager.connect(creator).setPaused(false);
			let now = await currentTime();
			await createMarketAndMintMore(sAUDKey, initialStrikePrice, now, creator, timeToMaturity);
			assert.bnEqual(await market.phase(), Phase.Trading);
			await fastForward(timeToMaturity + 1);
			assert.bnEqual(await market.phase(), Phase.Maturity);
			await fastForward(expiryDuration + 1);

			now = await currentTime();
			await aggregator_sAUD.setLatestAnswer(
				convertToDecimals(initialStrikePriceValue, 8),
				await currentTime()
			);

			await manager.connect(creator).resolveMarket(market.address);

			assert.bnEqual(await market.phase(), Phase.Expiry);
		});

		it('Market can expire early if everything has been exercised.', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(sAUDKey, initialStrikePrice, now, creator, timeToMaturity);
			await fastForward(timeToMaturity + 1);

			now = await currentTime();
			await aggregator_sAUD.setLatestAnswer(
				convertToDecimals(initialStrikePriceValue, 8),
				await currentTime()
			);
			await manager.connect(creator).resolveMarket(market.address);

			assert.bnEqual(await market.phase(), Phase.Maturity);
			await market.exerciseOptions({ from: initialCreator });
			assert.bnEqual(await market.phase(), Phase.Expiry);
		});
	});

	describe('Exercising Options', () => {
		it('Exercising options yields the proper balances.', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(sAUDKey, initialStrikePrice, now, creator, timeToMaturity);

			const options = await market.options();
			up = await Position.at(options.up);
			down = await Position.at(options.down);

			let susdBalance = toUnit(10);
			await sUSDSynth.issue(exersicer, susdBalance);
			await sUSDSynth.approve(manager.address, sUSDQty, { from: exersicer });

			assert.bnEqual(await sUSDSynth.balanceOf(exersicer), susdBalance);

			await market.mint(susdBalance, { from: exersicer });

			// susd is transfered out after minting and options are in the wallet
			assert.bnEqual(await sUSDSynth.balanceOf(exersicer), toBN(0));

			let fees = await market.fees();
			let _feeMultiplier = toUnit(1).sub(fees[0].add(fees[1]));
			let upBalanceAfterMinting = multiplyDecimalRound(_feeMultiplier, toUnit(10));

			assert.bnEqual(await up.balanceOf(exersicer), upBalanceAfterMinting);

			await fastForward(timeToMaturity + 100);

			now = await currentTime();
			const price = (await market.oracleDetails()).strikePrice;

			await aggregator_sAUD.setLatestAnswer(price, await currentTime());
			await manager.resolveMarket(market.address);

			assert.bnEqual(await up.balanceOf(exersicer), upBalanceAfterMinting);

			const tx1 = await market.exerciseOptions({ from: exersicer });

			// options no longer in the wallet
			assert.bnEqual(await up.balanceOf(exersicer), toBN(0));

			let logs = Position.decodeLogs(tx1.receipt.rawLogs);
			assert.equal(logs.length, 5);
			assert.equal(logs[0].address, up.address);
			assert.equal(logs[0].event, 'Transfer');
			assert.equal(logs[0].args.from, exersicer);
			assert.equal(logs[0].args.to, '0x' + '0'.repeat(40));
			assert.bnClose(logs[0].args.value, upBalanceAfterMinting, 1);
			assert.equal(logs[1].address, up.address);
			assert.equal(logs[1].event, 'Burned');
			assert.equal(logs[1].args.account, exersicer);
			assert.bnClose(logs[1].args.value, upBalanceAfterMinting, 1);
			assert.equal(tx1.logs.length, 1);
			assert.equal(tx1.logs[0].event, 'OptionsExercised');
			assert.equal(tx1.logs[0].args.account, exersicer);
			assert.bnClose(tx1.logs[0].args.value, upBalanceAfterMinting, 1);
		});

		it('Exercising options resolves an unresolved market.', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(sAUDKey, initialStrikePrice, now, creator, timeToMaturity);
			await market.mint(toUnit(1), { from: exersicer });
			await fastForward(timeToMaturity + 100);
			await aggregator_sAUD.setLatestAnswer(
				(await market.oracleDetails()).strikePrice,
				await currentTime()
			);
			assert.isFalse(await market.resolved());
			await market.exerciseOptions({ from: exersicer });
			assert.isTrue(await market.resolved());
		});

		it('Exercising options with none owned reverts.', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(sAUDKey, initialStrikePrice, now, creator, timeToMaturity);
			await fastForward(timeToMaturity + 100);
			now = await currentTime();
			const price = (await market.oracleDetails()).strikePrice;
			await aggregator_sAUD.setLatestAnswer(price, await currentTime());

			await manager.resolveMarket(market.address);

			await assert.revert(market.exerciseOptions({ from: exersicer }), 'Nothing to exercise');
		});

		it('Options cannot be exercised if the manager is paused.', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(sAUDKey, initialStrikePrice, now, creator, timeToMaturity);

			await market.mint(toUnit(1), { from: exersicer });
			await fastForward(timeToMaturity + 100);
			await aggregator_sAUD.setLatestAnswer(
				(await market.oracleDetails()).strikePrice,
				await currentTime()
			);

			await manager.resolveMarket(market.address);

			await manager.connect(creator).setPaused(true);
			await assert.revert(
				market.exerciseOptions({ from: exersicer }),
				'This action cannot be performed while the contract is paused'
			);
		});

		it('Options can be exercised if transferred to another account.', async () => {
			await manager.connect(creator).setPaused(false);
			let now = await currentTime();
			await createMarketAndMintMore(sAUDKey, initialStrikePrice, now, creator, timeToMaturity);

			await market.mint(toUnit(2), { from: exersicer });
			const options = await market.options();
			up = await Position.at(options.up);
			down = await Position.at(options.down);

			await up.transfer(dummy, toUnit(1), { from: exersicer });
			await fastForward(timeToMaturity + 100);
			now = await currentTime();
			const price = (await market.oracleDetails()).strikePrice;
			await aggregator_sAUD.setLatestAnswer(price, await currentTime());

			await manager.resolveMarket(market.address);

			let tx = await market.exerciseOptions({ from: dummy });
			let logs = await getDecodedLogs({
				hash: tx.receipt.transactionHash,
				contracts: [market, up],
			});

			assert.equal(logs.length, 4);
			decodedEventEqual({
				event: 'Transfer',
				emittedFrom: up.address,
				args: [dummy, ZERO_ADDRESS, toUnit(1)],
				log: logs[0],
			});
			decodedEventEqual({
				event: 'Burned',
				emittedFrom: up.address,
				args: [dummy, toUnit(1)],
				log: logs[1],
			});
		});
	});

	describe('Expiry', () => {
		it('Expired markets destroy themselves and their options.', async () => {
			await manager.connect(creator).setPaused(false);
			let now = await currentTime();
			await createMarketAndMintMore(sAUDKey, initialStrikePrice, now, creator, timeToMaturity);

			const options = await market.options();
			up = await Position.at(options.up);
			down = await Position.at(options.down);

			const marketAddress = market.address;
			const upAddress = up.address;
			const downAddress = down.address;

			await fastForward(expiryDuration.add(toBN(timeToMaturity + 10)));
			await aggregator_sAUD.setLatestAnswer(initialStrikePriceValue, await currentTime());

			await manager.resolveMarket(market.address);
			await manager.connect(creator).expireMarkets([market.address]);

			assert.equal(await web3.eth.getCode(marketAddress), '0x');
			assert.equal(await web3.eth.getCode(upAddress), '0x');
			assert.equal(await web3.eth.getCode(downAddress), '0x');
		});

		it('Unresolved markets cannot be expired', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(sAUDKey, initialStrikePrice, now, creator, timeToMaturity);
			now = await currentTime();

			await fastForward(expiryDuration.add(toBN(timeToMaturity + 10)));
			await assert.revert(
				manager.connect(creator).expireMarkets([market.address]),
				'Unexpired options remaining'
			);
		});

		it('Market cannot be expired before its time', async () => {
			let now = await currentTime();

			await createMarketAndMintMore(sAUDKey, initialStrikePrice, now, creator, timeToMaturity);

			now = await currentTime();

			await fastForward(timeToMaturity + 10);
			now = await currentTime();
			await aggregator_sAUD.setLatestAnswer(initialStrikePriceValue, await currentTime());

			await manager.resolveMarket(market.address);
			await assert.revert(
				manager.connect(creator).expireMarkets([market.address]),
				'Unexpired options remaining'
			);
		});

		it('Market can be expired early if all options are exercised', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(sAUDKey, initialStrikePrice, now, creator, timeToMaturity);

			await fastForward(timeToMaturity + 10);
			await aggregator_sAUD.setLatestAnswer(initialStrikePriceValue, await currentTime());

			await market.exerciseOptions({ from: initialCreator });
			const marketAddress = market.address;
			await manager.connect(creator).expireMarkets([market.address]);
			assert.equal(await web3.eth.getCode(marketAddress), '0x');
		});

		it('Market cannot be expired except by the manager', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(sAUDKey, initialStrikePrice, now, creator, timeToMaturity);

			await fastForward(expiryDuration.add(toBN(timeToMaturity + 10)));
			await aggregator_sAUD.setLatestAnswer(initialStrikePriceValue, await currentTime());

			await manager.resolveMarket(market.address);

			await onlyGivenAddressCanInvoke({
				fnc: market.expire,
				args: [initialCreator],
				accounts,
				skipPassCheck: true,
				reason: 'Only the contract owner may perform this action',
			});
		});

		it('Expired market remits any unclaimed options and extra sUSD to the caller. [ @cov-skip ]', async () => {
			sUSDSynth.issue(secondCreator, toUnit(3));
			sUSDSynth.approve(manager.address, toUnit(3), { from: secondCreator });

			const creatorBalance = await sUSDSynth.balanceOf(secondCreator);

			let now = await currentTime();
			await createMarketAndMintMore(
				sAUDKey,
				initialStrikePrice,
				now,
				secondCreatorSigner,
				timeToMaturity
			);

			let fees = await market.fees();
			let _feeMultiplier = toUnit(1).sub(fees[0].add(fees[1]));
			// creator fee goes back to creator
			let valueAfterFees = multiplyDecimalRound(_feeMultiplier, toUnit(1)).add(toUnit(4));

			await sUSDSynth.transfer(market.address, toUnit(1));

			await sUSDSynth.issue(exersicer, sUSDQty);
			await market.mint(toUnit(1), { from: exersicer });

			const deposited = await market.deposited();
			const preTotalDeposited = await manager.totalDeposited();

			await fastForward(expiryDuration.add(toBN(timeToMaturity + 10)));
			await aggregator_sAUD.setLatestAnswer(initialStrikePriceValue, await currentTime());

			await manager.resolveMarket(market.address);
			await manager.connect(creator).expireMarkets([market.address]);

			assert.bnEqual(await manager.totalDeposited(), preTotalDeposited.sub(deposited.toString()));
		});

		it('Expired market emits no transfer if there is nothing to remit.', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(sAUDKey, initialStrikePrice, now, creator, timeToMaturity);

			await fastForward(expiryDuration.add(toBN(timeToMaturity + 10)));
			await aggregator_sAUD.setLatestAnswer(initialStrikePriceValue, await currentTime());

			const marketAddress = market.address;
			await market.exerciseOptions({ from: initialCreator });

			const creatorBalance = await sUSDSynth.balanceOf(managerOwner);
			const tx = await manager.connect(creator).expireMarkets([market.address]);
			const postCreatorBalance = await sUSDSynth.balanceOf(managerOwner);
			assert.bnEqual(postCreatorBalance, creatorBalance);

			const log = await transactionEvent(tx, 'MarketExpired');
			assert.eventEqual(log, 'MarketExpired', {
				market: marketAddress,
			});

			const receipt = await tx.wait();
			const logs = Synth.decodeLogs(receipt.events);
			assert.equal(logs.length, 0);
		});

		it('Market cannot be expired if the manager is paused', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(sAUDKey, initialStrikePrice, now, creator, timeToMaturity);

			await fastForward(expiryDuration.add(toBN(timeToMaturity + 10)));
			await aggregator_sAUD.setLatestAnswer(initialStrikePriceValue, await currentTime());

			await manager.resolveMarket(market.address);
			await manager.connect(creator).setPaused(true);
			await assert.revert(
				manager.connect(creator).expireMarkets([market.address]),
				'This action cannot be performed while the contract is paused'
			);
			await manager.connect(creator).setPaused(false);
		});
	});
});
