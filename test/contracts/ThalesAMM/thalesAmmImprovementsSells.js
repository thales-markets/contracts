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

let aggregator_sAUD, aggregator_sETH, aggregator_sUSD, aggregator_nonRate;

const ZERO_ADDRESS = '0x' + '0'.repeat(40);

const MockAggregator = artifacts.require('MockAggregatorV2V3');

contract('ThalesAMM', accounts => {
	const [initialCreator, managerOwner, minter, dummy, exersicer, secondCreator, safeBox] = accounts;
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
		await factory.connect(ownerSigner).setThalesAMM(thalesAMM.address);
		sUSDSynth.issue(thalesAMM.address, sUSDQtyAmm);
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

			let additionalSlippage = toUnit(0.01);

			let options = await newMarket.options();
			up = await position.at(options.up);
			down = await position.at(options.down);
			await up.approve(thalesAMM.address, toUnit(10000000000), { from: minter });
			await down.approve(thalesAMM.address, toUnit(10000000000), { from: minter });

			await newMarket.mint(toUnit(20000), {
				from: minter,
			});

			let spentOnMarket = await thalesAMM.spentOnMarket(newMarket.address);
			let priceUp = await thalesAMM.price(newMarket.address, Position.UP);

			let availableToSellToAMM = await thalesAMM.availableToSellToAMM(
				newMarket.address,
				Position.UP
			);

			let sellPriceImpact = await thalesAMM.sellPriceImpact(
				newMarket.address,
				Position.UP,
				toUnit(availableToSellToAMM / 1e18)
			);
			console.log('sellPriceImpact decimal is:' + sellPriceImpact / 1e18);
			assert.equal(sellPriceImpact / 1e18 > 0.09, true);
			assert.equal(sellPriceImpact / 1e18 < 0.11, true);

			let sellToAmmQuote = await thalesAMM.sellToAmmQuote(
				newMarket.address,
				Position.UP,
				toUnit(availableToSellToAMM / 1e18)
			);
			await thalesAMM.sellToAMM(
				newMarket.address,
				Position.UP,
				toUnit(availableToSellToAMM / 1e18),
				sellToAmmQuote,
				additionalSlippage,
				{ from: minter }
			);

			let safeBoxsUSD = await sUSDSynth.balanceOf(safeBox);
			console.log('safeBoxsUSD post buy decimal is:' + safeBoxsUSD / 1e18);
			assert.bnGte(safeBoxsUSD, toUnit(9));
			assert.bnLte(safeBoxsUSD, toUnit(10));

			availableToSellToAMM = await thalesAMM.availableToSellToAMM(newMarket.address, Position.UP);
			sellPriceImpact = await thalesAMM.sellPriceImpact(newMarket.address, Position.UP, toUnit(1));
			spentOnMarket = await thalesAMM.spentOnMarket(newMarket.address);
			availableToSellToAMM = await thalesAMM.availableToSellToAMM(newMarket.address, Position.DOWN);
			sellPriceImpact = await thalesAMM.sellPriceImpact(
				newMarket.address,
				Position.DOWN,
				toUnit(availableToSellToAMM / 1e18)
			);
			sellToAmmQuote = await thalesAMM.sellToAmmQuote(
				newMarket.address,
				Position.DOWN,
				toUnit(availableToSellToAMM / 1e18)
			);
			await thalesAMM.sellToAMM(
				newMarket.address,
				Position.DOWN,
				toUnit(availableToSellToAMM / 1e18),
				sellToAmmQuote,
				additionalSlippage,
				{ from: minter }
			);

			sellPriceImpact = await thalesAMM.sellPriceImpact(newMarket.address, Position.UP, toUnit(1));
			console.log('sellPriceImpact decimal is:' + sellPriceImpact / 1e18);

			spentOnMarket = await thalesAMM.spentOnMarket(newMarket.address);
			console.log('spentOnMarket pre buy decimal is:' + spentOnMarket / 1e18);

			availableToSellToAMM = await thalesAMM.availableToSellToAMM(newMarket.address, Position.DOWN);
			console.log('availableToSellToAMM down decimal is:' + availableToSellToAMM / 1e18);

			safeBoxsUSD = await sUSDSynth.balanceOf(safeBox);
			console.log('safeBoxsUSD post buy decimal is:' + safeBoxsUSD / 1e18);
			assert.bnGte(safeBoxsUSD, toUnit(33));
			assert.bnLte(safeBoxsUSD, toUnit(34));
		});
	});
});
