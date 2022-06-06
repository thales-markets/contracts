'use strict';

const { artifacts, contract, web3 } = require('hardhat');
const { toBN } = web3.utils;

const { toUnit, currentTime } = require('../../utils')();
const { toBytes32 } = require('../../../index');
const { setupAllContracts } = require('../../utils/setup');

const { convertToDecimals } = require('../../utils/helpers');

let PositionalMarketFactory, factory, PositionalMarketManager, manager, addressResolver;
let PositionalMarket, priceFeed, oracle, sUSDSynth, PositionalMarketMastercopy, PositionMastercopy;
let market, up, down, position, Synth;

let aggregator_sAUD, aggregator_sETH, aggregator_sUSD, aggregator_nonRate;

const ZERO_ADDRESS = '0x' + '0'.repeat(40);

const MockAggregator = artifacts.require('MockAggregatorV2V3');

contract('ThalesAMM', accounts => {
	const [initialCreator, managerOwner, minter, dummy, exersicer, secondCreator, safeBox] = accounts;
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
			toUnit(5000),
			deciMath.address,
			toUnit(0.02),
			toUnit(0.12),
			hour * 24
		);
		await thalesAMM.setPositionalMarketManager(manager.address, { from: owner });
		await thalesAMM.setImpliedVolatilityPerAsset(sETHKey, toUnit(80), { from: owner });
		await thalesAMM.setSafeBoxData(safeBox, toUnit(0.01), { from: owner });
		await thalesAMM.setMinMaxSupportedPrice(toUnit(0.05), toUnit(0.95), { from: owner });
		sUSDSynth.issue(thalesAMM.address, sUSDQtyAmm);
	});

	const Position = {
		UP: toBN(0),
		DOWN: toBN(1),
	};

	describe('Test Safe Box', () => {
		it('Safe box [ @cov-skip ]', async () => {
			let strike = 4000;
			let now = await currentTime();
			let newMarket = await createMarket(
				manager,
				sETHKey,
				toUnit(strike),
				now + day * 10,
				toUnit(10),
				creatorSigner
			);

			let priceUp = await thalesAMM.price(newMarket.address, Position.UP);
			//console.log('priceUp decimal is:' + priceUp / 1e18);

			let availableToBuyFromAMM = await thalesAMM.availableToBuyFromAMM(
				newMarket.address,
				Position.UP
			);
			//console.log('availableToBuyFromAMM UP decimal is:' + availableToBuyFromAMM / 1e18);

			let ammSusdBalance = await sUSDSynth.balanceOf(thalesAMM.address);
			//console.log('ammSusdBalance pre buy decimal is:' + ammSusdBalance / 1e18);

			let minterSusdBalance = await sUSDSynth.balanceOf(minter);
			//console.log('minterSusdBalance post buy decimal is:' + minterSusdBalance / 1e18);

			let buyFromAmmQuote = await thalesAMM.buyFromAmmQuote(
				newMarket.address,
				Position.UP,
				toUnit(availableToBuyFromAMM / 1e18 - 1)
			);
			//console.log('buyFromAmmQuote decimal is:' + buyFromAmmQuote / 1e18);
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

			ammSusdBalance = await sUSDSynth.balanceOf(thalesAMM.address);
			//console.log('ammSusdBalance post buy decimal is:' + ammSusdBalance / 1e18);

			let spentOnMarket = await thalesAMM.spentOnMarket(newMarket.address);
			//console.log('spentOnMarket post buy decimal is:' + spentOnMarket / 1e18);

			let safeBoxsUSD = await sUSDSynth.balanceOf(safeBox);
			//console.log('safeBoxsUSD post buy decimal is:' + safeBoxsUSD / 1e18);

			let availableToBuyFromAMMDown = await thalesAMM.availableToBuyFromAMM(
				newMarket.address,
				Position.DOWN
			);
			//console.log('availableToBuyFromAMMDon UP decimal is:' + availableToBuyFromAMMDown / 1e18);

			minterSusdBalance = await sUSDSynth.balanceOf(minter);
			//console.log('minterSusdBalance post buy decimal is:' + minterSusdBalance / 1e18);

			let buyFromAmmQuoteDown = await thalesAMM.buyFromAmmQuote(
				newMarket.address,
				Position.DOWN,
				toUnit(availableToBuyFromAMMDown / 1e18 - 1)
			);
			//console.log('buyFromAmmQuoteDown decimal is:' + buyFromAmmQuoteDown / 1e18);
			await sUSDSynth.approve(thalesAMM.address, sUSDQty, { from: minter });
			await thalesAMM.buyFromAMM(
				newMarket.address,
				Position.DOWN,
				toUnit(availableToBuyFromAMMDown / 1e18 - 1),
				buyFromAmmQuoteDown,
				additionalSlippage,
				{ from: minter }
			);

			ammSusdBalance = await sUSDSynth.balanceOf(thalesAMM.address);
			//console.log('ammSusdBalance post buy decimal is:' + ammSusdBalance / 1e18);

			minterSusdBalance = await sUSDSynth.balanceOf(minter);
			//console.log('minterSusdBalance post buy decimal is:' + minterSusdBalance / 1e18);

			spentOnMarket = await thalesAMM.spentOnMarket(newMarket.address);
			//console.log('spentOnMarket post buy decimal is:' + spentOnMarket / 1e18);

			safeBoxsUSD = await sUSDSynth.balanceOf(safeBox);
			//console.log('safeBoxsUSD post buy decimal is:' + safeBoxsUSD / 1e18);

			await newMarket.mint(toUnit(20000), {
				from: minter,
			});

			let availableToSellToAMM = await thalesAMM.availableToSellToAMM(
				newMarket.address,
				Position.DOWN
			);
			//console.log('availableToSellToAMM pre buy decimal is:' + availableToSellToAMM / 1e18);

			let options = await newMarket.options();
			up = await position.at(options.up);
			down = await position.at(options.down);

			await down.approve(thalesAMM.address, toUnit(availableToSellToAMM / 1e18), { from: minter });
			let sellToAmmQuote = await thalesAMM.sellToAmmQuote(
				newMarket.address,
				Position.DOWN,
				toUnit(availableToSellToAMM / 1e18 - 1)
			);
			//console.log('sellToAmmQuote is ' + sellToAmmQuote / 1e18);
			await thalesAMM.sellToAMM(
				newMarket.address,
				Position.DOWN,
				toUnit(availableToSellToAMM / 1e18 - 1),
				sellToAmmQuote,
				additionalSlippage,
				{ from: minter }
			);

			ammSusdBalance = await sUSDSynth.balanceOf(thalesAMM.address);
			//console.log('ammSusdBalance post buy decimal is:' + ammSusdBalance / 1e18);

			minterSusdBalance = await sUSDSynth.balanceOf(minter);
			//console.log('minterSusdBalance post buy decimal is:' + minterSusdBalance / 1e18);

			spentOnMarket = await thalesAMM.spentOnMarket(newMarket.address);
			//console.log('spentOnMarket post buy decimal is:' + spentOnMarket / 1e18);

			safeBoxsUSD = await sUSDSynth.balanceOf(safeBox);
			//console.log('safeBoxsUSD post buy decimal is:' + safeBoxsUSD / 1e18);
		});

		it('Safe box sell [ @cov-skip ]', async () => {
			let strike = 4000;
			let now = await currentTime();
			let newMarket = await createMarket(
				manager,
				sETHKey,
				toUnit(strike),
				now + day * 10,
				toUnit(10),
				creatorSigner
			);

			let availableToBuyFromAMM = await thalesAMM.availableToBuyFromAMM(
				newMarket.address,
				Position.UP
			);
			//console.log('availableToBuyFromAMM UP decimal is:' + availableToBuyFromAMM / 1e18);

			let buyFromAmmQuote = await thalesAMM.buyFromAmmQuote(
				newMarket.address,
				Position.UP,
				toUnit(availableToBuyFromAMM / 1e18 - 1)
			);
			//console.log('buyFromAmmQuote decimal is:' + buyFromAmmQuote / 1e18);
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
			//console.log('availableToSellToAMM pre buy decimal is:' + availableToSellToAMM / 1e18);

			let options = await newMarket.options();
			up = await position.at(options.up);
			down = await position.at(options.down);

			await up.approve(thalesAMM.address, toUnit(availableToSellToAMM / 1e18), { from: minter });
			let sellPriceImpactPostBuy = await thalesAMM.sellPriceImpact(
				newMarket.address,
				Position.UP,
				toUnit(availableToSellToAMM / 1e18 - 1)
			);
			//console.log('sellPriceImpactPostBuy pre buy decimal is:' + sellPriceImpactPostBuy / 1e18);

			let sellToAmmQuote = await thalesAMM.sellToAmmQuote(
				newMarket.address,
				Position.UP,
				toUnit(availableToSellToAMM / 1e18 - 1)
			);
			//console.log('sellToAmmQuote is ' + sellToAmmQuote / 1e18);
			additionalSlippage = toUnit(0.01);
			await thalesAMM.sellToAMM(
				newMarket.address,
				Position.UP,
				toUnit(availableToSellToAMM / 1e18 - 1),
				sellToAmmQuote,
				additionalSlippage,
				{ from: minter }
			);

			let ammSusdBalance = await sUSDSynth.balanceOf(thalesAMM.address);
			//console.log('ammSusdBalance post buy decimal is:' + ammSusdBalance / 1e18);

			let minterSusdBalance = await sUSDSynth.balanceOf(minter);
			//console.log('minterSusdBalance post buy decimal is:' + minterSusdBalance / 1e18);

			let spentOnMarket = await thalesAMM.spentOnMarket(newMarket.address);
			//console.log('spentOnMarket post buy decimal is:' + spentOnMarket / 1e18);

			let safeBoxsUSD = await sUSDSynth.balanceOf(safeBox);
			//console.log('safeBoxsUSD post buy decimal is:' + safeBoxsUSD / 1e18);

			availableToBuyFromAMM = await thalesAMM.availableToBuyFromAMM(newMarket.address, Position.UP);
			//console.log('availableToBuyFromAMM UP decimal is:' + availableToBuyFromAMM / 1e18);

			buyFromAmmQuote = await thalesAMM.buyFromAmmQuote(
				newMarket.address,
				Position.UP,
				toUnit(availableToBuyFromAMM / 1e18 - 1)
			);
			//console.log('buyFromAmmQuote decimal is:' + buyFromAmmQuote / 1e18);
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

			spentOnMarket = await thalesAMM.spentOnMarket(newMarket.address);
			//console.log('spentOnMarket post buy decimal is:' + spentOnMarket / 1e18);

			safeBoxsUSD = await sUSDSynth.balanceOf(safeBox);
			//console.log('safeBoxsUSD post buy decimal is:' + safeBoxsUSD / 1e18);
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
