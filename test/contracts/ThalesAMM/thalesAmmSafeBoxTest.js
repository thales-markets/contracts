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
let market, up, down, position, Synth;

let aggregator_sAUD, aggregator_sETH, aggregator_sUSD, aggregator_nonRate, safeBox;

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
		firstLiquidityProvider,
		defaultLiquidityProvider,
	] = accounts;
	const [first, owner, second, third, fourth] = accounts;
	let creatorSigner, ownerSigner;

	const sUSDQty = toUnit(100000);
	const sUSDQtyAmm = toUnit(5000);
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
		await aggregator_sETH.setLatestAnswer(convertToDecimals(4000, 8), timestamp);
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
	let thalesAMM;
	let MockPriceFeedDeployed;
	let ThalesAMMLiquidityPool;

	beforeEach(async () => {
		priceFeedAddress = owner;
		rewardTokenAddress = owner;

		let MockPriceFeed = artifacts.require('MockPriceFeed');
		MockPriceFeedDeployed = await MockPriceFeed.new(owner);
		await MockPriceFeedDeployed.setPricetoReturn(10000);

		priceFeedAddress = MockPriceFeedDeployed.address;

		let SafeBox = artifacts.require('SafeBox');
		safeBox = await SafeBox.new();
		await safeBox.initialize(owner, sUSDSynth.address);

		const hour = 60 * 60;
		ThalesAMM = artifacts.require('ThalesAMM');
		thalesAMM = await ThalesAMM.new();
		await thalesAMM.initialize(
			owner,
			priceFeedAddress,
			sUSDSynth.address,
			toUnit(5000),
			owner,
			toUnit(0.02),
			toUnit(0.12),
			hour * 24
		);
		await thalesAMM.setPositionalMarketManager(manager.address, { from: owner });
		await thalesAMM.setImpliedVolatilityPerAsset(sETHKey, toUnit(80), { from: owner });
		await thalesAMM.setSafeBoxData(safeBox.address, toUnit(0.01), { from: owner });
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
				_needsTransformingCollateral: false,
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

		sUSDSynth.issue(thalesAMM.address, sUSDQtyAmm);

		await factory.connect(ownerSigner).setThalesAMM(thalesAMM.address);
	});

	const Position = {
		UP: toBN(0),
		DOWN: toBN(1),
	};

	describe('Test Safe Box', () => {
		it('Safe box ', async () => {
			let now = await currentTime();
			await manager.setMarketCreationParameters(now - WEEK + 200, now - 3 * day + 200);
			let price = (await priceFeed.rateForCurrency(sETHKey)) / 1e18;
			let strikePriceStep = (await manager.getStrikePriceStep(sETHKey)) / 1e18;

			let strike = price;

			let newMarket = await createMarket(
				manager,
				sETHKey,
				toUnit(strike),
				now + WEEK + 200,
				toUnit(10),
				creatorSigner
			);

			let availableToBuyFromAMM = await thalesAMM.availableToBuyFromAMM(
				newMarket.address,
				Position.UP
			);

			let buyFromAmmQuote = await thalesAMM.buyFromAmmQuote(
				newMarket.address,
				Position.UP,
				toUnit(availableToBuyFromAMM / 1e18 - 1)
			);
			await sUSDSynth.approve(thalesAMM.address, sUSDQty, { from: minter });
			let additionalSlippage = toUnit(0.01);
			await thalesAMM.buyFromAMM(
				newMarket.address,
				Position.UP,
				toUnit(availableToBuyFromAMM / 1e18 - 1),
				buyFromAmmQuote,
				additionalSlippage,
				{ from: minter }
			);

			let safeBoxsUSD = await sUSDSynth.balanceOf(safeBox.address);
			console.log('safeBoxsUSD before assert and post buy decimal is:' + safeBoxsUSD / 1e18);

			assert.bnGte(safeBoxsUSD, toUnit(11));
			assert.bnLte(safeBoxsUSD, toUnit(13));

			let availableToBuyFromAMMDown = await thalesAMM.availableToBuyFromAMM(
				newMarket.address,
				Position.DOWN
			);

			let buyFromAmmQuoteDown = await thalesAMM.buyFromAmmQuote(
				newMarket.address,
				Position.DOWN,
				toUnit(availableToBuyFromAMMDown / 1e18 - 1)
			);
			await sUSDSynth.approve(thalesAMM.address, sUSDQty, { from: minter });
			await thalesAMM.buyFromAMM(
				newMarket.address,
				Position.DOWN,
				toUnit(availableToBuyFromAMMDown / 1e18 - 1),
				buyFromAmmQuoteDown,
				additionalSlippage,
				{ from: minter }
			);

			safeBoxsUSD = await sUSDSynth.balanceOf(safeBox.address);
			console.log('safeBoxsUSD post buy decimal is:' + safeBoxsUSD / 1e18);
			assert.bnGte(safeBoxsUSD, toUnit(35));
			assert.bnLte(safeBoxsUSD, toUnit(36));

			await newMarket.mint(toUnit(20000), {
				from: minter,
			});

			let availableToSellToAMM = await thalesAMM.availableToSellToAMM(
				newMarket.address,
				Position.DOWN
			);

			let options = await newMarket.options();
			up = await position.at(options.up);
			down = await position.at(options.down);

			await down.approve(thalesAMM.address, toUnit(availableToSellToAMM / 1e18), { from: minter });
			let sellToAmmQuote = await thalesAMM.sellToAmmQuote(
				newMarket.address,
				Position.DOWN,
				toUnit(availableToSellToAMM / 1e18 - 1)
			);
			await thalesAMM.sellToAMM(
				newMarket.address,
				Position.DOWN,
				toUnit(availableToSellToAMM / 1e18 - 1),
				sellToAmmQuote,
				additionalSlippage,
				{ from: minter }
			);

			safeBoxsUSD = await sUSDSynth.balanceOf(safeBox.address);
			console.log('safeBoxsUSD post buy decimal is:' + safeBoxsUSD / 1e18);
			assert.bnGte(safeBoxsUSD, toUnit(58));
			assert.bnLte(safeBoxsUSD, toUnit(60));
		});

		it('Safe box sell ', async () => {
			let now = await currentTime();
			await manager.setMarketCreationParameters(now - WEEK + 200, now - 3 * day + 200);
			let price = (await priceFeed.rateForCurrency(sETHKey)) / 1e18;
			let strikePriceStep = (await manager.getStrikePriceStep(sETHKey)) / 1e18;

			let strike = price;

			let newMarket = await createMarket(
				manager,
				sETHKey,
				toUnit(strike),
				now + 2 * WEEK + 200,
				toUnit(10),
				creatorSigner
			);

			let availableToBuyFromAMM = await thalesAMM.availableToBuyFromAMM(
				newMarket.address,
				Position.UP
			);

			let buyFromAmmQuote = await thalesAMM.buyFromAmmQuote(
				newMarket.address,
				Position.UP,
				toUnit(availableToBuyFromAMM / 1e18 - 1)
			);
			await sUSDSynth.approve(thalesAMM.address, sUSDQty, { from: minter });
			let additionalSlippage = toUnit(0.01);
			await thalesAMM.buyFromAMM(
				newMarket.address,
				Position.UP,
				toUnit(availableToBuyFromAMM / 1e18 - 1),
				buyFromAmmQuote,
				additionalSlippage,
				{ from: minter }
			);

			await newMarket.mint(toUnit(20000), {
				from: minter,
			});

			let availableToSellToAMM = await thalesAMM.availableToSellToAMM(
				newMarket.address,
				Position.UP
			);

			let options = await newMarket.options();
			up = await position.at(options.up);
			down = await position.at(options.down);

			await up.approve(thalesAMM.address, toUnit(availableToSellToAMM / 1e18), { from: minter });
			let sellPriceImpactPostBuy = await thalesAMM.sellPriceImpact(
				newMarket.address,
				Position.UP,
				toUnit(availableToSellToAMM / 1e18 - 1)
			);
			let sellToAmmQuote = await thalesAMM.sellToAmmQuote(
				newMarket.address,
				Position.UP,
				toUnit(availableToSellToAMM / 1e18 - 1)
			);
			additionalSlippage = toUnit(0.01);
			await thalesAMM.sellToAMM(
				newMarket.address,
				Position.UP,
				toUnit(availableToSellToAMM / 1e18 - 1),
				sellToAmmQuote,
				additionalSlippage,
				{ from: minter }
			);

			let safeBoxsUSD = await sUSDSynth.balanceOf(safeBox.address);
			console.log('safeBoxsUSD post buy decimal is:' + safeBoxsUSD / 1e18);
			assert.bnGte(safeBoxsUSD, toUnit(34));
			assert.bnLte(safeBoxsUSD, toUnit(35));

			availableToBuyFromAMM = await thalesAMM.availableToBuyFromAMM(newMarket.address, Position.UP);

			buyFromAmmQuote = await thalesAMM.buyFromAmmQuote(
				newMarket.address,
				Position.UP,
				toUnit(availableToBuyFromAMM / 1e18 - 1)
			);
			await sUSDSynth.approve(thalesAMM.address, sUSDQty, { from: minter });
			additionalSlippage = toUnit(0.01);
			await thalesAMM.buyFromAMM(
				newMarket.address,
				Position.UP,
				toUnit(availableToBuyFromAMM / 1e18 - 1),
				buyFromAmmQuote,
				additionalSlippage,
				{ from: minter }
			);

			safeBoxsUSD = await sUSDSynth.balanceOf(safeBox.address);
			console.log('safeBoxsUSD post buy decimal is:' + safeBoxsUSD / 1e18);
			assert.bnGte(safeBoxsUSD, toUnit(59));
			assert.bnLte(safeBoxsUSD, toUnit(60));
		});
	});

	describe('Retrieve sUSD from SafeBox', () => {
		it('Retrieves sUSD ', async () => {
			await sUSDSynth.issue(safeBox.address, sUSDQty);

			let sUSDBalanceSafeBox = await sUSDSynth.balanceOf(safeBox.address);
			let sUSDBalanceOwner = await sUSDSynth.balanceOf(owner);
			await safeBox.retrieveSUSDAmount(owner, sUSDQtyAmm, { from: owner });
			let sUSDBalanceSafeBoxAfter = await sUSDSynth.balanceOf(thalesAMM.address);
			let sUSDBalanceOwnerAfter = await sUSDSynth.balanceOf(owner);
			assert.bnGte(sUSDBalanceOwnerAfter, sUSDBalanceOwner);
			assert.bnGte(sUSDBalanceSafeBox, sUSDBalanceSafeBoxAfter);
		});
	});
});
