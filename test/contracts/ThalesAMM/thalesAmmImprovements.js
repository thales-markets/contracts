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

const WEEK = 604800;

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
			},
			{ from: owner }
		);

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
		it('buying test ', async () => {
			let now = await currentTime();
			let newMarket = await createMarket(
				manager,
				sETHKey,
				toUnit(10000),
				now + day * 10,
				toUnit(10),
				creatorSigner
			);

			let spentOnMarket = await thalesAMM.spentOnMarket(newMarket.address);
			console.log('spentOnMarket pre buy decimal is:' + spentOnMarket / 1e18);
			let priceUp = await thalesAMM.price(newMarket.address, Position.UP);
			console.log('priceUp decimal is:' + priceUp / 1e18);

			let availableToBuyFromAMM = await thalesAMM.availableToBuyFromAMM(
				newMarket.address,
				Position.UP
			);
			console.log('availableToBuyFromAMM UP decimal is:' + availableToBuyFromAMM / 1e18);

			let availableToBuyFromAMMDown = await thalesAMM.availableToBuyFromAMM(
				newMarket.address,
				Position.DOWN
			);
			console.log('availableToBuyFromAMM down decimal is:' + availableToBuyFromAMMDown / 1e18);

			let buyPriceImpactMin = await thalesAMM.buyPriceImpact(
				newMarket.address,
				Position.UP,
				toUnit(1)
			);
			console.log('buyPriceImpactMin decimal is:' + buyPriceImpactMin / 1e18);

			let buyPriceImpactMax = await thalesAMM.buyPriceImpact(
				newMarket.address,
				Position.UP,
				toUnit(availableToBuyFromAMM / 1e18)
			);

			console.log('buyPriceImpactMax decimal is:' + buyPriceImpactMax / 1e18);

			let buyPriceImpactMid = await thalesAMM.buyPriceImpact(
				newMarket.address,
				Position.UP,
				toUnit(availableToBuyFromAMM / 2 / 1e18)
			);
			console.log('buyPriceImpactMid decimal is:' + buyPriceImpactMid / 1e18);

			await sUSDSynth.approve(thalesAMM.address, sUSDQty, { from: minter });
			let additionalSlippage = toUnit(0.01);
			let buyFromAmmQuote = await thalesAMM.buyFromAmmQuote(
				newMarket.address,
				Position.UP,
				toUnit(availableToBuyFromAMM / 1e18 - 1)
			);
			console.log('buyFromAmmQuote decimal is:' + buyFromAmmQuote / 1e18);
			let roundPool = await ThalesAMMLiquidityPool.getMarketPool(newMarket.address);
			console.log('susd contract:', (await sUSDSynth.balanceOf(roundPool)) / 1e18);
			await thalesAMM.buyFromAMM(
				newMarket.address,
				Position.UP,
				toUnit(availableToBuyFromAMM / 1e18 - 1),
				buyFromAmmQuote,
				additionalSlippage,
				{ from: minter }
			);
			console.log(
				'Bought  ' + (availableToBuyFromAMM / 1e18 - 1) + ' for ' + buyFromAmmQuote / 1e18 + ' sUSD'
			);

			let safeBoxsUSD = await sUSDSynth.balanceOf(safeBox);
			console.log('safeBoxsUSD post buy decimal is:' + safeBoxsUSD / 1e18);

			availableToBuyFromAMM = await thalesAMM.availableToBuyFromAMM(newMarket.address, Position.UP);
			console.log('availableToBuyFromAMM here decimal is:' + availableToBuyFromAMM / 1e18);

			spentOnMarket = await thalesAMM.spentOnMarket(newMarket.address);
			console.log('spentOnMarket pre buy decimal is:' + spentOnMarket / 1e18);

			buyPriceImpactMin = await thalesAMM.buyPriceImpact(newMarket.address, Position.UP, toUnit(1));
			console.log('buyPriceImpactMin decimal is:' + buyPriceImpactMin / 1e18);

			buyPriceImpactMin = await thalesAMM.buyPriceImpact(
				newMarket.address,
				Position.DOWN,
				toUnit(1)
			);
			console.log('buyPriceImpactMin down decimal is:' + buyPriceImpactMin / 1e18);
			availableToBuyFromAMMDown = await thalesAMM.availableToBuyFromAMM(
				newMarket.address,
				Position.DOWN
			);
			console.log('availableToBuyFromAMM down decimal is:' + availableToBuyFromAMMDown / 1e18);

			buyPriceImpactMin = await thalesAMM.buyPriceImpact(
				newMarket.address,
				Position.DOWN,
				toUnit(1000)
			);
			console.log('buyPriceImpactMin down thousand decimal is:' + buyPriceImpactMin / 1e18);

			buyPriceImpactMax = await thalesAMM.buyPriceImpact(
				newMarket.address,
				Position.DOWN,
				toUnit(availableToBuyFromAMMDown / 1e18 - 1)
			);
			console.log(
				'buyPriceImpactMax down availableToBuyFromAMM decimal is:' + buyPriceImpactMax / 1e18
			);

			buyFromAmmQuote = await thalesAMM.buyFromAmmQuote(
				newMarket.address,
				Position.DOWN,
				toUnit(availableToBuyFromAMM / 1e18 - 1)
			);
			console.log('buyFromAmmQuote decimal is:' + buyFromAmmQuote / 1e18);
			roundPool = await ThalesAMMLiquidityPool.getMarketPool(newMarket.address);
			console.log('susd contract:', (await sUSDSynth.balanceOf(roundPool)) / 1e18);
			await thalesAMM.buyFromAMM(
				newMarket.address,
				Position.DOWN,
				toUnit(availableToBuyFromAMM / 1e18 - 1),
				buyFromAmmQuote,
				additionalSlippage,
				{ from: minter }
			);

			safeBoxsUSD = await sUSDSynth.balanceOf(safeBox);
			console.log('safeBoxsUSD post buy decimal is:' + safeBoxsUSD / 1e18);

			spentOnMarket = await thalesAMM.spentOnMarket(newMarket.address);
			console.log('spentOnMarket pre buy decimal is:' + spentOnMarket / 1e18);

			availableToBuyFromAMM = await thalesAMM.availableToBuyFromAMM(
				newMarket.address,
				Position.DOWN
			);
			console.log('availableToBuyFromAMM down decimal is:' + availableToBuyFromAMM / 1e18);

			buyPriceImpactMin = await thalesAMM.buyPriceImpact(
				newMarket.address,
				Position.DOWN,
				toUnit(1)
			);
			console.log('buyPriceImpactMin down decimal is:' + buyPriceImpactMin / 1e18);

			buyPriceImpactMax = await thalesAMM.buyPriceImpact(
				newMarket.address,
				Position.DOWN,
				toUnit(availableToBuyFromAMM / 1e18 - 1)
			);
			console.log(
				'buyPriceImpactMax down availableToBuyFromAMM decimal is:' + buyPriceImpactMax / 1e18
			);

			buyFromAmmQuote = await thalesAMM.buyFromAmmQuote(
				newMarket.address,
				Position.DOWN,
				toUnit(availableToBuyFromAMM / 1e18 - 1)
			);
			console.log('buyFromAmmQuote decimal is:' + buyFromAmmQuote / 1e18);
			roundPool = await ThalesAMMLiquidityPool.getMarketPool(newMarket.address);
			console.log('susd contract:', (await sUSDSynth.balanceOf(roundPool)) / 1e18);
			await thalesAMM.buyFromAMM(
				newMarket.address,
				Position.DOWN,
				toUnit(availableToBuyFromAMM / 1e18 - 1),
				buyFromAmmQuote,
				additionalSlippage,
				{ from: minter }
			);

			console.log(
				'Bought  ' + (availableToBuyFromAMM / 1e18 - 1) + ' for ' + buyFromAmmQuote / 1e18 + ' sUSD'
			);

			safeBoxsUSD = await sUSDSynth.balanceOf(safeBox);
			console.log('safeBoxsUSD post buy decimal is:' + safeBoxsUSD / 1e18);

			spentOnMarket = await thalesAMM.spentOnMarket(newMarket.address);
			console.log('spentOnMarket pre buy decimal is:' + spentOnMarket / 1e18);

			availableToBuyFromAMM = await thalesAMM.availableToBuyFromAMM(
				newMarket.address,
				Position.DOWN
			);
			console.log('availableToBuyFromAMM down decimal is:' + availableToBuyFromAMM / 1e18);

			let availableToBuyFromAMMUP = await thalesAMM.availableToBuyFromAMM(
				newMarket.address,
				Position.UP
			);
			console.log('availableToBuyFromAMM UP decimal is:' + availableToBuyFromAMMUP / 1e18);

			buyPriceImpactMin = await thalesAMM.buyPriceImpact(newMarket.address, Position.UP, toUnit(1));
			console.log('buyPriceImpactMin UP decimal is:' + buyPriceImpactMin / 1e18);

			buyPriceImpactMax = await thalesAMM.buyPriceImpact(
				newMarket.address,
				Position.UP,
				toUnit(availableToBuyFromAMMUP / 1e18 - 1)
			);
			console.log(
				'buyPriceImpactMax down availableToBuyFromAMMUP decimal is:' + buyPriceImpactMax / 1e18
			);
		});
	});
});
