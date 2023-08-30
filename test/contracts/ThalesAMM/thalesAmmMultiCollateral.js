'use strict';

const { artifacts, contract, web3 } = require('hardhat');
const { toBN } = web3.utils;

const { toUnit, currentTime } = require('../../utils')();
const { toBytes32 } = require('../../../index');
const { setupAllContracts } = require('../../utils/setup');
const { assert } = require('../../utils/common');

const { convertToDecimals } = require('../../utils/helpers');

let PositionalMarketFactory, factory, PositionalMarketManager, manager, addressResolver;
let PositionalMarket, priceFeed, oracle, sUSDSynth, PositionalMarketMastercopy, PositionMastercopy;
let market, up, down, position, Synth, testUSDC, testUSDT, testDAI;

let aggregator_sAUD, aggregator_sETH, aggregator_sUSD, aggregator_nonRate;

const usdcQuantity = toBN(10000 * 1e6); //100 USDC

const ZERO_ADDRESS = '0x' + '0'.repeat(40);
const WEEK = 7 * 24 * 60 * 60;

const MockAggregator = artifacts.require('MockAggregatorV2V3');

contract('ThalesAMM', (accounts) => {
	const [
		initialCreator,
		managerOwner,
		minter,
		dummy,
		exersicer,
		secondCreator,
		safeBox,
		firstLiquidityProvider,
		defaultLiquidityProvider,
	] = accounts;
	const [creator, owner] = accounts;
	let creatorSigner, ownerSigner;

	const sUSDQty = toUnit(100000);
	const sUSDQtyAmm = toUnit(1000);

	const day = 24 * 60 * 60;

	const sAUDKey = toBytes32('sAUD');
	const sUSDKey = toBytes32('sUSD');
	const sETHKey = toBytes32('sETH');
	const nonRate = toBytes32('nonExistent');

	const createMarket = async (man, oracleKey, strikePrice, maturity, initialMint, creator) => {
		const tx = await man
			.connect(creator)
			.createMarket(oracleKey, strikePrice.toString(), maturity, initialMint.toString());
		let receipt = await tx.wait();
		const marketEvent = receipt.events.find(
			(event) => event['event'] && event['event'] === 'MarketCreated'
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
	let rewardTokenAddress;
	let ThalesAMM;
	let thalesAMM, curveSUSD;
	let MockPriceFeedDeployed;
	let ThalesAMMLiquidityPool;

	beforeEach(async () => {
		priceFeedAddress = owner;
		rewardTokenAddress = owner;

		let MockPriceFeed = artifacts.require('MockPriceFeed');
		MockPriceFeedDeployed = await MockPriceFeed.new(owner);
		await MockPriceFeedDeployed.setPricetoReturn(10000);

		priceFeedAddress = MockPriceFeedDeployed.address;

		const hour = 60 * 60;
		ThalesAMM = artifacts.require('ThalesAMM');
		thalesAMM = await ThalesAMM.new();
		await thalesAMM.initialize(
			owner,
			priceFeedAddress,
			sUSDSynth.address,
			toUnit(1000),
			owner,
			toUnit(0.02),
			toUnit(0.2),
			hour * 2
		);
		await thalesAMM.setPositionalMarketManager(manager.address, { from: owner });
		await thalesAMM.setImpliedVolatilityPerAsset(sETHKey, toUnit(120), { from: owner });
		await thalesAMM.setSafeBoxData(safeBox, toUnit(0.01), { from: owner });
		await thalesAMM.setMinMaxSupportedPriceAndCap(toUnit(0.05), toUnit(0.95), toUnit(1000), {
			from: owner,
		});
		let ThalesAMMUtils = artifacts.require('ThalesAMMUtils');
		let thalesAMMUtils = await ThalesAMMUtils.new();
		await thalesAMM.setAmmUtils(thalesAMMUtils.address, {
			from: owner,
		});

		let ThalesAMMLiquidityPoolContract = artifacts.require('ThalesAMMLiquidityPool');
		ThalesAMMLiquidityPool = await ThalesAMMLiquidityPoolContract.new();

		await ThalesAMMLiquidityPool.initialize(
			{
				_owner: owner,
				_thalesAMM: thalesAMM.address,
				_sUSD: sUSDSynth.address,
				_roundLength: WEEK,
				_maxAllowedDeposit: toUnit(1000).toString(),
				_minDepositAmount: toUnit(100).toString(),
				_maxAllowedUsers: 100,
				_needsTransformingCollateral: true,
			},
			{ from: owner }
		);
		await ThalesAMMLiquidityPool.setUtilizationRate(toUnit(1), {
			from: owner,
		});

		await thalesAMM.setLiquidityPool(ThalesAMMLiquidityPool.address, {
			from: owner,
		});

		let ThalesAMMLiquidityPoolRoundMastercopy = artifacts.require(
			'ThalesAMMLiquidityPoolRoundMastercopy'
		);

		let aMMLiquidityPoolRoundMastercopy = await ThalesAMMLiquidityPoolRoundMastercopy.new();
		await ThalesAMMLiquidityPool.setPoolRoundMastercopy(aMMLiquidityPoolRoundMastercopy.address, {
			from: owner,
		});
		await sUSDSynth.issue(firstLiquidityProvider, toUnit('100000'), { from: owner });
		await sUSDSynth.approve(ThalesAMMLiquidityPool.address, toUnit('100000'), {
			from: firstLiquidityProvider,
		});
		await ThalesAMMLiquidityPool.setWhitelistedAddresses([firstLiquidityProvider], true, {
			from: owner,
		});
		await ThalesAMMLiquidityPool.deposit(toUnit(100), { from: firstLiquidityProvider });
		await ThalesAMMLiquidityPool.start({ from: owner });
		await ThalesAMMLiquidityPool.setDefaultLiquidityProvider(defaultLiquidityProvider, {
			from: owner,
		});
		await sUSDSynth.issue(defaultLiquidityProvider, toUnit('100000'), { from: owner });
		await sUSDSynth.approve(ThalesAMMLiquidityPool.address, toUnit('100000'), {
			from: defaultLiquidityProvider,
		});

		sUSDSynth.issue(thalesAMM.address, sUSDQty);
		await factory.connect(ownerSigner).setThalesAMM(thalesAMM.address);

		let TestUSDC = artifacts.require('TestUSDC');
		testUSDC = await TestUSDC.new();
		testUSDT = await TestUSDC.new();

		let ERC20token = artifacts.require('Thales');
		testDAI = await ERC20token.new();

		let CurveSUSD = artifacts.require('MockCurveSUSD');
		curveSUSD = await CurveSUSD.new(
			sUSDSynth.address,
			testUSDC.address,
			testUSDT.address,
			testDAI.address
		);

		await thalesAMM.setCurveSUSD(
			curveSUSD.address,
			testDAI.address,
			testUSDC.address,
			testUSDT.address,
			true,
			toUnit(0.02),
			{ from: owner }
		);

		console.log('minting');
		await testUSDC.mint(minter, usdcQuantity);
		await testUSDC.mint(curveSUSD.address, usdcQuantity);
		await testUSDC.approve(thalesAMM.address, usdcQuantity, { from: minter });
		console.log('done minting');
	});

	const Position = {
		UP: toBN(0),
		DOWN: toBN(1),
	};

	describe('Test AMM', () => {
		it('buying test', async () => {
			let now = await currentTime();
			await manager.setMarketCreationParameters(now - WEEK + 200, now - 3 * day + 200);
			let price = (await priceFeed.rateForCurrency(sETHKey)) / 1e18;
			let strikePriceStep = (await manager.getStrikePriceStep(sETHKey)) / 1e18;

			let newMarket = await createMarket(
				manager,
				sETHKey,
				toUnit(price),
				now + WEEK + 200,
				toUnit(10),
				creatorSigner
			);

			let availableToBuyFromAMM = await thalesAMM.availableToBuyFromAMM(
				newMarket.address,
				Position.UP
			);

			await sUSDSynth.approve(thalesAMM.address, sUSDQty, { from: minter });
			let additionalSlippage = toUnit(0.01);
			let buyFromAmmQuote = await thalesAMM.buyFromAmmQuote(
				newMarket.address,
				Position.UP,
				toUnit(availableToBuyFromAMM / 1e18 - 1)
			);
			console.log('buyFromAmmQuote decimal is:' + buyFromAmmQuote / 1e18);

			let buyFromAmmQuoteUSDCCollateralObject =
				await thalesAMM.buyFromAmmQuoteWithDifferentCollateral(
					newMarket.address,
					Position.UP,
					toUnit(availableToBuyFromAMM / 1e18 - 1),
					testUSDC.address
				);
			let buyFromAmmQuoteUSDCCollateral = buyFromAmmQuoteUSDCCollateralObject[0];
			console.log(
				'buyFromAmmQuoteUSDCCollateral decimal is:' + buyFromAmmQuoteUSDCCollateral / 1e18
			);

			assert.equal(buyFromAmmQuoteUSDCCollateral / 1e6 > buyFromAmmQuote / 1e18, true);

			let buyFromAmmQuoteDAICollateralObject =
				await thalesAMM.buyFromAmmQuoteWithDifferentCollateral(
					newMarket.address,
					Position.UP,
					toUnit(availableToBuyFromAMM / 1e18 - 1),
					testDAI.address
				);
			let buyFromAmmQuoteDAICollateral = buyFromAmmQuoteDAICollateralObject[0];

			assert.equal(buyFromAmmQuoteDAICollateral / 1e18 > buyFromAmmQuote / 1e18, true);

			let minterUSDC = await testUSDC.balanceOf(minter);

			let roundPool = await ThalesAMMLiquidityPool.getMarketPool(newMarket.address);

			let ammSusdBalance = await sUSDSynth.balanceOf(roundPool);

			let buyFromAmmQuoteUSDCCollateralObjectSlippagedObject =
				await thalesAMM.buyFromAmmQuoteWithDifferentCollateral(
					newMarket.address,
					Position.UP,
					toUnit(0.9 * (availableToBuyFromAMM / 1e18 - 1)),
					testUSDC.address
				);
			let buyFromAmmQuoteUSDCCollateralObjectSlippaged =
				buyFromAmmQuoteUSDCCollateralObjectSlippagedObject[0];
			console.log(
				'buyFromAmmQuoteUSDCCollateralObjectSlippaged decimal is:' +
					buyFromAmmQuoteUSDCCollateralObjectSlippaged / 1e6
			);

			assert.equal(buyFromAmmQuoteUSDCCollateralObjectSlippaged / 1e6 > 1200, true);
			assert.equal(buyFromAmmQuoteUSDCCollateralObjectSlippaged / 1e6 < 1300, true);

			await expect(
				thalesAMM.buyFromAMMWithDifferentCollateralAndReferrer(
					newMarket.address,
					Position.UP,
					toUnit(availableToBuyFromAMM / 1e18 - 1),
					buyFromAmmQuoteUSDCCollateralObjectSlippaged,
					additionalSlippage,
					testUSDC.address,
					ZERO_ADDRESS,
					{ from: minter }
				)
			).to.be.revertedWith('Slippage too high!');

			await expect(
				thalesAMM.buyFromAMMWithDifferentCollateralAndReferrer(
					newMarket.address,
					Position.UP,
					toUnit(availableToBuyFromAMM / 1e18 - 1),
					buyFromAmmQuoteUSDCCollateral * 0.9,
					additionalSlippage,
					sUSDSynth.address,
					ZERO_ADDRESS,
					{ from: minter }
				)
			).to.be.revertedWith('unsupported collateral');

			await thalesAMM.buyFromAMMWithDifferentCollateralAndReferrer(
				newMarket.address,
				Position.UP,
				toUnit(availableToBuyFromAMM / 1e18 - 1),
				buyFromAmmQuoteUSDCCollateral,
				additionalSlippage,
				testUSDC.address,
				ZERO_ADDRESS,
				{ from: minter }
			);
			console.log(
				'Bought  ' +
					(availableToBuyFromAMM / 1e18 - 1) +
					' for ' +
					buyFromAmmQuoteUSDCCollateral / 1e6 +
					' sUSD'
			);

			minterUSDC = await testUSDC.balanceOf(minter);
			console.log('minterUSDC post buy decimal is:' + minterUSDC / 1e6);

			roundPool = await ThalesAMMLiquidityPool.getMarketPool(newMarket.address);

			ammSusdBalance = await sUSDSynth.balanceOf(roundPool);
			console.log('ammSusdBalance post buy decimal is:' + ammSusdBalance / 1e18);

			let options = await newMarket.options();
			up = await position.at(options.up);
			down = await position.at(options.down);

			let minterUps = await up.balanceOf(minter);
			console.log('minterUps post buy:' + minterUps / 1e18);

			await thalesAMM.setCurveSUSD(
				curveSUSD.address,
				testDAI.address,
				testUSDC.address,
				testUSDT.address,
				false,
				toUnit(0.02),
				{ from: owner }
			);

			await expect(
				thalesAMM.buyFromAMMWithDifferentCollateralAndReferrer(
					newMarket.address,
					Position.UP,
					toUnit(availableToBuyFromAMM / 1e18 - 1),
					buyFromAmmQuoteUSDCCollateral * 0.9,
					additionalSlippage,
					testUSDC.address,
					ZERO_ADDRESS,
					{ from: minter }
				)
			).to.be.revertedWith('unsupported collateral');
		});

		it('buying test max peg allowed', async () => {
			let CurveSUSD = artifacts.require('MockCurveSUSDBreakingPeg');
			curveSUSD = await CurveSUSD.new(
				sUSDSynth.address,
				testUSDC.address,
				testUSDT.address,
				testDAI.address
			);

			await thalesAMM.setCurveSUSD(
				curveSUSD.address,
				testDAI.address,
				testUSDC.address,
				testUSDT.address,
				true,
				toUnit(0.05),
				{ from: owner }
			);

			let now = await currentTime();
			await manager.setMarketCreationParameters(now - WEEK + 200, now - 3 * day + 200);
			let price = (await priceFeed.rateForCurrency(sETHKey)) / 1e18;
			let strikePriceStep = (await manager.getStrikePriceStep(sETHKey)) / 1e18;

			let newMarket = await createMarket(
				manager,
				sETHKey,
				toUnit(price),
				now + 2 * WEEK + 200,
				toUnit(10),
				creatorSigner
			);

			let availableToBuyFromAMM = await thalesAMM.availableToBuyFromAMM(
				newMarket.address,
				Position.UP
			);

			await sUSDSynth.approve(thalesAMM.address, sUSDQty, { from: minter });
			let additionalSlippage = toUnit(0.01);
			let buyFromAmmQuote = await thalesAMM.buyFromAmmQuote(
				newMarket.address,
				Position.UP,
				toUnit(availableToBuyFromAMM / 1e18 - 1)
			);
			console.log('buyFromAmmQuote decimal is:' + buyFromAmmQuote / 1e18);

			let buyFromAmmQuoteUSDCCollateralObject =
				await thalesAMM.buyFromAmmQuoteWithDifferentCollateral(
					newMarket.address,
					Position.UP,
					toUnit(availableToBuyFromAMM / 1e18 - 1),
					testUSDC.address
				);
			let buyFromAmmQuoteUSDCCollateral = buyFromAmmQuoteUSDCCollateralObject[0];

			console.log(
				'buyFromAmmQuoteUSDCCollateral decimal is:' + buyFromAmmQuoteUSDCCollateral / 1e6
			);

			let minterUSDC = await testUSDC.balanceOf(minter);

			let roundPool = await ThalesAMMLiquidityPool.getMarketPool(newMarket.address);

			let ammSusdBalance = await sUSDSynth.balanceOf(roundPool);

			await thalesAMM.buyFromAMMWithDifferentCollateralAndReferrer(
				newMarket.address,
				Position.UP,
				toUnit(availableToBuyFromAMM / 1e18 - 1),
				buyFromAmmQuoteUSDCCollateral,
				additionalSlippage,
				testUSDC.address,
				ZERO_ADDRESS,
				{ from: minter }
			);
			console.log(
				'Bought  ' +
					(availableToBuyFromAMM / 1e18 - 1) +
					' for ' +
					buyFromAmmQuoteUSDCCollateral / 1e6 +
					' sUSD'
			);

			minterUSDC = await testUSDC.balanceOf(minter);
			console.log('minterUSDC post buy decimal is:' + minterUSDC / 1e6);

			roundPool = await ThalesAMMLiquidityPool.getMarketPool(newMarket.address);

			ammSusdBalance = await sUSDSynth.balanceOf(roundPool);
			console.log('ammSusdBalance post buy decimal is:' + ammSusdBalance / 1e18);

			let options = await newMarket.options();
			up = await position.at(options.up);
			down = await position.at(options.down);

			let minterUps = await up.balanceOf(minter);
			console.log('minterUps post buy:' + minterUps / 1e18);
		});

		it('buying test max peg breaking', async () => {
			let CurveSUSD = artifacts.require('MockCurveSUSDBreakingPeg');
			curveSUSD = await CurveSUSD.new(
				sUSDSynth.address,
				testUSDC.address,
				testUSDT.address,
				testDAI.address
			);

			await thalesAMM.setCurveSUSD(
				curveSUSD.address,
				testDAI.address,
				testUSDC.address,
				testUSDT.address,
				true,
				toUnit(0.02),
				{ from: owner }
			);

			let now = await currentTime();
			await manager.setMarketCreationParameters(now - WEEK + 200, now - 3 * day + 200);
			let price = (await priceFeed.rateForCurrency(sETHKey)) / 1e18;
			let strikePriceStep = (await manager.getStrikePriceStep(sETHKey)) / 1e18;

			let newMarket = await createMarket(
				manager,
				sETHKey,
				toUnit(price),
				now + 3 * WEEK + 200,
				toUnit(10),
				creatorSigner
			);

			let availableToBuyFromAMM = await thalesAMM.availableToBuyFromAMM(
				newMarket.address,
				Position.UP
			);

			await sUSDSynth.approve(thalesAMM.address, sUSDQty, { from: minter });
			let additionalSlippage = toUnit(0.01);
			let buyFromAmmQuote = await thalesAMM.buyFromAmmQuote(
				newMarket.address,
				Position.UP,
				toUnit(availableToBuyFromAMM / 1e18 - 1)
			);
			console.log('buyFromAmmQuote decimal is:' + buyFromAmmQuote / 1e18);

			let buyFromAmmQuoteUSDCCollateralObject =
				await thalesAMM.buyFromAmmQuoteWithDifferentCollateral(
					newMarket.address,
					Position.UP,
					toUnit(availableToBuyFromAMM / 1e18 - 1),
					testUSDC.address
				);
			let buyFromAmmQuoteUSDCCollateral = buyFromAmmQuoteUSDCCollateralObject[0];

			console.log(
				'buyFromAmmQuoteUSDCCollateral decimal is:' + buyFromAmmQuoteUSDCCollateral / 1e6
			);

			await expect(
				thalesAMM.buyFromAMMWithDifferentCollateralAndReferrer(
					newMarket.address,
					Position.UP,
					toUnit(availableToBuyFromAMM / 1e18 - 1),
					buyFromAmmQuoteUSDCCollateral,
					additionalSlippage,
					testUSDC.address,
					ZERO_ADDRESS,
					{ from: minter }
				)
			).to.be.revertedWith('Amount below max allowed peg slippage');
		});
	});
});
