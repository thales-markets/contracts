'use strict';

const { artifacts, contract, web3 } = require('hardhat');
const { toBN } = web3.utils;

const ZERO_ADDRESS = '0x' + '0'.repeat(40);

const { assert, addSnapshotBeforeRestoreAfterEach } = require('../common');
const {
	fastForward,
	toUnit,
	currentTime,
	multiplyDecimalRound,
	divideDecimalRound,
} = require('../../utils')();
const { toBytes32 } = require('../../../index');
const { setupContract, setupAllContracts } = require('../Token/setup');

const {
	ensureOnlyExpectedMutativeFunctions,
	onlyGivenAddressCanInvoke,
	getEventByName,
	getDecodedLogs,
	decodedEventEqual,
} = require('../helpers');

let BinaryOptionMarketFactory, factory, BinaryOptionMarketManager, manager, addressResolver;
let BinaryOptionMarket,
	exchangeRates,
	oracle,
	sUSDSynth,
	binaryOptionMarketMastercopy,
	binaryOptionMastercopy;
let market, long, short, BinaryOption, Synth;

contract('BinaryOptionMarketManager', accounts => {
	const [initialCreator, managerOwner, minter, dummy, exerciser, secondCreator] = accounts;

	const sUSDQty = toUnit(10000);
	const initialStrikePrice = toUnit(100);

	const sAUDKey = toBytes32('sAUD');

	let timeToMaturity = 200;
	let totalDepositedAfterFees;

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
			sUSDSynth.issue(exerciser, sUSDQty),
			sUSDSynth.approve(manager.address, sUSDQty, { from: exerciser }),
		]);
	});

	describe('Fees edge case', () => {
		it('Rounding of fees can prevent all options from being exercised.', async () => {
			let creatorFee = toBN('80839200000000000');
			let poolFee = toBN('18178000000000000');
			let value = toBN('3982999999999999700');
			await manager.setPoolFee(poolFee, { from: managerOwner });
			await manager.setCreatorFee(creatorFee, { from: managerOwner });
			let now = await currentTime();
			const result = await manager.createMarket(
				sAUDKey,
				initialStrikePrice,
				now + timeToMaturity,
				toUnit(2),
				false,
				ZERO_ADDRESS,
				{
					from: initialCreator,
				}
			);
			market = await BinaryOptionMarket.at(
				getEventByName({ tx: result, name: 'MarketCreated' }).args.market
			);
			await market.mint(value, { from: exerciser });
			await fastForward(timeToMaturity + 100);
			await exchangeRates.updateRates(
				[sAUDKey],
				[(await market.oracleDetails()).strikePrice],
				await currentTime(),
				{ from: oracle }
			);

			await market.exerciseOptions({ from: initialCreator });
			await market.exerciseOptions({ from: exerciser });

			await manager.expireMarkets([market.address], { from: managerOwner });
		});
	});
});
