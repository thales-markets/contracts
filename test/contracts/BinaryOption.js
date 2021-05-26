'use strict';

const { artifacts, contract, web3 } = require('hardhat');
const { toBN } = web3.utils;

const { assert, addSnapshotBeforeRestoreAfterEach } = require('./common');
const {
	fastForward,
	toUnit,
	currentTime,
	multiplyDecimalRound,
	divideDecimalRound,
} = require('../utils')();
const { toBytes32 } = require('../..');
const { setupContract, setupAllContracts } = require('./setup');

const {
	ensureOnlyExpectedMutativeFunctions,
	onlyGivenAddressCanInvoke,
	getEventByName,
	getDecodedLogs,
	decodedEventEqual,
} = require('./helpers');

let BinaryOptionMarketFactory, factory, BinaryOptionMarketManager, manager, addressResolver;
let BinaryOptionMarket,
	exchangeRates,
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

async function createMarketAndMintMore(
	sAUDKey,
	initialStrikePrice,
	now,
	initialCreator,
	timeToMaturityParam
) {
	const result = await manager.createMarket(
		sAUDKey,
		initialStrikePrice,
		now + timeToMaturityParam,
		toUnit(2),
		{
			from: initialCreator,
		}
	);
	market = await BinaryOptionMarket.at(
		getEventByName({ tx: result, name: 'MarketCreated' }).args.market
	);
	await market.mint(toUnit(1), {
		from: initialCreator,
	});
}

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

	const sAUDKey = toBytes32('sAUD');
	const iAUDKey = toBytes32('iAUD');

	let timeToMaturity = 200;
	let totalDepositedAfterFees;

	const Side = {
		Long: toBN(0),
		Short: toBN(1),
	};

	const createMarket = async (man, oracleKey, strikePrice, maturity, initialMint, creator) => {
		const tx = await man.createMarket(oracleKey, strikePrice, maturity, initialMint, {
			from: creator,
		});
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
			ExchangeRates: exchangeRates,
			SynthsUSD: sUSDSynth,
		} = await setupAllContracts({
			accounts,
			synths: ['sUSD'],
			contracts: [
				'FeePool',
				'ExchangeRates',
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

		oracle = await exchangeRates.oracle();

		await exchangeRates.updateRates([sAUDKey], [toUnit(5)], await currentTime(), {
			from: oracle,
		});

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
			console.log('Manager is:' + manager.address);
			assert.notEqual(ZERO_ADDRESS, manager.address);
		});

		it('Only expected functions are mutative', async () => {
			ensureOnlyExpectedMutativeFunctions({
				abi: manager.abi,
				ignoreParents: ['Owned', 'Pausable'],
				expected: [
					'createMarket',
					'decrementTotalDeposited',
					'expireMarkets',
					'incrementTotalDeposited',
					'migrateMarkets',
					'receiveMarkets',
					'resolveMarket',
					'setBinaryOptionsMarketFactory',
					'setFeeAddress',
					'setCreatorCapitalRequirement',
					'setCreatorFee',
					'setExpiryDuration',
					'setMarketCreationEnabled',
					'setMaxOraclePriceAge',
					'setMaxTimeToMaturity',
					'setMigratingManager',
					'setPoolFee',
					'transferSusdTo',
				],
			});
		});

		it('Static parameters are set properly', async () => {
			const durations = await manager.durations();
			assert.bnEqual(durations.expiryDuration, expiryDuration);
			assert.bnEqual(durations.maxOraclePriceAge, maxOraclePriceAge);
			assert.bnEqual(durations.maxTimeToMaturity, maxTimeToMaturity);

			const fees = await manager.fees();
			assert.bnEqual(fees.poolFee, initialPoolFee);
			assert.bnEqual(fees.creatorFee, initialCreatorFee);

			const capitalRequirement = await manager.capitalRequirement();
			assert.bnEqual(capitalRequirement, capitalRequirement);
			assert.bnEqual(await manager.totalDeposited(), toBN(0));
			assert.bnEqual(await manager.marketCreationEnabled(), true);
			assert.equal(await manager.resolver(), addressResolver.address);
			assert.equal(await manager.owner(), accounts[1]);
			assert.equal(await manager.feeAddress(), initialFeeAddress);
		});
	});

	describe('BinaryOptionMarketFactory', () => {
		it('Can create a market', async () => {
			const now = await currentTime();

			const result = await manager.createMarket(sAUDKey, initialStrikePrice, now + 200, toUnit(2), {
				from: initialCreator,
			});

			assert.eventEqual(getEventByName({ tx: result, name: 'MarketCreated' }), 'MarketCreated', {
				creator: initialCreator,
				oracleKey: sAUDKey,
				strikePrice: initialStrikePrice,
				maturityDate: toBN(now + timeToMaturity),
				expiryDate: toBN(now + timeToMaturity).add(expiryDuration),
			});

			const decodedLogs = BinaryOptionMarket.decodeLogs(result.receipt.rawLogs);
			assert.eventEqual(decodedLogs[1], 'Mint', {
				side: Side.Long,
				account: initialCreator,
				value: toUnit(2),
			});
			assert.eventEqual(decodedLogs[2], 'Mint', {
				side: Side.Short,
				account: initialCreator,
				value: toUnit(2),
			});

			market = await BinaryOptionMarket.at(
				getEventByName({ tx: result, name: 'MarketCreated' }).args.market
			);

			const times = await market.times();
			assert.bnEqual(times.maturity, toBN(now + 200));
			assert.bnEqual(times.expiry, toBN(now + 200).add(expiryDuration));
			const oracleDetails = await market.oracleDetails();
			assert.equal(oracleDetails.key, sAUDKey);
			assert.bnEqual(oracleDetails.strikePrice, toUnit(100));
			assert.equal(await market.creator(), initialCreator);
			assert.equal(await market.owner(), manager.address);
			assert.equal(await market.resolver(), addressResolver.address);

			const fees = await market.fees();
			assert.bnEqual(fees.poolFee, initialPoolFee);
			assert.bnEqual(fees.creatorFee, initialCreatorFee);

			assert.bnEqual(await manager.numActiveMarkets(), toBN(1));
			assert.equal((await manager.activeMarkets(0, 100))[0], market.address);
			assert.bnEqual(await manager.numMaturedMarkets(), toBN(0));
			assert.equal((await manager.maturedMarkets(0, 100)).length, 0);
		});

		it('Total Minted options', async () => {
			let totalSupplies = await market.totalSupplies();
			console.log('Total supplies are: ' + totalSupplies[0] + ' and ' + totalSupplies[1]);
			assert.bnEqual(totalSupplies[0], toUnit(2));
		});

		it('Held by owner', async () => {
			const options = await market.options();
			long = await BinaryOption.at(options.long);
			short = await BinaryOption.at(options.short);
			console.log('Total long and short addresses are: ' + long.address + ' and ' + short.address);
			assert.bnEqual(await long.balanceOf(initialCreator), toUnit(2));
			assert.bnEqual(await short.balanceOf(initialCreator), toUnit(2));
			assert.bnEqual(await long.totalSupply(), toUnit(2));
			assert.bnEqual(await short.totalSupply(), toUnit(2));
		});

		it('Static option parameters are set properly', async () => {
			assert.equal(await long.name(), 'Binary Option Long');
			assert.equal(await long.symbol(), 'sLONG');
			assert.bnEqual(await long.decimals(), toBN(18));
			assert.equal(await long.market(), market.address);
		});

		it('Mint more and check balance', async () => {
			await market.mint(toUnit(1), {
				from: initialCreator,
			});

			let totalAdditionalMintedNoFees = toUnit(1);

			let fees = await market.fees();
			console.log('fees are pool:' + fees[0] + ' creator:' + fees[1]);

			let _feeMultiplier = toUnit(1).sub(fees[0].add(fees[1]));
			let valueAfterFees = multiplyDecimalRound(_feeMultiplier, toUnit(1)).add(toUnit(2));
			totalDepositedAfterFees = valueAfterFees;
			console.log('valueAfterFees ' + valueAfterFees);
			assert.bnEqual(await long.balanceOf(initialCreator), valueAfterFees);
			assert.bnEqual(await short.balanceOf(initialCreator), valueAfterFees);

			const totalSupplies = await market.totalSupplies();
			assert.bnEqual(totalSupplies.long, valueAfterFees);
			assert.bnEqual(totalSupplies.short, valueAfterFees);
		});

		it('Only expected functions are mutative', async () => {
			ensureOnlyExpectedMutativeFunctions({
				abi: market.abi,
				ignoreParents: ['MinimalProxyFactory', 'OwnedWithInit'],
				expected: ['mint', 'resolve', 'exerciseOptions', 'expire', 'initialize'],
			});
		});

		it('Current oracle price and timestamp are correct.', async () => {
			const now = await currentTime();
			const price = toUnit(0.7);
			await exchangeRates.updateRates([sAUDKey], [price], now, { from: oracle });
			const result = await market.oraclePriceAndTimestamp();

			assert.bnEqual(result.price, price);
			assert.bnEqual(result.updatedAt, now);
			console.log('Price ' + result.price);
			console.log('UpdatedAt ' + result.updatedAt);
		});

		it('Result can fluctuate while unresolved, but is fixed after resolution.', async () => {
			const two = toBN(2);
			assert.isFalse(await market.resolved());

			let now = await currentTime();
			await exchangeRates.updateRates([sAUDKey], [initialStrikePrice.div(two)], now, {
				from: oracle,
			});
			assert.bnEqual(await market.result(), Side.Short);
			now = await currentTime();
			await exchangeRates.updateRates([sAUDKey], [initialStrikePrice.mul(two)], now, {
				from: oracle,
			});
			assert.bnEqual(await market.result(), Side.Long);

			await fastForward(timeToMaturity + 10);
			now = await currentTime();

			await exchangeRates.updateRates([sAUDKey], [initialStrikePrice.mul(two)], now, {
				from: oracle,
			});
			await manager.resolveMarket(market.address);

			assert.isTrue(await market.resolved());
			now = await currentTime();
			await exchangeRates.updateRates([sAUDKey], [initialStrikePrice.div(two)], now, {
				from: oracle,
			});
			assert.bnEqual(await market.result(), Side.Long);
			now = await currentTime();
			await exchangeRates.updateRates([sAUDKey], [initialStrikePrice.mul(two)], now, {
				from: oracle,
			});
			assert.bnEqual(await market.result(), Side.Long);
		});

		it('Result resolves correctly long.', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(
				sAUDKey,
				initialStrikePrice,
				now,
				initialCreator,
				timeToMaturity
			);
			now = await currentTime();
			await fastForward(timeToMaturity + 1);
			now = await currentTime();
			const price = initialStrikePrice.add(toBN(1));
			await exchangeRates.updateRates([sAUDKey], [price], now, { from: oracle });
			const tx = await manager.resolveMarket(market.address);
			assert.bnEqual(await market.result(), Side.Long);
			assert.isTrue(await market.resolved());
			assert.bnEqual((await market.oracleDetails()).finalPrice, price);

			const poolFees = multiplyDecimalRound(toUnit(1), initialPoolFee);
			const creatorFees = multiplyDecimalRound(toUnit(1), initialCreatorFee);

			const log = BinaryOptionMarket.decodeLogs(tx.receipt.rawLogs)[0];
			assert.eventEqual(log, 'MarketResolved', {
				result: Side.Long,
				oraclePrice: price,
				oracleTimestamp: now,
				deposited: totalDepositedAfterFees,
				poolFees,
				creatorFees,
			});
			assert.equal(log.event, 'MarketResolved');
			assert.bnEqual(log.args.result, Side.Long);
			assert.bnEqual(log.args.oraclePrice, price);
			assert.bnEqual(log.args.oracleTimestamp, now);
		});

		it('Result resolves correctly short.', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(
				sAUDKey,
				initialStrikePrice,
				now,
				initialCreator,
				timeToMaturity
			);
			await fastForward(timeToMaturity + 1);
			now = await currentTime();
			const price = initialStrikePrice.sub(toBN(1));

			await exchangeRates.updateRates([sAUDKey], [price], now, { from: oracle });

			const tx = await manager.resolveMarket(market.address);
			assert.isTrue(await market.resolved());
			assert.bnEqual(await market.result(), Side.Short);
			assert.bnEqual((await market.oracleDetails()).finalPrice, price);

			const log = BinaryOptionMarket.decodeLogs(tx.receipt.rawLogs)[0];
			assert.equal(log.event, 'MarketResolved');
			assert.bnEqual(log.args.result, Side.Short);
			assert.bnEqual(log.args.oraclePrice, price);
			assert.bnEqual(log.args.oracleTimestamp, now);
		});

		it('A result equal to the strike price resolves long.', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(
				sAUDKey,
				initialStrikePrice,
				now,
				initialCreator,
				timeToMaturity
			);
			await fastForward(timeToMaturity + 1);
			now = await currentTime();
			await exchangeRates.updateRates([sAUDKey], [initialStrikePrice], now, { from: oracle });
			await manager.resolveMarket(market.address);
			assert.isTrue(await market.resolved());
			assert.bnEqual(await market.result(), Side.Long);
			assert.bnEqual((await market.oracleDetails()).finalPrice, initialStrikePrice);
		});

		it('Resolution cannot occur before maturity.', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(
				sAUDKey,
				initialStrikePrice,
				now,
				initialCreator,
				timeToMaturity
			);
			assert.isFalse(await market.canResolve());
			await assert.revert(manager.resolveMarket(market.address), 'Not yet mature');
		});

		it('Resolution can only occur once.', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(
				sAUDKey,
				initialStrikePrice,
				now,
				initialCreator,
				timeToMaturity
			);
			await fastForward(timeToMaturity + 1);
			now = await currentTime();
			await exchangeRates.updateRates([sAUDKey], [initialStrikePrice], now, { from: oracle });
			assert.isTrue(await market.canResolve());
			await manager.resolveMarket(market.address);
			assert.isFalse(await market.canResolve());
			await assert.revert(manager.resolveMarket(market.address), 'Not an active market');
		});

		it('Resolution can occur if the price was updated within the maturity window but before maturity.', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(
				sAUDKey,
				initialStrikePrice,
				now,
				initialCreator,
				timeToMaturity
			);
			await fastForward(timeToMaturity + 1);
			now = await currentTime();
			await exchangeRates.updateRates(
				[sAUDKey],
				[initialStrikePrice],
				now - (maxOraclePriceAge - 60),
				{
					from: oracle,
				}
			);
			assert.isTrue(await market.canResolve());
			await manager.resolveMarket(market.address);
		});

		it('Resolution cannot occur if the price is too old.', async () => {
			let result = await market.oraclePriceAndTimestamp();
			let now = await currentTime();

			let timeToMaturityExtended = 60 * 61 + 200;

			await createMarketAndMintMore(
				sAUDKey,
				initialStrikePrice,
				now,
				initialCreator,
				timeToMaturityExtended
			);
			await fastForward(maxOraclePriceAge + 1);
			result = await market.oraclePriceAndTimestamp();
			now = await currentTime();
			assert.isFalse(await market.canResolve());
			await assert.revert(manager.resolveMarket(market.address), 'Price is stale');
		});

		it('Resolution properly remits the collected fees.', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(
				sAUDKey,
				initialStrikePrice,
				now,
				initialCreator,
				timeToMaturity
			);

			await fastForward(timeToMaturity + 1);
			await exchangeRates.updateRates([sAUDKey], [toUnit(0.7)], await currentTime(), {
				from: oracle,
			});

			const feeAddress = await manager.feeAddress();

			const [creatorPrebalance, poolPrebalance, preDeposits] = await Promise.all([
				sUSDSynth.balanceOf(initialCreator),
				sUSDSynth.balanceOf(feeAddress),
				market.deposited(),
			]);

			const tx = await manager.resolveMarket(market.address);
			const logs = Synth.decodeLogs(tx.receipt.rawLogs);

			const [creatorPostbalance, poolPostbalance, postDeposits] = await Promise.all([
				sUSDSynth.balanceOf(initialCreator),
				sUSDSynth.balanceOf(feeAddress),
				market.deposited(),
			]);

			const poolFee = multiplyDecimalRound(toUnit(1), initialPoolFee);
			const creatorFee = multiplyDecimalRound(toUnit(1), initialCreatorFee);

			const poolReceived = poolPostbalance.sub(poolPrebalance);
			const creatorReceived = creatorPostbalance.sub(creatorPrebalance);

			assert.bnClose(poolReceived, poolFee, 1);
			assert.bnClose(creatorReceived, creatorFee, 1);
			assert.bnClose(postDeposits, preDeposits.sub(poolFee.add(creatorFee)));

			assert.eventEqual(logs[0], 'Transfer', {
				from: market.address,
				to: feeAddress,
				value: poolReceived,
			});
			assert.eventEqual(logs[1], 'Transfer', {
				from: market.address,
				to: initialCreator,
				value: creatorReceived,
			});
		});

		it('Empty mints do nothing.', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(
				sAUDKey,
				initialStrikePrice,
				now,
				initialCreator,
				timeToMaturity
			);
			const tx1 = await market.mint(toUnit(0), {
				from: dummy,
			});

			assert.equal(tx1.logs.length, 0);
			assert.equal(tx1.receipt.rawLogs, 0);

			assert.bnEqual(await long.balanceOf(dummy), 0);
		});

		it('Mint less than $0.01 revert.', async () => {
			await assert.revert(market.mint(toUnit('0.0099'), { from: dummy }), 'Balance < $0.01');
		});
	});

	describe('Pauses', () => {
		it('Resolution cannot occur if the manager is paused', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(
				sAUDKey,
				initialStrikePrice,
				now,
				initialCreator,
				timeToMaturity
			);
			await fastForward(timeToMaturity + 1);
			await exchangeRates.updateRates([sAUDKey], [toUnit(0.7)], await currentTime(), {
				from: oracle,
			});
			await manager.setPaused(true, { from: accounts[1] });
			await assert.revert(
				manager.resolveMarket(market.address),
				'This action cannot be performed while the contract is paused'
			);
		});
		it('Minting fails when the manager is paused.', async () => {
			await manager.setPaused(false, { from: accounts[1] });
			let now = await currentTime();
			await createMarketAndMintMore(
				sAUDKey,
				initialStrikePrice,
				now,
				initialCreator,
				timeToMaturity
			);
			await manager.setPaused(true, { from: accounts[1] });
			await assert.revert(
				market.mint(toUnit(1), { from: dummy }),
				'This action cannot be performed while the contract is paused'
			);
		});
	});

	describe('Phases', () => {
		it('Can proceed through the phases properly.', async () => {
			await manager.setPaused(false, { from: accounts[1] });
			let now = await currentTime();
			await createMarketAndMintMore(
				sAUDKey,
				initialStrikePrice,
				now,
				initialCreator,
				timeToMaturity
			);
			assert.bnEqual(await market.phase(), Phase.Trading);
			await fastForward(timeToMaturity + 1);
			assert.bnEqual(await market.phase(), Phase.Maturity);
			await fastForward(expiryDuration + 1);

			now = await currentTime();
			await exchangeRates.updateRates([sAUDKey], [initialStrikePrice], now, {
				from: oracle,
			});
			await manager.resolveMarket(market.address);

			assert.bnEqual(await market.phase(), Phase.Expiry);
		});

		it('Market can expire early if everything has been exercised.', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(
				sAUDKey,
				initialStrikePrice,
				now,
				initialCreator,
				timeToMaturity
			);
			await fastForward(timeToMaturity + 1);

			now = await currentTime();
			await exchangeRates.updateRates([sAUDKey], [initialStrikePrice], now, {
				from: oracle,
			});
			await manager.resolveMarket(market.address);

			assert.bnEqual(await market.phase(), Phase.Maturity);
			await market.exerciseOptions({ from: initialCreator });
			assert.bnEqual(await market.phase(), Phase.Expiry);
		});
	});

	describe('Exercising Options', () => {
		it('Exercising options yields the proper balances.', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(
				sAUDKey,
				initialStrikePrice,
				now,
				initialCreator,
				timeToMaturity
			);

			const options = await market.options();
			long = await BinaryOption.at(options.long);
			short = await BinaryOption.at(options.short);

			let susdBalance = toUnit(10);
			await sUSDSynth.issue(exersizer, susdBalance);
			await sUSDSynth.approve(manager.address, sUSDQty, { from: exersizer });

			assert.bnEqual(await sUSDSynth.balanceOf(exersizer), susdBalance);

			await market.mint(susdBalance, { from: exersizer });

			// susd is transfered out after minting and options are in the wallet
			assert.bnEqual(await sUSDSynth.balanceOf(exersizer), toBN(0));

			let fees = await market.fees();
			let _feeMultiplier = toUnit(1).sub(fees[0].add(fees[1]));
			let longBalanceAfterMinting = multiplyDecimalRound(_feeMultiplier, toUnit(10));

			assert.bnEqual(await long.balanceOf(exersizer), longBalanceAfterMinting);

			await fastForward(timeToMaturity + 100);

			now = await currentTime();
			const price = (await market.oracleDetails()).strikePrice;
			await exchangeRates.updateRates([sAUDKey], [price], now, { from: oracle });
			await manager.resolveMarket(market.address);

			assert.bnEqual(await long.balanceOf(exersizer), longBalanceAfterMinting);

			const tx1 = await market.exerciseOptions({ from: exersizer });

			// options no longer in the wallet
			assert.bnEqual(await long.balanceOf(exersizer), toBN(0));

			let logs = BinaryOption.decodeLogs(tx1.receipt.rawLogs);
			assert.equal(logs.length, 5);
			assert.equal(logs[0].address, long.address);
			assert.equal(logs[0].event, 'Transfer');
			assert.equal(logs[0].args.from, exersizer);
			assert.equal(logs[0].args.to, '0x' + '0'.repeat(40));
			assert.bnClose(logs[0].args.value, longBalanceAfterMinting, 1);
			assert.equal(logs[1].address, long.address);
			assert.equal(logs[1].event, 'Burned');
			assert.equal(logs[1].args.account, exersizer);
			assert.bnClose(logs[1].args.value, longBalanceAfterMinting, 1);
			assert.equal(tx1.logs.length, 1);
			assert.equal(tx1.logs[0].event, 'OptionsExercised');
			assert.equal(tx1.logs[0].args.account, exersizer);
			assert.bnClose(tx1.logs[0].args.value, longBalanceAfterMinting, 1);
		});

		it('Exercising options resolves an unresolved market.', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(
				sAUDKey,
				initialStrikePrice,
				now,
				initialCreator,
				timeToMaturity
			);
			await market.mint(toUnit(1), { from: exersizer });
			await fastForward(timeToMaturity + 100);
			await exchangeRates.updateRates(
				[sAUDKey],
				[(await market.oracleDetails()).strikePrice],
				await currentTime(),
				{ from: oracle }
			);
			assert.isFalse(await market.resolved());
			await market.exerciseOptions({ from: exersizer });
			assert.isTrue(await market.resolved());
		});

		it('Exercising options with none owned reverts.', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(
				sAUDKey,
				initialStrikePrice,
				now,
				initialCreator,
				timeToMaturity
			);
			await fastForward(timeToMaturity + 100);
			now = await currentTime();
			const price = (await market.oracleDetails()).strikePrice;
			await exchangeRates.updateRates([sAUDKey], [price], now, { from: oracle });
			await manager.resolveMarket(market.address);

			await assert.revert(market.exerciseOptions({ from: exersizer }), 'Nothing to exercise');
		});

		it('Options cannot be exercised if the manager is paused.', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(
				sAUDKey,
				initialStrikePrice,
				now,
				initialCreator,
				timeToMaturity
			);

			await market.mint(toUnit(1), { from: exersizer });
			await fastForward(timeToMaturity + 100);
			await exchangeRates.updateRates(
				[sAUDKey],
				[(await market.oracleDetails()).strikePrice],
				await currentTime(),
				{ from: oracle }
			);
			await manager.resolveMarket(market.address);

			await manager.setPaused(true, { from: accounts[1] });
			await assert.revert(
				market.exerciseOptions({ from: exersizer }),
				'This action cannot be performed while the contract is paused'
			);
		});

		it('Options can be exercised if transferred to another account.', async () => {
			await manager.setPaused(false, { from: accounts[1] });
			let now = await currentTime();
			await createMarketAndMintMore(
				sAUDKey,
				initialStrikePrice,
				now,
				initialCreator,
				timeToMaturity
			);

			await market.mint(toUnit(2), { from: exersizer });
			const options = await market.options();
			long = await BinaryOption.at(options.long);
			short = await BinaryOption.at(options.short);

			await long.transfer(dummy, toUnit(1), { from: exersizer });
			await fastForward(timeToMaturity + 100);
			now = await currentTime();
			const price = (await market.oracleDetails()).strikePrice;
			await exchangeRates.updateRates([sAUDKey], [price], now, { from: oracle });
			await manager.resolveMarket(market.address);

			let tx = await market.exerciseOptions({ from: dummy });
			let logs = await getDecodedLogs({
				hash: tx.receipt.transactionHash,
				contracts: [manager, market, long],
			});

			console.log('long.address ' + long.address);
			console.log('exersizer' + exersizer);
			console.log('dummy' + dummy);

			assert.equal(logs.length, 4);
			decodedEventEqual({
				event: 'Transfer',
				emittedFrom: long.address,
				args: [dummy, ZERO_ADDRESS, toUnit(1)],
				log: logs[0],
			});
			decodedEventEqual({
				event: 'Burned',
				emittedFrom: long.address,
				args: [dummy, toUnit(1)],
				log: logs[1],
			});
		});
	});

	describe('Expiry', () => {
		it('Expired markets destroy themselves and their options.', async () => {
			await manager.setPaused(false, { from: accounts[1] });
			let now = await currentTime();
			await createMarketAndMintMore(
				sAUDKey,
				initialStrikePrice,
				now,
				initialCreator,
				timeToMaturity
			);

			const options = await market.options();
			long = await BinaryOption.at(options.long);
			short = await BinaryOption.at(options.short);

			const marketAddress = market.address;
			const longAddress = long.address;
			const shortAddress = short.address;

			await fastForward(expiryDuration.add(toBN(timeToMaturity + 10)));
			await exchangeRates.updateRates([sAUDKey], [initialStrikePrice], await currentTime(), {
				from: oracle,
			});
			await manager.resolveMarket(market.address);
			await manager.expireMarkets([market.address], { from: initialCreator });

			assert.equal(await web3.eth.getCode(marketAddress), '0x');
			assert.equal(await web3.eth.getCode(longAddress), '0x');
			assert.equal(await web3.eth.getCode(shortAddress), '0x');
		});

		it('Unresolved markets cannot be expired', async () => {
			let now = await currentTime();
			console.log('Now at beggining ' + now);
			await createMarketAndMintMore(
				sAUDKey,
				initialStrikePrice,
				now,
				initialCreator,
				timeToMaturity
			);
			now = await currentTime();

			await fastForward(expiryDuration.add(toBN(timeToMaturity + 10)));
			await assert.revert(
				manager.expireMarkets([market.address], { from: initialCreator }),
				'Unexpired options remaining'
			);
		});

		it('Market cannot be expired before its time', async () => {
			let now = await currentTime();
			console.log('Oracle now is ' + now);

			await createMarketAndMintMore(
				sAUDKey,
				initialStrikePrice,
				now,
				initialCreator,
				timeToMaturity
			);

			now = await currentTime();

			await fastForward(timeToMaturity + 10);
			now = await currentTime();
			await exchangeRates.updateRates([sAUDKey], [initialStrikePrice], now, {
				from: oracle,
			});

			await manager.resolveMarket(market.address);
			await assert.revert(
				manager.expireMarkets([market.address], { from: initialCreator }),
				'Unexpired options remaining'
			);
		});

		it('Market can be expired early if all options are exercised', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(
				sAUDKey,
				initialStrikePrice,
				now,
				initialCreator,
				timeToMaturity
			);

			await fastForward(timeToMaturity + 10);
			await exchangeRates.updateRates([sAUDKey], [initialStrikePrice], await currentTime(), {
				from: oracle,
			});
			await market.exerciseOptions({ from: initialCreator });
			const marketAddress = market.address;
			await manager.expireMarkets([market.address], { from: initialCreator });
			assert.equal(await web3.eth.getCode(marketAddress), '0x');
		});

		it('Market cannot be expired except by the manager', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(
				sAUDKey,
				initialStrikePrice,
				now,
				initialCreator,
				timeToMaturity
			);

			await fastForward(expiryDuration.add(toBN(timeToMaturity + 10)));
			await exchangeRates.updateRates([sAUDKey], [initialStrikePrice], await currentTime(), {
				from: oracle,
			});
			await manager.resolveMarket(market.address);

			await onlyGivenAddressCanInvoke({
				fnc: market.expire,
				args: [initialCreator],
				accounts,
				skipPassCheck: true,
				reason: 'Only the contract owner may perform this action',
			});
		});

		it('Expired market remits any unclaimed options and extra sUSD to the caller.', async () => {
			sUSDSynth.issue(secondCreator, toUnit(3));
			sUSDSynth.approve(manager.address, toUnit(3), { from: secondCreator });

			const creatorBalance = await sUSDSynth.balanceOf(secondCreator);
			console.log('preCreatorBalance ' + (await sUSDSynth.balanceOf(secondCreator)));

			let now = await currentTime();
			await createMarketAndMintMore(
				sAUDKey,
				initialStrikePrice,
				now,
				secondCreator,
				timeToMaturity
			);

			let fees = await market.fees();
			let _feeMultiplier = toUnit(1).sub(fees[0].add(fees[1]));
			// creator fee goes back to creator
			let valueAfterFees = multiplyDecimalRound(_feeMultiplier, toUnit(1)).add(toUnit(4));

			await sUSDSynth.transfer(market.address, toUnit(1));

			await sUSDSynth.issue(exersizer, sUSDQty);
			await market.mint(toUnit(1), { from: exersizer });

			const deposited = await market.deposited();
			const preTotalDeposited = await manager.totalDeposited();

			await fastForward(expiryDuration.add(toBN(timeToMaturity + 10)));
			await exchangeRates.updateRates([sAUDKey], [initialStrikePrice], await currentTime(), {
				from: oracle,
			});
			await manager.resolveMarket(market.address);
			await manager.expireMarkets([market.address], { from: secondCreator });

			console.log('deposited ' + deposited);

			const creatorRecovered = deposited.add(toUnit(1));

			console.log('postCreatorBalance ' + (await sUSDSynth.balanceOf(secondCreator)));

			console.log('valueAfterFees ' + valueAfterFees);

			assert.bnEqual(await sUSDSynth.balanceOf(secondCreator), valueAfterFees);
			assert.bnEqual(await manager.totalDeposited(), preTotalDeposited.sub(deposited));
		});

		it('Expired market emits no transfer if there is nothing to remit.', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(
				sAUDKey,
				initialStrikePrice,
				now,
				initialCreator,
				timeToMaturity
			);

			await fastForward(expiryDuration.add(toBN(timeToMaturity + 10)));
			await exchangeRates.updateRates([sAUDKey], [initialStrikePrice], await currentTime(), {
				from: oracle,
			});

			const marketAddress = market.address;
			await market.exerciseOptions({ from: initialCreator });

			const creatorBalance = await sUSDSynth.balanceOf(initialCreator);
			const tx = await manager.expireMarkets([market.address], { from: initialCreator });
			const postCreatorBalance = await sUSDSynth.balanceOf(initialCreator);
			assert.bnEqual(postCreatorBalance, creatorBalance);

			const log = tx.receipt.logs[0];
			assert.eventEqual(log, 'MarketExpired', {
				market: marketAddress,
			});

			const logs = Synth.decodeLogs(tx.receipt.rawLogs);
			assert.equal(logs.length, 0);
		});

		it('Market cannot be expired if the manager is paused', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(
				sAUDKey,
				initialStrikePrice,
				now,
				initialCreator,
				timeToMaturity
			);

			await fastForward(expiryDuration.add(toBN(timeToMaturity + 10)));
			await exchangeRates.updateRates([sAUDKey], [initialStrikePrice], await currentTime(), {
				from: oracle,
			});
			await manager.resolveMarket(market.address);
			await manager.setPaused(true, { from: accounts[1] });
			await assert.revert(
				manager.expireMarkets([market.address], { from: initialCreator }),
				'This action cannot be performed while the contract is paused'
			);
		});
	});
});
