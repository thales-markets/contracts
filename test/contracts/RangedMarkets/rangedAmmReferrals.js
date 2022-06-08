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

contract('RangedAMM', accounts => {
	const [
		initialCreator,
		managerOwner,
		minter,
		dummy,
		exersicer,
		secondCreator,
		safeBox,
		referrerAddress,
		secondReferrerAddress,
	] = accounts;
	const [creator, owner] = accounts;
	let creatorSigner, ownerSigner;

	const sUSDQty = toUnit(1000);
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

	const Range = {
		In: toBN(0),
		Out: toBN(1),
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
	let Referrals;
	let referrals;
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

		await factory.connect(ownerSigner).setThalesAMM(thalesAMM.address);

		sUSDSynth.issue(thalesAMM.address, sUSDQtyAmm);

		let RangedMarketsAMM = artifacts.require('RangedMarketsAMM');
		rangedMarketsAMM = await RangedMarketsAMM.new();

		await rangedMarketsAMM.initialize(
			managerOwner,
			thalesAMM.address,
			toUnit('0.01'),
			toUnit('1000'),
			sUSDSynth.address,
			safeBox,
			toUnit('0.01')
		);

		console.log('Successfully create rangedMarketsAMM ' + rangedMarketsAMM.address);
		sUSDSynth.issue(rangedMarketsAMM.address, sUSDQtyAmm);

		[creatorSigner, ownerSigner] = await ethers.getSigners();

		RangedMarket = artifacts.require('RangedMarket');

		let RangedMarketMastercopy = artifacts.require('RangedMarketMastercopy');
		let rangedMarketMastercopy = await RangedMarketMastercopy.new();
		console.log('Setting mastercopy 11');
		await rangedMarketsAMM.setRangedMarketMastercopy(rangedMarketMastercopy.address, {
			from: owner,
		});

		let RangedPositionMastercopy = artifacts.require('RangedPositionMastercopy');
		let rangedPositionMastercopy = await RangedPositionMastercopy.new();
		await rangedMarketsAMM.setRangedPositionMastercopy(rangedPositionMastercopy.address, {
			from: owner,
		});

		await rangedMarketsAMM.setMinMaxSupportedPrice(toUnit(0.05), toUnit(0.95), 5, 200, {
			from: owner,
		});
		console.log('Setting min prices');

		await sUSDSynth.approve(rangedMarketsAMM.address, sUSDQty, { from: minter });

		Referrals = artifacts.require('Referrals');
		referrals = await Referrals.new();
		await referrals.initialize(owner, thalesAMM.address, rangedMarketsAMM.address);

		await rangedMarketsAMM.setReferrals(referrals.address, toUnit('0.01'), {
			from: owner,
		});
		console.log('rangedMarketsAMM -  set Referrals');

		await thalesAMM.setReferrals(referrals.address, toUnit('0.01'), {
			from: owner,
		});
		console.log('thalesAMM -  set Referrals');
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
		it('test referrers ', async () => {
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

			let availableToBuyFromAMMIn = await rangedMarketsAMM.availableToBuyFromAMM(
				rangedMarket.address,
				RangedPosition.IN
			);

			console.log('availableToBuyFromAMMIn is:' + availableToBuyFromAMMIn / 1e18);

			console.log('BUYING IN POSITION!!!!!!!!!!!!!!!!!!!!!!');

			let buyInQuote = await rangedMarketsAMM.buyFromAmmQuote(
				rangedMarket.address,
				RangedPosition.IN,
				toUnit('200')
			);

			console.log('buyInQuote is:' + buyInQuote / 1e18);

			let minterSusdBalance = await sUSDSynth.balanceOf(minter);
			console.log('minterSusdBalance before:' + minterSusdBalance / 1e18);

			let rangedMarketsAMMBalanceSUSd = await sUSDSynth.balanceOf(rangedMarketsAMM.address);
			console.log('rangedMarketsAMM before:' + rangedMarketsAMMBalanceSUSd / 1e18);
			let referrerSusdBalance = await sUSDSynth.balanceOf(referrerAddress);
			console.log('referrerSusdBalance before:' + referrerSusdBalance / 1e18);

			let additionalSlippage = toUnit(0.01);
			await rangedMarketsAMM.buyFromAMMWithReferrer(
				rangedMarket.address,
				RangedPosition.IN,
				toUnit('200'),
				buyInQuote,
				additionalSlippage,
				referrerAddress,
				{ from: minter }
			);

			let referredMinter = await referrals.referrals(minter);
			console.log('Minter referrer is ' + referredMinter);

			minterSusdBalance = await sUSDSynth.balanceOf(minter);
			console.log('minterSusdBalance after:' + minterSusdBalance / 1e18);

			rangedMarketsAMMBalanceSUSd = await sUSDSynth.balanceOf(rangedMarketsAMM.address);
			console.log('rangedMarketsAMM after:' + rangedMarketsAMMBalanceSUSd / 1e18);

			referrerSusdBalance = await sUSDSynth.balanceOf(referrerAddress);
			console.log('referrerSusdBalance after:' + referrerSusdBalance / 1e18);

			await rangedMarketsAMM.buyFromAMMWithReferrer(
				rangedMarket.address,
				RangedPosition.IN,
				toUnit('200'),
				buyInQuote,
				additionalSlippage,
				secondReferrerAddress,
				{ from: minter }
			);

			referredMinter = await referrals.referrals(minter);
			console.log('Minter referrer is ' + referredMinter);

			minterSusdBalance = await sUSDSynth.balanceOf(minter);
			console.log('minterSusdBalance after:' + minterSusdBalance / 1e18);

			rangedMarketsAMMBalanceSUSd = await sUSDSynth.balanceOf(rangedMarketsAMM.address);
			console.log('rangedMarketsAMM after:' + rangedMarketsAMMBalanceSUSd / 1e18);

			referrerSusdBalance = await sUSDSynth.balanceOf(referrerAddress);
			console.log('referrerSusdBalance after:' + referrerSusdBalance / 1e18);

			let secondreferrerSusdBalance = await sUSDSynth.balanceOf(secondReferrerAddress);
			console.log('secondreferrerSusdBalance after:' + secondreferrerSusdBalance / 1e18);

			console.log('DONE BUYING IN POSITION!!!!!!!!!!!!!!!!!!!!!!');
		});
	});
});
