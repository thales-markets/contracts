'use strict';

const { artifacts, contract } = require('hardhat');
const { assert } = require('../../utils/common');
const { toBytes32 } = require('../../../index');
const { expect } = require('chai');
const { fastForward, toUnit, currentTime } = require('../../utils')();

const ZERO_ADDRESS = '0x' + '0'.repeat(40);

contract('ChainedSpeedMarkets', (accounts) => {
	const [owner, user, safeBox, referrerAddress, proxyUser] = accounts;
	let exoticUSD, exoticOP;
	let chainedSpeedMarketsAMM, speedMarketsAMMData, speedMarketsAMM, multiCollateralOnOffRamp;
	let mockPyth, priceFeedUpdateData, fee;
	let mockWeth, swapRouterMock, MockPriceFeedDeployed;

	const PAYOUT_MULTIPLIER = 1.9;
	const DEFAULT_REFERRER_FEE = 0.005;
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
		await speedMarketsAMM.setMastercopy(speedMarketMastercopy.address);
		await speedMarketsAMM.setAmounts(toUnit(5), toUnit(500));
		await speedMarketsAMM.setTimes(3600, 86400);
		await speedMarketsAMM.setMaximumPriceDelays(60, 60);
		await speedMarketsAMM.setSupportedAsset(toBytes32('ETH'), true);
		await speedMarketsAMM.setMaxRiskPerAsset(toBytes32('ETH'), toUnit(1000));
		await speedMarketsAMM.setSafeBoxImpact(toUnit(0.02));
		await speedMarketsAMM.setAssetToPythID(
			toBytes32('ETH'),
			'0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace'
		);

		let now = await currentTime();

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
			toUnit(1000), // maxRisk
			toUnit(PAYOUT_MULTIPLIER)
		);

		await referrals.setWhitelistedAddress(chainedSpeedMarketsAMM.address, true);

		await multiCollateralOnOffRamp.setSupportedAMM(chainedSpeedMarketsAMM.address, true);
	});

	describe('Test Chained speed markets ', () => {
		it('Should create chained speed markets with referral', async () => {
			await exoticUSD.approve(chainedSpeedMarketsAMM.address, toUnit(100), { from: user });

			let buyinAmount = 10;
			let timeFrame = 600; // 10 min

			await expect(
				chainedSpeedMarketsAMM.createNewMarket(
					toBytes32('ETH'),
					timeFrame,
					[0, 1, 0, 0, 0, 0, 1], // 7 directions
					toUnit(buyinAmount),
					[priceFeedUpdateData],
					ZERO_ADDRESS,
					{ value: fee, from: user }
				)
			).to.be.revertedWith('Wrong number of directions');

			await expect(
				chainedSpeedMarketsAMM.createNewMarket(
					toBytes32('ETH'),
					timeFrame,
					[0, 1, 0, 0, 0, 0], // 6 directions
					toUnit(11),
					[priceFeedUpdateData],
					ZERO_ADDRESS,
					{ value: fee, from: user }
				)
			).to.be.revertedWith('Profit too high');

			await chainedSpeedMarketsAMM.createNewMarket(
				toBytes32('ETH'),
				timeFrame,
				[0, 1, 0, 0, 0, 0], // UP, DOWN, UP, UP, UP, UP
				toUnit(buyinAmount),
				[priceFeedUpdateData],
				referrerAddress,
				{ value: fee, from: user }
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
			assert.equal(
				marketBalance / 1e18,
				(buyinAmount * PAYOUT_MULTIPLIER ** numOfDirections).toFixed(5)
			);

			console.log('Check default referrer fee');
			let referrerBalance = await exoticUSD.balanceOf(referrerAddress);
			assert.bnEqual(referrerBalance, toUnit(buyinAmount * DEFAULT_REFERRER_FEE)); // 0.5% from 10

			console.log('Check liquidity validation');
			await chainedSpeedMarketsAMM.setLimitParams(
				600, // minTimeFrame
				600, // maxTimeFrame
				2, // minChainedMarkets
				6, // maxChainedMarkets
				toUnit(5), // minBuyinAmount
				toUnit(20), // maxBuyinAmount
				toUnit(500), // maxProfitPerIndividualMarket
				toUnit(900), // maxRisk DECREASED
				toUnit(PAYOUT_MULTIPLIER)
			);
			await expect(
				chainedSpeedMarketsAMM.createNewMarket(
					toBytes32('ETH'),
					timeFrame,
					[0, 1, 0, 0, 0, 0],
					toUnit(buyinAmount),
					[priceFeedUpdateData],
					ZERO_ADDRESS,
					{ value: fee, from: user }
				)
			).to.be.revertedWith('Out of liquidity');

			await chainedSpeedMarketsAMM.setLimitParams(
				600, // minTimeFrame
				600, // maxTimeFrame
				2, // minChainedMarkets
				6, // maxChainedMarkets
				toUnit(5), // minBuyinAmount
				toUnit(20), // maxBuyinAmount
				toUnit(500), // maxProfitPerIndividualMarket
				toUnit(2000), // maxRisk INCREASED
				toUnit(PAYOUT_MULTIPLIER)
			);
			await chainedSpeedMarketsAMM.createNewMarket(
				toBytes32('ETH'),
				timeFrame,
				[0, 1, 0, 0, 0, 0], // 6 directions
				toUnit(buyinAmount),
				[priceFeedUpdateData],
				ZERO_ADDRESS,
				{ value: fee, from: user }
			);

			await chainedSpeedMarketsAMM.createNewMarket(
				toBytes32('ETH'),
				timeFrame,
				[0, 1, 0], // 3 directions
				toUnit(buyinAmount),
				[priceFeedUpdateData],
				ZERO_ADDRESS,
				{ value: fee, from: user }
			);

			await chainedSpeedMarketsAMM.createNewMarket(
				toBytes32('ETH'),
				timeFrame,
				[0, 1], // 2 directions
				toUnit(buyinAmount),
				[priceFeedUpdateData],
				ZERO_ADDRESS,
				{ value: fee, from: user }
			);

			await chainedSpeedMarketsAMM.createNewMarket(
				toBytes32('ETH'),
				timeFrame,
				[0, 1], // 2 directions
				toUnit(buyinAmount),
				[priceFeedUpdateData],
				ZERO_ADDRESS,
				{ value: fee, from: user }
			);

			console.log('Check number of active markets');
			let chainedAmmData = await speedMarketsAMMData.getChainedSpeedMarketsAMMParameters(user);
			assert.equal(chainedAmmData.numActiveMarkets, 5);

			console.log('Check current risk per asset');
			markets = await chainedSpeedMarketsAMM.activeMarkets(0, chainedAmmData.numActiveMarkets);
			marketDataArray = await speedMarketsAMMData.getChainedMarketsData(markets);

			let expectedCurrentRisk = 0;
			for (let marketData of marketDataArray) {
				expectedCurrentRisk +=
					buyinAmount * PAYOUT_MULTIPLIER ** marketData.directions.length -
					buyinAmount * (1 + Number(marketData.safeBoxImpact / 1e18));
			}
			assert.equal((chainedAmmData.risk.current / 1e18).toFixed(5), expectedCurrentRisk.toFixed(5));

			console.log('Check AMM balance after transfer');
			let ammBalanceBefore = await exoticUSD.balanceOf(chainedSpeedMarketsAMM.address);
			await chainedSpeedMarketsAMM.transferAmount(owner, toUnit(2));
			let ammBalance = await exoticUSD.balanceOf(chainedSpeedMarketsAMM.address);
			assert.equal(ammBalanceBefore / 1e18 - ammBalance / 1e18, 2);
		});

		it('Should create chained speed markets with different collateral', async () => {
			await exoticOP.setDefaultAmount(toUnit(100));
			await exoticOP.mintForUser(user);
			let opBalance = await exoticOP.balanceOf(user);
			console.log('OP balance of user is ' + opBalance / 1e18);

			await exoticUSD.approve(chainedSpeedMarketsAMM.address, toUnit(100), { from: user });
			await exoticOP.approve(chainedSpeedMarketsAMM.address, toUnit(100), { from: user });

			await chainedSpeedMarketsAMM.setLimitParams(
				600, // minTimeFrame
				600, // maxTimeFrame
				2, // minChainedMarkets
				6, // maxChainedMarkets
				toUnit(5), // minBuyinAmount
				toUnit(20), // maxBuyinAmount
				toUnit(500), // maxProfitPerIndividualMarket
				toUnit(5000), // maxRisk INCREASED
				toUnit(PAYOUT_MULTIPLIER)
			);

			let buyinAmount = 10;
			let timeFrame = 600; // 10 min

			await chainedSpeedMarketsAMM.createNewMarketWithDifferentCollateral(
				toBytes32('ETH'),
				timeFrame,
				[0, 1, 1, 1, 1, 0], // 6 directions
				[priceFeedUpdateData],
				exoticOP.address,
				toUnit(buyinAmount),
				false,
				ZERO_ADDRESS,
				{ value: fee, from: user }
			);

			await swapRouterMock.setDefaults(mockWeth.address, exoticUSD.address);

			await chainedSpeedMarketsAMM.createNewMarketWithDifferentCollateral(
				toBytes32('ETH'),
				timeFrame,
				[0, 1], // 2 directions
				[priceFeedUpdateData],
				ZERO_ADDRESS,
				toUnit(buyinAmount),
				true,
				ZERO_ADDRESS,
				{ value: toUnit(buyinAmount + fee / 1e18), from: user }
			);
		});

		it('Should resolve chained speed markets', async () => {
			let activeMarkets = await chainedSpeedMarketsAMM.activeMarkets(0, 10);
			let market = activeMarkets[0];
			let numOfActiveMarkets = activeMarkets.length;
			console.log('Number of active markets', numOfActiveMarkets);
			let marketData = await speedMarketsAMMData.getChainedMarketsData(activeMarkets);

			let resolvePriceFeedUpdateData = await mockPyth.createPriceFeedUpdateData(
				'0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
				Number(marketData[0].initialStrikePrice) - 500000000, // DOWN
				74093100,
				-8,
				Number(marketData[0].initialStrikePrice) - 500000000,
				74093100,
				marketData[0].initialStrikeTime
			);

			await fastForward(86400);

			let resolvedMarkets = 0;

			await chainedSpeedMarketsAMM.resolveMarket(market, [[resolvePriceFeedUpdateData]], {
				value: fee,
				from: user,
			});
			resolvedMarkets++;

			console.log('Check number of active markets after first resolve');
			let curActiveMarkets = await chainedSpeedMarketsAMM.activeMarkets(0, 10);
			assert.equal(curActiveMarkets.length, numOfActiveMarkets - resolvedMarkets);

			console.log('Check number of matured markets after first resolve');
			let maturedMarkets = await chainedSpeedMarketsAMM.maturedMarkets(0, 10);
			assert.equal(maturedMarkets.length, resolvedMarkets);

			console.log('Check is first market resolved');
			marketData = await speedMarketsAMMData.getChainedMarketsData([market]);
			assert.equal(marketData[0].resolved, true);

			console.log('Check is user lost on first market');
			assert.equal(marketData[0].isUserWinner, false);

			// next active market - second
			market = activeMarkets[1];
			marketData = await speedMarketsAMMData.getChainedMarketsData([market]);
			resolvePriceFeedUpdateData = await mockPyth.createPriceFeedUpdateData(
				'0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
				Number(marketData[0].initialStrikePrice) - 500000000, // DOWN
				74093100,
				-8,
				Number(marketData[0].initialStrikePrice) - 500000000,
				74093100,
				marketData[0].initialStrikeTime
			);

			await chainedSpeedMarketsAMM.resolveMarketsBatch([market], [[resolvePriceFeedUpdateData]], {
				value: fee,
				from: user,
			});
			resolvedMarkets++;

			// next active market - third
			market = activeMarkets[2];
			marketData = await speedMarketsAMMData.getChainedMarketsData([market]);
			let finalPrices = [Number(marketData[0].initialStrikePrice) - 600000000]; // DOWN
			await speedMarketsAMM.addToWhitelist(user, true, { from: owner });

			await chainedSpeedMarketsAMM.resolveMarketManually(market, finalPrices, {
				from: user,
			});
			resolvedMarkets++;

			// next active market - fourth
			market = activeMarkets[3];
			marketData = await speedMarketsAMMData.getChainedMarketsData([market]);
			finalPrices = [
				Number(marketData[0].initialStrikePrice) - 500000000, // DOWN
			];

			await chainedSpeedMarketsAMM.resolveMarketManuallyBatch([market], [finalPrices], {
				from: user,
			});
			resolvedMarkets++;

			// next active market - fifth (user winner)
			market = activeMarkets[4];
			marketData = (await speedMarketsAMMData.getChainedMarketsData([market]))[0];
			let resolvePriceFeedUpdateDataWithUp = await mockPyth.createPriceFeedUpdateData(
				'0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
				Number(marketData.initialStrikePrice) + 800000000, // UP
				74093100,
				-8,
				Number(marketData.initialStrikePrice) + 800000000,
				74093100,
				marketData.initialStrikeTime
			);

			let resolvePriceFeedUpdateDataWithDown = await mockPyth.createPriceFeedUpdateData(
				'0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
				Number(marketData.initialStrikePrice) - 500000000, // DOWN
				74093100,
				-8,
				Number(marketData.initialStrikePrice) - 500000000,
				74093100,
				marketData.strikeTime
			);

			await chainedSpeedMarketsAMM.resolveMarket(
				market,
				[[resolvePriceFeedUpdateDataWithUp], [resolvePriceFeedUpdateDataWithDown]],
				{
					value: 2 * fee,
					from: user,
				}
			);
			resolvedMarkets++;

			console.log('Check is user winner on last market');
			marketData = await speedMarketsAMMData.getChainedMarketsData([market]);
			assert.equal(marketData[0].isUserWinner, true);

			console.log('Check number of active markets after all resolved');
			curActiveMarkets = await chainedSpeedMarketsAMM.activeMarkets(0, 10);
			assert.equal(curActiveMarkets.length, numOfActiveMarkets - resolvedMarkets);
		});

		it('Should resolve chained speed markets with offramp', async () => {
			let activeMarkets = await chainedSpeedMarketsAMM.activeMarketsPerUser(0, 10, user);
			let maturedMarkets = await chainedSpeedMarketsAMM.maturedMarketsPerUser(0, 10, user);
			let numOfMaturedMarkets = maturedMarkets.length;
			console.log('Number of active markets', activeMarkets.length);
			console.log('Number of matured markets', numOfMaturedMarkets);

			let marketDataArray = await speedMarketsAMMData.getChainedMarketsData(activeMarkets);
			let indexWithSixDirections = marketDataArray.findIndex(
				(marketData) => marketData.directions.length == 6
			);
			let indexWithTwoDirections = marketDataArray.findIndex(
				(marketData) => marketData.directions.length == 2
			);

			// Resolve market with 6 directions as AMM winner
			let resolvePriceFeedUpdateDataWithDown = await mockPyth.createPriceFeedUpdateData(
				'0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
				Number(marketDataArray[indexWithSixDirections].initialStrikePrice) - 500000000, // DOWN
				74093100,
				-8,
				Number(marketDataArray[indexWithSixDirections].initialStrikePrice) - 500000000,
				74093100,
				marketDataArray[indexWithSixDirections].initialStrikeTime
			);

			let resolvedMarkets = 0;
			let market = activeMarkets[indexWithSixDirections];
			await chainedSpeedMarketsAMM.resolveMarketWithOfframp(
				market,
				[[resolvePriceFeedUpdateDataWithDown]],
				exoticOP.address,
				false,
				{ value: fee, from: user }
			);
			resolvedMarkets++;

			// Resolve market with 2 directions as user winner
			await MockPriceFeedDeployed.setPricetoReturn(toUnit(1000));
			await swapRouterMock.setDefaults(exoticUSD.address, mockWeth.address);

			let resolvePriceFeedUpdateDataWithUp = await mockPyth.createPriceFeedUpdateData(
				'0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
				Number(marketDataArray[indexWithTwoDirections].initialStrikePrice) + 800000000, // UP
				74093100,
				-8,
				Number(marketDataArray[indexWithTwoDirections].initialStrikePrice) + 800000000,
				74093100,
				marketDataArray[indexWithTwoDirections].initialStrikeTime
			);

			resolvePriceFeedUpdateDataWithDown = await mockPyth.createPriceFeedUpdateData(
				'0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
				Number(marketDataArray[indexWithTwoDirections].initialStrikePrice) - 500000000, // DOWN
				74093100,
				-8,
				Number(marketDataArray[indexWithTwoDirections].initialStrikePrice) - 500000000,
				74093100,
				marketDataArray[indexWithTwoDirections].strikeTime
			);

			market = activeMarkets[indexWithTwoDirections];
			await chainedSpeedMarketsAMM.resolveMarketWithOfframp(
				market,
				[[resolvePriceFeedUpdateDataWithUp], [resolvePriceFeedUpdateDataWithDown]],
				ZERO_ADDRESS,
				true,
				{ value: 2 * fee, from: user }
			);
			resolvedMarkets++;

			console.log('Check number of matured markets after all resolved');
			maturedMarkets = await chainedSpeedMarketsAMM.maturedMarketsPerUser(0, 10, user);
			assert.equal(maturedMarkets.length, numOfMaturedMarkets + resolvedMarkets);
		});
	});
});
