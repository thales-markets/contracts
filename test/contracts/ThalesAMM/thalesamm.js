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

let aggregator_sAUD, aggregator_sETH, aggregator_sUSD, aggregator_nonRate;

const ZERO_ADDRESS = '0x' + '0'.repeat(40);

const MockAggregator = artifacts.require('MockAggregatorV2V3');

const Phase = {
	Trading: toBN(0),
	Maturity: toBN(1),
	Expiry: toBN(2),
};

contract('ThalesRoyale', accounts => {
	const [initialCreator, managerOwner, minter, dummy, exersicer, secondCreator] = accounts;
	const [first, owner, second, third, fourth] = accounts;

	const sUSDQty = toUnit(10000);

	const hour = 60 * 60;
	const day = 24 * 60 * 60;

	const capitalRequirement = toUnit(2);
	const skewLimit = toUnit(0.05);
	const maxOraclePriceAge = toBN(60 * 61);
	const expiryDuration = toBN(26 * 7 * 24 * 60 * 60);
	const maxTimeToMaturity = toBN(365 * 24 * 60 * 60);

	const initialStrikePrice = toUnit(100);
	const initialStrikePriceValue = 100;

	const sAUDKey = toBytes32('sAUD');
	const sUSDKey = toBytes32('sUSD');
	const sETHKey = toBytes32('sETH');
	const nonRate = toBytes32('nonExistent');

	let timeToMaturity = 200;
	let totalDeposited;

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

		aggregator_sAUD = await MockAggregator.new({ from: managerOwner });
		aggregator_sETH = await MockAggregator.new({ from: managerOwner });
		aggregator_sUSD = await MockAggregator.new({ from: managerOwner });
		aggregator_nonRate = await MockAggregator.new({ from: managerOwner });
		aggregator_sAUD.setDecimals('8');
		aggregator_sETH.setDecimals('8');
		aggregator_sUSD.setDecimals('8');
		const timestamp = await currentTime();

		await aggregator_sAUD.setLatestAnswer(convertToDecimals(100, 8), timestamp);
		await aggregator_sETH.setLatestAnswer(convertToDecimals(10000, 8), timestamp);
		await aggregator_sUSD.setLatestAnswer(convertToDecimals(100, 8), timestamp);

		await priceFeed.addAggregator(sAUDKey, aggregator_sAUD.address, {
			from: managerOwner,
		});

		await priceFeed.addAggregator(sETHKey, aggregator_sETH.address, {
			from: managerOwner,
		});

		await priceFeed.addAggregator(sUSDKey, aggregator_sUSD.address, {
			from: managerOwner,
		});

		await priceFeed.addAggregator(nonRate, aggregator_nonRate.address, {
			from: managerOwner,
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

	let priceFeedAddress;
	let deciMath;
	let rewardTokenAddress;
	let ThalesAMM;
	let thalesAMM;
	let MockPriceFeedDeployed;

	beforeEach(async () => {
		priceFeedAddress = owner;
		rewardTokenAddress = owner;

		let MockPriceFeed = artifacts.require('MockPriceFeed');
		MockPriceFeedDeployed = await MockPriceFeed.new(owner);
		await MockPriceFeedDeployed.setPricetoReturn(10000);

		let DeciMath = artifacts.require('DeciMath');
		deciMath = await DeciMath.new();
		await deciMath.setLUT1();
		await deciMath.setLUT2();
		await deciMath.setLUT3_1();
		await deciMath.setLUT3_2();
		await deciMath.setLUT3_3();
		await deciMath.setLUT3_4();

		priceFeedAddress = MockPriceFeedDeployed.address;

		ThalesAMM = artifacts.require('ThalesAMM');
		thalesAMM = await ThalesAMM.new(
			owner,
			priceFeedAddress,
			sUSDSynth.address,
			toUnit(1000),
			deciMath.address
		);
		await thalesAMM.setBinaryOptionsMarketManager(manager.address, { from: owner });
		sUSDSynth.issue(thalesAMM.address, sUSDQty);
	});

	const Position = {
		UP: toBN(0),
		DOWN: toBN(1),
	};

	describe('Test AMM', () => {

		it('check price', async () => {
			// scenario:
			// 1: Check current UP price
			// 2. Check available to buy UP
			// 3. Buy 200 UPs
			// 4. Check available to sell
			// 4. Sell 100 UPs

			console.log('ThalesAMM deployed to ' + thalesAMM.address);

			let now = await currentTime();
			let newMarket = await createMarket(
				manager,
				sETHKey,
				toUnit(12000),
				now + day * 10,
				toUnit(10),
				initialCreator
			);

			let strikePrice = await thalesAMM.strikePrice(newMarket.address, Position.UP);
			console.log('strikePrice is:' + strikePrice / 1e18);
			let oraclePrice = await thalesAMM.oraclePrice(newMarket.address, Position.UP);
			console.log('oraclePrice is:' + oraclePrice / 1e18);
			let timeLeftToMaturityInDays = await thalesAMM.timeLeftToMaturityInDays(
				newMarket.address,
				Position.UP
			);
			console.log('timeLeftToMaturityInDays is:' + timeLeftToMaturityInDays);

			let calculatedOdds = calculateOdds(10000, 12000, 10, 120);
			console.log('calculatedOdds is:' + calculatedOdds);
			let calculatedOddsContract = await thalesAMM.calculateOdds(
				toUnit(10000),
				toUnit(12000),
				toUnit(10),
				toUnit(100)
			);
			console.log('calculatedOddsContract is:' + calculatedOddsContract / 1e18);

			let priceUp = await thalesAMM.price(newMarket.address, Position.UP);
			console.log('priceUp is:' + priceUp);
			console.log('priceUp decimal is:' + priceUp / 1e18);
			assert.equal(priceUp / 1e18, 0.17933571412829044);

			let availableToBuyFromAMM = await thalesAMM.availableToBuyFromAMM(
				newMarket.address,
				Position.UP
			);
			console.log('availableToBuyFromAMM is:' + availableToBuyFromAMM);
			console.log('availableToBuyFromAMM decimal is:' + availableToBuyFromAMM / 1e18);
			assert.equal(availableToBuyFromAMM / 1e18, 1218);

			let minterSusdBalance = await sUSDSynth.balanceOf(minter);
			console.log('minterSusdBalance decimal is:' + minterSusdBalance / 1e18);
			assert.equal(minterSusdBalance / 1e18, 10000);

			let options = await newMarket.options();
			long = await BinaryOption.at(options.long);
			short = await BinaryOption.at(options.short);

			let minterLongBalance = await long.balanceOf(minter);
			console.log('minterLongBalance decimal is:' + minterLongBalance / 1e18);
			assert.equal(minterLongBalance / 1e18, 0);

			await sUSDSynth.approve(thalesAMM.address, sUSDQty, { from: minter });
			await thalesAMM.buyFromAMM(newMarket.address, Position.UP, toUnit(200), { from: minter });

			minterSusdBalance = await sUSDSynth.balanceOf(minter);
			console.log('minterSusdBalance decimal is:' + minterSusdBalance / 1e18);
			assert.equal(Math.floor(minterSusdBalance / 1e18), 9964);

			minterLongBalance = await long.balanceOf(minter);
			console.log('minterLongBalance decimal is:' + minterLongBalance / 1e18);
			assert.equal(minterLongBalance / 1e18, 200);

			availableToBuyFromAMM = await thalesAMM.availableToBuyFromAMM(
				newMarket.address,
				Position.UP
			);
			console.log('availableToBuyFromAMM is:' + availableToBuyFromAMM);
			console.log('availableToBuyFromAMM decimal is:' + availableToBuyFromAMM / 1e18);
			assert.equal(availableToBuyFromAMM / 1e18, 1018);

			// availableToSellFromAMM = await thalesAMM.availableToBuyFromAMM(
			// 	newMarket.address,
			// 	Position.UP
			// );
			// console.log('availableToBuyFromAMM is:' + availableToBuyFromAMM);
			// console.log('availableToBuyFromAMM decimal is:' + availableToBuyFromAMM / 1e18);
			// assert.equal(availableToBuyFromAMM / 1e18, 1018);

			//
			// let priceDown = await thalesAMM.price(newMarket.address, Position.DOWN);
			// console.log('priceDown is:' + priceDown / 1e18);
			//
			// newMarket = await createMarket(
			// 	manager,
			// 	sETHKey,
			// 	toUnit(20000),
			// 	now + day * 10,
			// 	toUnit(10),
			// 	initialCreator
			// );
			//
			// priceUp = await thalesAMM.price(newMarket.address, Position.UP);
			// console.log('priceUp1 is:' + priceUp / 1e18);
			//
			// priceDown = await thalesAMM.price(newMarket.address, Position.DOWN);
			// console.log('priceDown1 is:' + priceDown / 1e18);
			//
		});
	});
});

function calculateOdds(price, strike, days, volatility) {
	let p = price;
	let q = strike;
	let t = days / 365;
	let v = volatility / 100;

	let tt = Math.sqrt(t);
	let vt = v * tt;
	let lnpq = Math.log(q / p);
	let d1 = lnpq / vt;
	let y9 = 1 + 0.2316419 * Math.abs(d1);

	let y = Math.floor((1 / y9) * 100000) / 100000;
	let z1 = Math.exp(-((d1 * d1) / 2));
	let d2 = -((d1 * d1) / 2);
	let d3 = Math.exp(d2);
	let z = Math.floor(0.3989423 * d3 * 100000) / 100000;

	let y5 = 1.330274 * Math.pow(y, 5);
	let y4 = 1.821256 * Math.pow(y, 4);
	let y3 = 1.781478 * Math.pow(y, 3);
	let y2 = 0.356538 * Math.pow(y, 2);
	let y1 = 0.3193815 * y;
	let x1 = y5 + y3 + y1 - y4 - y2;
	let x = 1 - z * (y5 - y4 + y3 - y2 + y1);

	let x2 = z * x1;
	x = Math.floor(x * 100000) / 100000;

	if (d1 < 0) {
		x = 1 - x;
	}
	return Math.floor((1 - x) * 1000) / 10;
}
