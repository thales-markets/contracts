// 'use strict';
//
// const { artifacts, contract, web3 } = require('hardhat');
// const { toBN } = web3.utils;
//
// const { assert, addSnapshotBeforeRestoreAfterEach } = require('../../utils/common');
// const { fastForward, toUnit, currentTime, multiplyDecimalRound, divideDecimalRound } =
// 	require('../../utils')();
// const { toBytes32 } = require('../../../index');
// const { setupContract, setupAllContracts } = require('../../utils/setup');
//
// const {
// 	ensureOnlyExpectedMutativeFunctions,
// 	onlyGivenAddressCanInvoke,
// 	getEventByName,
// 	getDecodedLogs,
// 	decodedEventEqual,
// 	convertToDecimals,
// } = require('../../utils/helpers');
//
// let PositionalMarketFactory, factory, PositionalMarketManager, manager, addressResolver;
// let PositionalMarket,
// 	priceFeed,
// 	oracle,
// 	sUSDSynth,
// 	PositionalMarketMastercopy,
// 	PositionMastercopy,
// 	RangedMarket;
// let market, up, down, position, Synth, curveSUSD, testUSDC, testUSDT, testDAI;
//
// let aggregator_sAUD, aggregator_sETH, aggregator_sUSD, aggregator_nonRate;
//
// const ZERO_ADDRESS = '0x' + '0'.repeat(40);
// const WEEK = 7 * 24 * 60 * 60;
//
// const MockAggregator = artifacts.require('MockAggregatorV2V3');
//
// const usdcQuantity = toBN(10000 * 1e6); //100 USDC
//
// const Phase = {
// 	Trading: toBN(0),
// 	Maturity: toBN(1),
// 	Expiry: toBN(2),
// };
//
// contract('RangedAMM', (accounts) => {
// 	const [
// 		initialCreator,
// 		managerOwner,
// 		minter,
// 		dummy,
// 		exersicer,
// 		secondCreator,
// 		safeBox,
// 		referrerAddress,
// 		secondReferrerAddress,
// 		firstLiquidityProvider,
// 		defaultLiquidityProvider,
// 	] = accounts;
// 	const [creator, owner] = accounts;
// 	let creatorSigner, ownerSigner;
//
// 	const sUSDQty = toUnit(100000);
// 	const sUSDQtyAmm = toUnit(100000);
//
// 	const hour = 60 * 60;
// 	const day = 24 * 60 * 60;
//
// 	const capitalRequirement = toUnit(2);
// 	const skewLimit = toUnit(0.05);
// 	const maxOraclePriceAge = toBN(60 * 61);
// 	const expiryDuration = toBN(26 * 7 * 24 * 60 * 60);
// 	const maxTimeToMaturity = toBN(365 * 24 * 60 * 60);
//
// 	const initialStrikePrice = toUnit(100);
// 	const initialStrikePriceValue = 100;
//
// 	const sAUDKey = toBytes32('sAUD');
// 	const sUSDKey = toBytes32('sUSD');
// 	const sETHKey = toBytes32('sETH');
// 	const nonRate = toBytes32('nonExistent');
//
// 	let timeToMaturity = 200;
// 	let totalDeposited;
//
// 	const Side = {
// 		Up: toBN(0),
// 		Down: toBN(1),
// 	};
//
// 	const Range = {
// 		In: toBN(0),
// 		Out: toBN(1),
// 	};
//
// 	const createMarket = async (man, oracleKey, strikePrice, maturity, initialMint, creator) => {
// 		const tx = await man
// 			.connect(creator)
// 			.createMarket(oracleKey, strikePrice.toString(), maturity, initialMint.toString());
// 		let receipt = await tx.wait();
// 		const marketEvent = receipt.events.find(
// 			(event) => event['event'] && event['event'] === 'MarketCreated'
// 		);
// 		return PositionalMarket.at(marketEvent.args.market);
// 	};
//
// 	before(async () => {
// 		PositionalMarket = artifacts.require('PositionalMarket');
// 	});
//
// 	before(async () => {
// 		Synth = artifacts.require('Synth');
// 	});
//
// 	before(async () => {
// 		position = artifacts.require('Position');
// 	});
//
// 	before(async () => {
// 		({
// 			PositionalMarketManager: manager,
// 			PositionalMarketFactory: factory,
// 			PositionalMarketMastercopy: PositionalMarketMastercopy,
// 			PositionMastercopy: PositionMastercopy,
// 			AddressResolver: addressResolver,
// 			PriceFeed: priceFeed,
// 			SynthsUSD: sUSDSynth,
// 		} = await setupAllContracts({
// 			accounts,
// 			synths: ['sUSD'],
// 			contracts: [
// 				'FeePool',
// 				'PriceFeed',
// 				'PositionalMarketMastercopy',
// 				'PositionMastercopy',
// 				'PositionalMarketFactory',
// 			],
// 		}));
//
// 		[creatorSigner, ownerSigner] = await ethers.getSigners();
//
// 		await manager.connect(creatorSigner).setPositionalMarketFactory(factory.address);
//
// 		await factory.connect(ownerSigner).setPositionalMarketManager(manager.address);
// 		await factory
// 			.connect(ownerSigner)
// 			.setPositionalMarketMastercopy(PositionalMarketMastercopy.address);
// 		await factory.connect(ownerSigner).setPositionMastercopy(PositionMastercopy.address);
//
// 		aggregator_sAUD = await MockAggregator.new({ from: managerOwner });
// 		aggregator_sETH = await MockAggregator.new({ from: managerOwner });
// 		aggregator_sUSD = await MockAggregator.new({ from: managerOwner });
// 		aggregator_nonRate = await MockAggregator.new({ from: managerOwner });
// 		aggregator_sAUD.setDecimals('8');
// 		aggregator_sETH.setDecimals('8');
// 		aggregator_sUSD.setDecimals('8');
// 		const timestamp = await currentTime();
//
// 		await aggregator_sAUD.setLatestAnswer(convertToDecimals(100, 8), timestamp);
// 		await aggregator_sETH.setLatestAnswer(convertToDecimals(10000, 8), timestamp);
// 		await aggregator_sUSD.setLatestAnswer(convertToDecimals(100, 8), timestamp);
//
// 		await priceFeed.connect(ownerSigner).addAggregator(sAUDKey, aggregator_sAUD.address);
//
// 		await priceFeed.connect(ownerSigner).addAggregator(sETHKey, aggregator_sETH.address);
//
// 		await priceFeed.connect(ownerSigner).addAggregator(sUSDKey, aggregator_sUSD.address);
//
// 		await priceFeed.connect(ownerSigner).addAggregator(nonRate, aggregator_nonRate.address);
//
// 		await Promise.all([
// 			sUSDSynth.issue(initialCreator, sUSDQty),
// 			sUSDSynth.approve(manager.address, sUSDQty, { from: initialCreator }),
// 			sUSDSynth.issue(minter, sUSDQty),
// 			sUSDSynth.approve(manager.address, sUSDQty, { from: minter }),
// 			sUSDSynth.issue(dummy, sUSDQty),
// 			sUSDSynth.approve(manager.address, sUSDQty, { from: dummy }),
// 		]);
// 	});
//
// 	let priceFeedAddress;
// 	let rewardTokenAddress;
// 	let ThalesAMM;
// 	let thalesAMM;
// 	let Referrals;
// 	let referrals;
// 	let rangedMarketsAMM;
// 	let MockPriceFeedDeployed;
// 	let ThalesAMMLiquidityPool;
//
// 	beforeEach(async () => {
// 		priceFeedAddress = owner;
// 		rewardTokenAddress = owner;
//
// 		let MockPriceFeed = artifacts.require('MockPriceFeed');
// 		MockPriceFeedDeployed = await MockPriceFeed.new(owner);
// 		await MockPriceFeedDeployed.setPricetoReturn(10000);
//
// 		priceFeedAddress = MockPriceFeedDeployed.address;
//
// 		const hour = 60 * 60;
// 		ThalesAMM = artifacts.require('ThalesAMM');
// 		thalesAMM = await ThalesAMM.new();
// 		await thalesAMM.initialize(
// 			owner,
// 			priceFeedAddress,
// 			sUSDSynth.address,
// 			toUnit(1000),
// 			owner,
// 			toUnit(0.01),
// 			toUnit(0.05),
// 			hour * 2
// 		);
// 		await thalesAMM.setPositionalMarketManager(manager.address, { from: owner });
// 		await thalesAMM.setImpliedVolatilityPerAsset(sETHKey, toUnit(120), { from: owner });
// 		await thalesAMM.setSafeBoxData(safeBox, toUnit(0.01), { from: owner });
// 		await thalesAMM.setMinMaxSupportedPriceAndCap(toUnit(0.05), toUnit(0.95), toUnit(1000), {
// 			from: owner,
// 		});
// 		let ThalesAMMUtils = artifacts.require('ThalesAMMUtils');
// 		let thalesAMMUtils = await ThalesAMMUtils.new();
// 		await thalesAMM.setAmmUtils(thalesAMMUtils.address, {
// 			from: owner,
// 		});
//
// 		let ThalesAMMLiquidityPoolContract = artifacts.require('ThalesAMMLiquidityPool');
// 		ThalesAMMLiquidityPool = await ThalesAMMLiquidityPoolContract.new();
//
// 		await ThalesAMMLiquidityPool.initialize(
// 			{
// 				_owner: owner,
// 				_thalesAMM: thalesAMM.address,
// 				_sUSD: sUSDSynth.address,
// 				_roundLength: WEEK,
// 				_maxAllowedDeposit: toUnit(1000).toString(),
// 				_minDepositAmount: toUnit(100).toString(),
// 				_maxAllowedUsers: 100,
// 				_needsTransformingCollateral: false,
// 			},
// 			{ from: owner }
// 		);
//		await ThalesAMMLiquidityPool.setUtilizationRate(toUnit(1), {
//			from: owner,
//		});
//
// 		await thalesAMM.setLiquidityPool(ThalesAMMLiquidityPool.address, {
// 			from: owner,
// 		});
//
// 		let ThalesAMMLiquidityPoolRoundMastercopy = artifacts.require(
// 			'ThalesAMMLiquidityPoolRoundMastercopy'
// 		);
//
// 		let aMMLiquidityPoolRoundMastercopy = await ThalesAMMLiquidityPoolRoundMastercopy.new();
// 		await ThalesAMMLiquidityPool.setPoolRoundMastercopy(aMMLiquidityPoolRoundMastercopy.address, {
// 			from: owner,
// 		});
// 		await sUSDSynth.issue(firstLiquidityProvider, toUnit('100000'), { from: owner });
// 		await sUSDSynth.approve(ThalesAMMLiquidityPool.address, toUnit('100000'), {
// 			from: firstLiquidityProvider,
// 		});
// 		await ThalesAMMLiquidityPool.deposit(toUnit(100), { from: firstLiquidityProvider });
// 		await ThalesAMMLiquidityPool.start({ from: owner });
// 		await ThalesAMMLiquidityPool.setDefaultLiquidityProvider(defaultLiquidityProvider, {
// 			from: owner,
// 		});
// 		await sUSDSynth.issue(defaultLiquidityProvider, toUnit('100000'), { from: owner });
// 		await sUSDSynth.approve(ThalesAMMLiquidityPool.address, toUnit('100000'), {
// 			from: defaultLiquidityProvider,
// 		});
//
// 		await factory.connect(ownerSigner).setThalesAMM(thalesAMM.address);
//
// 		sUSDSynth.issue(thalesAMM.address, sUSDQtyAmm);
//
// 		let RangedMarketsAMM = artifacts.require('RangedMarketsAMM');
// 		rangedMarketsAMM = await RangedMarketsAMM.new();
//
// 		await rangedMarketsAMM.initialize(
// 			managerOwner,
// 			thalesAMM.address,
// 			toUnit('0.01'),
// 			toUnit('1000'),
// 			sUSDSynth.address,
// 			safeBox,
// 			toUnit('0.01')
// 		);
//
// 		console.log('Successfully create rangedMarketsAMM ' + rangedMarketsAMM.address);
// 		sUSDSynth.issue(rangedMarketsAMM.address, sUSDQtyAmm);
//
// 		[creatorSigner, ownerSigner] = await ethers.getSigners();
//
// 		RangedMarket = artifacts.require('RangedMarket');
//
// 		let RangedMarketMastercopy = artifacts.require('RangedMarketMastercopy');
// 		let rangedMarketMastercopy = await RangedMarketMastercopy.new();
// 		console.log('Setting mastercopy 11');
//
// 		let RangedPositionMastercopy = artifacts.require('RangedPositionMastercopy');
// 		let rangedPositionMastercopy = await RangedPositionMastercopy.new();
// 		await rangedMarketsAMM.setRangedMarketMastercopies(
// 			rangedMarketMastercopy.address,
// 			rangedPositionMastercopy.address,
// 			{
// 				from: owner,
// 			}
// 		);
//
// 		await rangedMarketsAMM.setMinMaxSupportedPrice(toUnit(0.05), toUnit(0.95), 5, 200, {
// 			from: owner,
// 		});
// 		console.log('Setting min prices');
//
// 		await sUSDSynth.approve(rangedMarketsAMM.address, sUSDQty, { from: minter });
//
// 		Referrals = artifacts.require('Referrals');
// 		referrals = await Referrals.new();
// 		await referrals.initialize(owner, thalesAMM.address, rangedMarketsAMM.address);
//
// 		await rangedMarketsAMM.setThalesAMMStakingThalesAndReferrals(
// 			thalesAMM.address,
// 			ZERO_ADDRESS,
// 			referrals.address,
// 			toUnit('0.01'),
// 			{
// 				from: owner,
// 			}
// 		);
// 		console.log('rangedMarketsAMM -  set Referrals');
//
// 		await thalesAMM.setStakingThalesAndReferrals(ZERO_ADDRESS, referrals.address, toUnit('0.01'), {
// 			from: owner,
// 		});
// 		console.log('thalesAMM -  set Referrals');
//
// 		let TestUSDC = artifacts.require('TestUSDC');
// 		testUSDC = await TestUSDC.new();
// 		testUSDT = await TestUSDC.new();
//
// 		let ERC20token = artifacts.require('Thales');
// 		testDAI = await ERC20token.new();
//
// 		let CurveSUSD = artifacts.require('MockCurveSUSD');
// 		curveSUSD = await CurveSUSD.new(
// 			sUSDSynth.address,
// 			testUSDC.address,
// 			testUSDT.address,
// 			testDAI.address
// 		);
//
// 		await rangedMarketsAMM.setCurveSUSD(
// 			curveSUSD.address,
// 			testDAI.address,
// 			testUSDC.address,
// 			testUSDT.address,
// 			true,
// 			toUnit(0.02),
// 			{ from: owner }
// 		);
//
// 		console.log('minting');
// 		await testUSDC.mint(minter, usdcQuantity);
// 		await testUSDC.mint(curveSUSD.address, usdcQuantity);
// 		await testUSDC.approve(rangedMarketsAMM.address, usdcQuantity, { from: minter });
// 		console.log('done minting');
// 	});
//
// 	const Position = {
// 		UP: toBN(0),
// 		DOWN: toBN(1),
// 	};
//
// 	const RangedPosition = {
// 		IN: toBN(0),
// 		OUT: toBN(1),
// 	};
//
// 	describe('Test ranged AMM', () => {
// 		it('test referrers ', async () => {
// 			let now = await currentTime();
// 			await manager.setMarketCreationParameters(now - WEEK + 200, now - 3 * day + 200);
// 			let price = (await priceFeed.rateForCurrency(sETHKey)) / 1e18;
// 			let strikePriceStep = (await manager.getStrikePriceStep(sETHKey)) / 1e18;
//
// 			let leftMarket = await createMarket(
// 				manager,
// 				sETHKey,
// 				toUnit(price - 2 * strikePriceStep),
// 				now + WEEK + 200,
// 				toUnit(10),
// 				creatorSigner
// 			);
// 			console.log('Left market is ' + leftMarket.address);
//
// 			let rightMarket = await createMarket(
// 				manager,
// 				sETHKey,
// 				toUnit(price + 2 * strikePriceStep),
// 				now + WEEK + 200,
// 				toUnit(10),
// 				creatorSigner
// 			);
//
// 			let tx = await rangedMarketsAMM.createRangedMarket(leftMarket.address, rightMarket.address);
// 			let createdMarketAddress = tx.receipt.logs[0].args.market;
// 			console.log('created market is :' + createdMarketAddress);
//
// 			let rangedMarket = await RangedMarket.at(createdMarketAddress);
//
// 			console.log('rangedMarket is ' + rangedMarket.address);
//
// 			let availableToBuyFromAMMIn = await rangedMarketsAMM.availableToBuyFromAMM(
// 				rangedMarket.address,
// 				RangedPosition.IN
// 			);
//
// 			console.log('availableToBuyFromAMMIn is:' + availableToBuyFromAMMIn / 1e18);
//
// 			await sUSDSynth.approve(thalesAMM.address, sUSDQty, { from: minter });
// 			let additionalSlippage = toUnit(0.01);
// 			let buyFromAmmQuote = await rangedMarketsAMM.buyFromAmmQuote(
// 				rangedMarket.address,
// 				RangedPosition.IN,
// 				toUnit(availableToBuyFromAMMIn / 1e18 - 1)
// 			);
// 			console.log('buyFromAmmQuote decimal is:' + buyFromAmmQuote / 1e18);
//
// 			let buyFromAmmQuoteUSDCCollateralObject =
// 				await rangedMarketsAMM.buyFromAmmQuoteWithDifferentCollateral(
// 					rangedMarket.address,
// 					RangedPosition.IN,
// 					toUnit(availableToBuyFromAMMIn / 1e18 - 1),
// 					testUSDC.address
// 				);
// 			let buyFromAmmQuoteUSDCCollateral = buyFromAmmQuoteUSDCCollateralObject[0];
// 			console.log('buyFromAmmQuoteUSDCCollateral  is:' + buyFromAmmQuoteUSDCCollateral);
// 			console.log(
// 				'buyFromAmmQuoteUSDCCollateral decimal is:' + buyFromAmmQuoteUSDCCollateral / 1e6
// 			);
//
// 			let buyFromAmmQuoteDAICollateralObject =
// 				await rangedMarketsAMM.buyFromAmmQuoteWithDifferentCollateral(
// 					rangedMarket.address,
// 					RangedPosition.IN,
// 					toUnit(availableToBuyFromAMMIn / 1e18 - 1),
// 					testDAI.address
// 				);
// 			let buyFromAmmQuoteDAICollateral = buyFromAmmQuoteDAICollateralObject[0];
// 			console.log('buyFromAmmQuoteDAICollateral  is:' + buyFromAmmQuoteDAICollateral);
// 			console.log('buyFromAmmQuoteDAICollateral decimal is:' + buyFromAmmQuoteDAICollateral / 1e18);
//
// 			let minterUSDC = await testUSDC.balanceOf(minter);
// 			console.log('minterUSDC pre  buy decimal is:' + minterUSDC / 1e6);
//
// 			let ammSusdBalance = await sUSDSynth.balanceOf(thalesAMM.address);
// 			console.log('ammSusdBalance pre buy decimal is:' + ammSusdBalance / 1e18);
//
// 			let buyFromAmmQuoteUSDCCollateralObjectSlippagedObject =
// 				await rangedMarketsAMM.buyFromAmmQuoteWithDifferentCollateral(
// 					rangedMarket.address,
// 					RangedPosition.IN,
// 					toUnit(0.9 * (availableToBuyFromAMMIn / 1e18 - 1)),
// 					testUSDC.address
// 				);
// 			let buyFromAmmQuoteUSDCCollateralObjectSlippaged =
// 				buyFromAmmQuoteUSDCCollateralObjectSlippagedObject[0];
// 			console.log(
// 				'buyFromAmmQuoteUSDCCollateralObjectSlippaged decimal is:' +
// 					buyFromAmmQuoteUSDCCollateralObjectSlippaged / 1e6
// 			);
//
// 			await expect(
// 				rangedMarketsAMM.buyFromAMMWithDifferentCollateralAndReferrer(
// 					rangedMarket.address,
// 					RangedPosition.IN,
// 					toUnit(availableToBuyFromAMMIn / 1e18 - 1),
// 					buyFromAmmQuoteUSDCCollateralObjectSlippaged,
// 					additionalSlippage,
// 					testUSDC.address,
// 					ZERO_ADDRESS,
// 					{ from: minter }
// 				)
// 			).to.be.revertedWith('Slippage too high');
//
// 			await expect(
// 				rangedMarketsAMM.buyFromAMMWithDifferentCollateralAndReferrer(
// 					rangedMarket.address,
// 					RangedPosition.IN,
// 					toUnit(availableToBuyFromAMMIn / 1e18 - 1),
// 					buyFromAmmQuoteUSDCCollateral,
// 					additionalSlippage,
// 					sUSDSynth.address,
// 					ZERO_ADDRESS,
// 					{ from: minter }
// 				)
// 			).to.be.revertedWith('unsupported collateral');
//
// 			await rangedMarketsAMM.buyFromAMMWithDifferentCollateralAndReferrer(
// 				rangedMarket.address,
// 				RangedPosition.IN,
// 				toUnit(availableToBuyFromAMMIn / 1e18 - 1),
// 				buyFromAmmQuoteUSDCCollateral,
// 				additionalSlippage,
// 				testUSDC.address,
// 				ZERO_ADDRESS,
// 				{ from: minter }
// 			);
// 			console.log(
// 				'Bought  ' +
// 					(availableToBuyFromAMMIn / 1e18 - 1) +
// 					' for ' +
// 					buyFromAmmQuoteUSDCCollateral / 1e6 +
// 					' sUSD'
// 			);
//
// 			minterUSDC = await testUSDC.balanceOf(minter);
// 			console.log('minterUSDC post buy decimal is:' + minterUSDC / 1e6);
//
// 			ammSusdBalance = await sUSDSynth.balanceOf(thalesAMM.address);
// 			console.log('ammSusdBalance post buy decimal is:' + ammSusdBalance / 1e18);
//
// 			let inposition = artifacts.require('RangedPosition');
// 			let outposition = artifacts.require('RangedPosition');
//
// 			let positions = await rangedMarket.positions();
// 			let inPosition = await inposition.at(positions.inp);
// 			let outPosition = await outposition.at(positions.outp);
//
// 			let minterBalance = await inPosition.balanceOf(minter);
// 			console.log('minter In tokens balance:' + minterBalance / 1e18);
//
// 			await rangedMarketsAMM.setCurveSUSD(
// 				curveSUSD.address,
// 				testDAI.address,
// 				testUSDC.address,
// 				testUSDT.address,
// 				false,
// 				toUnit(0.02),
// 				{ from: owner }
// 			);
//
// 			await expect(
// 				rangedMarketsAMM.buyFromAMMWithDifferentCollateralAndReferrer(
// 					rangedMarket.address,
// 					RangedPosition.IN,
// 					toUnit(availableToBuyFromAMMIn / 1e18 - 1),
// 					buyFromAmmQuoteUSDCCollateral,
// 					additionalSlippage,
// 					testUSDC.address,
// 					ZERO_ADDRESS,
// 					{ from: minter }
// 				)
// 			).to.be.revertedWith('unsupported collateral');
// 		});
// 	});
// });
