'use strict';

const { artifacts, contract, web3 } = require('hardhat');
const { toBN } = web3.utils;

const { toUnit, currentTime } = require('../../utils')();
const { toBytes32 } = require('../../../index');
const { setupAllContracts } = require('../../utils/setup');

const { convertToDecimals } = require('../../utils/helpers');

let PositionalMarketFactory, factory, PositionalMarketManager, manager, addressResolver;
let PositionalMarket, priceFeed, oracle, sUSDSynth, PositionalMarketMastercopy, PositionMastercopy;
let market, up, down, position, Synth, testUSDC, testUSDT, testDAI;

let aggregator_sAUD, aggregator_sETH, aggregator_sUSD, aggregator_nonRate;

const usdcQuantity = toBN(10000 * 1e6); //100 USDC

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
			.createMarket(
				oracleKey,
				strikePrice.toString(),
				maturity,
				initialMint.toString()
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
	let thalesAMM, curveSUSD;
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
		sUSDSynth.issue(thalesAMM.address, sUSDQty);

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
		it('buying test [ @cov-skip ]', async () => {
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

			await sUSDSynth.approve(thalesAMM.address, sUSDQty, { from: minter });
			let additionalSlippage = toUnit(0.01);
			let buyFromAmmQuote = await thalesAMM.buyFromAmmQuote(
				newMarket.address,
				Position.UP,
				toUnit(availableToBuyFromAMM / 1e18 - 1)
			);
			console.log('buyFromAmmQuote decimal is:' + buyFromAmmQuote / 1e18);

			let buyFromAmmQuoteUSDCCollateralObject = await thalesAMM.buyFromAmmQuoteWithDifferentCollateral(
				newMarket.address,
				Position.UP,
				toUnit(availableToBuyFromAMM / 1e18 - 1),
				testUSDC.address
			);
			let buyFromAmmQuoteUSDCCollateral = buyFromAmmQuoteUSDCCollateralObject[0];
			console.log('buyFromAmmQuoteUSDCCollateral  is:' + buyFromAmmQuoteUSDCCollateral);
			console.log(
				'buyFromAmmQuoteUSDCCollateral decimal is:' + buyFromAmmQuoteUSDCCollateral / 1e6
			);

			let buyFromAmmQuoteDAICollateralObject = await thalesAMM.buyFromAmmQuoteWithDifferentCollateral(
				newMarket.address,
				Position.UP,
				toUnit(availableToBuyFromAMM / 1e18 - 1),
				testDAI.address
			);
			let buyFromAmmQuoteDAICollateral = buyFromAmmQuoteDAICollateralObject[0];
			console.log('buyFromAmmQuoteDAICollateral  is:' + buyFromAmmQuoteDAICollateral);
			console.log('buyFromAmmQuoteDAICollateral decimal is:' + buyFromAmmQuoteDAICollateral / 1e18);

			let minterUSDC = await testUSDC.balanceOf(minter);
			console.log('minterUSDC pre  buy decimal is:' + minterUSDC / 1e6);

			let ammSusdBalance = await sUSDSynth.balanceOf(thalesAMM.address);
			console.log('ammSusdBalance pre buy decimal is:' + ammSusdBalance / 1e18);

			let buyFromAmmQuoteUSDCCollateralObjectSlippagedObject = await thalesAMM.buyFromAmmQuoteWithDifferentCollateral(
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

			ammSusdBalance = await sUSDSynth.balanceOf(thalesAMM.address);
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
	});
});
