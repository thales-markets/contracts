'use strict';

const { artifacts, contract } = require('hardhat');
const { assert } = require('../../utils/common');
const { toBytes32 } = require('../../../index');
const { expect } = require('chai');
const { fastForward, toUnit, currentTime } = require('../../utils')();
const { ZERO_ADDRESS } = require('../../utils/helpers');
const { getCreateChainedSpeedAMMParams } = require('../../utils/speedMarkets');

contract('ChainedSpeedMarkets', (accounts) => {
	const [owner, user, safeBox, referrerAddress, proxyUser, creatorAccount] = accounts;
	let exoticUSD, exoticOP;
	let chainedSpeedMarketsAMM, speedMarketsAMMData, speedMarketsAMM, multiCollateralOnOffRamp;
	let mockPyth, priceFeedUpdateData, fee;
	let mockWeth, swapRouterMock, MockPriceFeedDeployed;
	let now;

	const PAYOUT_MULTIPLIERS = [toUnit(1.7), toUnit(1.78), toUnit(1.82), toUnit(1.84), toUnit(1.9)];
	const DEFAULT_REFERRER_FEE = 0;
	const SILVER_REFERRER_FEE = 0.0075;
	const GOLD_REFERRER_FEE = 0.01;
	const PYTH_ETH_PRICE = 186342931000;

	before(async () => {
		// -------------------------- Speed Markets --------------------------
		let SpeedMarketsAMMContract = artifacts.require('SpeedMarketsAMM');
		speedMarketsAMM = await SpeedMarketsAMMContract.new();

		let SpeedMarketsAMMDataContract = artifacts.require('SpeedMarketsAMMData');
		speedMarketsAMMData = await SpeedMarketsAMMDataContract.new();
		await speedMarketsAMMData.initialize(owner, speedMarketsAMM.address);

		let ExoticUSD = artifacts.require('ExoticUSD');
		exoticUSD = await ExoticUSD.new();

		await exoticUSD.setDefaultAmount(toUnit(5000));

		await exoticUSD.mintForUser(owner);
		let balance = await exoticUSD.balanceOf(owner);
		console.log('Balance of owner is ' + balance / 1e18);

		await exoticUSD.transfer(speedMarketsAMM.address, toUnit(100), { from: owner });

		await exoticUSD.mintForUser(user);
		balance = await exoticUSD.balanceOf(user);
		console.log('Balance of user is ' + balance / 1e18);

		let SpeedMarketMastercopy = artifacts.require('SpeedMarketMastercopy');
		let speedMarketMastercopy = await SpeedMarketMastercopy.new();

		await speedMarketsAMM.initialize(owner, exoticUSD.address);
		await speedMarketsAMM.setAMMAddresses(
			speedMarketMastercopy.address,
			ZERO_ADDRESS,
			ZERO_ADDRESS
		);
		await speedMarketsAMM.setLimitParams(toUnit(5), toUnit(500), 3600, 86400, 60, 60);
		await speedMarketsAMM.setSupportedAsset(toBytes32('ETH'), true);
		await speedMarketsAMM.setMaxRisks(toBytes32('ETH'), toUnit(1000), toUnit(500));
		await speedMarketsAMM.setSafeBoxAndMaxSkewImpact(toUnit(0.02), toUnit(0.05), toUnit(0.02));
		await speedMarketsAMM.setAssetToPythID(
			toBytes32('ETH'),
			'0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace'
		);

		now = await currentTime();

		let MockPyth = artifacts.require('MockPythCustom');
		mockPyth = await MockPyth.new(60, 1e6);

		priceFeedUpdateData = await mockPyth.createPriceFeedUpdateData(
			'0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
			PYTH_ETH_PRICE,
			74093100,
			-8,
			PYTH_ETH_PRICE,
			74093100,
			now
		);

		let updateDataArray = [];
		updateDataArray[0] = priceFeedUpdateData;

		fee = await mockPyth.getUpdateFee(updateDataArray);

		// -------------------------- Referrals --------------------------
		let Referrals = artifacts.require('Referrals');
		let referrals = await Referrals.new();

		await referrals.initialize(owner, ZERO_ADDRESS, ZERO_ADDRESS);
		await referrals.setWhitelistedAddress(speedMarketsAMM.address, true);
		await referrals.setReferrerFees(
			toUnit(DEFAULT_REFERRER_FEE),
			toUnit(SILVER_REFERRER_FEE),
			toUnit(GOLD_REFERRER_FEE)
		);

		// -------------------------- Multi Collateral --------------------------
		let MultiCollateralOnOffRamp = artifacts.require('MultiCollateralOnOffRamp');
		multiCollateralOnOffRamp = await MultiCollateralOnOffRamp.new();
		await multiCollateralOnOffRamp.initialize(owner, exoticUSD.address);

		let MockPriceFeed = artifacts.require('MockPriceFeed');
		MockPriceFeedDeployed = await MockPriceFeed.new(owner);

		await multiCollateralOnOffRamp.setPriceFeed(MockPriceFeedDeployed.address);

		let ExoticOP = artifacts.require('ExoticUSD');
		exoticOP = await ExoticOP.new();

		await multiCollateralOnOffRamp.setSupportedCollateral(exoticOP.address, true);

		let MockWeth = artifacts.require('MockWeth');
		mockWeth = await MockWeth.new();
		await multiCollateralOnOffRamp.setWETH(mockWeth.address, { from: owner });
		await multiCollateralOnOffRamp.setSupportedCollateral(mockWeth.address, true, {
			from: owner,
		});

		let SwapRouterMock = artifacts.require('SwapRouterMock');
		swapRouterMock = await SwapRouterMock.new();

		await multiCollateralOnOffRamp.setSwapRouter(swapRouterMock.address);
		await swapRouterMock.setDefaults(exoticOP.address, exoticUSD.address);

		await exoticUSD.mintForUser(proxyUser);
		await exoticUSD.transfer(swapRouterMock.address, toUnit(1000), { from: proxyUser });
		balance = await exoticUSD.balanceOf(swapRouterMock.address);
		console.log('Balance of swap router is ' + balance / 1e18);

		await MockPriceFeedDeployed.setPricetoReturn(toUnit(1));

		await multiCollateralOnOffRamp.setCurveSUSD(
			exoticUSD.address,
			exoticUSD.address,
			exoticUSD.address,
			exoticUSD.address,
			true,
			toUnit('0.01')
		);

		// ------------------------- Address Manager -------------------------
		let AddressManagerContract = artifacts.require('AddressManager');
		let addressManager = await AddressManagerContract.new();

		await addressManager.initialize(
			owner,
			safeBox,
			referrals.address,
			ZERO_ADDRESS,
			multiCollateralOnOffRamp.address,
			mockPyth.address,
			speedMarketsAMM.address
		);
		await addressManager.setAddressInAddressBook('SpeedMarketsAMMCreator', creatorAccount);

		// -------------------------- Chained Speed Markets --------------------------
		let ChainedSpeedMarketsAMMContract = artifacts.require('ChainedSpeedMarketsAMM');
		chainedSpeedMarketsAMM = await ChainedSpeedMarketsAMMContract.new();
		await chainedSpeedMarketsAMM.initialize(owner, exoticUSD.address);

		await speedMarketsAMMData.setSpeedMarketsAMM(
			speedMarketsAMM.address,
			chainedSpeedMarketsAMM.address,
			{ from: owner }
		);

		await exoticUSD.transfer(chainedSpeedMarketsAMM.address, toUnit(5000), { from: owner });

		let ChainedSpeedMarketMastercopy = artifacts.require('ChainedSpeedMarketMastercopy');
		let chainedSpeedMarketMastercopy = await ChainedSpeedMarketMastercopy.new();

		await chainedSpeedMarketsAMM.setSusdAddress(exoticUSD.address);
		await chainedSpeedMarketsAMM.setMastercopy(chainedSpeedMarketMastercopy.address);
		await chainedSpeedMarketsAMM.setAddressManager(addressManager.address);
		await chainedSpeedMarketsAMM.setMultiCollateralOnOffRampEnabled(true);
		await chainedSpeedMarketsAMM.setLimitParams(
			600, // minTimeFrame
			600, // maxTimeFrame
			2, // minChainedMarkets
			6, // maxChainedMarkets
			toUnit(5), // minBuyinAmount
			toUnit(20), // maxBuyinAmount
			toUnit(500), // maxProfitPerIndividualMarket
			toUnit(1100), // maxRisk
			PAYOUT_MULTIPLIERS
		);

		await referrals.setWhitelistedAddress(chainedSpeedMarketsAMM.address, true);

		await multiCollateralOnOffRamp.setSupportedAMM(chainedSpeedMarketsAMM.address, true);
	});

	describe('Test Chained speed markets ', () => {
		it('Should create chained speed markets with referral', async () => {
			await exoticUSD.approve(chainedSpeedMarketsAMM.address, toUnit(100), { from: user });

			let buyinAmount = 10;
			let timeFrame = 600; // 10 min

			const defaultCreateChainedSpeedAMMParams = getCreateChainedSpeedAMMParams(
				user,
				'ETH',
				timeFrame,
				PYTH_ETH_PRICE,
				now,
				buyinAmount
			);

			await chainedSpeedMarketsAMM.createNewMarket(
				getCreateChainedSpeedAMMParams(
					user,
					'ETH',
					timeFrame,
					PYTH_ETH_PRICE,
					now,
					buyinAmount,
					[0, 1, 0, 0, 0, 0], // UP, DOWN, UP, UP, UP, UP
					ZERO_ADDRESS,
					referrerAddress
				),
				{ from: creatorAccount }
			);

			let markets = await chainedSpeedMarketsAMM.activeMarkets(0, 10);
			let market = markets[markets.length - 1];
			let marketDataArray = await speedMarketsAMMData.getChainedMarketsData([market]);
			let numOfDirections = marketDataArray[0].directions.length;

			console.log('Check strike times');
			assert.equal(
				Number(marketDataArray[0].createdAt) + timeFrame,
				marketDataArray[0].initialStrikeTime
			);
			assert.equal(
				Number(marketDataArray[0].createdAt) + numOfDirections * timeFrame,
				marketDataArray[0].strikeTime
			);

			console.log('Check payout');
			let marketBalance = await exoticUSD.balanceOf(market);
			let payoutMultiplier = PAYOUT_MULTIPLIERS[numOfDirections - 2] / 1e18; // minChainedMarkets = 2
			assert.equal(
				(marketBalance / 1e18).toFixed(5),
				(buyinAmount * payoutMultiplier ** numOfDirections).toFixed(5)
			);
			assert.equal(marketDataArray[0].payoutMultiplier / 1e18, payoutMultiplier);

			console.log('Check default referrer fee');
			let referrerBalance = await exoticUSD.balanceOf(referrerAddress);
			assert.bnEqual(referrerBalance, toUnit(buyinAmount * DEFAULT_REFERRER_FEE)); // 0.5% from 10
		});
	});
});
