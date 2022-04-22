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

let PositionalMarketFactory, factory, PositionalMarketManager, manager, addressResolver;
let PositionalMarket,
	priceFeed,
	oracle,
	sUSDSynth,
	PositionalMarketMastercopy,
	PositionMastercopy,
	RangedMarket;
let market, up, down, position, Synth;

let aggregator_sAUD, aggregator_sETH, aggregator_sUSD, aggregator_nonRate;

const ZERO_ADDRESS = '0x' + '0'.repeat(40);

const MockAggregator = artifacts.require('MockAggregatorV2V3');

const Phase = {
	Trading: toBN(0),
	Maturity: toBN(1),
	Expiry: toBN(2),
};

contract('ThalesAMM', accounts => {
	const [initialCreator, managerOwner, minter, dummy, exersicer, secondCreator, safeBox] = accounts;
	const [creator, owner] = accounts;
	let creatorSigner, ownerSigner;

	const sUSDQty = toUnit(100000);
	const sUSDQtyAmm = toUnit(1000);

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
		position = artifacts.require('Position');
	});

	before(async () => {
		({
			PositionalMarketManager: manager,
			PositionalMarketFactory: factory,
			PositionalMarketMastercopy: PositionalMarketMastercopy,
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

		[creatorSigner, ownerSigner] = await ethers.getSigners();

		await manager.connect(creatorSigner).setPositionalMarketFactory(factory.address);

		await factory.connect(ownerSigner).setPositionalMarketManager(manager.address);
		await factory
			.connect(ownerSigner)
			.setPositionalMarketMastercopy(PositionalMarketMastercopy.address);
		await factory.connect(ownerSigner).setPositionMastercopy(PositionMastercopy.address);

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

		await priceFeed.connect(ownerSigner).addAggregator(sAUDKey, aggregator_sAUD.address);

		await priceFeed.connect(ownerSigner).addAggregator(sETHKey, aggregator_sETH.address);

		await priceFeed.connect(ownerSigner).addAggregator(sUSDKey, aggregator_sUSD.address);

		await priceFeed.connect(ownerSigner).addAggregator(nonRate, aggregator_nonRate.address);

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
	let rangedMarketsAMM;
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

		const hour = 60 * 60;
		ThalesAMM = artifacts.require('ThalesAMM');
		thalesAMM = await ThalesAMM.new();
		await thalesAMM.initialize(
			owner,
			priceFeedAddress,
			sUSDSynth.address,
			toUnit(1000),
			deciMath.address,
			toUnit(0.01),
			toUnit(0.05),
			hour * 2
		);
		await thalesAMM.setPositionalMarketManager(manager.address, { from: owner });
		await thalesAMM.setImpliedVolatilityPerAsset(sETHKey, toUnit(120), { from: owner });
		await thalesAMM.setSafeBoxImpact(toUnit(0.01), { from: owner });
		await thalesAMM.setSafeBox(safeBox, { from: owner });
		await thalesAMM.setMinSupportedPrice(toUnit(0.05), { from: owner });
		await thalesAMM.setMaxSupportedPrice(toUnit(0.95), { from: owner });

		sUSDSynth.issue(thalesAMM.address, sUSDQtyAmm);

		let RangedMarketsAMM = artifacts.require('RangedMarketsAMM');
		rangedMarketsAMM = await RangedMarketsAMM.new();

		await rangedMarketsAMM.initialize(
			managerOwner,
			thalesAMM.address,
			toUnit('0.01'),
			toUnit('1000'),
			sUSDSynth.address
		);

		console.log('Successfully create rangedMarketsAMM ' + rangedMarketsAMM.address);
		sUSDSynth.issue(rangedMarketsAMM.address, sUSDQtyAmm);

		[creatorSigner, ownerSigner] = await ethers.getSigners();

		RangedMarket = artifacts.require('RangedMarket');

		console.log('Setting mastercopy 1');
		let RangedMarketMastercopy = artifacts.require('RangedMarketMastercopy');
		let rangedMarketMastercopy = await RangedMarketMastercopy.new();
		console.log('Setting mastercopy 11');
		await rangedMarketsAMM.setRangedMarketMastercopy(rangedMarketMastercopy.address, {
			from: owner,
		});

		console.log('Setting mastercopy 2');
		let InPositionMastercopy = artifacts.require('InPositionMastercopy');
		let inPositionMastercopy = await InPositionMastercopy.new();
		await rangedMarketsAMM.setRangedPositionINMastercopy(inPositionMastercopy.address, {
			from: owner,
		});

		console.log('Setting mastercopy 3');
		let OutPositionMastercopy = artifacts.require('OutPositionMastercopy');
		let outPositionMastercopy = await OutPositionMastercopy.new();
		await rangedMarketsAMM.setRangedPositionOUTMastercopy(outPositionMastercopy.address, {
			from: owner,
		});

		await rangedMarketsAMM.setMinSupportedPrice(toUnit(0.05), { from: owner });
		await rangedMarketsAMM.setMaxSupportedPrice(toUnit(0.95), { from: owner });
		console.log('Setting min prices');
	});

	const Position = {
		UP: toBN(0),
		DOWN: toBN(1),
	};

	const RangedPosition = {
		IN: toBN(0),
		OUT: toBN(1),
	};

	describe('Test ranged AMM', () => {
		it('create market test', async () => {
			let now = await currentTime();
			let leftMarket = await createMarket(
				manager,
				sETHKey,
				toUnit(9000),
				now + day * 10,
				toUnit(10),
				creatorSigner
			);
			console.log('Left market is ' + leftMarket.address);

			let rightMarket = await createMarket(
				manager,
				sETHKey,
				toUnit(11000),
				now + day * 10,
				toUnit(10),
				creatorSigner
			);

			let tx = await rangedMarketsAMM.createRangedMarket(leftMarket.address, rightMarket.address);
			let createdMarketAddress = tx.receipt.logs[0].args.market;
			console.log('created market is :' + createdMarketAddress);

			let rangedMarket = await RangedMarket.at(createdMarketAddress);

			console.log('rangedMarket is ' + rangedMarket.address);

			let rangedMarketsAMMAddressFromCreatedMarket = await rangedMarket.rangedMarketsAMM();
			console.log('rangedMarketsAMM market is ' + rangedMarketsAMMAddressFromCreatedMarket);

			let leftMarketAddressFromCreatedRangedMarket = await rangedMarket.leftMarket();
			console.log(
				'leftMarketAddressFromCreatedRangedMarket is ' + leftMarketAddressFromCreatedRangedMarket
			);

			let minInPrice = await rangedMarketsAMM.minInPrice(rangedMarket.address);
			console.log('minInPrice is:' + minInPrice / 1e18);
			//
			// let availableToBuyFromAMMLeft = await thalesAMM.availableToBuyFromAMM(
			// 	leftMarket.address,
			// 	Position.DOWN
			// );
			// console.log('availableToBuyFromAMM leftMarket is:' + availableToBuyFromAMMLeft / 1e18);
			//
			// let availableToBuyFromAMMRight = await thalesAMM.availableToBuyFromAMM(
			// 	rightMarket.address,
			// 	Position.UP
			// );
			// console.log('availableToBuyFromAMM rightMarket is:' + availableToBuyFromAMMRight / 1e18);
			//
			// let availableToBuyFromAMMOut = await rangedMarketsAMM.availableToBuyFromAMM(
			// 	leftMarket.address,
			// 	rightMarket.address,
			// 	RangedPosition.OUT
			// );
			//
			// console.log('availableToBuyFromAMMOut is:' + availableToBuyFromAMMOut / 1e18);
			//
			// availableToBuyFromAMMLeft = await thalesAMM.availableToBuyFromAMM(
			// 	leftMarket.address,
			// 	Position.UP
			// );
			// console.log('availableToBuyFromAMM IN leftMarket  is:' + availableToBuyFromAMMLeft / 1e18);
			//
			// availableToBuyFromAMMRight = await thalesAMM.availableToBuyFromAMM(
			// 	rightMarket.address,
			// 	Position.DOWN
			// );
			// console.log('availableToBuyFromAMM IN rightMarket is:' + availableToBuyFromAMMRight / 1e18);
			//
			let availableToBuyFromAMMIn = await rangedMarketsAMM.availableToBuyFromAMM(
				rangedMarket.address,
				RangedPosition.IN
			);

			console.log('availableToBuyFromAMMIn is:' + availableToBuyFromAMMIn / 1e18);

			let buyInQuote = await rangedMarketsAMM.buyFromAmmQuote(
				rangedMarket.address,
				RangedPosition.IN,
				toUnit('1')
			);

			console.log('buyInQuote is:' + buyInQuote / 1e18);

			buyInQuote = await rangedMarketsAMM.buyFromAmmQuote(
				rangedMarket.address,
				RangedPosition.IN,
				toUnit('1000')
			);

			console.log('buyInQuote 1000 is :' + buyInQuote / 1e18);

			buyInQuote = await rangedMarketsAMM.buyFromAmmQuote(
				rangedMarket.address,
				RangedPosition.IN,
				toUnit(availableToBuyFromAMMIn / 1e18 + '')
			);
			console.log('buyInQuote availableToBuyFromAMMIn is :' + buyInQuote / 1e18);
		});
	});
});
