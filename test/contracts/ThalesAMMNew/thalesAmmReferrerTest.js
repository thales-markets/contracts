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
let Referrals, referrals;

let aggregator_sAUD, aggregator_sETH, aggregator_sUSD, aggregator_nonRate;

const ZERO_ADDRESS = '0x' + '0'.repeat(40);

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
		referrerAddress,
		secondReferrerAddress,
	] = accounts;
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
		ThalesAMM = artifacts.require('ThalesAMMNew');
		thalesAMM = await ThalesAMM.new();
		await thalesAMM.initialize(
			owner,
			priceFeedAddress,
			sUSDSynth.address,
			toUnit(1000),
			deciMath.address,
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

		Referrals = artifacts.require('Referrals');
		referrals = await Referrals.new();
		await referrals.initialize(owner, thalesAMM.address, thalesAMM.address);

		await thalesAMM.setStakingThalesAndReferrals(ZERO_ADDRESS, referrals.address, toUnit('0.01'), {
			from: owner,
		});
		console.log('thalesAMM -  set Referrals');
	});

	const Position = {
		UP: toBN(0),
		DOWN: toBN(1),
	};

	describe('Test AMM + Referrer', () => {
		it('Test referrer paid ', async () => {
			let now = await currentTime();
			let newMarket = await createMarket(
				manager,
				sETHKey,
				toUnit(10000),
				now + day * 10,
				toUnit(10),
				creatorSigner
			);

			let buyFromAmmQuote = await thalesAMM.buyFromAmmQuote(
				newMarket.address,
				Position.UP,
				toUnit(100)
			);
			console.log('buyFromAmmQuote decimal is:' + buyFromAmmQuote / 1e18);

			let options = await newMarket.options();
			up = await position.at(options.up);
			down = await position.at(options.down);

			let ammDownBalance = await down.balanceOf(thalesAMM.address);

			await sUSDSynth.approve(thalesAMM.address, sUSDQty, { from: minter });
			let additionalSlippage = toUnit(0.01);
			await thalesAMM.buyFromAMM(
				newMarket.address,
				Position.UP,
				toUnit(10),
				buyFromAmmQuote,
				additionalSlippage,
				{ from: minter }
			);

			ammDownBalance = await down.balanceOf(thalesAMM.address);

			let minterSusdBalance = await sUSDSynth.balanceOf(minter);
			console.log('minterSusdBalance after:' + minterSusdBalance / 1e18);

			let referrerSusdBalance = await sUSDSynth.balanceOf(referrerAddress);
			console.log('referrerSusdBalance after:' + referrerSusdBalance / 1e18);
			assert.equal(referrerSusdBalance, 0);

			additionalSlippage = toUnit(0.2); // 20%
			await thalesAMM.buyFromAMMWithReferrer(
				newMarket.address,
				Position.UP,
				toUnit(10),
				toUnit((buyFromAmmQuote / 1e18) * 0.9),
				additionalSlippage,
				referrerAddress,
				{ from: minter }
			);

			referrerSusdBalance = await sUSDSynth.balanceOf(referrerAddress);
			console.log('referrerSusdBalance after:' + referrerSusdBalance / 1e18);
			assert.bnGte(referrerSusdBalance, toUnit(0));
			assert.bnLte(referrerSusdBalance, toUnit(1));
		});
	});
	describe('Test Referrers whitelist and traded before', () => {
		it('sets correctly', async () => {
			await referrals.setWhitelistedAddress(owner, true, {
				from: owner,
			});

			let traders = new Array();
			traders.push(owner);
			await referrals.setTradedBefore(traders, {
				from: owner,
			});

			let isOwnerWhitelisted = await referrals.whitelistedAddresses(owner);
			assert.equal(isOwnerWhitelisted, true);

			let isOwnerPrevtrader = await referrals.tradedBefore(owner);
			assert.equal(isOwnerPrevtrader, true);
		});
	});
});
