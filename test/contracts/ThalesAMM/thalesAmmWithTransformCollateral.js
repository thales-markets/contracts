'use strict';

const { artifacts, contract, web3 } = require('hardhat');
const { toBN } = web3.utils;

const { fastForward, toUnit, currentTime } = require('../../utils')();
const { toBytes32 } = require('../../../index');
const { setupAllContracts } = require('../../utils/setup');
const { assert } = require('../../utils/common');

const { convertToDecimals } = require('../../utils/helpers');

let PositionalMarketFactory, factory, PositionalMarketManager, manager, addressResolver;
let PositionalMarket,
	priceFeed,
	oracle,
	sUSDSynth,
	PositionalMarketMastercopy,
	PositionMastercopy,
	testUSDC;
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
	let thalesAMM;
	let MockPriceFeedDeployed;
	let ThalesAMMLiquidityPool;

	beforeEach(async () => {
		rewardTokenAddress = owner;

		let MockPriceFeed = artifacts.require('MockPriceFeed');
		MockPriceFeedDeployed = await MockPriceFeed.new(owner);
		await MockPriceFeedDeployed.setPricetoReturn(10000);

		priceFeedAddress = MockPriceFeedDeployed.address;

		const hour = 60 * 60;
		ThalesAMM = artifacts.require('ThalesAMM');
		thalesAMM = await ThalesAMM.new();
		let TestUSDC = artifacts.require('TestUSDC');
		testUSDC = await TestUSDC.new();
		await thalesAMM.initialize(
			owner,
			priceFeedAddress,
			testUSDC.address,
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
				_sUSD: testUSDC.address,
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

		await testUSDC.mint(firstLiquidityProvider, toUnit('100000'));
		await testUSDC.approve(ThalesAMMLiquidityPool.address, toUnit('100000'), {
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
		await testUSDC.mint(defaultLiquidityProvider, toUnit('100000'));
		await testUSDC.approve(ThalesAMMLiquidityPool.address, toUnit('100000'), {
			from: defaultLiquidityProvider,
		});

		await manager.setNeedsTransformingCollateral(true);
		await factory.connect(ownerSigner).setThalesAMM(thalesAMM.address);

		const usdcQuantity = toBN(100 * 1e6); //100 USDC
		const ammusdcQuantity = toBN(10000 * 1e6); //100 USDC

		await manager.setsUSD(testUSDC.address);
		await testUSDC.mint(minter, usdcQuantity);
		await testUSDC.approve(manager.address, usdcQuantity, { from: minter });
		await testUSDC.approve(thalesAMM.address, usdcQuantity, { from: minter });
		await testUSDC.mint(thalesAMM.address, ammusdcQuantity);
		await testUSDC.mint(creatorSigner.address, usdcQuantity);
		await testUSDC.approve(manager.address, usdcQuantity, { from: creatorSigner.address });
	});

	const Position = {
		UP: toBN(0),
		DOWN: toBN(1),
	};

	describe('Test AMM', () => {
		it('buying test ', async () => {
			let usdcBalance = await testUSDC.balanceOf(creatorSigner.address);
			let transformedCollateral = await manager.transformCollateral(toUnit(10).toString());

			let now = await currentTime();
			await manager.setMarketCreationParameters(now - WEEK + 200, now - 4 * day + 200);
			let price = (await priceFeed.rateForCurrency(sETHKey)) / 1e18;
			let strikePriceStep = (await manager.getStrikePriceStep(sETHKey)) / 1e18;

			let newMarket = await createMarket(
				manager,
				sETHKey,
				toUnit(price + 4 * strikePriceStep),
				now - 4 * day + 2 * WEEK + 200,
				toUnit(10),
				creatorSigner
			);

			let options = await newMarket.options();
			up = await position.at(options.up);
			down = await position.at(options.down);

			let ammUpBalance = await up.balanceOf(creatorSigner.address);

			let availableToBuyFromAMM = await thalesAMM.availableToBuyFromAMM(
				newMarket.address,
				Position.UP
			);

			let buyFromAmmQuote = await thalesAMM.buyFromAmmQuote(
				newMarket.address,
				Position.UP,
				toUnit(availableToBuyFromAMM / 1e18 - 1)
			);
			console.log('buyFromAmmQuote decimal is:' + buyFromAmmQuote);
			assert.equal(buyFromAmmQuote > 200 * 1e6, true);
			assert.equal(buyFromAmmQuote < 300 * 1e6, true);

			await testUSDC.approve(thalesAMM.address, sUSDQty, { from: minter });
			let additionalSlippage = toUnit(0.01);
			buyFromAmmQuote = await thalesAMM.buyFromAmmQuote(
				newMarket.address,
				Position.UP,
				toUnit(500)
			);
			console.log('buyFromAmmQuote 500 decimal is:' + buyFromAmmQuote / 1e6);
			assert.equal(buyFromAmmQuote > 99 * 1e6 && buyFromAmmQuote < 100 * 1e6, true);

			//slippage test
			await thalesAMM.buyFromAMM(
				newMarket.address,
				Position.UP,
				toUnit(500),
				Math.floor(buyFromAmmQuote / 1.001) + '',
				additionalSlippage,
				{ from: minter }
			);

			usdcBalance = await testUSDC.balanceOf(minter);
			console.log('usdcBalance minter after:' + usdcBalance / 1e6);
			usdcBalance = await testUSDC.balanceOf(thalesAMM.address);
			console.log('usdcBalance thalesAMM after:' + usdcBalance / 1e6);
			usdcBalance = await testUSDC.balanceOf(safeBox);
			console.log('usdcBalance safeBox after:' + usdcBalance / 1e6);

			ammUpBalance = await up.balanceOf(minter);
			console.log('up balance minter:' + ammUpBalance / 1e18);

			await up.approve(thalesAMM.address, toUnit(100), { from: minter });
			await down.approve(thalesAMM.address, toUnit(100), { from: minter });
			let sellToAmmQuote = await thalesAMM.sellToAmmQuote(
				newMarket.address,
				Position.UP,
				toUnit(100)
			);
			console.log('sellToAmmQuote is ' + sellToAmmQuote / 1e6);
			await thalesAMM.sellToAMM(
				newMarket.address,
				Position.UP,
				toUnit(100),
				sellToAmmQuote,
				additionalSlippage,
				{ from: minter }
			);

			usdcBalance = await testUSDC.balanceOf(minter);
			console.log('usdcBalance minter after sell:' + usdcBalance / 1e6);
			usdcBalance = await testUSDC.balanceOf(thalesAMM.address);
			console.log('usdcBalance thalesAMM after sell:' + usdcBalance / 1e6);
			usdcBalance = await testUSDC.balanceOf(safeBox);
			console.log('usdcBalance safeBox after sell:' + usdcBalance / 1e6);

			ammUpBalance = await up.balanceOf(minter);
			console.log('up balance minter sell:' + ammUpBalance / 1e18);

			const minterQuantity = toBN(1001 * 1e6); //1000 USDC
			await testUSDC.mint(minter, minterQuantity);
			await testUSDC.approve(manager.address, minterQuantity, { from: minter });
			await newMarket.mint(toUnit(1000), {
				from: minter,
			});

			usdcBalance = await testUSDC.balanceOf(minter);
			console.log('usdcBalance minter after mint:' + usdcBalance / 1e6);

			sellToAmmQuote = await thalesAMM.sellToAmmQuote(
				newMarket.address,
				Position.DOWN,
				toUnit(500)
			);
			console.log('sellToAmmQuote decimal is:' + sellToAmmQuote / 1e6);
			await down.approve(thalesAMM.address, toUnit(500), { from: minter });
			await thalesAMM.sellToAMM(
				newMarket.address,
				Position.DOWN,
				toUnit(500),
				sellToAmmQuote,
				additionalSlippage,
				{ from: minter }
			);

			usdcBalance = await testUSDC.balanceOf(minter);
			console.log('usdcBalance minter after sell2:' + usdcBalance / 1e6);
			usdcBalance = await testUSDC.balanceOf(thalesAMM.address);
			console.log('usdcBalance thalesAMM after sell2:' + usdcBalance / 1e6);
			usdcBalance = await testUSDC.balanceOf(safeBox);
			console.log('usdcBalance safeBox after sell2:' + usdcBalance / 1e6);

			await fastForward(day * 20);

			let phase = await newMarket.phase();
			console.log('phase ' + phase);

			let isKnownMarket = await manager.isKnownMarket(newMarket.address);
			console.log('isKnownMarket ' + isKnownMarket);

			ammUpBalance = await up.balanceOf(thalesAMM.address);
			console.log('amm UpBalance pre Exercise decimal is:' + ammUpBalance / 1e18);

			let ammDownBalance = await down.balanceOf(thalesAMM.address);
			console.log('ammDownBalance pre Exercise  decimal is:' + ammDownBalance / 1e18);

			usdcBalance = await sUSDSynth.balanceOf(thalesAMM.address);
			console.log('usdcBalance post Exercise  decimal is:' + usdcBalance / 1e6);

			// let canExerciseMaturedMarket = await thalesAMM.canExerciseMaturedMarket(newMarket.address);
			// console.log('canExerciseMaturedMarket ' + canExerciseMaturedMarket);

			// await thalesAMM.exerciseMaturedMarket(newMarket.address);

			// ammUpBalance = await up.balanceOf(thalesAMM.address);
			// console.log('amm UpBalance post Exercise decimal is:' + ammUpBalance / 1e18);
			// ammDownBalance = await down.balanceOf(thalesAMM.address);
			// console.log('ammDownBalance pre Exercise  decimal is:' + ammDownBalance / 1e18);

			// usdcBalance = await testUSDC.balanceOf(minter);
			// console.log('usdcBalance minter after exercize:' + usdcBalance / 1e6);
			// usdcBalance = await testUSDC.balanceOf(thalesAMM.address);
			// console.log('usdcBalance thalesAMM after exercize:' + usdcBalance / 1e6);
			// usdcBalance = await testUSDC.balanceOf(safeBox);
			// console.log('usdcBalance safeBox after exercize:' + usdcBalance / 1e6);

			// assert.equal(usdcBalance > 5 * 1e6, true);
		});
	});
});
