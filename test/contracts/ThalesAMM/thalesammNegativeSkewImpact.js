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
	let thalesAMM;
	let MockPriceFeedDeployed;

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
				toUnit(12000),
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

			let buyPriceImpactMax = await thalesAMM.buyPriceImpact(
				newMarket.address,
				Position.UP,
				toUnit(availableToBuyFromAMM / 1e18)
			);
			console.log('buyPriceImpactMax decimal is:' + buyPriceImpactMax / 1e18);

			let buyPriceImpactMaxDown = await thalesAMM.buyPriceImpact(
				newMarket.address,
				Position.DOWN,
				toUnit(availableToBuyFromAMMDown / 1e18)
			);
			console.log('buyPriceImpactMax DOWN decimal is:' + buyPriceImpactMaxDown / 1e18);

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
			console.log('buyPriceImpact post buy 500 decimal is:' + buyPriceImpactPostBuy / 1e18);

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

			ammUpBalance = await up.balanceOf(thalesAMM.address);
			console.log('amm Up Balance post buy decimal is:' + ammUpBalance / 1e18);

			ammDownBalance = await down.balanceOf(thalesAMM.address);
			console.log('amm Down Balance post buy  decimal is:' + ammDownBalance / 1e18);

			availableToBuyFromAMM = await thalesAMM.availableToBuyFromAMM(newMarket.address, Position.UP);
			availableToBuyFromAMMDown = await thalesAMM.availableToBuyFromAMM(
				newMarket.address,
				Position.DOWN
			);
			console.log('availableToBuyFromAMM UP decimal is:' + availableToBuyFromAMM / 1e18);
			console.log('availableToBuyFromAMM DOWN decimal is:' + availableToBuyFromAMMDown / 1e18);
			buyPriceImpactPostBuy = await thalesAMM.buyPriceImpact(
				newMarket.address,
				Position.UP,
				toUnit(1)
			);

			const buyPriceImpactPostBuyDOWN = await thalesAMM.buyPriceImpact(
				newMarket.address,
				Position.DOWN,
				toUnit(1291)
			);

			const buyQuoteDown = await thalesAMM.buyFromAmmQuote(
				newMarket.address,
				Position.DOWN,
				toUnit(1291)
			);

			let priceDown = await thalesAMM.price(newMarket.address, Position.DOWN);
			console.log('priceDown decimal is:' + priceDown / 1e18);
			console.log('buyQuoteDown decimal is:' + buyQuoteDown / 1e18);

			console.log('buyPriceImpact post buy max  decimal is:' + buyPriceImpactPostBuy / 1e18);
			console.log(
				'buyPriceImpact post buy max DOWN decimal is:' + buyPriceImpactPostBuyDOWN / 1e18
			);
			assert.bnLte(buyPriceImpactPostBuyDOWN, toUnit(-0.01));

			const buyQuoteAvailableDown = await thalesAMM.buyFromAmmQuote(
				newMarket.address,
				Position.DOWN,
				toUnit(availableToBuyFromAMMDown / 1e18 - 1)
			);

			console.log('buyQuoteAvailableDown decimal is:' + buyQuoteAvailableDown / 1e18);

			let tx = await thalesAMM.buyFromAMM(
				newMarket.address,
				Position.DOWN,
				toUnit(availableToBuyFromAMMDown / 1e18 - 1),
				buyQuoteAvailableDown,
				additionalSlippage,
				{ from: minter }
			);
			console.log('susd paid', tx.logs[0].args.sUSDPaid / 1e18);
		});

		it('buying test #2', async () => {
			let now = await currentTime();
			let newMarket = await createMarket(
				manager,
				sETHKey,
				toUnit(12000),
				now + day * 7,
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
			console.log('availableToBuyFromAMM UP decimal is:' + availableToBuyFromAMM / 1e18);
			console.log('availableToBuyFromAMM DOWN decimal is:' + availableToBuyFromAMMDown / 1e18);

			let options = await newMarket.options();
			up = await position.at(options.up);
			down = await position.at(options.down);

			let ammUpBalance = await up.balanceOf(thalesAMM.address);
			console.log('amm Up Balance is:' + ammUpBalance / 1e18);

			let ammDownBalance = await down.balanceOf(thalesAMM.address);
			console.log('amm Down Balance is:' + ammDownBalance / 1e18);

			let buyPriceImpactMax = await thalesAMM.buyPriceImpact(
				newMarket.address,
				Position.UP,
				toUnit(availableToBuyFromAMM / 1e18)
			);
			console.log('buyPriceImpactMax UP decimal is:' + buyPriceImpactMax / 1e18);

			let buyPriceImpactMaxDown = await thalesAMM.buyPriceImpact(
				newMarket.address,
				Position.DOWN,
				toUnit(availableToBuyFromAMMDown / 1e18)
			);
			console.log('buyPriceImpactMax DOWN decimal is:' + buyPriceImpactMaxDown / 1e18);

			let buyFromAmmQuote = await thalesAMM.buyFromAmmQuote(
				newMarket.address,
				Position.DOWN,
				toUnit(availableToBuyFromAMMDown / 1e18 - 1)
			);
			console.log('buyFromAmmQuote UP decimal is:' + buyFromAmmQuote / 1e18);

			await sUSDSynth.approve(thalesAMM.address, sUSDQty, { from: minter });
			let additionalSlippage = toUnit(0.01);
			// buyFromAmmQuote = await thalesAMM.buyFromAmmQuote(
			// 	newMarket.address,
			// 	Position.DOWN,
			// 	toUnit(1000)
			// );
			await thalesAMM.buyFromAMM(
				newMarket.address,
				Position.DOWN,
				toUnit(availableToBuyFromAMMDown / 1e18 - 1),
				buyFromAmmQuote,
				additionalSlippage,
				{ from: minter }
			);
			let buyPriceImpactPostBuy = await thalesAMM.buyPriceImpact(
				newMarket.address,
				Position.DOWN,
				toUnit(1000)
			);
			console.log('buyPriceImpact post buy 1000 decimal is:' + buyPriceImpactPostBuy / 1e18);

			ammUpBalance = await up.balanceOf(thalesAMM.address);
			console.log('amm Up Balance post buy decimal is:' + ammUpBalance / 1e18);

			ammDownBalance = await down.balanceOf(thalesAMM.address);
			console.log('amm Down Balance post buy  decimal is:' + ammDownBalance / 1e18);

			availableToBuyFromAMM = await thalesAMM.availableToBuyFromAMM(newMarket.address, Position.UP);
			availableToBuyFromAMMDown = await thalesAMM.availableToBuyFromAMM(
				newMarket.address,
				Position.DOWN
			);
			console.log('availableToBuyFromAMM UP decimal is:' + availableToBuyFromAMM / 1e18);
			console.log('availableToBuyFromAMM DOWN decimal is:' + availableToBuyFromAMMDown / 1e18);

			const buyPriceImpactPostBuyUP = await thalesAMM.buyPriceImpact(
				newMarket.address,
				Position.UP,
				toUnit(1500)
			);

			const buyQuoteUP = await thalesAMM.buyFromAmmQuote(
				newMarket.address,
				Position.UP,
				toUnit(1500)
			);

			priceUp = await thalesAMM.price(newMarket.address, Position.UP);
			let priceDown = await thalesAMM.price(newMarket.address, Position.DOWN);
			console.log('priceDown decimal is:' + priceDown / 1e18);
			console.log('priceUp decimal is:' + priceUp / 1e18);
			console.log('buyQuoteUp decimal is:' + buyQuoteUP / 1e18);

			const buyPriceImpactTest = await thalesAMM.buyPriceImpact(
				newMarket.address,
				Position.UP,
				toUnit(ammUpBalance / 1e18 + 1000)
			);

			const buyPriceImpactMaxUpBalance = await thalesAMM.buyPriceImpact(
				newMarket.address,
				Position.UP,
				toUnit(ammUpBalance / 1e18 + 1000)
			);

			let buyPriceImpactAllUP = await thalesAMM.buyPriceImpact(
				newMarket.address,
				Position.UP,
				toUnit(availableToBuyFromAMM / 1e18 - 1)
			);

			console.log('buyPriceImpact post buy max UP decimal is:' + buyPriceImpactPostBuyUP / 1e18);
			console.log('TEST for', ammUpBalance / 1e18 + 1000, buyPriceImpactTest / 1e18);
			console.log('skew impact for', ammUpBalance / 1e18 + 1000, buyPriceImpactMaxUpBalance / 1e18);
			console.log('buyPriceImpactAllUP ' + buyPriceImpactAllUP / 1e18);

			await sUSDSynth.approve(thalesAMM.address, sUSDQty, { from: minter });
			buyFromAmmQuote = await thalesAMM.buyFromAmmQuote(
				newMarket.address,
				Position.UP,
				toUnit(ammUpBalance / 1e18 - 1)
			);
			await thalesAMM.buyFromAMM(
				newMarket.address,
				Position.UP,
				toUnit(ammUpBalance / 1e18),
				buyFromAmmQuote,
				additionalSlippage,
				{ from: minter }
			);
			buyPriceImpactPostBuy = await thalesAMM.buyPriceImpact(
				newMarket.address,
				Position.UP,
				toUnit(1000)
			);

			console.log('buyPriceImpact post buy 1000 UP', buyPriceImpactPostBuy / 1e18);

			availableToBuyFromAMM = await thalesAMM.availableToBuyFromAMM(newMarket.address, Position.UP);
			availableToBuyFromAMMDown = await thalesAMM.availableToBuyFromAMM(
				newMarket.address,
				Position.DOWN
			);
			console.log('availableToBuyFromAMM UP decimal is:' + availableToBuyFromAMM / 1e18);
			console.log('availableToBuyFromAMM DOWN decimal is:' + availableToBuyFromAMMDown / 1e18);

			ammUpBalance = await up.balanceOf(thalesAMM.address);
			console.log('amm Up Balance post buy decimal is:' + ammUpBalance / 1e18);

			ammDownBalance = await down.balanceOf(thalesAMM.address);
			console.log('amm Down Balance post buy  decimal is:' + ammDownBalance / 1e18);
		});
	});
});
