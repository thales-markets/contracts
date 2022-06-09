'use strict';

const { artifacts, contract, web3 } = require('hardhat');
const { toBN } = web3.utils;

const { fastForward, toUnit, currentTime } = require('../../utils')();
const { toBytes32 } = require('../../../index');
const { setupAllContracts } = require('../../utils/setup');

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

const MockAggregator = artifacts.require('MockAggregatorV2V3');

contract('ThalesAMM', accounts => {
	const [initialCreator, managerOwner, minter, dummy, exersicer, secondCreator, safeBox] = accounts;
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
		let TestUSDC = artifacts.require('TestUSDC');
		testUSDC = await TestUSDC.new();
		await thalesAMM.initialize(
			owner,
			priceFeedAddress,
			testUSDC.address,
			toUnit(1000),
			deciMath.address,
			toUnit(0.01),
			toUnit(0.05),
			hour * 2
		);
		await thalesAMM.setPositionalMarketManager(manager.address, { from: owner });
		await thalesAMM.setImpliedVolatilityPerAsset(sETHKey, toUnit(120), { from: owner });
		await thalesAMM.setSafeBoxData(safeBox, toUnit(0.01), { from: owner });
		await thalesAMM.setMinMaxSupportedPrice(toUnit(0.05), toUnit(0.95), { from: owner });
		await manager.setNeedsTransformingCollateral(true);

		const usdcQuantity = toBN(100 * 1e6); //100 USDC
		const ammusdcQuantity = toBN(10000 * 1e6); //100 USDC

		let sUSDBalance = await testUSDC.balanceOf(creatorSigner.address);
		//console.log('sUSDBalance creatorSigner before:' + sUSDBalance / 1e6);

		await manager.setsUSD(testUSDC.address);
		await testUSDC.mint(minter, usdcQuantity);
		await testUSDC.approve(manager.address, usdcQuantity, { from: minter });
		await testUSDC.approve(thalesAMM.address, usdcQuantity, { from: minter });
		await testUSDC.mint(thalesAMM.address, ammusdcQuantity);
		await testUSDC.mint(creatorSigner.address, usdcQuantity);
		await testUSDC.approve(manager.address, usdcQuantity, { from: creatorSigner.address });

		sUSDBalance = await testUSDC.balanceOf(creatorSigner.address);
		//console.log('sUSDBalance creatorSigner after:' + sUSDBalance / 1e6);
	});

	const Position = {
		UP: toBN(0),
		DOWN: toBN(1),
	};

	describe('Test AMM', () => {
		it('buying test ', async () => {
			let sUSDBalance = await testUSDC.balanceOf(creatorSigner.address);
			//console.log('sUSDBalance creatorSigner:' + sUSDBalance / 1e6);

			let transformedCollateral = await manager.transformCollateral(toUnit(10).toString());
			//console.log('transformedCollateral ' + transformedCollateral / 1e6);

			let now = await currentTime();
			let newMarket = await createMarket(
				manager,
				sETHKey,
				toUnit(12000),
				now + day * 10,
				toUnit(10),
				creatorSigner
			);

			let options = await newMarket.options();
			up = await position.at(options.up);
			down = await position.at(options.down);

			let ammUpBalance = await up.balanceOf(creatorSigner.address);
			//console.log('up balance creatorSigner.address:' + ammUpBalance / 1e18);

			sUSDBalance = await testUSDC.balanceOf(creatorSigner.address);
			//console.log('sUSDBalance creatorSigner:' + sUSDBalance / 1e6);

			sUSDBalance = await testUSDC.balanceOf(newMarket.address);
			//console.log('sUSDBalance newMarket:' + sUSDBalance / 1e6);

			let priceUp = await thalesAMM.price(newMarket.address, Position.UP);
			//console.log('priceUp decimal is:' + priceUp / 1e18);

			let availableToBuyFromAMM = await thalesAMM.availableToBuyFromAMM(
				newMarket.address,
				Position.UP
			);
			//console.log('availableToBuyFromAMM decimal is:' + availableToBuyFromAMM / 1e18);

			let buyPriceImpactMax = await thalesAMM.buyPriceImpact(
				newMarket.address,
				Position.UP,
				toUnit(availableToBuyFromAMM / 1e18)
			);
			//console.log('buyPriceImpactMax decimal is:' + buyPriceImpactMax / 1e18);

			let buyFromAmmQuote = await thalesAMM.buyFromAmmQuote(
				newMarket.address,
				Position.UP,
				toUnit(availableToBuyFromAMM / 1e18)
			);
			//console.log('buyFromAmmQuote decimal is:' + buyFromAmmQuote / 1e6);

			await testUSDC.approve(thalesAMM.address, sUSDQty, { from: minter });
			let additionalSlippage = toUnit(0.01);
			buyFromAmmQuote = await thalesAMM.buyFromAmmQuote(
				newMarket.address,
				Position.UP,
				toUnit(500)
			);
			//console.log('buyFromAmmQuote 500 decimal is:' + buyFromAmmQuote / 1e6);

			sUSDBalance = await testUSDC.balanceOf(minter);
			//console.log('sUSDBalance minter before:' + sUSDBalance / 1e6);
			sUSDBalance = await testUSDC.balanceOf(thalesAMM.address);
			//console.log('sUSDBalance thalesAMM before:' + sUSDBalance / 1e6);
			sUSDBalance = await testUSDC.balanceOf(safeBox);
			//console.log('sUSDBalance safeBox before:' + sUSDBalance / 1e6);

			//slippage test
			await thalesAMM.buyFromAMM(
				newMarket.address,
				Position.UP,
				toUnit(500),
				Math.floor(buyFromAmmQuote / 1.001) + '',
				additionalSlippage,
				{ from: minter }
			);

			sUSDBalance = await testUSDC.balanceOf(minter);
			//console.log('sUSDBalance minter after:' + sUSDBalance / 1e6);
			sUSDBalance = await testUSDC.balanceOf(thalesAMM.address);
			//console.log('sUSDBalance thalesAMM after:' + sUSDBalance / 1e6);
			sUSDBalance = await testUSDC.balanceOf(safeBox);
			//console.log('sUSDBalance safeBox after:' + sUSDBalance / 1e6);

			ammUpBalance = await up.balanceOf(minter);
			//console.log('up balance minter:' + ammUpBalance / 1e18);

			await up.approve(thalesAMM.address, toUnit(100), { from: minter });
			await down.approve(thalesAMM.address, toUnit(100), { from: minter });
			let sellToAmmQuote = await thalesAMM.sellToAmmQuote(
				newMarket.address,
				Position.UP,
				toUnit(100)
			);
			//console.log('sellToAmmQuote is ' + sellToAmmQuote / 1e6);
			await thalesAMM.sellToAMM(
				newMarket.address,
				Position.UP,
				toUnit(100),
				sellToAmmQuote,
				additionalSlippage,
				{ from: minter }
			);

			sUSDBalance = await testUSDC.balanceOf(minter);
			//console.log('sUSDBalance minter after sell:' + sUSDBalance / 1e6);
			sUSDBalance = await testUSDC.balanceOf(thalesAMM.address);
			//console.log('sUSDBalance thalesAMM after sell:' + sUSDBalance / 1e6);
			sUSDBalance = await testUSDC.balanceOf(safeBox);
			//console.log('sUSDBalance safeBox after sell:' + sUSDBalance / 1e6);

			ammUpBalance = await up.balanceOf(minter);
			//console.log('up balance minter sell:' + ammUpBalance / 1e18);

			const minterQuantity = toBN(1000 * 1e6); //1000 USDC
			await testUSDC.mint(minter, minterQuantity);
			await testUSDC.approve(manager.address, minterQuantity, { from: minter });
			await newMarket.mint(toUnit(1000), {
				from: minter,
			});

			sUSDBalance = await testUSDC.balanceOf(minter);
			//console.log('sUSDBalance minter after mint:' + sUSDBalance / 1e6);

			sellToAmmQuote = await thalesAMM.sellToAmmQuote(
				newMarket.address,
				Position.DOWN,
				toUnit(500)
			);
			//console.log('sellToAmmQuote decimal is:' + sellToAmmQuote / 1e6);
			await down.approve(thalesAMM.address, toUnit(500), { from: minter });
			await thalesAMM.sellToAMM(
				newMarket.address,
				Position.DOWN,
				toUnit(500),
				sellToAmmQuote,
				additionalSlippage,
				{ from: minter }
			);

			sUSDBalance = await testUSDC.balanceOf(minter);
			//console.log('sUSDBalance minter after sell2:' + sUSDBalance / 1e6);
			sUSDBalance = await testUSDC.balanceOf(thalesAMM.address);
			//console.log('sUSDBalance thalesAMM after sell2:' + sUSDBalance / 1e6);
			sUSDBalance = await testUSDC.balanceOf(safeBox);
			//console.log('sUSDBalance safeBox after sell2:' + sUSDBalance / 1e6);

			await fastForward(day * 20);

			let phase = await newMarket.phase();
			//console.log('phase ' + phase);

			let isKnownMarket = await manager.isKnownMarket(newMarket.address);
			//console.log('isKnownMarket ' + isKnownMarket);

			ammUpBalance = await up.balanceOf(thalesAMM.address);
			//console.log('amm UpBalance pre Exercise decimal is:' + ammUpBalance / 1e18);

			let ammDownBalance = await down.balanceOf(thalesAMM.address);
			//console.log('ammDownBalance pre Exercise  decimal is:' + ammDownBalance / 1e18);

			sUSDBalance = await sUSDSynth.balanceOf(thalesAMM.address);
			//console.log('sUSDBalance post Exercise  decimal is:' + sUSDBalance / 1e6);

			let canExerciseMaturedMarket = await thalesAMM.canExerciseMaturedMarket(newMarket.address);
			//console.log('canExerciseMaturedMarket ' + canExerciseMaturedMarket);

			await thalesAMM.exerciseMaturedMarket(newMarket.address);

			ammUpBalance = await up.balanceOf(thalesAMM.address);
			//console.log('amm UpBalance post Exercise decimal is:' + ammUpBalance / 1e18);
			ammDownBalance = await down.balanceOf(thalesAMM.address);
			//console.log('ammDownBalance pre Exercise  decimal is:' + ammDownBalance / 1e18);

			sUSDBalance = await testUSDC.balanceOf(minter);
			//console.log('sUSDBalance minter after exercize:' + sUSDBalance / 1e6);
			sUSDBalance = await testUSDC.balanceOf(thalesAMM.address);
			//console.log('sUSDBalance thalesAMM after exercize:' + sUSDBalance / 1e6);
			sUSDBalance = await testUSDC.balanceOf(safeBox);
			//console.log('sUSDBalance safeBox after exercize:' + sUSDBalance / 1e6);
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
