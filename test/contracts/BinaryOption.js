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
	let longOption, shortOption;

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

	describe('Transfers', () => {
		it('Can transfer tokens.', async () => {
			const newValue = toUnit(1);
			await manager.setCreatorCapitalRequirement(newValue, { from: managerOwner });
			let now = await currentTime();
			market = await createMarket(
				manager,
				sAUDKey,
				toUnit(1),
				now + 200,
				toUnit(2),
				initialCreator
			);
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
					'expire',
					'transfer',
					'transferFrom',
					'approve',
				],
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
