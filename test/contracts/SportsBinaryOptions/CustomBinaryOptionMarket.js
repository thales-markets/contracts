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
} = require('../../utils/helpers');

let BinaryOptionMarketFactory, factory, BinaryOptionMarketManager, manager, addressResolver;
let BinaryOptionMarket,
	exchangeRates,
	oracle,
	sUSDSynth,
	binaryOptionMarketMastercopy,
	binaryOptionMastercopy;
let market, long, short, BinaryOption, Synth;
let customMarket;
let customOracle;

const ZERO_ADDRESS = '0x' + '0'.repeat(40);

const Phase = {
	Trading: toBN(0),
	Maturity: toBN(1),
	Expiry: toBN(2),
};

contract('BinaryOption', accounts => {
	const [initialCreator, managerOwner, minter, dummy, exersicer, secondCreator] = accounts;

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

		factory.setBinaryOptionMarketManager(manager.address, { from: managerOwner });
		factory.setBinaryOptionMarketMastercopy(binaryOptionMarketMastercopy.address, {
			from: managerOwner,
		});
		factory.setBinaryOptionMastercopy(binaryOptionMastercopy.address, { from: managerOwner });

		await Promise.all([
			sUSDSynth.issue(initialCreator, sUSDQty),
			sUSDSynth.approve(manager.address, sUSDQty, { from: initialCreator }),
			sUSDSynth.issue(managerOwner, sUSDQty),
			sUSDSynth.approve(manager.address, sUSDQty, { from: managerOwner }),
			sUSDSynth.issue(minter, sUSDQty),
			sUSDSynth.approve(manager.address, sUSDQty, { from: minter }),
			sUSDSynth.issue(dummy, sUSDQty),
			sUSDSynth.approve(manager.address, sUSDQty, { from: dummy }),
		]);
	});

	describe('Integration test', () => {
		it('Can create a custom market', async () => {
			let SportFeedContract = artifacts.require('TestSportFeed');
			let feed = await SportFeedContract.new(
				managerOwner,
				'0x56dd6586db0d08c6ce7b2f2805af28616e082455',
				toBytes32('aa34467c0b074fb0888c9f42c449547f'),
				toUnit(1),
				'medals',
				'2016',
				'',
				''
			);

			await feed.setResult('0x5b22555341222c2243484e222c22474252225d00000000000000000000000000', {
				from: managerOwner,
			});

			let SportFeedOracleInstanceContract = artifacts.require('SportFeedOracleInstance');

			await SportFeedOracleInstanceContract.link(await artifacts.require('Integers').new());

			customOracle = await SportFeedOracleInstanceContract.new(
				managerOwner,
				feed.address,
				'USA',
				'1',
				'Olympics Medal Count'
			);

			const now = await currentTime();

			const result = await manager.createMarket(
				toBytes32(''),
				0,
				now + timeToMaturity,
				toUnit(2),
				true,
				customOracle.address,
				{
					from: managerOwner,
				}
			);

			customMarket = await BinaryOptionMarket.at(
				getEventByName({ tx: result, name: 'MarketCreated' }).args.market
			);
			const options = await customMarket.options();
			long = await BinaryOption.at(options.long);
			short = await BinaryOption.at(options.short);
			let longAddress = long.address;
			let shortAddress = short.address;

			assert.eventEqual(getEventByName({ tx: result, name: 'MarketCreated' }), 'MarketCreated', {
				creator: managerOwner,
				oracleKey: toBytes32(''),
				strikePrice: 0,
				maturityDate: toBN(now + timeToMaturity),
				expiryDate: toBN(now + timeToMaturity).add(expiryDuration),
				long: longAddress,
				short: shortAddress,
				customMarket: true,
				customOracle: customOracle.address,
			});
		});

		it('Current side', async () => {
			assert.bnEqual(await customMarket.result(), Side.Long);
		});

		it('Can resolve a custom market', async () => {
			assert.isFalse(await customOracle.resolvable());
			assert.isFalse(await customMarket.canResolve());

			await fastForward(timeToMaturity + 100);

			assert.isFalse(await customOracle.resolvable());
			assert.isFalse(await customMarket.canResolve());

			await customOracle.setResolvable(true, {
				from: managerOwner,
			});

			assert.isFalse(await customMarket.resolved());
			assert.isTrue(await customOracle.resolvable());

			assert.bnEqual(await customMarket.phase(), Phase.Maturity);

			assert.isTrue(await customMarket.customMarket());

			assert.isTrue(await customMarket.canResolve());

			await manager.resolveMarket(customMarket.address);

			assert.isTrue(await customMarket.resolved());
			assert.bnEqual(await customMarket.result(), Side.Long);
		});

		it('Exercising options on custom market', async () => {
			assert.bnEqual(await long.balanceOf(managerOwner), toBN("2000000000000000000"));
			const tx1 = await customMarket.exerciseOptions({ from: managerOwner });
			// options no longer in the wallet
			assert.bnEqual(await long.balanceOf(managerOwner), toBN(0));
		});
	});
});
