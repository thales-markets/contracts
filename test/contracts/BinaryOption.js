'use strict';

const { artifacts, contract, web3 } = require('hardhat');
const { toBN } = web3.utils;

const { assert, addSnapshotBeforeRestoreAfterEach } = require('./common');
const { fastForward, toUnit, currentTime } = require('../utils')();
const { toBytes32 } = require('../..');
const { setupContract, setupAllContracts } = require('./setup');

const {
	ensureOnlyExpectedMutativeFunctions,
	onlyGivenAddressCanInvoke,
	getEventByName,
} = require('./helpers');

let BinaryOptionMarketFactory, factory, BinaryOptionMarketManager, manager, addressResolver;
let BinaryOptionMarket,
	exchangeRates,
	oracle,
	sUSDSynth,
	binaryOptionMarketMastercopy,
	binaryOptionMastercopy;
let market, long, short, BinaryOption;

const ZERO_ADDRESS = '0x' + '0'.repeat(40);

contract('BinaryOption', accounts => {
	const [initialCreator, managerOwner, minter, dummy] = accounts;

	const sUSDQty = toUnit(10000);

	const capitalRequirement = toUnit(2);
	const skewLimit = toUnit(0.05);
	const maxOraclePriceAge = toBN(60 * 61);
	const expiryDuration = toBN(26 * 7 * 24 * 60 * 60);
	const maxTimeToMaturity = toBN(365 * 24 * 60 * 60);

	const initialPoolFee = toUnit(0.008);
	const initialCreatorFee = toUnit(0.002);

	const initialFeeAddress = 0xfeefeefeefeefeefeefeefeefeefeefeefeefeef;

	const sAUDKey = toBytes32('sAUD');
	const iAUDKey = toBytes32('iAUD');

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
				'BinaryOptionMarketMastercopy',
				'BinaryOptionMastercopy',
				'BinaryOptionMarketFactory',
			],
		}));

		manager.setBinaryOptionsMarketFactory(factory.address, { from: managerOwner });
		manager.setBinaryOptionsMasterCopy(binaryOptionMastercopy.address, { from: managerOwner });

		factory.setBinaryOptionMarketManager(manager.address, { from: managerOwner });
		factory.setBinaryOptionMarketMastercopy(binaryOptionMarketMastercopy.address, {
			from: managerOwner,
		});

		console.log('Factory address is: ' + factory.address);
		console.log('Manager address is: ' + manager.address);
		console.log('BinaryOptionMarketMastercopy address is: ' + binaryOptionMarketMastercopy.address);
		console.log('BinaryOptionMastercopy address is: ' + binaryOptionMastercopy.address);

		oracle = await exchangeRates.oracle();

		await exchangeRates.updateRates([sAUDKey], [toUnit(5)], await currentTime(), {
			from: oracle,
		});

		await Promise.all([
			sUSDSynth.issue(initialCreator, sUSDQty),
			sUSDSynth.approve(manager.address, sUSDQty, { from: initialCreator }),
			sUSDSynth.issue(minter, sUSDQty),
			sUSDSynth.approve(manager.address, sUSDQty, { from: minter }),
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
					'setBinaryOptionsMasterCopy',
					'setFeeAddress',
					'setCreatorCapitalRequirement',
					'setCreatorFee',
					'setExpiryDuration',
					'setMarketCreationEnabled',
					'setMaxOraclePriceAge',
					'setMaxTimeToMaturity',
					'setMigratingManager',
					'setPoolFee',
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

			const result = await manager.createMarket(sAUDKey, toUnit(1), now + 200, toUnit(2), {
				from: initialCreator,
			});

			assert.eventEqual(getEventByName({ tx: result, name: 'MarketCreated' }), 'MarketCreated', {
				creator: initialCreator,
				oracleKey: sAUDKey,
				strikePrice: toUnit(1),
				maturityDate: toBN(now + 200),
				expiryDate: toBN(now + 200).add(expiryDuration),
			});

			// const decodedLogs = BinaryOptionMarket.decodeLogs(result.receipt.rawLogs);
			// assert.eventEqual(decodedLogs[1], 'Mint', {
			// 	side: Side.Long,
			// 	account: initialCreator,
			// 	value: toUnit(2),
			// });
			// assert.eventEqual(decodedLogs[2], 'Bid', {
			// 	side: Side.Short,
			// 	account: initialCreator,
			// 	value: toUnit(3),
			// });

			market = await BinaryOptionMarket.at(
				getEventByName({ tx: result, name: 'MarketCreated' }).args.market
			);

			const times = await market.times();
			assert.bnEqual(times.maturity, toBN(now + 200));
			assert.bnEqual(times.expiry, toBN(now + 200).add(expiryDuration));
			const oracleDetails = await market.oracleDetails();
			assert.equal(oracleDetails.key, sAUDKey);
			assert.bnEqual(oracleDetails.strikePrice, toUnit(1));
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
	});
});
