'use strict';

const { artifacts, contract, web3 } = require('hardhat');
const { toBN } = web3.utils;

const { assert } = require('../../utils/common');
const { fastForward, toUnit, currentTime } = require('../../utils')();
const { toBytes32 } = require('../../../index');
const { setupAllContracts } = require('../../utils/setup');

const { convertToDecimals } = require('../../utils/helpers');

let factory, manager, addressResolver;
let PositionalMarket, priceFeed, oracle, sUSDSynth, PositionalMarketMastercopy, PositionMastercopy;
let market, up, down, position, Synth;

let aggregator_sAUD, aggregator_sETH, aggregator_sUSD, aggregator_nonRate;

const ZERO_ADDRESS = '0x' + '0'.repeat(40);

const DAY = 24 * 60 * 60;
const WEEK = 7 * DAY;

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

	const hour = 60 * 60;
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

		await manager.connect(creatorSigner).setTimeframeBuffer(0);
		await manager.connect(creatorSigner).setPriceBuffer(toUnit(0.01).toString());

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
	let thalesAMM, thalesAmmUtils;
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
			toUnit(0.01),
			toUnit(0.05),
			hour * 2
		);
		await thalesAMM.setPositionalMarketManager(manager.address, { from: owner });
		await thalesAMM.setImpliedVolatilityPerAsset(sETHKey, toUnit(120), { from: owner });
		await thalesAMM.setSafeBoxData(safeBox, toUnit(0.01), { from: owner });
		await thalesAMM.setMinMaxSupportedPriceAndCap(toUnit(0.05), toUnit(0.95), toUnit(1000), {
			from: owner,
		});

		let ThalesAMMUtils = artifacts.require('ThalesAMMUtils');
		thalesAmmUtils = await ThalesAMMUtils.new();
		await thalesAMM.setAmmUtils(thalesAmmUtils.address, {
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
				_needsTransformingCollateral: false,
			},
			{ from: owner }
		);
		await ThalesAMMLiquidityPool.setUtilizationRate(toUnit(1));

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

		sUSDSynth.issue(thalesAMM.address, sUSDQtyAmm);

		await factory.connect(ownerSigner).setThalesAMM(thalesAMM.address);
	});

	const Position = {
		UP: toBN(0),
		DOWN: toBN(1),
	};

	describe('Test AMM', () => {
		it('simple sell test ', async () => {
			let now = await currentTime();

			await manager.setMarketCreationParameters(now - WEEK + 200, now - 3 * DAY + 200);
			let price = (await priceFeed.rateForCurrency(sETHKey)) / 1e18;
			let strikePriceStep = (await manager.getStrikePriceStep(sETHKey)) / 1e18;

			let newMarket = await createMarket(
				manager,
				sETHKey,
				toUnit(price + 2 * strikePriceStep),
				now + WEEK + 200,
				toUnit(10),
				creatorSigner
			);

			let priceUp = await thalesAMM.price(newMarket.address, Position.UP);
			console.log('priceUp decimal is:' + priceUp / 1e18);

			let options = await newMarket.options();
			up = await position.at(options.up);
			down = await position.at(options.down);
			await up.approve(thalesAMM.address, toUnit(1205), { from: minter });

			await newMarket.mint(toUnit(1205), {
				from: minter,
			});

			let sellToAmmQuote = await thalesAMM.sellToAmmQuote(
				newMarket.address,
				Position.UP,
				toUnit(1205)
			);
			console.log('sellToAmmQuote is ' + sellToAmmQuote / 1e18);
			let additionalSlippage = toUnit(0.01);
			await thalesAMM.sellToAMM(
				newMarket.address,
				Position.UP,
				toUnit(1205),
				sellToAmmQuote,
				additionalSlippage,
				{ from: minter }
			);
		});

		it('buy effect on sellPriceImpact ', async () => {
			let now = await currentTime();

			await manager.setMarketCreationParameters(now - WEEK + 200, now - 3 * DAY + 200);
			let price = (await priceFeed.rateForCurrency(sETHKey)) / 1e18;
			let strikePriceStep = (await manager.getStrikePriceStep(sETHKey)) / 1e18;

			let newMarket = await createMarket(
				manager,
				sETHKey,
				toUnit(price - 3 * strikePriceStep),
				now + WEEK + 200,
				toUnit(10),
				creatorSigner
			);

			let priceUp = await thalesAMM.price(newMarket.address, Position.UP);
			console.log('priceUp decimal is:' + priceUp / 1e18);
			let availableToBuyFromAMM = await thalesAMM.availableToBuyFromAMM(
				newMarket.address,
				Position.UP
			);

			let availableToSellToAMM = await thalesAMM.availableToSellToAMM(
				newMarket.address,
				Position.UP
			);
			console.log('availableToSellToAMM pre buy decimal is:' + availableToSellToAMM / 1e18);

			let sellPriceImpactPostBuy = await thalesAMM.sellPriceImpact(
				newMarket.address,
				Position.UP,
				toUnit(100)
			);
			console.log('sellPriceImpactPostBuy pre buy decimal is:' + sellPriceImpactPostBuy / 1e18);

			let spentOnMarket = await thalesAMM.spentOnMarket(newMarket.address);
			console.log('spentOnMarket pre buy decimal is:' + spentOnMarket / 1e18);

			let options = await newMarket.options();
			up = await position.at(options.up);
			down = await position.at(options.down);

			await sUSDSynth.approve(thalesAMM.address, sUSDQty, { from: minter });
			await newMarket.mint(toUnit(5800), {
				from: minter,
			});

			let ammUpBalance = await up.balanceOf(thalesAMM.address);
			console.log('ammUpBalance  pre sell decimal is:' + ammUpBalance / 1e18);

			let ammDownBalance = await down.balanceOf(thalesAMM.address);
			console.log('ammDownBalance  pre sell decimal is:' + ammDownBalance / 1e18);

			let ammSusdBalance = await sUSDSynth.balanceOf(thalesAMM.address);
			console.log('ammSusdBalance pre buy decimal is:' + ammSusdBalance / 1e18);

			availableToSellToAMM = await thalesAMM.availableToSellToAMM(newMarket.address, Position.UP);
			console.log('availableToSellToAMM post buy decimal is:' + availableToSellToAMM / 1e18);

			await up.approve(thalesAMM.address, toUnit(1200), { from: minter });
			let sellToAmmQuote = await thalesAMM.sellToAmmQuote(
				newMarket.address,
				Position.UP,
				toUnit(1200)
			);
			console.log('sellToAmmQuote is ' + sellToAmmQuote / 1e18);
			let additionalSlippage = toUnit(0.01);
			await thalesAMM.sellToAMM(
				newMarket.address,
				Position.UP,
				toUnit(1200),
				sellToAmmQuote,
				additionalSlippage,
				{ from: minter }
			);
		});

		it('buying test ', async () => {
			let now = await currentTime();
			await manager.setMarketCreationParameters(now - WEEK + 200, now - 3 * DAY + 200);
			let price = (await priceFeed.rateForCurrency(sETHKey)) / 1e18;
			let strikePriceStep = (await manager.getStrikePriceStep(sETHKey)) / 1e18;

			let newMarket = await createMarket(
				manager,
				sETHKey,
				toUnit(price - 2 * strikePriceStep),
				now + WEEK + 200,
				toUnit(10),
				creatorSigner
			);

			let priceUp = await thalesAMM.price(newMarket.address, Position.UP);
			console.log('priceUp decimal is:' + priceUp / 1e18);

			let availableToBuyFromAMM = await thalesAMM.availableToBuyFromAMM(
				newMarket.address,
				Position.UP
			);
			console.log('availableToBuyFromAMM decimal is:' + availableToBuyFromAMM / 1e18);

			let buyPriceImpactMax = await thalesAMM.buyPriceImpact(
				newMarket.address,
				Position.UP,
				toUnit(availableToBuyFromAMM / 1e18)
			);
			console.log('buyPriceImpactMax decimal is:' + buyPriceImpactMax / 1e18);

			let buyFromAmmQuote = await thalesAMM.buyFromAmmQuote(
				newMarket.address,
				Position.UP,
				toUnit(availableToBuyFromAMM / 1e18)
			);
			console.log('buyFromAmmQuote decimal is:' + buyFromAmmQuote / 1e18);

			await sUSDSynth.approve(thalesAMM.address, sUSDQty, { from: minter });
			let additionalSlippage = toUnit(0.01);
			buyFromAmmQuote = await thalesAMM.buyFromAmmQuote(
				newMarket.address,
				Position.UP,
				toUnit(500)
			);

			console.log('buyFromAMMQuote 500 is', buyFromAmmQuote / 1e18);
			await thalesAMM.buyFromAMM(
				newMarket.address,
				Position.UP,
				toUnit(500),
				buyFromAmmQuote,
				additionalSlippage,
				{ from: minter }
			);
			let buyPriceImpactPostBuy = await thalesAMM.buyPriceImpact(
				newMarket.address,
				Position.UP,
				toUnit(100)
			);
			console.log(
				'buyPriceImpact post buy 500, 100 up positions decimal is:' + buyPriceImpactPostBuy / 1e18
			);

			buyPriceImpactPostBuy = await thalesAMM.buyPriceImpact(
				newMarket.address,
				Position.UP,
				toUnit(720)
			);
			console.log('buyPriceImpact near max decimal is:' + buyPriceImpactPostBuy / 1e18);

			availableToBuyFromAMM = await thalesAMM.availableToBuyFromAMM(newMarket.address, Position.UP);
			console.log('availableToBuyFromAMM post buy 500 decimal is:' + availableToBuyFromAMM / 1e18);

			buyFromAmmQuote = await thalesAMM.buyFromAmmQuote(
				newMarket.address,
				Position.UP,
				toUnit(availableToBuyFromAMM / 1e18 - 1)
			);
			await thalesAMM.buyFromAMM(
				newMarket.address,
				Position.UP,
				toUnit(availableToBuyFromAMM / 1e18 - 1),
				buyFromAmmQuote,
				additionalSlippage,
				{ from: minter }
			);
			buyPriceImpactPostBuy = await thalesAMM.buyPriceImpact(
				newMarket.address,
				Position.UP,
				toUnit(100)
			);
			console.log('buyPriceImpact post buy max  decimal is:' + buyPriceImpactPostBuy / 1e18);
			availableToBuyFromAMM = await thalesAMM.availableToBuyFromAMM(newMarket.address, Position.UP);
			console.log('availableToBuyFromAMM post buy max decimal is:' + availableToBuyFromAMM / 1e18);
		});

		it('buy effect on sellPriceImpact ', async () => {
			let now = await currentTime();
			await manager.setMarketCreationParameters(now - WEEK + 200, now - 5 * DAY + 200);
			let price = (await priceFeed.rateForCurrency(sETHKey)) / 1e18;
			let strikePriceStep = (await manager.getStrikePriceStep(sETHKey)) / 1e18;

			let newMarket = await createMarket(
				manager,
				sETHKey,
				toUnit(price + 4 * strikePriceStep),
				now - 5 * DAY + 2 * WEEK + 200,
				toUnit(10),
				creatorSigner
			);

			let priceUp = await thalesAMM.price(newMarket.address, Position.UP);
			console.log('priceUp decimal is:' + priceUp / 1e18);
			let availableToBuyFromAMM = await thalesAMM.availableToBuyFromAMM(
				newMarket.address,
				Position.UP
			);

			let availableToSellToAMM = await thalesAMM.availableToSellToAMM(
				newMarket.address,
				Position.UP
			);
			console.log('availableToSellToAMM pre buy decimal is:' + availableToSellToAMM / 1e18);

			let sellPriceImpactPostBuy = await thalesAMM.sellPriceImpact(
				newMarket.address,
				Position.UP,
				toUnit(100)
			);
			console.log('sellPriceImpactPostBuy pre buy decimal is:' + sellPriceImpactPostBuy / 1e18);

			let spentOnMarket = await thalesAMM.spentOnMarket(newMarket.address);
			console.log('spentOnMarket pre buy decimal is:' + spentOnMarket / 1e18);

			let options = await newMarket.options();
			up = await position.at(options.up);
			down = await position.at(options.down);

			let roundPool = await ThalesAMMLiquidityPool.getMarketPool(newMarket.address);

			let ammUpBalance = await up.balanceOf(roundPool);
			console.log('amm UpBalance pre buy decimal is:' + ammUpBalance / 1e18);

			let ammDownBalance = await down.balanceOf(roundPool);
			console.log('ammDownBalance pre buy  decimal is:' + ammDownBalance / 1e18);

			await sUSDSynth.approve(thalesAMM.address, sUSDQty, { from: minter });
			let buyFromAmmQuote = await thalesAMM.buyFromAmmQuote(
				newMarket.address,
				Position.UP,
				toUnit(availableToBuyFromAMM / 1e18 - 1)
			);
			let additionalSlippage = toUnit(0.01);
			await thalesAMM.buyFromAMM(
				newMarket.address,
				Position.UP,
				toUnit(availableToBuyFromAMM / 1e18 - 1),
				buyFromAmmQuote,
				additionalSlippage,
				{ from: minter }
			);

			roundPool = await ThalesAMMLiquidityPool.getMarketPool(newMarket.address);

			ammUpBalance = await up.balanceOf(roundPool);
			console.log('roundPool UpBalance post buy decimal is:' + ammUpBalance / 1e18);

			ammDownBalance = await down.balanceOf(roundPool);
			console.log('roundPool DownBalance post buy  decimal is:' + ammDownBalance / 1e18);

			ammUpBalance = await up.balanceOf(minter);
			console.log('minter UpBalance post buy decimal is:' + ammUpBalance / 1e18);

			ammDownBalance = await down.balanceOf(minter);
			console.log('minter DownBalance post buy  minter decimal is:' + ammDownBalance / 1e18);

			spentOnMarket = await thalesAMM.spentOnMarket(newMarket.address);
			console.log('spentOnMarket post buy decimal is:' + spentOnMarket / 1e18);

			availableToSellToAMM = await thalesAMM.availableToSellToAMM(newMarket.address, Position.UP);
			console.log('availableToSellToAMM post buy decimal is:' + availableToSellToAMM / 1e18);

			let result = await thalesAmmUtils.balanceOfPositionsOnMarket(
				newMarket.address,
				Position.UP,
				roundPool
			);

			console.log('balance & balance other side round pool', result[0] / 1e18, result[1] / 1e18);

			let result1 = await thalesAmmUtils.getBalanceOfPositionsOnMarket(
				newMarket.address,
				roundPool
			);

			console.log('balance & balance other side round pool', result1[0] / 1e18, result1[1] / 1e18);

			sellPriceImpactPostBuy = await thalesAMM.sellPriceImpact(
				newMarket.address,
				Position.UP,
				toUnit(100)
			);
			console.log('sellPriceImpactPostBuy post buy decimal is:' + sellPriceImpactPostBuy / 1e18);

			await up.approve(thalesAMM.address, toUnit(1205), { from: minter });
			let sellToAmmQuote = await thalesAMM.sellToAmmQuote(
				newMarket.address,
				Position.UP,
				toUnit(1205)
			);
			console.log('sellToAmmQuote is ' + sellToAmmQuote / 1e18);
			await thalesAMM.sellToAMM(
				newMarket.address,
				Position.UP,
				toUnit(1205),
				sellToAmmQuote,
				additionalSlippage,
				{ from: minter }
			);

			roundPool = await ThalesAMMLiquidityPool.getMarketPool(newMarket.address);
			ammUpBalance = await up.balanceOf(roundPool);
			console.log('roundPool UpBalance post sell decimal is:' + ammUpBalance / 1e18);

			ammDownBalance = await down.balanceOf(roundPool);
			console.log('roundPool post sell  decimal is:' + ammDownBalance / 1e18);

			spentOnMarket = await thalesAMM.spentOnMarket(newMarket.address);
			console.log('spentOnMarket post sell decimal is:' + spentOnMarket / 1e18);

			availableToSellToAMM = await thalesAMM.availableToSellToAMM(newMarket.address, Position.UP);
			console.log('availableToSellToAMM post sell decimal is:' + availableToSellToAMM / 1e18);

			let buy = await thalesAMM.buyPriceImpact(newMarket.address, Position.UP, toUnit(100));
			console.log('buy impact post sell decimal is:' + buy / 1e18);

			sellPriceImpactPostBuy = await thalesAMM.sellPriceImpact(
				newMarket.address,
				Position.UP,
				toUnit(100)
			);
			console.log('sellPriceImpactPostBuy post sell decimal is:' + sellPriceImpactPostBuy / 1e18);
		});

		it('sell effect on buyPriceImpact ', async () => {
			let now = await currentTime();
			await manager.setMarketCreationParameters(now - WEEK + 200, now - 3 * DAY + 200);
			let price = (await priceFeed.rateForCurrency(sETHKey)) / 1e18;
			let strikePriceStep = (await manager.getStrikePriceStep(sETHKey)) / 1e18;

			let newMarket = await createMarket(
				manager,
				sETHKey,
				toUnit(price + 2 * strikePriceStep),
				now - 3 * DAY + 2 * WEEK + 200,
				toUnit(10),
				creatorSigner
			);

			let roundPool = await ThalesAMMLiquidityPool.getMarketPool(newMarket.address);

			let priceUp = await thalesAMM.price(newMarket.address, Position.UP);
			console.log('priceUp decimal is:' + priceUp / 1e18);
			let availableToBuyFromAMM = await thalesAMM.availableToBuyFromAMM(
				newMarket.address,
				Position.UP
			);

			let availableToSellToAMM = await thalesAMM.availableToSellToAMM(
				newMarket.address,
				Position.UP
			);
			console.log('availableToSellToAMM pre buy decimal is:' + availableToSellToAMM / 1e18);

			let sellPriceImpactPostBuy = await thalesAMM.sellPriceImpact(
				newMarket.address,
				Position.UP,
				toUnit(100)
			);
			console.log('sellPriceImpactPostBuy pre buy decimal is:' + sellPriceImpactPostBuy / 1e18);

			let spentOnMarket = await thalesAMM.spentOnMarket(newMarket.address);
			console.log('spentOnMarket pre buy decimal is:' + spentOnMarket / 1e18);

			let options = await newMarket.options();
			up = await position.at(options.up);
			down = await position.at(options.down);

			let ammUpBalance = await up.balanceOf(roundPool);
			console.log('ammUpBalance pre buy decimal is:' + ammUpBalance / 1e18);

			let ammDownBalance = await down.balanceOf(roundPool);
			console.log('ammDownBalance pre buy  decimal is:' + ammDownBalance / 1e18);

			await newMarket.mint(toUnit(10000), {
				from: minter,
			});

			let sellToAmmQuote = await thalesAMM.sellToAmmQuote(
				newMarket.address,
				Position.UP,
				toUnit(availableToSellToAMM / 1e18 - 1)
			);
			console.log('sellToAmmQuote decimal is:' + sellToAmmQuote / 1e18);

			let additionalSlippage = toUnit(0.01);
			await up.approve(thalesAMM.address, toUnit(availableToSellToAMM / 1e18), { from: minter });
			await thalesAMM.sellToAMM(
				newMarket.address,
				Position.UP,
				toUnit(availableToSellToAMM / 1e18 - 1),
				sellToAmmQuote,
				additionalSlippage,
				{ from: minter }
			);

			ammUpBalance = await up.balanceOf(roundPool);
			console.log('ammUpBalance post buy decimal is:' + ammUpBalance / 1e18);

			ammDownBalance = await down.balanceOf(roundPool);
			console.log('ammDownBalance post buy  decimal is:' + ammDownBalance / 1e18);

			spentOnMarket = await thalesAMM.spentOnMarket(newMarket.address);
			console.log('spentOnMarket post buy decimal is:' + spentOnMarket / 1e18);

			availableToSellToAMM = await thalesAMM.availableToSellToAMM(newMarket.address, Position.UP);
			console.log('availableToSellToAMM post buy decimal is:' + availableToSellToAMM / 1e18);

			sellPriceImpactPostBuy = await thalesAMM.sellPriceImpact(
				newMarket.address,
				Position.UP,
				toUnit(100)
			);
			console.log('sellPriceImpactPostBuy post buy decimal is:' + sellPriceImpactPostBuy / 1e18);

			await sUSDSynth.approve(thalesAMM.address, sUSDQty, { from: minter });
			let buyFromAmmQuote = await thalesAMM.buyFromAmmQuote(
				newMarket.address,
				Position.UP,
				toUnit(4000)
			);

			console.log('buy from amm quote post buy decimal is:' + buyFromAmmQuote / 1e18);
			availableToBuyFromAMM = await thalesAMM.availableToBuyFromAMM(newMarket.address, Position.UP);
			console.log('available to buy', availableToBuyFromAMM / 1e18);
			await thalesAMM.buyFromAMM(
				newMarket.address,
				Position.UP,
				toUnit(4000),
				buyFromAmmQuote,
				additionalSlippage,
				{ from: minter }
			);

			ammUpBalance = await up.balanceOf(roundPool);
			console.log('ammUpBalance post sell decimal is:' + ammUpBalance / 1e18);

			ammDownBalance = await down.balanceOf(roundPool);
			console.log('ammDownBalance post sell  decimal is:' + ammDownBalance / 1e18);

			spentOnMarket = await thalesAMM.spentOnMarket(newMarket.address);
			console.log('spentOnMarket post sell decimal is:' + spentOnMarket / 1e18);

			availableToSellToAMM = await thalesAMM.availableToSellToAMM(newMarket.address, Position.UP);
			console.log('availableToSellToAMM post sell decimal is:' + availableToSellToAMM / 1e18);

			sellPriceImpactPostBuy = await thalesAMM.sellPriceImpact(
				newMarket.address,
				Position.DOWN,
				toUnit(100)
			);
			console.log('sellPriceImpactPostBuy post sell decimal is:' + sellPriceImpactPostBuy / 1e18);
		});

		it('buy other side effect ', async () => {
			let now = await currentTime();
			await manager.setMarketCreationParameters(now - WEEK + 200, now - 3 * DAY + 200);
			let price = (await priceFeed.rateForCurrency(sETHKey)) / 1e18;
			let strikePriceStep = (await manager.getStrikePriceStep(sETHKey)) / 1e18;

			let newMarket = await createMarket(
				manager,
				sETHKey,
				toUnit(price + 4 * strikePriceStep),
				now + WEEK + 200,
				toUnit(10),
				creatorSigner
			);

			let roundPool = await ThalesAMMLiquidityPool.getMarketPool(newMarket.address);

			let priceUp = await thalesAMM.price(newMarket.address, Position.UP);
			console.log('priceUp decimal is:' + priceUp / 1e18);

			let priceDown = await thalesAMM.price(newMarket.address, Position.DOWN);
			console.log('priceDown decimal is:' + priceDown / 1e18);

			let availableToBuyFromAMMUP = await thalesAMM.availableToBuyFromAMM(
				newMarket.address,
				Position.UP
			);
			console.log('availableToBuyFromAMMUP pre buy decimal is:' + availableToBuyFromAMMUP / 1e18);

			let availableToBuyFromAMMDOWN = await thalesAMM.availableToBuyFromAMM(
				newMarket.address,
				Position.DOWN
			);
			console.log(
				'availableToBuyFromAMMDOWN pre buy decimal is:' + availableToBuyFromAMMDOWN / 1e18
			);

			let spentOnMarket = await thalesAMM.spentOnMarket(newMarket.address);
			console.log('spentOnMarket pre buy decimal is:' + spentOnMarket / 1e18);

			let options = await newMarket.options();
			up = await position.at(options.up);
			down = await position.at(options.down);

			let ammUpBalance = await up.balanceOf(roundPool);
			console.log('ammUpBalance pre buy decimal is:' + ammUpBalance / 1e18);

			let ammDownBalance = await down.balanceOf(roundPool);
			console.log('ammDownBalance pre buy  decimal is:' + ammDownBalance / 1e18);

			await sUSDSynth.approve(thalesAMM.address, sUSDQty, { from: minter });
			let newbuyFromAmmQuote = await thalesAMM.buyFromAmmQuote(
				newMarket.address,
				Position.UP,
				toUnit(availableToBuyFromAMMUP / 1e18 - 1)
			);
			let additionalSlippage = toUnit(0.01);
			await thalesAMM.buyFromAMM(
				newMarket.address,
				Position.UP,
				toUnit(availableToBuyFromAMMUP / 1e18 - 1),
				newbuyFromAmmQuote,
				additionalSlippage,
				{ from: minter }
			);

			spentOnMarket = await thalesAMM.spentOnMarket(newMarket.address);
			console.log('spentOnMarket post buy decimal is:' + spentOnMarket / 1e18);

			ammUpBalance = await up.balanceOf(roundPool);
			console.log('ammUpBalance post buy decimal is:' + ammUpBalance / 1e18);

			ammDownBalance = await down.balanceOf(roundPool);
			console.log('ammDownBalance post buy  decimal is:' + ammDownBalance / 1e18);

			availableToBuyFromAMMUP = await thalesAMM.availableToBuyFromAMM(
				newMarket.address,
				Position.UP
			);
			console.log('availableToBuyFromAMMUP post buy decimal is:' + availableToBuyFromAMMUP / 1e18);

			availableToBuyFromAMMDOWN = await thalesAMM.availableToBuyFromAMM(
				newMarket.address,
				Position.DOWN
			);
			console.log(
				'availableToBuyFromAMMDOWN post buy decimal is:' + availableToBuyFromAMMDOWN / 1e18
			);

			let brandnewbuyFromAmmQuote = await thalesAMM.buyFromAmmQuote(
				newMarket.address,
				Position.DOWN,
				toUnit(1000)
			);
			await thalesAMM.buyFromAMM(
				newMarket.address,
				Position.DOWN,
				toUnit(1000),
				brandnewbuyFromAmmQuote,
				additionalSlippage,
				{ from: minter }
			);

			spentOnMarket = await thalesAMM.spentOnMarket(newMarket.address);
			console.log('spentOnMarket post buy 1000 shorts decimal is:' + spentOnMarket / 1e18);

			ammUpBalance = await up.balanceOf(roundPool);
			console.log('amm UpBalance post buy 1000 shorts  decimal is:' + ammUpBalance / 1e18);

			ammDownBalance = await down.balanceOf(roundPool);
			console.log('ammDownBalance post buy 1000 shorts  decimal is:' + ammDownBalance / 1e18);

			availableToBuyFromAMMUP = await thalesAMM.availableToBuyFromAMM(
				newMarket.address,
				Position.UP
			);
			console.log(
				'availableToBuyFromAMMUP post buy 1000 shorts decimal is:' + availableToBuyFromAMMUP / 1e18
			);

			availableToBuyFromAMMDOWN = await thalesAMM.availableToBuyFromAMM(
				newMarket.address,
				Position.DOWN
			);
			console.log(
				'availableToBuyFromAMMDOWN post buy 1000 shorts decimal is:' +
					availableToBuyFromAMMDOWN / 1e18
			);

			let superbrandnewbuyFromAmmQuote = await thalesAMM.buyFromAmmQuote(
				newMarket.address,
				Position.UP,
				toUnit(availableToBuyFromAMMUP / 1e18 - 1)
			);
			await thalesAMM.buyFromAMM(
				newMarket.address,
				Position.UP,
				toUnit(availableToBuyFromAMMUP / 1e18 - 1),
				superbrandnewbuyFromAmmQuote,
				additionalSlippage,
				{ from: minter }
			);

			spentOnMarket = await thalesAMM.spentOnMarket(newMarket.address);
			console.log('spentOnMarket post buy all UP decimal is:' + spentOnMarket / 1e18);

			ammUpBalance = await up.balanceOf(roundPool);
			console.log('amm UpBalance post buy all UP decimal is:' + ammUpBalance / 1e18);

			ammDownBalance = await down.balanceOf(roundPool);
			console.log('ammDownBalance post buy all UP decimal is:' + ammDownBalance / 1e18);

			availableToBuyFromAMMUP = await thalesAMM.availableToBuyFromAMM(
				newMarket.address,
				Position.UP
			);
			console.log(
				'availableToBuyFromAMMUP post buy all UP decimal is:' + availableToBuyFromAMMUP / 1e18
			);

			availableToBuyFromAMMDOWN = await thalesAMM.availableToBuyFromAMM(
				newMarket.address,
				Position.DOWN
			);
			console.log(
				'availableToBuyFromAMMDOWN post buy all UP decimal is:' + availableToBuyFromAMMDOWN / 1e18
			);

			let buyFromAmmQuote = await thalesAMM.buyFromAmmQuote(
				newMarket.address,
				Position.DOWN,
				toUnit(availableToBuyFromAMMDOWN / 1e18 - 1)
			);
			console.log('buyFromAmmQuote decimal is:' + buyFromAmmQuote / 1e18);

			let buyPriceImpact = await thalesAMM.buyPriceImpact(
				newMarket.address,
				Position.DOWN,
				toUnit(availableToBuyFromAMMDOWN / 1e18 - 1)
			);
			console.log('buyPriceImpact decimal is:' + buyPriceImpact / 1e18);

			priceUp = await thalesAMM.price(newMarket.address, Position.UP);
			console.log('priceUp decimal is:' + priceUp / 1e18);

			priceDown = await thalesAMM.price(newMarket.address, Position.DOWN);
			console.log('priceDown decimal is:' + priceDown / 1e18);

			await thalesAMM.buyFromAMM(
				newMarket.address,
				Position.DOWN,
				toUnit(availableToBuyFromAMMDOWN / 1e18 - 1),
				buyFromAmmQuote,
				additionalSlippage,
				{ from: minter }
			);

			spentOnMarket = await thalesAMM.spentOnMarket(newMarket.address);
			console.log('spentOnMarket post buy ALL shorts decimal is:' + spentOnMarket / 1e18);

			ammUpBalance = await up.balanceOf(roundPool);
			console.log('amm UpBalance post buy ALL shorts  decimal is:' + ammUpBalance / 1e18);

			ammDownBalance = await down.balanceOf(roundPool);
			console.log('ammDownBalance post buy ALL shorts  decimal is:' + ammDownBalance / 1e18);

			availableToBuyFromAMMUP = await thalesAMM.availableToBuyFromAMM(
				newMarket.address,
				Position.UP
			);
			console.log(
				'availableToBuyFromAMMUP post buy ALL shorts decimal is:' + availableToBuyFromAMMUP / 1e18
			);

			availableToBuyFromAMMDOWN = await thalesAMM.availableToBuyFromAMM(
				newMarket.address,
				Position.DOWN
			);
			console.log(
				'availableToBuyFromAMMDOWN post buy ALL shorts decimal is:' +
					availableToBuyFromAMMDOWN / 1e18
			);
		});

		it('Market time left condition ', async () => {
			let now = await currentTime();
			await manager.setMarketCreationParameters(now - WEEK + 200, now - 3 * DAY + 200);
			let price = (await priceFeed.rateForCurrency(sETHKey)) / 1e18;
			let strikePriceStep = (await manager.getStrikePriceStep(sETHKey)) / 1e18;

			let newMarket = await createMarket(
				manager,
				sETHKey,
				toUnit(price + 5 * strikePriceStep),
				now + WEEK + 200,
				toUnit(10),
				creatorSigner
			);

			let isMarketInAMMTrading = await thalesAMM.isMarketInAMMTrading(newMarket.address);
			console.log('isMarketInAMMTrading ' + isMarketInAMMTrading);

			await sUSDSynth.approve(thalesAMM.address, toUnit(10), { from: minter });

			let buyFromAmmQuote = await thalesAMM.buyFromAmmQuote(
				newMarket.address,
				Position.UP,
				toUnit(1)
			);
			let additionalSlippage = toUnit(0.01);

			await thalesAMM.buyFromAMM(
				newMarket.address,
				Position.UP,
				toUnit(1),
				buyFromAmmQuote,
				additionalSlippage,
				{ from: minter }
			);

			newMarket = await createMarket(
				manager,
				sETHKey,
				toUnit(price + 4 * strikePriceStep),
				now + 200,
				toUnit(10),
				creatorSigner
			);

			isMarketInAMMTrading = await thalesAMM.isMarketInAMMTrading(newMarket.address);
			console.log('isMarketInAMMTrading ' + isMarketInAMMTrading);

			await sUSDSynth.approve(thalesAMM.address, toUnit(1), { from: minter });

			await expect(
				thalesAMM.buyFromAMM(
					newMarket.address,
					Position.UP,
					toUnit(1),
					buyFromAmmQuote,
					additionalSlippage,
					{
						from: minter,
					}
				)
			).to.be.revertedWith('Market is not in Trading phase');
		});

		it('Unsupported asset market ', async () => {
			let now = await currentTime();
			await manager.setMarketCreationParameters(now - WEEK + 200, now - 3 * DAY + 200);
			let price = (await priceFeed.rateForCurrency(sAUDKey)) / 1e18;
			let strikePriceStep = (await manager.getStrikePriceStep(sAUDKey)) / 1e18;

			let newMarket = await createMarket(
				manager,
				sAUDKey,
				toUnit(price),
				now + WEEK + 200,
				toUnit(10),
				creatorSigner
			);
			let isMarketInAMMTrading = await thalesAMM.isMarketInAMMTrading(newMarket.address);
			assert.equal(false, isMarketInAMMTrading);
		});

		it('Exercise market ', async () => {
			let now = await currentTime();
			await manager.setMarketCreationParameters(now - WEEK + 200, now - 3 * DAY + 200);
			let price = (await priceFeed.rateForCurrency(sETHKey)) / 1e18;
			let strikePriceStep = (await manager.getStrikePriceStep(sETHKey)) / 1e18;

			let newMarket = await createMarket(
				manager,
				sETHKey,
				toUnit(price + 10 * strikePriceStep),
				now + WEEK + 200,
				toUnit(10),
				creatorSigner
			);

			await newMarket.mint(toUnit(1000), {
				from: minter,
			});

			// let canExerciseMaturedMarket = await thalesAMM.canExerciseMaturedMarket(newMarket.address);
			// console.log('canExerciseMaturedMarket ' + canExerciseMaturedMarket);
			let phase = await newMarket.phase();
			console.log('phase ' + phase);

			let options = await newMarket.options();
			up = await position.at(options.up);
			down = await position.at(options.down);
			await up.approve(thalesAMM.address, toUnit(100), { from: minter });
			await down.approve(thalesAMM.address, toUnit(100), { from: minter });

			let sellToAmmQuote = await thalesAMM.sellToAmmQuote(
				newMarket.address,
				Position.UP,
				toUnit(100)
			);
			console.log('sellToAmmQuote decimal is:' + sellToAmmQuote / 1e18);

			let additionalSlippage = toUnit(0.01);
			await thalesAMM.sellToAMM(
				newMarket.address,
				Position.DOWN,
				toUnit(100),
				sellToAmmQuote,
				additionalSlippage,
				{ from: minter }
			);

			await sUSDSynth.approve(thalesAMM.address, toUnit(1), { from: minter });

			let roundPool = await ThalesAMMLiquidityPool.getMarketPool(newMarket.address);

			await fastForward(day * 8);

			phase = await newMarket.phase();
			console.log('phase ' + phase);

			let isKnownMarket = await manager.isKnownMarket(newMarket.address);
			console.log('isKnownMarket ' + isKnownMarket);

			let poolUpBalance = await up.balanceOf(roundPool);
			console.log('round pool UpBalance pre Exercise decimal is:' + poolUpBalance / 1e18);

			let poolDownBalance = await down.balanceOf(roundPool);
			console.log('round pool DownBalance pre Exercise  decimal is:' + poolDownBalance / 1e18);

			let sUSDBalance = await sUSDSynth.balanceOf(roundPool);
			console.log('sUSDBalance pre Exercise  decimal is:' + sUSDBalance / 1e18);

			await manager.resolveMarket(newMarket.address);

			await ThalesAMMLiquidityPool.exerciseMarketsReadyToExercised();

			poolUpBalance = await up.balanceOf(roundPool);
			console.log('round pool UpBalance post Exercise decimal is:' + poolUpBalance / 1e18);

			poolDownBalance = await down.balanceOf(roundPool);
			console.log('round pool downBalance post Exercise  decimal is:' + poolDownBalance / 1e18);

			sUSDBalance = await sUSDSynth.balanceOf(roundPool);
			console.log('sUSDBalance post Exercise  decimal is:' + sUSDBalance / 1e18);
		});

		it('Odds calculation checker ', async () => {
			console.log('ThalesAMM deployed to ' + thalesAMM.address);

			let now = await currentTime();
			await manager.setMarketCreationParameters(now - WEEK + 200, now - 3 * DAY + 200);
			let price = (await priceFeed.rateForCurrency(sETHKey)) / 1e18;
			let strikePriceStep = (await manager.getStrikePriceStep(sETHKey)) / 1e18;

			let newMarket = await createMarket(
				manager,
				sETHKey,
				toUnit(price + strikePriceStep),
				now - 3 * DAY + WEEK + 200,
				toUnit(10),
				creatorSigner
			);

			let calculatedOdds = calculateOdds(10000, 12000, 10, 120);
			console.log('calculatedOdds is:' + calculatedOdds);
			let calculatedOddsContract = await thalesAmmUtils.calculateOdds(
				toUnit(10000),
				toUnit(12000),
				toUnit(10),
				toUnit(120)
			);
			console.log('calculatedOddsContract is:' + calculatedOddsContract / 1e18);

			let priceUp = await thalesAMM.price(newMarket.address, Position.UP);
			console.log('priceUp decimal is:' + priceUp / 1e18);

			await manager.setMarketCreationParameters(now - WEEK + 200, now - 3 * DAY + 200);
			price = (await priceFeed.rateForCurrency(sETHKey)) / 1e18;
			strikePriceStep = (await manager.getStrikePriceStep(sETHKey)) / 1e18;

			newMarket = await createMarket(
				manager,
				sETHKey,
				toUnit(price - strikePriceStep),
				now - 3 * DAY + WEEK + 200,
				toUnit(10),
				creatorSigner
			);

			calculatedOdds = calculateOdds(10000, 10000, 1, 120);
			console.log('calculatedOdds is:' + calculatedOdds);
			calculatedOddsContract = await thalesAmmUtils.calculateOdds(
				toUnit(10000),
				toUnit(10000),
				toUnit(1),
				toUnit(120)
			);
			console.log('calculatedOddsContract is:' + calculatedOddsContract / 1e18);

			priceUp = await thalesAMM.price(newMarket.address, Position.UP);
			console.log('priceUp decimal is:' + priceUp / 1e18);

			strikePriceStep = (await manager.getStrikePriceStep(sETHKey)) / 1e18;

			newMarket = await createMarket(
				manager,
				sETHKey,
				toUnit(price + 2 * strikePriceStep),
				now - 3 * DAY + WEEK + 200,
				toUnit(10),
				creatorSigner
			);

			calculatedOdds = calculateOdds(10000, 11000, 0.5, 120);
			console.log('calculatedOdds is:' + calculatedOdds);
			calculatedOddsContract = await thalesAmmUtils.calculateOdds(
				toUnit(10000),
				toUnit(11000),
				toUnit(0.5),
				toUnit(120)
			);
			console.log('calculatedOddsContract is:' + calculatedOddsContract / 1e18);

			priceUp = await thalesAMM.price(newMarket.address, Position.UP);
			//('priceUp decimal is:' + priceUp / 1e18);
		});

		it('Edge cases for price ', async () => {
			let now = await currentTime();
			await manager.setMarketCreationParameters(now - WEEK + 200, now - 3 * DAY + 200);
			let price = (await priceFeed.rateForCurrency(sETHKey)) / 1e18;
			let strikePriceStep = (await manager.getStrikePriceStep(sETHKey)) / 1e18;

			let newMarket = await createMarket(
				manager,
				sETHKey,
				toUnit(price + 2 * strikePriceStep),
				now + WEEK + 200,
				toUnit(10),
				creatorSigner
			);

			let calculatedOdds = calculateOdds(10000, 13000, 0.5, 120);
			console.log('calculatedOdds is:' + calculatedOdds);
			let calculatedOddsContract = await thalesAmmUtils.calculateOdds(
				toUnit(10000),
				toUnit(13000),
				toUnit(0.5),
				toUnit(120)
			);
			console.log('calculatedOddsContract is:' + calculatedOddsContract / 1e18);

			let priceUp = await thalesAMM.price(newMarket.address, Position.UP);
			console.log('priceUp decimal is:' + priceUp / 1e18);

			let priceDown = await thalesAMM.price(newMarket.address, Position.DOWN);
			console.log('priceDown decimal is:' + priceDown / 1e18);

			let availableToBuyFromAMM = await thalesAMM.availableToBuyFromAMM(
				newMarket.address,
				Position.UP
			);
			console.log('availableToBuyFromAMM decimal is:' + availableToBuyFromAMM / 1e18);

			let availableToSellToAMM = await thalesAMM.availableToSellToAMM(
				newMarket.address,
				Position.UP
			);
			console.log('availableToSellToAMM post buy decimal is:' + availableToSellToAMM / 1e18);

			let availableToBuyFromAMMDown = await thalesAMM.availableToBuyFromAMM(
				newMarket.address,
				Position.DOWN
			);
			console.log('availableToBuyFromAMMDown decimal is:' + availableToBuyFromAMMDown / 1e18);

			let availableToSellToAMMDown = await thalesAMM.availableToSellToAMM(
				newMarket.address,
				Position.DOWN
			);
			console.log(
				'availableToSellToAMMDown post buy decimal is:' + availableToSellToAMMDown / 1e18
			);
		});

		it('TIP examples1 ', async () => {
			let now = await currentTime();
			await manager.setMarketCreationParameters(now - WEEK + 200, now - 3 * DAY + 200);
			let price = (await priceFeed.rateForCurrency(sETHKey)) / 1e18;
			let strikePriceStep = (await manager.getStrikePriceStep(sETHKey)) / 1e18;

			let newMarket = await createMarket(
				manager,
				sETHKey,
				toUnit(price + 6 * strikePriceStep),
				now + WEEK + 200,
				toUnit(10),
				creatorSigner
			);

			let calculatedOdds = calculateOdds(10000, 10235, 0.5, 120);
			console.log('calculatedOdds is:' + calculatedOdds);
			let calculatedOddsContract = await thalesAmmUtils.calculateOdds(
				toUnit(10000),
				toUnit(10235),
				toUnit(0.5),
				toUnit(120)
			);
			console.log('calculatedOddsContract is:' + calculatedOddsContract / 1e18);

			let priceUp = await thalesAMM.price(newMarket.address, Position.UP);
			console.log('priceUp decimal is:' + priceUp / 1e18);

			let priceDown = await thalesAMM.price(newMarket.address, Position.DOWN);
			console.log('priceDown decimal is:' + priceDown / 1e18);

			let availableToBuyFromAMM = await thalesAMM.availableToBuyFromAMM(
				newMarket.address,
				Position.UP
			);
			console.log('availableToBuyFromAMM decimal is:' + availableToBuyFromAMM / 1e18);

			let availableToSellToAMM = await thalesAMM.availableToSellToAMM(
				newMarket.address,
				Position.UP
			);
			console.log('availableToSellToAMM post buy decimal is:' + availableToSellToAMM / 1e18);

			let availableToBuyFromAMMDown = await thalesAMM.availableToBuyFromAMM(
				newMarket.address,
				Position.DOWN
			);
			console.log('availableToBuyFromAMMDown decimal is:' + availableToBuyFromAMMDown / 1e18);

			let availableToSellToAMMDown = await thalesAMM.availableToSellToAMM(
				newMarket.address,
				Position.DOWN
			);
			console.log(
				'availableToSellToAMMDown post buy decimal is:' + availableToSellToAMMDown / 1e18
			);
		});

		it('TIP examples2 ', async () => {
			await thalesAMM.setMinMaxSupportedPriceAndCap(toUnit(0.05), toUnit(0.95), toUnit(500), {
				from: owner,
			});
			let now = await currentTime();
			await manager.setMarketCreationParameters(now - WEEK + 200, now - 3 * DAY + 200);
			let price = (await priceFeed.rateForCurrency(sETHKey)) / 1e18;
			let strikePriceStep = (await manager.getStrikePriceStep(sETHKey)) / 1e18;

			let newMarket = await createMarket(
				manager,
				sETHKey,
				toUnit(price - 6 * strikePriceStep),
				now + WEEK + 200,
				toUnit(10),
				creatorSigner
			);
			let calculatedOdds = calculateOdds(10000, 10235, 0.5, 120);
			console.log('calculatedOdds is:' + calculatedOdds);
			let calculatedOddsContract = await thalesAmmUtils.calculateOdds(
				toUnit(10000),
				toUnit(10235),
				toUnit(0.5),
				toUnit(120)
			);
			console.log('calculatedOddsContract is:' + calculatedOddsContract / 1e18);

			let options = await newMarket.options();
			up = await position.at(options.up);
			down = await position.at(options.down);

			let ammUpBalance = await up.balanceOf(thalesAMM.address);
			console.log('amm UpBalance pre buy decimal is:' + ammUpBalance / 1e18);

			let ammDownBalance = await down.balanceOf(thalesAMM.address);
			console.log('ammDownBalance pre buy  decimal is:' + ammDownBalance / 1e18);

			await newMarket.mint(toUnit(6000), {
				from: minter,
			});

			up.transfer(thalesAMM.address, toUnit(100), { from: minter });
			ammUpBalance = await up.balanceOf(thalesAMM.address);
			console.log('amm UpBalance pre buy decimal is:' + ammUpBalance / 1e18);

			ammDownBalance = await down.balanceOf(thalesAMM.address);
			console.log('ammDownBalance pre buy  decimal is:' + ammDownBalance / 1e18);

			let priceUp = await thalesAMM.price(newMarket.address, Position.UP);
			console.log('priceUp decimal is:' + priceUp / 1e18);

			let priceDown = await thalesAMM.price(newMarket.address, Position.DOWN);
			console.log('priceDown decimal is:' + priceDown / 1e18);

			let availableToBuyFromAMM = await thalesAMM.availableToBuyFromAMM(
				newMarket.address,
				Position.UP
			);
			console.log('availableToBuyFromAMM decimal is:' + availableToBuyFromAMM / 1e18);

			let availableToSellToAMM = await thalesAMM.availableToSellToAMM(
				newMarket.address,
				Position.UP
			);
			console.log('availableToSellToAMM post buy decimal is:' + availableToSellToAMM / 1e18);

			let availableToBuyFromAMMDown = await thalesAMM.availableToBuyFromAMM(
				newMarket.address,
				Position.DOWN
			);
			console.log('availableToBuyFromAMMDown decimal is:' + availableToBuyFromAMMDown / 1e18);

			let availableToSellToAMMDown = await thalesAMM.availableToSellToAMM(
				newMarket.address,
				Position.DOWN
			);
			console.log(
				'availableToSellToAMMDown post buy decimal is:' + availableToSellToAMMDown / 1e18
			);
		});
	});

	describe('Retrieve sUSD', () => {
		it('Retrieves sUSD ', async () => {
			let sUSDBalanceAmm = await sUSDSynth.balanceOf(thalesAMM.address);
			let sUSDBalanceOwner = await sUSDSynth.balanceOf(owner);
			await thalesAMM.retrieveSUSDAmount(owner, sUSDQtyAmm, { from: owner });
			let sUSDBalanceAmmAfter = await sUSDSynth.balanceOf(thalesAMM.address);
			let sUSDBalanceOwnerAfter = await sUSDSynth.balanceOf(owner);
			assert.bnGte(sUSDBalanceOwnerAfter, sUSDBalanceOwner);
			assert.bnGte(sUSDBalanceAmm, sUSDBalanceAmmAfter);
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
