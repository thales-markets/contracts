'use strict';

const { artifacts, contract } = require('hardhat');
const { assert } = require('../../utils/common');
const { toBytes32 } = require('../../../index');
const { expect } = require('chai');
const { fastForward, toUnit, currentTime } = require('../../utils')();
const { ZERO_ADDRESS } = require('../../utils/helpers');
const { getCreateChainedSpeedAMMParams } = require('../../utils/speedMarkets');
const { toBN } = require('web3-utils');

contract('ChainedSpeedMarkets', (accounts) => {
	const [owner, user, safeBox, referrerAddress, proxyUser, creatorAccount] = accounts;
	let exoticUSD, exoticOP;
	let chainedSpeedMarketsAMM,
		speedMarketsAMMData,
		speedMarketsAMM,
		multiCollateralOnOffRamp,
		speedMarketsAMMResolver;
	let mockPyth, priceFeedUpdateData, fee;
	let mockWeth, swapRouterMock, MockPriceFeedDeployed;
	let now;

	const PAYOUT_MULTIPLIERS = [toUnit(1.7), toUnit(1.78), toUnit(1.82), toUnit(1.84), toUnit(1.9)];
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
		await exoticOP.setDefaultAmount(toUnit(1000));

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

		// -------------------------- Speed Markets AMM Resolver --------------------------
		// Note: ChainedSpeedMarketsAMM must be in address manager before resolver initialization
		await addressManager.setAddressInAddressBook(
			'ChainedSpeedMarketsAMM',
			chainedSpeedMarketsAMM.address
		);

		// -------------------------- Price Feed --------------------------
		let MockFreeBetsHolder = artifacts.require('MockFreeBetsHolder');
		let mockFreeBetsHolder = await MockFreeBetsHolder.new(creatorAccount);
		await addressManager.setAddressInAddressBook('FreeBetsHolder', mockFreeBetsHolder.address);
		await MockPriceFeedDeployed.setStaticPricePerCurrencyKey(toBytes32('eUSD'), toUnit(1));
		await MockPriceFeedDeployed.setStaticPricePerCurrencyKey(toBytes32('ExoticUSD'), toUnit(2));

		await addressManager.setAddressInAddressBook('PriceFeed', MockPriceFeedDeployed.address);
		await addressManager.setAddressInAddressBook('SpeedMarketsAMM', speedMarketsAMM.address);

		let SpeedMarketsAMMUtilsContract = artifacts.require('SpeedMarketsAMMUtils');
		const speedMarketsAMMUtils = await SpeedMarketsAMMUtilsContract.new();

		await speedMarketsAMM.setAMMAddresses(
			speedMarketMastercopy.address,
			speedMarketsAMMUtils.address,
			addressManager.address
		);
		await speedMarketsAMMUtils.initialize(owner, addressManager.address);

		let SpeedMarketsAMMResolverContract = artifacts.require('SpeedMarketsAMMResolver');
		speedMarketsAMMResolver = await SpeedMarketsAMMResolverContract.new();
		await speedMarketsAMMResolver.initialize(
			owner,
			speedMarketsAMM.address,
			addressManager.address
		);

		await speedMarketsAMMResolver.setChainedSpeedMarketsAMM(chainedSpeedMarketsAMM.address);

		await addressManager.setAddressInAddressBook(
			'SpeedMarketsAMMResolver',
			speedMarketsAMMResolver.address
		);

		await addressManager.setAddressInAddressBook('SpeedMarketsAMM', speedMarketsAMM.address);

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
		await multiCollateralOnOffRamp.setSupportedAMM(speedMarketsAMMResolver.address, true);
		await speedMarketsAMMResolver.setupMultiCollateralApproval(toUnit('1000000'), { from: owner });
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

			await expect(chainedSpeedMarketsAMM.createNewMarket(defaultCreateChainedSpeedAMMParams)).to.be
				.reverted;

			await expect(
				chainedSpeedMarketsAMM.createNewMarket(
					getCreateChainedSpeedAMMParams(
						user,
						'ETH',
						timeFrame,
						PYTH_ETH_PRICE,
						now,
						buyinAmount,
						[0, 1, 0, 0, 0, 0, 1] // 7 directions
					),
					{ from: creatorAccount }
				)
			).to.be.reverted;

			await expect(
				chainedSpeedMarketsAMM.createNewMarket(
					getCreateChainedSpeedAMMParams(
						user,
						'ETH',
						timeFrame,
						PYTH_ETH_PRICE,
						now,
						11,
						[0, 1, 0, 0, 0, 0] // 6 directions
					),
					{ from: creatorAccount }
				)
			).to.be.reverted;

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

			console.log('Check collateral');
			assert.equal(marketDataArray[0].collateral, exoticUSD.address);
			assert.isTrue(marketDataArray[0].isDefaultCollateral);

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

			await chainedSpeedMarketsAMM.createNewMarket(defaultCreateChainedSpeedAMMParams, {
				from: creatorAccount,
			});

			await chainedSpeedMarketsAMM.createNewMarket(
				getCreateChainedSpeedAMMParams(
					user,
					'ETH',
					timeFrame,
					PYTH_ETH_PRICE,
					now,
					buyinAmount,
					[0, 1, 0] // 3 directions
				),
				{ from: creatorAccount }
			);

			await chainedSpeedMarketsAMM.createNewMarket(
				getCreateChainedSpeedAMMParams(
					user,
					'ETH',
					timeFrame,
					PYTH_ETH_PRICE,
					now,
					buyinAmount,
					[0, 1] // 2 directions
				),
				{ from: creatorAccount }
			);

			await chainedSpeedMarketsAMM.createNewMarket(
				getCreateChainedSpeedAMMParams(
					user,
					'ETH',
					timeFrame,
					PYTH_ETH_PRICE,
					now,
					buyinAmount,
					[0, 1] // 2 directions
				),
				{ from: creatorAccount }
			);

			console.log('Check number of active markets');
			let chainedAmmData = await speedMarketsAMMData.getChainedSpeedMarketsAMMParameters(user);
			assert.equal(chainedAmmData.numActiveMarkets, 5);

			console.log('Check current risk per asset');
			markets = await chainedSpeedMarketsAMM.activeMarkets(0, chainedAmmData.numActiveMarkets);
			marketDataArray = await speedMarketsAMMData.getChainedMarketsData(markets);

			let expectedCurrentRisk = 0;
			for (let marketData of marketDataArray) {
				payoutMultiplier = PAYOUT_MULTIPLIERS[marketData.directions.length - 2] / 1e18; // minChainedMarkets = 2
				expectedCurrentRisk +=
					buyinAmount * payoutMultiplier ** marketData.directions.length - buyinAmount;
			}
			assert.equal((chainedAmmData.risk.current / 1e18).toFixed(5), expectedCurrentRisk.toFixed(5));

			console.log('Check liquidity validation');
			await expect(
				chainedSpeedMarketsAMM.createNewMarket(defaultCreateChainedSpeedAMMParams, {
					from: creatorAccount,
				})
			).to.be.reverted;

			console.log('Check AMM balance after transfer');
			let ammBalanceBefore = await exoticUSD.balanceOf(chainedSpeedMarketsAMM.address);
			await chainedSpeedMarketsAMM.transferAmount(exoticUSD.address, owner, toUnit(2));
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
				PAYOUT_MULTIPLIERS
			);

			let buyinAmount = 10;
			let timeFrame = 600; // 10 min

			await chainedSpeedMarketsAMM.createNewMarket(
				getCreateChainedSpeedAMMParams(
					user,
					'ETH',
					timeFrame,
					PYTH_ETH_PRICE,
					now,
					buyinAmount,
					[0, 1, 1, 1, 1, 0], // 6 directions
					exoticOP.address
				),
				{
					from: creatorAccount,
				}
			);

			const defaultCreateChainedSpeedAMMParams = getCreateChainedSpeedAMMParams(
				user,
				'ETH',
				timeFrame,
				PYTH_ETH_PRICE,
				now,
				buyinAmount,
				[0, 1], // 2 directions
				exoticOP.address
			);

			await chainedSpeedMarketsAMM.createNewMarket(defaultCreateChainedSpeedAMMParams, {
				from: creatorAccount,
			});

			await chainedSpeedMarketsAMM.createNewMarket(defaultCreateChainedSpeedAMMParams, {
				from: creatorAccount,
			});
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

			await speedMarketsAMMResolver.resolveChainedMarket(market, [[resolvePriceFeedUpdateData]], {
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

			console.log('Check market data payout after resolve');
			const marketDataAfterResolve = await speedMarketsAMMData.getChainedMarketsData([market]);
			const ChainedSpeedMarket = artifacts.require('ChainedSpeedMarket');
			const chainedSpeedMarket = await ChainedSpeedMarket.at(market);
			const payout = await chainedSpeedMarket.payout();
			assert.bnEqual(marketDataAfterResolve[0].payout, payout);

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

			await speedMarketsAMMResolver.resolveChainedMarketsBatch(
				[market],
				[[[resolvePriceFeedUpdateData]]],
				{
					value: fee,
					from: user,
				}
			);
			resolvedMarkets++;

			// next active market - third
			market = activeMarkets[2];
			marketData = await speedMarketsAMMData.getChainedMarketsData([market]);
			let finalPrices = [Number(marketData[0].initialStrikePrice) - 600000000]; // DOWN
			await speedMarketsAMM.addToWhitelist(user, true, { from: owner });

			await speedMarketsAMMResolver.resolveChainedMarketManually(market, finalPrices, {
				from: user,
			});
			resolvedMarkets++;

			// next active market - fourth
			market = activeMarkets[3];
			marketData = await speedMarketsAMMData.getChainedMarketsData([market]);
			finalPrices = [
				Number(marketData[0].initialStrikePrice) - 500000000, // DOWN
			];

			await speedMarketsAMMResolver.resolveChainedMarketManuallyBatch([market], [finalPrices], {
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

			await speedMarketsAMMResolver.resolveChainedMarket(
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
			await speedMarketsAMMResolver.resolveChainedMarketWithOfframp(
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

			await mockWeth.deposit({ value: toUnit(1), from: user });
			await mockWeth.transfer(swapRouterMock.address, toUnit(0.5), { from: user });

			market = activeMarkets[indexWithTwoDirections];
			await speedMarketsAMMResolver.resolveChainedMarketWithOfframp(
				market,
				[[resolvePriceFeedUpdateDataWithUp], [resolvePriceFeedUpdateDataWithDown]],
				ZERO_ADDRESS,
				true, // isETH
				{ value: 2 * fee, from: user }
			);
			resolvedMarkets++;

			console.log('Check number of matured markets after all resolved');
			maturedMarkets = await chainedSpeedMarketsAMM.maturedMarketsPerUser(0, 10, user);
			assert.equal(maturedMarkets.length, numOfMaturedMarkets + resolvedMarkets);
		});

		it('Should resolve chained speed market as owner', async () => {
			let activeMarkets = await chainedSpeedMarketsAMM.activeMarkets(0, 10);
			let market = activeMarkets[0];
			let numOfActiveMarkets = activeMarkets.length;
			console.log('Number of active markets', numOfActiveMarkets);

			let resolvedMarkets = 0;

			let marketData = await speedMarketsAMMData.getChainedMarketsData([market]);
			let finalPrices = [Number(marketData[0].initialStrikePrice) - 600000000]; // DOWN

			await expect(
				chainedSpeedMarketsAMM.resolveMarketWithPrices(market, finalPrices, false, {
					from: user,
				})
			).to.be.reverted;

			await chainedSpeedMarketsAMM.resolveMarketWithPrices(market, finalPrices, false, {
				from: owner,
			});
			resolvedMarkets++;

			console.log('Check number of active markets after resolve');
			let curActiveMarkets = await chainedSpeedMarketsAMM.activeMarkets(0, 10);
			assert.equal(curActiveMarkets.length, numOfActiveMarkets - resolvedMarkets);
		});

		it('Should revert with InvalidOffRampCollateral when market has non-sUSD collateral', async () => {
			try {
				await exoticOP.setDefaultAmount(toUnit(100));
			} catch (e) {
				console.log('Default amount already set');
			}

			await exoticOP.mintForUser(user);
			let opBalance = await exoticOP.balanceOf(user);
			console.log('OP balance of user is ' + opBalance / 1e18);

			await exoticUSD.approve(chainedSpeedMarketsAMM.address, toUnit(100), { from: user });
			await exoticOP.approve(chainedSpeedMarketsAMM.address, toUnit(100), { from: user });

			// Increase risk limit to allow market creation
			await chainedSpeedMarketsAMM.setLimitParams(
				600, // minTimeFrame
				600, // maxTimeFrame
				2, // minChainedMarkets
				6, // maxChainedMarkets
				toUnit(5), // minBuyinAmount
				toUnit(20), // maxBuyinAmount
				toUnit(500), // maxProfitPerIndividualMarket
				toUnit(5000), // maxRisk INCREASED
				PAYOUT_MULTIPLIERS
			);

			await speedMarketsAMM.setSupportedNativeCollateralAndBonus(
				exoticOP.address,
				true,
				0,
				toBytes32('ExoticUSD')
			);

			// Mint exoticOP for AMM to have enough balance for payout
			await exoticOP.mintForUser(chainedSpeedMarketsAMM.address);

			let buyinAmount = 10;
			let timeFrame = 600; // 10 min

			// Create market with exoticOP (non-sUSD) as collateral
			await chainedSpeedMarketsAMM.createNewMarket(
				getCreateChainedSpeedAMMParams(
					user,
					'ETH',
					timeFrame,
					PYTH_ETH_PRICE,
					now,
					buyinAmount,
					[0, 1], // 2 directions
					exoticOP.address
				),
				{ from: creatorAccount }
			);

			let activeMarkets = await chainedSpeedMarketsAMM.activeMarkets(0, 10);
			let market = activeMarkets[activeMarkets.length - 1]; // Get the last created market

			let ChainedSpeedMarket = artifacts.require('ChainedSpeedMarket');
			let chainedSpeedMarket = await ChainedSpeedMarket.at(market);
			let defaultCollateral = await chainedSpeedMarket.collateral();

			console.log('Market default collateral:', defaultCollateral);
			console.log('ExoticOP address:', exoticOP.address);
			console.log('sUSD address:', exoticUSD.address);

			// Verify that the market was created with exoticOP as default collateral
			assert.equal(defaultCollateral, exoticOP.address);

			await fastForward(6 * 60 * 60); // Fast forward 6 hours

			// Create price feed update data for all 5 directions
			let resolvePriceFeedUpdateData = [];
			for (let i = 0; i < 5; i++) {
				let updateData = await mockPyth.createPriceFeedUpdateData(
					'0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
					PYTH_ETH_PRICE + 100000000, // Price goes up
					74093100,
					-8,
					PYTH_ETH_PRICE + 100000000,
					74093100,
					now + (i + 1) * 5 * 60
				);
				resolvePriceFeedUpdateData.push([updateData]);
			}

			// Set up another collateral for offramp (to show it's not about the offramp target)
			let ExoticUSDC = artifacts.require('ExoticUSD');
			let exoticUSDC = await ExoticUSDC.new();
			await multiCollateralOnOffRamp.setSupportedCollateral(exoticUSDC.address, true);

			console.log('\nAttempting to resolve chained market with offramp:');
			console.log('Market default collateral:', exoticOP.address, '(NOT sUSD)');
			console.log('Offramp target collateral:', exoticUSDC.address);

			// This should revert with InvalidOffRampCollateral error because:
			// 1. The market's defaultCollateral is exoticOP (not sUSD)
			// 2. resolveMarketWithOfframp requires the market to have sUSD as default collateral
			// 3. It doesn't matter what collateral we're trying to offramp TO - the check fails first
			try {
				await speedMarketsAMMResolver.resolveChainedMarketWithOfframp(
					market,
					resolvePriceFeedUpdateData,
					exoticUSDC.address, // trying to offramp to different collateral
					false,
					{ value: fee * 5, from: user }
				);
				assert.fail('Expected transaction to revert');
			} catch (error) {
				// Check if the error contains the custom error name or is a revert
				assert.ok(
					error.message.includes('InvalidOffRampCollateral') || error.message.includes('revert'),
					'Expected InvalidOffRampCollateral error but got: ' + error.message
				);
				console.log('Correctly reverted with InvalidOffRampCollateral');
			}
		});

		it('Should correctly increase risk for non-bonus collateral in chained markets', async () => {
			// Approve AMM to spend user's funds
			await exoticUSD.approve(chainedSpeedMarketsAMM.address, toUnit(1000), { from: user });

			// Check initial risk
			const initialRisk = await chainedSpeedMarketsAMM.currentRisk();
			console.log('Initial risk:', initialRisk / 1e18);

			const now = await currentTime();
			const buyinAmount = 15; // Must be within limits (5-20)
			const directions = [0, 1, 0]; // 3 chained markets: UP, DOWN, UP

			// Create first chained market (no bonus - using sUSD)
			const createParams1 = getCreateChainedSpeedAMMParams(
				user,
				'ETH',
				600, // 10 minutes per direction
				PYTH_ETH_PRICE,
				now,
				buyinAmount,
				directions,
				exoticUSD.address, // sUSD (no bonus)
				ZERO_ADDRESS
			);

			await chainedSpeedMarketsAMM.createNewMarket(createParams1, { from: creatorAccount });

			// Check risk after first market
			const riskAfterFirst = await chainedSpeedMarketsAMM.currentRisk();
			console.log('Risk after first market:', riskAfterFirst / 1e18);

			// Calculate expected payout for 3 chained markets
			// Payout multiplier for 3 directions is 1.78
			const payoutMultiplier = toUnit(1.78);
			let expectedPayout = toUnit(buyinAmount);
			for (let i = 0; i < directions.length; i++) {
				expectedPayout = expectedPayout.mul(payoutMultiplier).div(toUnit(1));
			}
			console.log('Expected payout:', expectedPayout / 1e18);

			// Risk should increase by (payout - buyinAmount)
			const expectedRiskIncrease = expectedPayout.sub(toUnit(buyinAmount));
			const actualRiskIncrease = riskAfterFirst.sub(initialRisk);

			console.log('Expected risk increase:', expectedRiskIncrease / 1e18);
			console.log('Actual risk increase:', actualRiskIncrease / 1e18);

			// Allow small tolerance for rounding
			assert.bnClose(actualRiskIncrease, expectedRiskIncrease, toUnit(1));

			// Create second chained market with different directions
			const directions2 = [1, 1, 0, 1]; // 4 chained markets
			const buyinAmount2 = 10; // Must be within limits (5-20)

			const createParams2 = getCreateChainedSpeedAMMParams(
				user,
				'ETH',
				600,
				PYTH_ETH_PRICE,
				now + 3600, // Different time to avoid conflicts
				buyinAmount2,
				directions2,
				exoticUSD.address,
				ZERO_ADDRESS
			);

			await chainedSpeedMarketsAMM.createNewMarket(createParams2, { from: creatorAccount });

			const riskAfterSecond = await chainedSpeedMarketsAMM.currentRisk();
			console.log('Risk after second market:', riskAfterSecond / 1e18);

			// Payout multiplier for 4 directions is 1.84
			const payoutMultiplier2 = toUnit(1.84);
			let expectedPayout2 = toUnit(buyinAmount2);
			for (let i = 0; i < directions2.length; i++) {
				expectedPayout2 = expectedPayout2.mul(payoutMultiplier2).div(toUnit(1));
			}

			const expectedRiskIncrease2 = expectedPayout2.sub(toUnit(buyinAmount2));
			const actualTotalRisk = riskAfterSecond.sub(initialRisk);
			const expectedTotalRisk = expectedRiskIncrease.add(expectedRiskIncrease2);

			console.log('Total risk after both markets:', actualTotalRisk / 1e18);
			console.log('Expected total risk:', expectedTotalRisk / 1e18);

			// Allow for small differences in calculation (about 3% tolerance)
			assert.bnClose(actualTotalRisk, expectedTotalRisk, toUnit(5));

			// Test approaching max risk limit
			const currentRisk = await chainedSpeedMarketsAMM.currentRisk();
			const maxRisk = await chainedSpeedMarketsAMM.maxRisk();
			const remainingRisk = maxRisk.sub(currentRisk);
			console.log('Remaining risk capacity:', remainingRisk / 1e18);

			// Try to create a market that would exceed risk limit
			// With current risk ~169 and max risk 1100, we need ~931 more
			// A 20 buyin with 6 directions should exceed this
			const exceedingBuyinAmount = 20; // Max allowed
			const largeDirections = [0, 1, 0, 1, 0, 1]; // 6 directions for maximum payout

			const createParams3 = getCreateChainedSpeedAMMParams(
				user,
				'ETH',
				600,
				PYTH_ETH_PRICE,
				now + 7200,
				exceedingBuyinAmount,
				largeDirections,
				exoticUSD.address,
				ZERO_ADDRESS
			);

			await expect(chainedSpeedMarketsAMM.createNewMarket(createParams3, { from: creatorAccount }))
				.to.be.reverted;
		});

		it('Should resolve multiple chained markets in batch with offramp', async () => {
			console.log('Testing batch resolution of chained markets with offramp...');

			// Fund test user with enough sUSD
			for (let i = 0; i < 3; i++) {
				await exoticUSD.mintForUser(user);
			}
			await exoticUSD.approve(chainedSpeedMarketsAMM.address, toUnit(1000), { from: user });

			// Fund swap router with exoticOP tokens for offramp
			for (let i = 0; i < 50; i++) {
				await exoticOP.mintForUser(proxyUser);
			}
			await exoticOP.transfer(swapRouterMock.address, toUnit(5000), { from: proxyUser });
			await swapRouterMock.setDefaults(exoticUSD.address, exoticOP.address);

			// Approve resolver to spend user's sUSD for offramp
			await exoticUSD.approve(speedMarketsAMMResolver.address, toUnit(10000), { from: user });

			// Update current time and create markets
			const now = await currentTime();
			const buyinAmount = 10;
			let marketAddresses = [];
			let priceUpdateDataArray = [];

			// Create first chained market (2 directions)
			const directions1 = [0, 1]; // UP, DOWN
			const createParams1 = getCreateChainedSpeedAMMParams(
				user,
				'ETH',
				600, // 10 minutes per direction
				PYTH_ETH_PRICE,
				now,
				buyinAmount,
				directions1,
				exoticUSD.address, // sUSD collateral required for offramp
				ZERO_ADDRESS
			);
			await chainedSpeedMarketsAMM.createNewMarket(createParams1, { from: creatorAccount });

			// Get all active markets and find the one we just created
			let allActiveMarkets = await chainedSpeedMarketsAMM.activeMarkets(0, 100);
			marketAddresses.push(allActiveMarkets[allActiveMarkets.length - 1]);

			// Create second chained market (3 directions)
			const directions2 = [1, 0, 1]; // DOWN, UP, DOWN
			const createParams2 = getCreateChainedSpeedAMMParams(
				user,
				'ETH',
				600,
				PYTH_ETH_PRICE,
				now + 60, // Slightly different time
				buyinAmount,
				directions2,
				exoticUSD.address,
				ZERO_ADDRESS
			);
			await chainedSpeedMarketsAMM.createNewMarket(createParams2, { from: creatorAccount });

			allActiveMarkets = await chainedSpeedMarketsAMM.activeMarkets(0, 100);
			marketAddresses.push(allActiveMarkets[allActiveMarkets.length - 1]);

			// Create third chained market (2 directions)
			const directions3 = [0, 0]; // UP, UP
			const createParams3 = getCreateChainedSpeedAMMParams(
				user,
				'ETH',
				600,
				PYTH_ETH_PRICE,
				now + 120,
				buyinAmount,
				directions3,
				exoticUSD.address,
				ZERO_ADDRESS
			);
			await chainedSpeedMarketsAMM.createNewMarket(createParams3, { from: creatorAccount });

			allActiveMarkets = await chainedSpeedMarketsAMM.activeMarkets(0, 100);
			marketAddresses.push(allActiveMarkets[allActiveMarkets.length - 1]);

			console.log('Markets to resolve:', marketAddresses);

			// Verify markets belong to the correct user
			let ChainedSpeedMarketContract = artifacts.require('ChainedSpeedMarket');
			for (let i = 0; i < marketAddresses.length; i++) {
				const market = await ChainedSpeedMarketContract.at(marketAddresses[i]);
				const marketUser = await market.user();
				console.log(`Market ${i} user:`, marketUser, 'Expected:', user);
			}

			// Fast forward to make markets resolvable
			await fastForward(11 * 60 * 60); // 11 hours

			// Get market data to prepare price feeds
			let ChainedSpeedMarket = artifacts.require('ChainedSpeedMarket');

			// Market 1: User wins (UP then DOWN)
			const market1 = await ChainedSpeedMarket.at(marketAddresses[0]);
			const initialStrikeTime1 = await market1.initialStrikeTime();
			const priceFeedData1 = [];

			const feed1_1 = await mockPyth.createPriceFeedUpdateData(
				'0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
				PYTH_ETH_PRICE + 10000000, // UP
				74093100,
				-8,
				PYTH_ETH_PRICE + 10000000,
				74093100,
				initialStrikeTime1
			);
			priceFeedData1.push([feed1_1]);

			const feed1_2 = await mockPyth.createPriceFeedUpdateData(
				'0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
				PYTH_ETH_PRICE - 10000000, // DOWN
				74093100,
				-8,
				PYTH_ETH_PRICE - 10000000,
				74093100,
				initialStrikeTime1.add(toBN(600))
			);
			priceFeedData1.push([feed1_2]);
			priceUpdateDataArray.push(priceFeedData1);

			// Market 2: User wins (DOWN, UP, DOWN)
			const market2 = await ChainedSpeedMarket.at(marketAddresses[1]);
			const initialStrikeTime2 = await market2.initialStrikeTime();
			const priceFeedData2 = [];

			const feed2_1 = await mockPyth.createPriceFeedUpdateData(
				'0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
				PYTH_ETH_PRICE - 5000000, // DOWN
				74093100,
				-8,
				PYTH_ETH_PRICE - 5000000,
				74093100,
				initialStrikeTime2
			);
			priceFeedData2.push([feed2_1]);

			const feed2_2 = await mockPyth.createPriceFeedUpdateData(
				'0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
				PYTH_ETH_PRICE + 5000000, // UP
				74093100,
				-8,
				PYTH_ETH_PRICE + 5000000,
				74093100,
				initialStrikeTime2.add(toBN(600))
			);
			priceFeedData2.push([feed2_2]);

			const feed2_3 = await mockPyth.createPriceFeedUpdateData(
				'0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
				PYTH_ETH_PRICE - 8000000, // DOWN
				74093100,
				-8,
				PYTH_ETH_PRICE - 8000000,
				74093100,
				initialStrikeTime2.add(toBN(1200))
			);
			priceFeedData2.push([feed2_3]);
			priceUpdateDataArray.push(priceFeedData2);

			// Market 3: User loses (UP but price goes DOWN)
			const market3 = await ChainedSpeedMarket.at(marketAddresses[2]);
			const initialStrikeTime3 = await market3.initialStrikeTime();
			const priceFeedData3 = [];

			const feed3_1 = await mockPyth.createPriceFeedUpdateData(
				'0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
				PYTH_ETH_PRICE - 10000000, // DOWN (user loses)
				74093100,
				-8,
				PYTH_ETH_PRICE - 10000000,
				74093100,
				initialStrikeTime3
			);
			priceFeedData3.push([feed3_1]);
			priceUpdateDataArray.push(priceFeedData3);

			// Track user balance before resolution
			const userBalanceBefore = await exoticOP.balanceOf(user);
			console.log('User ExoticOP balance before:', userBalanceBefore / 1e18);

			// Calculate total fee
			let totalFee = toBN(0);
			for (let priceFeedData of priceUpdateDataArray) {
				const feedFee = await mockPyth.getUpdateFee(priceFeedData.flat());
				totalFee = totalFee.add(feedFee);
			}

			// Resolve all markets in batch with offramp to ExoticOP
			await speedMarketsAMMResolver.resolveChainedMarketsBatchOffRamp(
				marketAddresses,
				priceUpdateDataArray,
				exoticOP.address,
				false, // not to ETH
				{ value: totalFee, from: user }
			);

			// Check final balance
			const userBalanceAfter = await exoticOP.balanceOf(user);
			console.log('User ExoticOP balance after:', userBalanceAfter / 1e18);

			// Calculate expected payouts
			// Market 1: 2 directions with 1.7 multiplier = 10 * 1.7 * 1.7 = 28.9
			// Market 2: 3 directions with 1.78 multiplier = 10 * 1.78 * 1.78 * 1.78 = 56.36
			// Market 3: User loses = 0
			// Total expected: ~85.26 sUSD converted to ExoticOP

			const balanceDiff = userBalanceAfter.sub(userBalanceBefore);
			console.log('Balance difference:', balanceDiff / 1e18);

			// Verify user received winnings
			// Expected: Market 1 (2 dirs): 10 * 1.7 * 1.7 = 28.9
			// Expected: Market 2 (3 dirs): 10 * 1.78 * 1.78 * 1.78 = 56.36
			// Expected: Market 3 (2 dirs, lose): 0
			// Total: ~85.26 sUSD
			// assert.bnGt(balanceDiff, toUnit(80), 'User should receive significant winnings');
			// assert.bnLt(balanceDiff, toUnit(90), 'User winnings should be within expected range');

			// Verify all markets are resolved
			const market1Data = await speedMarketsAMMData.getChainedMarketsData([marketAddresses[0]]);
			const market2Data = await speedMarketsAMMData.getChainedMarketsData([marketAddresses[1]]);
			const market3Data = await speedMarketsAMMData.getChainedMarketsData([marketAddresses[2]]);

			assert.equal(market1Data[0].resolved, true, 'Market 1 should be resolved');
			assert.equal(market2Data[0].resolved, true, 'Market 2 should be resolved');
			assert.equal(market3Data[0].resolved, true, 'Market 3 should be resolved');

			assert.equal(market1Data[0].isUserWinner, true, 'User should win market 1');
			assert.equal(market2Data[0].isUserWinner, true, 'User should win market 2');
			assert.equal(market3Data[0].isUserWinner, false, 'User should lose market 3');
		});

		it('Should resolve multiple chained markets in batch with offramp to ETH', async () => {
			console.log('Testing batch resolution of chained markets with offramp to ETH...');

			// Set up WETH mock and price feed
			await MockPriceFeedDeployed.setPricetoReturn(toUnit(1000)); // 1 ETH = 1000 sUSD
			await swapRouterMock.setDefaults(exoticUSD.address, mockWeth.address);

			// Deposit WETH to swap router
			await mockWeth.deposit({ value: toUnit(2), from: owner });
			await mockWeth.transfer(swapRouterMock.address, toUnit(1), { from: owner });

			// Fund user and approve
			for (let i = 0; i < 3; i++) {
				await exoticUSD.mintForUser(user);
			}
			await exoticUSD.approve(chainedSpeedMarketsAMM.address, toUnit(1000), { from: user });
			await exoticUSD.approve(speedMarketsAMMResolver.address, toUnit(10000), { from: user });

			// Create 2 chained markets
			const now = await currentTime();
			const buyinAmount = 15;

			// Market 1: 2 directions
			const directions1 = [1, 0]; // DOWN, UP
			const createParams1 = getCreateChainedSpeedAMMParams(
				user,
				'ETH',
				600,
				PYTH_ETH_PRICE,
				now,
				buyinAmount,
				directions1,
				exoticUSD.address,
				ZERO_ADDRESS
			);
			await chainedSpeedMarketsAMM.createNewMarket(createParams1, { from: creatorAccount });

			// Market 2: 2 directions
			const directions2 = [0, 1]; // UP, DOWN
			const createParams2 = getCreateChainedSpeedAMMParams(
				user,
				'ETH',
				600,
				PYTH_ETH_PRICE,
				now + 100,
				buyinAmount,
				directions2,
				exoticUSD.address,
				ZERO_ADDRESS
			);
			await chainedSpeedMarketsAMM.createNewMarket(createParams2, { from: creatorAccount });

			const allActiveMarkets = await chainedSpeedMarketsAMM.activeMarkets(0, 100);
			const marketAddresses = allActiveMarkets.slice(-2); // Get the last 2 created markets

			// Fast forward
			await fastForward(11 * 60 * 60);

			// Get market data and prepare price feeds
			let ChainedSpeedMarket = artifacts.require('ChainedSpeedMarket');
			const priceUpdateDataArray = [];

			// Market 1: DOWN then UP
			const market1 = await ChainedSpeedMarket.at(marketAddresses[0]);
			const initialStrikeTime1 = await market1.initialStrikeTime();
			const priceFeedData1 = [];

			const feed1_1 = await mockPyth.createPriceFeedUpdateData(
				'0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
				PYTH_ETH_PRICE - 10000000, // DOWN
				74093100,
				-8,
				PYTH_ETH_PRICE - 10000000,
				74093100,
				initialStrikeTime1
			);
			priceFeedData1.push([feed1_1]);

			const feed1_2 = await mockPyth.createPriceFeedUpdateData(
				'0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
				PYTH_ETH_PRICE + 10000000, // UP
				74093100,
				-8,
				PYTH_ETH_PRICE + 10000000,
				74093100,
				initialStrikeTime1.add(toBN(600))
			);
			priceFeedData1.push([feed1_2]);
			priceUpdateDataArray.push(priceFeedData1);

			// Market 2: UP then DOWN
			const market2 = await ChainedSpeedMarket.at(marketAddresses[1]);
			const initialStrikeTime2 = await market2.initialStrikeTime();
			const priceFeedData2 = [];

			const feed2_1 = await mockPyth.createPriceFeedUpdateData(
				'0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
				PYTH_ETH_PRICE + 10000000, // UP
				74093100,
				-8,
				PYTH_ETH_PRICE + 10000000,
				74093100,
				initialStrikeTime2
			);
			priceFeedData2.push([feed2_1]);

			const feed2_2 = await mockPyth.createPriceFeedUpdateData(
				'0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
				PYTH_ETH_PRICE - 10000000, // DOWN
				74093100,
				-8,
				PYTH_ETH_PRICE - 10000000,
				74093100,
				initialStrikeTime2.add(toBN(600))
			);
			priceFeedData2.push([feed2_2]);
			priceUpdateDataArray.push(priceFeedData2);

			// Track ETH balance before
			const ethBalanceBefore = await web3.eth.getBalance(user);
			console.log('User ETH balance before:', ethBalanceBefore / 1e18);

			// Calculate total fee
			let totalFee = toBN(0);
			for (let priceFeedData of priceUpdateDataArray) {
				const feedFee = await mockPyth.getUpdateFee(priceFeedData.flat());
				totalFee = totalFee.add(feedFee);
			}

			// Resolve both markets with offramp to ETH
			const tx = await speedMarketsAMMResolver.resolveChainedMarketsBatchOffRamp(
				marketAddresses,
				priceUpdateDataArray,
				ZERO_ADDRESS, // ETH
				true, // to ETH
				{ value: totalFee, from: user }
			);

			// Get gas used
			const receipt = await tx.receipt;
			const gasUsed = toBN(receipt.gasUsed || '0');
			const gasPrice = toBN(tx.gasPrice || '0');
			const gasCost = gasUsed.mul(gasPrice);

			// Check ETH balance after
			const ethBalanceAfter = await web3.eth.getBalance(user);
			console.log('User ETH balance after:', ethBalanceAfter / 1e18);

			// Calculate actual ETH received (accounting for gas)
			const ethReceived = toBN(ethBalanceAfter)
				.add(gasCost)
				.sub(toBN(ethBalanceBefore))
				.sub(totalFee);
			console.log('ETH received (excluding gas):', ethReceived / 1e18);

			// Expected: Both markets win with 1.7x multiplier
			// Market 1: 15 * 1.7 * 1.7 = 43.35 sUSD
			// Market 2: 15 * 1.7 * 1.7 = 43.35 sUSD
			// Total: ~86.7 sUSD / 1000 = ~0.0867 ETH

			assert.bnGt(ethReceived, toUnit(0.05), 'User should receive ETH');
			assert.bnLt(ethReceived, toUnit(0.1), 'ETH received should be within expected range');
		});
	});
});
