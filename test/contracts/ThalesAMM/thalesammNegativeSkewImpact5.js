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

const MockAggregator = artifacts.require('MockAggregatorV2V3');

contract('ThalesAMM', (accounts) => {
	const [initialCreator, managerOwner, minter, dummy, exersicer, secondCreator, safeBox] = accounts;
	const [creator, owner] = accounts;
	let creatorSigner, ownerSigner;

	const sUSDQty = toUnit(1000000);
	const sUSDQtyAmm = toUnit(100000);

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
		await aggregator_sETH.setLatestAnswer(convertToDecimals(2290, 8), timestamp);
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
	let MockPriceFeedDeployed;

	beforeEach(async () => {
		priceFeedAddress = owner;
		rewardTokenAddress = owner;

		let MockPriceFeed = artifacts.require('MockPriceFeed');
		MockPriceFeedDeployed = await MockPriceFeed.new(owner);
		await MockPriceFeedDeployed.setPricetoReturn(2290);

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
			toUnit(10000),
			deciMath.address,
			toUnit(0.02),
			toUnit(0.2),
			hour * 2
		);
		await thalesAMM.setPositionalMarketManager(manager.address, { from: owner });
		await thalesAMM.setImpliedVolatilityPerAsset(sETHKey, toUnit(138), { from: owner });
		await thalesAMM.setSafeBoxData(safeBox, toUnit(0.03), { from: owner });
		await thalesAMM.setMinMaxSupportedPriceAndCap(toUnit(0.05), toUnit(0.95), toUnit(10000), {
			from: owner,
		});
		let ThalesAMMUtils = artifacts.require('ThalesAMMUtils');
		let thalesAMMUtils = await ThalesAMMUtils.new();
		await thalesAMM.setAmmUtils(thalesAMMUtils.address, {
			from: owner,
		});
		sUSDSynth.issue(thalesAMM.address, sUSDQtyAmm);

		await factory.connect(ownerSigner).setThalesAMM(thalesAMM.address);
	});

	const Position = {
		UP: toBN(0),
		DOWN: toBN(1),
	};

	describe('AMM Negative Skew Impact', () => {
		it('buying test ', async () => {
			let now = await currentTime();
			let newMarket = await createMarket(
				manager,
				sETHKey,
				toUnit(2800),
				now + day * 12,
				toUnit(10),
				creatorSigner
			);

			let priceUp = await thalesAMM.price(newMarket.address, Position.UP);
			console.log('priceUp decimal is:' + priceUp / 1e18);

			let availableToBuyFromAMM = await thalesAMM.availableToBuyFromAMM(
				newMarket.address,
				Position.UP
			);

			let availableToBuyFromAMMDown = await thalesAMM.availableToBuyFromAMM(
				newMarket.address,
				Position.DOWN
			);
			console.log('availableToBuyFromAMM decimal is:' + availableToBuyFromAMM / 1e18);
			console.log('availableToBuyFromAMM DOWN decimal is:' + availableToBuyFromAMMDown / 1e18);

			let options = await newMarket.options();
			up = await position.at(options.up);
			down = await position.at(options.down);

			let ammUpBalance = await up.balanceOf(thalesAMM.address);
			console.log('amm Up Balance is:' + ammUpBalance / 1e18);

			let ammDownBalance = await down.balanceOf(thalesAMM.address);
			console.log('amm Down Balance is:' + ammDownBalance / 1e18);

			let buyFromAmmQuote = await thalesAMM.buyFromAmmQuote(
				newMarket.address,
				Position.DOWN,
				toUnit(300)
			);
			console.log('buyFromAmmQuote decimal is:' + buyFromAmmQuote / 1e18);
			let additionalSlippage = toUnit(0.01);
			await sUSDSynth.approve(thalesAMM.address, sUSDQty, { from: minter });
			await thalesAMM.buyFromAMM(
				newMarket.address,
				Position.DOWN,
				toUnit(300),
				buyFromAmmQuote,
				additionalSlippage,
				{ from: minter }
			);

			priceUp = await thalesAMM.price(newMarket.address, Position.UP);
			console.log('priceUp decimal is:' + priceUp / 1e18);

			let buyPriceImpactPostBuy = await thalesAMM.buyPriceImpact(
				newMarket.address,
				Position.UP,
				toUnit(1)
			);
			console.log('buyPriceImpact post buy 1 decimal is:' + buyPriceImpactPostBuy / 1e16);

			let availableToBuyFromAMMDownNew = await thalesAMM.availableToBuyFromAMM(
				newMarket.address,
				Position.UP
			);
			console.log(
				'availableToBuyFromAMMNew DOWN decimal is:' + availableToBuyFromAMMDownNew / 1e18
			);

			const buyPriceImpactPostBuyDOWNNewMax = await thalesAMM.buyPriceImpact(
				newMarket.address,
				Position.UP,
				toUnit(availableToBuyFromAMMDownNew / 1e18 - 1)
			);

			console.log(
				'buyPriceImpactPostBuyUpNewMax post buy  decimal is:' +
					buyPriceImpactPostBuyDOWNNewMax / 1e16
			);

			const buyQuoteUpNewMax = await thalesAMM.buyFromAmmQuote(
				newMarket.address,
				Position.UP,
				toUnit(availableToBuyFromAMMDownNew / 1e18 - 1)
			);

			console.log('buyQuoteUpNewMax decimal is:' + buyQuoteUpNewMax / 1e18);
		});
	});
});
