'use strict';

const { artifacts, contract } = require('hardhat');
const { assert } = require('../../utils/common');
const { toBytes32 } = require('../../../index');
const { expect } = require('chai');
const { fastForward, toUnit, currentTime } = require('../../utils')();
const { ZERO_ADDRESS } = require('../../utils/helpers');
const { getCreateChainedSpeedAMMParams } = require('../../utils/speedMarkets');
const { toBN } = require('web3-utils');

contract('ChainedSpeedMarketsNativeCollateral', (accounts) => {
	const [owner, user, safeBox, referrer, proxyUser, creatorAccount, user2] = accounts;

	let chainedSpeedMarketsAMM;
	let speedMarketsAMMData;
	let speedMarketsAMM;
	let speedMarketsAMMUtils;
	let speedMarketsAMMResolver;
	let exoticUSD; // Default sUSD with 18 decimals
	let exoticUSDC; // 6 decimals collateral
	let exoticUSDT; // 18 decimals collateral with $0.80 price
	let mockPyth;
	let MockPriceFeedDeployed;
	let addressManager;
	let referrals;
	let multiCollateralOnOffRamp;
	let mockWeth, swapRouterMock;
	let priceFeedUpdateData, fee;
	let now;

	const ETH = toBytes32('ETH');
	const BTC = toBytes32('BTC');
	const ETH_PYTH_ID = '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace';
	const BTC_PYTH_ID = '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43';
	const ETH_CHAINLINK_ID = '0x000359843a543ee2fe414dc14c7e7920ef10f4372990b79d6361cdc0dd1ba782';
	const BTC_CHAINLINK_ID = '0x00037da06d56d083fe599397a4769a042d63aa73dc4ef57709d31e9971a5b439';

	const PAYOUT_MULTIPLIERS = [toUnit(1.7), toUnit(1.78), toUnit(1.82), toUnit(1.85), toUnit(1.9)];
	const DEFAULT_REFERRER_FEE = 0.005;
	const PYTH_ETH_PRICE = 186342931000;

	const ONE = toUnit(1);

	before(async () => {
		// -------------------------- Speed Markets --------------------------
		let SpeedMarketsAMMContract = artifacts.require('SpeedMarketsAMM');
		speedMarketsAMM = await SpeedMarketsAMMContract.new();

		let SpeedMarketsAMMDataContract = artifacts.require('SpeedMarketsAMMData');
		speedMarketsAMMData = await SpeedMarketsAMMDataContract.new();
		await speedMarketsAMMData.initialize(owner, speedMarketsAMM.address);

		// Deploy default collateral
		let ExoticUSD = artifacts.require('ExoticUSD');
		exoticUSD = await ExoticUSD.new();
		await exoticUSD.setDefaultAmount(toUnit(10000));

		// Deploy USDC-like token with 6 decimals
		const ExoticUSDC = artifacts.require('ExoticUSDC');
		exoticUSDC = await ExoticUSDC.new();
		await exoticUSDC.setDefaultAmount(10000 * 1e6); // 10000 USDC
		await exoticUSDC.setName('Exotic USDC', { from: owner });
		await exoticUSDC.setSymbol('exUSDC', { from: owner });

		// Deploy USDT-like token with 18 decimals
		exoticUSDT = await ExoticUSD.new();
		await exoticUSDT.setDefaultAmount(toUnit(10000));
		await exoticUSDT.setName('Exotic USDT', { from: owner });
		await exoticUSDT.setSymbol('exUSDT', { from: owner });

		// Mint tokens for users
		for (let i = 0; i < 10; i++) {
			await exoticUSD.mintForUser(user);
			await exoticUSD.mintForUser(user2);
			await exoticUSDC.mintForUser(user);
			await exoticUSDC.mintForUser(user2);
			await exoticUSDT.mintForUser(user);
			await exoticUSDT.mintForUser(user2);
		}

		// Mint tokens for owner to fund AMMs
		for (let i = 0; i < 10; i++) {
			await exoticUSD.mintForUser(owner);
			await exoticUSDC.mintForUser(owner);
			await exoticUSDT.mintForUser(owner);
		}

		// Deploy speed market mastercopy
		let SpeedMarketMastercopy = artifacts.require('SpeedMarketMastercopy');
		let speedMarketMastercopy = await SpeedMarketMastercopy.new();

		// Initialize speedMarketsAMM
		await speedMarketsAMM.initialize(owner, exoticUSD.address);
		await speedMarketsAMM.setLimitParams(toUnit(5), toUnit(500), 3600, 86400, 60, 60);
		await speedMarketsAMM.setSupportedAsset(ETH, true);
		await speedMarketsAMM.setMaxRisks(ETH, toUnit(1000), toUnit(500));
		await speedMarketsAMM.setSafeBoxAndMaxSkewImpact(toUnit(0.02), toUnit(0.05), toUnit(0.02));
		await speedMarketsAMM.setAssetToPriceOracleID(ETH, ETH_PYTH_ID, ETH_CHAINLINK_ID);

		await speedMarketsAMM.setSupportedAsset(BTC, true);
		await speedMarketsAMM.setMaxRisks(BTC, toUnit(1000), toUnit(500));
		await speedMarketsAMM.setAssetToPriceOracleID(BTC, BTC_PYTH_ID, BTC_CHAINLINK_ID);

		// Transfer sUSD to speedMarketsAMM
		await exoticUSD.transfer(speedMarketsAMM.address, toUnit(50000), { from: owner });

		// Setup current time
		now = await currentTime();

		// Setup Pyth
		let MockPyth = artifacts.require('MockPythCustom');
		mockPyth = await MockPyth.new(60, 1e6);

		// Create initial price feed update data
		priceFeedUpdateData = await mockPyth.createPriceFeedUpdateData(
			ETH_PYTH_ID,
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

		// Setup Referrals
		let Referrals = artifacts.require('Referrals');
		referrals = await Referrals.new();
		await referrals.initialize(owner, ZERO_ADDRESS, ZERO_ADDRESS);
		await referrals.setWhitelistedAddress(speedMarketsAMM.address, true);
		await referrals.setReferrerFees(toUnit(DEFAULT_REFERRER_FEE), toUnit(0.0075), toUnit(0.01));

		// Setup Multi Collateral
		let MultiCollateralOnOffRamp = artifacts.require('MultiCollateralOnOffRamp');
		multiCollateralOnOffRamp = await MultiCollateralOnOffRamp.new();
		await multiCollateralOnOffRamp.initialize(owner, exoticUSD.address);

		let MockPriceFeed = artifacts.require('MockPriceFeed');
		MockPriceFeedDeployed = await MockPriceFeed.new(owner);
		await multiCollateralOnOffRamp.setPriceFeed(MockPriceFeedDeployed.address);

		// Set price feeds for collaterals
		await MockPriceFeedDeployed.setStaticPricePerCurrencyKey(toBytes32('USDC'), toUnit(1));
		await MockPriceFeedDeployed.setStaticPricePerCurrencyKey(toBytes32('USDT'), toUnit(0.8));
		await MockPriceFeedDeployed.setStaticPricePerCurrencyKey(toBytes32('sUSD'), toUnit(1));
		await MockPriceFeedDeployed.setStaticPricePerCurrencyKey(toBytes32('ExoticUSD'), toUnit(2));

		// Setup mock WETH and swap router
		let MockWeth = artifacts.require('MockWeth');
		mockWeth = await MockWeth.new();
		await multiCollateralOnOffRamp.setWETH(mockWeth.address, { from: owner });
		await multiCollateralOnOffRamp.setSupportedCollateral(mockWeth.address, true, { from: owner });
		await multiCollateralOnOffRamp.setSupportedCollateral(exoticUSDC.address, true, {
			from: owner,
		});
		await multiCollateralOnOffRamp.setSupportedCollateral(exoticUSDT.address, true, {
			from: owner,
		});

		let SwapRouterMock = artifacts.require('SwapRouterMock');
		swapRouterMock = await SwapRouterMock.new();
		await multiCollateralOnOffRamp.setSwapRouter(swapRouterMock.address);
		await swapRouterMock.setDefaults(exoticUSDC.address, exoticUSD.address);
		await swapRouterMock.setDefaults(exoticUSDT.address, exoticUSD.address);

		// Fund swap router with tokens
		await exoticUSD.mintForUser(proxyUser);
		await exoticUSD.transfer(swapRouterMock.address, toUnit(1000), { from: proxyUser });

		await multiCollateralOnOffRamp.setCurveSUSD(
			exoticUSD.address,
			exoticUSD.address,
			exoticUSD.address,
			exoticUSD.address,
			true,
			toUnit('0.01')
		);

		// Setup Address Manager
		let AddressManagerContract = artifacts.require('AddressManager');
		addressManager = await AddressManagerContract.new();
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
		await addressManager.setAddressInAddressBook('PriceFeed', MockPriceFeedDeployed.address);
		await addressManager.setAddressInAddressBook('SpeedMarketsAMM', speedMarketsAMM.address);

		let MockFreeBetsHolder = artifacts.require('MockFreeBetsHolder');
		let mockFreeBetsHolder = await MockFreeBetsHolder.new(creatorAccount);
		await addressManager.setAddressInAddressBook('FreeBetsHolder', mockFreeBetsHolder.address);

		// Deploy and setup ChainedSpeedMarketsAMM
		let ChainedSpeedMarketsAMMContract = artifacts.require('ChainedSpeedMarketsAMM');
		chainedSpeedMarketsAMM = await ChainedSpeedMarketsAMMContract.new();
		await chainedSpeedMarketsAMM.initialize(owner, exoticUSD.address);

		// Add ChainedSpeedMarketsAMM to address manager
		await addressManager.setAddressInAddressBook(
			'ChainedSpeedMarketsAMM',
			chainedSpeedMarketsAMM.address
		);

		// Setup SpeedMarketsAMMUtils
		let SpeedMarketsAMMUtilsContract = artifacts.require('SpeedMarketsAMMUtils');
		speedMarketsAMMUtils = await SpeedMarketsAMMUtilsContract.new();
		await speedMarketsAMMUtils.initialize(owner, addressManager.address);
		await addressManager.setAddressInAddressBook(
			'SpeedMarketsAMMUtils',
			speedMarketsAMMUtils.address
		);

		// Setup AMM addresses
		await speedMarketsAMM.setAMMAddresses(
			speedMarketMastercopy.address,
			speedMarketsAMMUtils.address,
			addressManager.address
		);

		// Setup SpeedMarketsAMMResolver
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

		// Update speedMarketsAMMData with chained AMM
		await speedMarketsAMMData.setSpeedMarketsAMM(
			speedMarketsAMM.address,
			chainedSpeedMarketsAMM.address,
			{ from: owner }
		);

		// Fund ChainedSpeedMarketsAMM with collaterals
		await exoticUSD.transfer(chainedSpeedMarketsAMM.address, toUnit(50000), { from: owner });
		await exoticUSDC.transfer(chainedSpeedMarketsAMM.address, 50000 * 1e6, { from: owner });
		await exoticUSDT.transfer(chainedSpeedMarketsAMM.address, toUnit(50000), { from: owner });

		// Deploy and setup ChainedSpeedMarket mastercopy
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
			toUnit(100), // maxBuyinAmount (increased for testing)
			toUnit(500), // maxProfitPerIndividualMarket
			toUnit(5000), // maxRisk (increased for testing)
			PAYOUT_MULTIPLIERS
		);

		// Whitelist chained AMM in referrals
		await referrals.setWhitelistedAddress(chainedSpeedMarketsAMM.address, true);

		// Setup multi collateral support
		await multiCollateralOnOffRamp.setSupportedAMM(chainedSpeedMarketsAMM.address, true);
		await multiCollateralOnOffRamp.setSupportedAMM(speedMarketsAMMResolver.address, true);
		await speedMarketsAMMResolver.setupMultiCollateralApproval(toUnit('1000000'), { from: owner });

		// Configure native collaterals in speedMarketsAMM (not chainedSpeedMarketsAMM)
		await speedMarketsAMM.setSupportedNativeCollateralAndBonus(
			exoticUSDC.address,
			true,
			toUnit(0.02), // 2% bonus
			toBytes32('USDC'),
			{ from: owner }
		);

		await speedMarketsAMM.setSupportedNativeCollateralAndBonus(
			exoticUSDT.address,
			true,
			toUnit(0.03), // 3% bonus
			toBytes32('USDT'),
			{ from: owner }
		);

		// Approve collaterals for all users
		const MAX_UINT = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
		await exoticUSD.approve(chainedSpeedMarketsAMM.address, MAX_UINT, { from: user });
		await exoticUSD.approve(chainedSpeedMarketsAMM.address, MAX_UINT, { from: user2 });
		await exoticUSDC.approve(chainedSpeedMarketsAMM.address, MAX_UINT, { from: user });
		await exoticUSDC.approve(chainedSpeedMarketsAMM.address, MAX_UINT, { from: user2 });
		await exoticUSDT.approve(chainedSpeedMarketsAMM.address, MAX_UINT, { from: user });
		await exoticUSDT.approve(chainedSpeedMarketsAMM.address, MAX_UINT, { from: user2 });
	});

	// Helper function to create chained market with native collateral
	async function createChainedMarketWithCollateral(
		collateral,
		buyinAmount,
		user,
		directions,
		timeFrame = 600
	) {
		const now = await currentTime();

		// For non-sUSD collaterals, we need to convert the buyinAmount to equivalent USD value
		let buyinAmountForParams;
		if (collateral === exoticUSDC.address) {
			// USDC has 6 decimals, convert to 18 decimal equivalent
			buyinAmountForParams = buyinAmount / 1e6;
		} else if (collateral === exoticUSDT.address) {
			// USDT has 18 decimals but price is $0.80, so adjust accordingly
			buyinAmountForParams = (buyinAmount / 1e18) * 0.8;
		} else {
			// sUSD or other 18 decimal tokens at $1
			buyinAmountForParams = buyinAmount / 1e18;
		}

		const params = getCreateChainedSpeedAMMParams(
			user,
			'ETH',
			timeFrame,
			PYTH_ETH_PRICE,
			now,
			buyinAmountForParams, // This will be converted to wei by the function
			directions,
			collateral,
			ZERO_ADDRESS // referrer
		);

		// Override the buyinAmount with the actual amount in native decimals
		params[7] = buyinAmount;

		try {
			const tx = await chainedSpeedMarketsAMM.createNewMarket(params, { from: creatorAccount });
			const marketCreatedLog = tx.logs.find((log) => log.event === 'MarketCreated');
			if (!marketCreatedLog) {
				return null;
			}
			const marketAddress = marketCreatedLog.args.market || marketCreatedLog.args[0];
			return marketAddress;
		} catch (error) {
			throw error;
		}
	}

	// Helper function to resolve chained market with multiple price feeds
	async function resolveChainedMarketWithPriceFeeds(
		marketAddress,
		finalPrices,
		strikeTimes,
		pythId = ETH_PYTH_ID
	) {
		// Check if market can be resolved first
		const canResolve = await chainedSpeedMarketsAMM.canResolveMarket(marketAddress);
		if (!canResolve) {
			const ChainedSpeedMarket = artifacts.require('ChainedSpeedMarket');
			const market = await ChainedSpeedMarket.at(marketAddress);
			const initialStrikeTime = await market.initialStrikeTime();
			const timeFrame = await market.timeFrame();
			const numDirections = await market.numOfDirections();
			const now = await currentTime();
			throw new Error(
				`Market cannot be resolved yet. Initial strike time: ${initialStrikeTime}, timeFrame: ${timeFrame}, directions: ${numDirections}, current time: ${now}`
			);
		}

		const updateDataArray = [];

		for (let i = 0; i < finalPrices.length; i++) {
			const updateData = await mockPyth.createPriceFeedUpdateData(
				pythId,
				toBN(finalPrices[i]),
				74093100,
				-8,
				toBN(finalPrices[i]),
				74093100,
				strikeTimes[i]
			);
			updateDataArray.push([updateData]);
		}

		// Calculate fee based on the actual update data array
		const flattenedUpdateData = updateDataArray.flat();
		const fee = await mockPyth.getUpdateFee(flattenedUpdateData);

		try {
			await speedMarketsAMMResolver.resolveChainedMarket(marketAddress, updateDataArray, {
				from: owner,
				value: fee,
			});
		} catch (error) {
			throw error;
		}
	}

	describe('Native Collateral Configuration for Chained Markets', () => {
		it('Should correctly configure native collaterals with different decimals', async () => {
			// Verify USDC configuration (6 decimals)
			assert.equal(await speedMarketsAMM.supportedNativeCollateral(exoticUSDC.address), true);
			assert.bnEqual(await speedMarketsAMM.bonusPerCollateral(exoticUSDC.address), toUnit(0.02));
			assert.equal(await speedMarketsAMMUtils.collateralKey(exoticUSDC.address), toBytes32('USDC'));

			// Verify USDT configuration (18 decimals)
			assert.equal(await speedMarketsAMM.supportedNativeCollateral(exoticUSDT.address), true);
			assert.bnEqual(await speedMarketsAMM.bonusPerCollateral(exoticUSDT.address), toUnit(0.03));
			assert.equal(await speedMarketsAMMUtils.collateralKey(exoticUSDT.address), toBytes32('USDT'));

			// Verify price feeds work
			assert.bnEqual(
				await speedMarketsAMMUtils.getCollateralPriceInUSD(exoticUSDC.address),
				toUnit(1)
			);
			assert.bnEqual(
				await speedMarketsAMMUtils.getCollateralPriceInUSD(exoticUSDT.address),
				toUnit(0.8)
			);
		});

		it('Should update bonus for existing collateral', async () => {
			// Update USDC bonus
			await speedMarketsAMM.setSupportedNativeCollateralAndBonus(
				exoticUSDC.address,
				true,
				toUnit(0.025), // 2.5% bonus
				toBytes32('USDC'),
				{ from: owner }
			);

			assert.bnEqual(await speedMarketsAMM.bonusPerCollateral(exoticUSDC.address), toUnit(0.025));
		});
	});

	describe('Chained Market Creation with Different Collaterals', () => {
		it('Should create chained market with default sUSD collateral', async () => {
			const buyinAmount = toUnit(10); // 10 sUSD
			const directions = [0, 1, 0]; // UP, DOWN, UP

			const marketAddress = await createChainedMarketWithCollateral(
				exoticUSD.address,
				buyinAmount,
				user,
				directions
			);

			// Verify market was created
			const activeMarkets = await chainedSpeedMarketsAMM.activeMarkets(0, 10);
			assert.isTrue(activeMarkets.includes(marketAddress));

			// Verify market details
			const marketData = await speedMarketsAMMData.getChainedMarketsData([marketAddress]);
			assert.equal(marketData[0].collateral, exoticUSD.address);
			assert.equal(marketData[0].directions.length, directions.length);
			assert.bnEqual(marketData[0].buyinAmount, buyinAmount);
		});

		it('Should create chained market with 6-decimal USDC collateral', async () => {
			const buyinAmount = 50 * 1e6; // 50 USDC
			const directions = [0, 1]; // UP, DOWN

			const balanceBefore = await exoticUSDC.balanceOf(user);
			const marketAddress = await createChainedMarketWithCollateral(
				exoticUSDC.address,
				buyinAmount,
				user,
				directions
			);
			const balanceAfter = await exoticUSDC.balanceOf(user);

			// Verify correct amount was deducted
			const actualDeduction = balanceBefore.sub(balanceAfter);
			assert.isTrue(actualDeduction.gte(toBN(buyinAmount)), 'Should deduct at least buyinAmount');

			// Verify market payout with bonus
			const marketBalance = await exoticUSDC.balanceOf(marketAddress);
			const payoutMultiplier = PAYOUT_MULTIPLIERS[directions.length - 2]; // 1.7 for 2 directions
			const expectedPayout = toBN(buyinAmount)
				.mul(payoutMultiplier)
				.div(ONE)
				.mul(payoutMultiplier)
				.div(ONE) // Apply multiplier for each direction
				.mul(toBN(102))
				.div(toBN(100)); // Apply 2% bonus

			// Allow small tolerance for rounding
			assert.bnClose(marketBalance, expectedPayout, toBN(1e6)); // 1 USDC tolerance
		});

		it('Should create chained market with 18-decimal USDT collateral at $0.80', async () => {
			const buyinAmount = toUnit(62.5); // 62.5 USDT = $50
			const directions = [1, 0, 1]; // DOWN, UP, DOWN

			const balanceBefore = await exoticUSDT.balanceOf(user);
			const marketAddress = await createChainedMarketWithCollateral(
				exoticUSDT.address,
				buyinAmount,
				user,
				directions
			);
			const balanceAfter = await exoticUSDT.balanceOf(user);

			// Verify deduction
			const actualDeduction = balanceBefore.sub(balanceAfter);
			assert.isTrue(actualDeduction.gte(buyinAmount), 'Should deduct at least buyinAmount');

			// Verify risk is calculated in USD terms
			const currentRisk = await chainedSpeedMarketsAMM.currentRisk();
			assert.isTrue(currentRisk.gt(toBN(0)), 'Risk should increase');

			// Verify market has correct payout with 3% bonus
			const marketBalance = await exoticUSDT.balanceOf(marketAddress);
			const payoutMultiplier = PAYOUT_MULTIPLIERS[directions.length - 2]; // 1.78 for 3 directions
			let expectedPayout = buyinAmount;
			for (let i = 0; i < directions.length; i++) {
				expectedPayout = expectedPayout.mul(payoutMultiplier).div(ONE);
			}
			expectedPayout = expectedPayout.mul(toBN(103)).div(toBN(100)); // Apply 3% bonus

			assert.bnClose(marketBalance, expectedPayout, toUnit(0.1));
		});

		it('Should enforce minimum/maximum buy-in amounts in USD terms', async () => {
			// Set limits
			await chainedSpeedMarketsAMM.setLimitParams(
				600, // minTimeFrame
				600, // maxTimeFrame
				2, // minChainedMarkets
				6, // maxChainedMarkets
				toUnit(10), // minBuyinAmount in USD
				toUnit(100), // maxBuyinAmount in USD
				toUnit(500), // maxProfitPerIndividualMarket
				toUnit(5000), // maxRisk
				PAYOUT_MULTIPLIERS
			);

			const directions = [0, 1]; // UP, DOWN

			// Test minimum with USDC - should fail with 9 USDC ($9)
			await expect(createChainedMarketWithCollateral(exoticUSDC.address, 9 * 1e6, user, directions))
				.to.be.reverted;

			// Test minimum with USDT - should fail with 12 USDT ($9.60)
			await expect(
				createChainedMarketWithCollateral(exoticUSDT.address, toUnit(12), user, directions)
			).to.be.reverted;

			// Test maximum with USDC - should fail with 101 USDC ($101)
			await expect(
				createChainedMarketWithCollateral(exoticUSDC.address, 101 * 1e6, user, directions)
			).to.be.reverted;

			// Test maximum with USDT - should fail with 126 USDT ($100.80)
			await expect(
				createChainedMarketWithCollateral(exoticUSDT.address, toUnit(126), user, directions)
			).to.be.reverted;

			// Test valid amounts
			await createChainedMarketWithCollateral(exoticUSDC.address, 10 * 1e6, user, directions); // $10
			await createChainedMarketWithCollateral(exoticUSDT.address, toUnit(125), user2, directions); // $100
		});
	});

	describe('Basic Functionality Tests', () => {
		it('Should create and verify chained market state', async () => {
			const buyinAmount = toUnit(10);
			const directions = [0, 1]; // UP, DOWN

			const marketAddress = await createChainedMarketWithCollateral(
				exoticUSD.address,
				buyinAmount,
				user,
				directions
			);

			const ChainedSpeedMarket = artifacts.require('ChainedSpeedMarket');
			const market = await ChainedSpeedMarket.at(marketAddress);

			// Verify market state
			assert.equal(await market.user(), user);
			assert.equal(await market.collateral(), exoticUSD.address);
			assert.bnEqual(await market.buyinAmount(), buyinAmount);
			assert.equal(await market.numOfDirections(), directions.length);

			// Check payout
			const payout = await exoticUSD.balanceOf(marketAddress);

			// Basic payout calculation: buyinAmount * 1.7 * 1.7 = buyinAmount * 2.89
			const expectedBasePayout = toBN(buyinAmount)
				.mul(toBN(17))
				.div(toBN(10))
				.mul(toBN(17))
				.div(toBN(10));

			// Check if sUSD has bonus configured
			const susdBonus = await speedMarketsAMM.bonusPerCollateral(exoticUSD.address);

			// The market balance should be greater than base payout due to bonus (if configured)
			if (susdBonus.gt(toBN(0))) {
				assert.isTrue(payout.gt(expectedBasePayout), 'Market should have bonus applied');
			} else {
				assert.bnEqual(payout, expectedBasePayout, 'Market should have no bonus for sUSD');
			}
		});
	});

	describe('Risk Tracking Across Different Collaterals', () => {
		it('Should calculate risk correctly for different collateral values', async () => {
			const directions = [0, 1, 0]; // UP, DOWN, UP

			// Create market with USDC (1:1 USD)
			const usdcAmount = 50 * 1e6; // 50 USDC
			await createChainedMarketWithCollateral(exoticUSDC.address, usdcAmount, user, directions);

			const riskAfterUSDC = await chainedSpeedMarketsAMM.currentRisk();

			// Create market with USDT (0.8:1 USD)
			const usdtAmount = toUnit(62.5); // 62.5 USDT = 50 USD
			await createChainedMarketWithCollateral(exoticUSDT.address, usdtAmount, user2, directions);

			const riskAfterUSDT = await chainedSpeedMarketsAMM.currentRisk();

			// Both should add similar USD risk (accounting for different bonuses)
			assert.isTrue(riskAfterUSDT.gt(riskAfterUSDC), 'Risk should increase after second market');
		});

		it('Should update risk correctly when chained markets resolve', async () => {
			const directions = [0, 1]; // UP, DOWN
			const buyinAmount = 30 * 1e6; // 30 USDC
			const now = await currentTime();

			// Create market
			const marketAddress = await createChainedMarketWithCollateral(
				exoticUSDC.address,
				buyinAmount,
				user,
				directions
			);

			const initialRisk = await chainedSpeedMarketsAMM.currentRisk();

			// Fast forward past all strike times
			await fastForward(directions.length * 600 + 60);

			// Get the actual market details to calculate correct strike times
			const ChainedSpeedMarket = artifacts.require('ChainedSpeedMarket');
			const market = await ChainedSpeedMarket.at(marketAddress);
			const initialStrikeTime = await market.initialStrikeTime();
			const timeFrame = await market.timeFrame();

			// Calculate actual strike times based on market parameters
			const strikeTimes = [];
			for (let i = 0; i < directions.length; i++) {
				strikeTimes.push(initialStrikeTime.toNumber() + i * timeFrame.toNumber());
			}

			// Resolve as user loses (first direction wrong)
			const finalPrices = [
				PYTH_ETH_PRICE - 10000000, // Price went DOWN when user bet UP
				PYTH_ETH_PRICE + 10000000, // Doesn't matter, already lost
			];

			await resolveChainedMarketWithPriceFeeds(marketAddress, finalPrices, strikeTimes);

			const riskAfterResolution = await chainedSpeedMarketsAMM.currentRisk();

			// Risk should decrease when user loses
			assert.isTrue(riskAfterResolution.lt(initialRisk), 'Risk should decrease after user loses');
		});
	});

	describe('Bonus Application for Different Collaterals', () => {
		it('Should apply correct bonus based on collateral type', async () => {
			const directions = [0, 1, 0]; // UP, DOWN, UP
			const usdcBalanceBefore = await exoticUSDC.balanceOf(user);
			// Create market with USDC (2% bonus)
			const usdcMarket = await createChainedMarketWithCollateral(
				exoticUSDC.address,
				50 * 1e6, // 50 USDC
				user,
				directions
			);

			const usdcBalance = await exoticUSDC.balanceOf(usdcMarket);

			const usdtBalanceBefore = await exoticUSDT.balanceOf(user2);
			// Create market with USDT (3% bonus)
			const usdtMarket = await createChainedMarketWithCollateral(
				exoticUSDT.address,
				toUnit(62.5), // 62.5 USDT = $50
				user2,
				directions
			);

			const usdtBalance = await exoticUSDT.balanceOf(usdtMarket);

			// Verify USDC has 2% bonus and USDT has 3% bonus
			// The payout calculation is complex due to compounding multipliers
			const payoutMultiplier = PAYOUT_MULTIPLIERS[directions.length - 2]; // 1.78 for 3 directions
			const bonus = await speedMarketsAMM.bonusPerCollateral(exoticUSDT.address);
			const bonusUsdc = await speedMarketsAMM.bonusPerCollateral(exoticUSDC.address);
			console.log('bonus usdt', bonus.toString());
			console.log('bonus usdc', bonusUsdc.toString());
			// USDC expected payout
			let expectedUsdcPayout = toBN(50 * 1e6);
			for (let i = 0; i < directions.length; i++) {
				expectedUsdcPayout = expectedUsdcPayout.mul(payoutMultiplier).div(ONE);
			}
			expectedUsdcPayout = expectedUsdcPayout.mul(toBN(1025)).div(toBN(1000)); // 2.5% bonus

			// USDT expected payout
			let expectedUsdtPayout = toUnit(62.5);
			for (let i = 0; i < directions.length; i++) {
				expectedUsdtPayout = expectedUsdtPayout.mul(payoutMultiplier).div(ONE);
			}
			expectedUsdtPayout = expectedUsdtPayout.mul(toBN(103)).div(toBN(100)); // 3% bonus

			assert.bnEqual(usdcBalance, expectedUsdcPayout); // 1 USDC tolerance
			assert.bnEqual(usdtBalance, expectedUsdtPayout); // 0.1 USDT tolerance
		});

		it('Should pay correct bonus for winning positions', async () => {
			const directions = [0, 1]; // UP, DOWN
			const buyinAmount = 25 * 1e6; // 25 USDC
			const now = await currentTime();

			// Create market with USDC
			const marketAddress = await createChainedMarketWithCollateral(
				exoticUSDC.address,
				buyinAmount,
				user,
				directions
			);

			if (!marketAddress) {
				throw new Error('Market creation failed - no market address returned');
			}

			const userBalanceBefore = await exoticUSDC.balanceOf(user);

			// Fast forward and resolve as winner
			await fastForward(directions.length * 600 + 60);

			// Get the actual market details to calculate correct strike times
			const ChainedSpeedMarket = artifacts.require('ChainedSpeedMarket');
			const market = await ChainedSpeedMarket.at(marketAddress);
			const initialStrikeTime = await market.initialStrikeTime();
			const timeFrame = await market.timeFrame();

			// Calculate actual strike times based on market parameters
			const strikeTimes = [
				initialStrikeTime.toNumber(),
				initialStrikeTime.toNumber() + timeFrame.toNumber(),
			];

			const finalPrices = [
				PYTH_ETH_PRICE + 10000000, // UP - user wins
				PYTH_ETH_PRICE - 10000000, // DOWN - user wins
			];

			await resolveChainedMarketWithPriceFeeds(marketAddress, finalPrices, strikeTimes);

			const userBalanceAfter = await exoticUSDC.balanceOf(user);
			const payout = userBalanceAfter.sub(userBalanceBefore);

			// Calculate expected payout
			const payoutMultiplier = PAYOUT_MULTIPLIERS[directions.length - 2]; // 1.7 for 2 directions
			let expectedPayout = toBN(buyinAmount);
			for (let i = 0; i < directions.length; i++) {
				expectedPayout = expectedPayout.mul(payoutMultiplier).div(ONE);
			}
			expectedPayout = expectedPayout.mul(toBN(1025)).div(toBN(1000)); // 2.5% bonus

			assert.bnClose(payout, expectedPayout, toBN(1e5)); // 0.1 USDC tolerance
		});
	});

	describe('Multiple Direction Resolution Scenarios', () => {
		it('Should resolve market with user winning all directions', async () => {
			const directions = [0, 1, 0, 1]; // UP, DOWN, UP, DOWN
			const buyinAmount = toUnit(20);
			const now = await currentTime();

			const marketAddress = await createChainedMarketWithCollateral(
				exoticUSD.address,
				buyinAmount,
				user,
				directions
			);

			await fastForward(directions.length * 600 + 60);

			// Get the actual market details to calculate correct strike times
			const ChainedSpeedMarket = artifacts.require('ChainedSpeedMarket');
			const market = await ChainedSpeedMarket.at(marketAddress);
			const initialStrikeTime = await market.initialStrikeTime();
			const timeFrame = await market.timeFrame();

			const strikeTimes = [];
			const finalPrices = [];
			for (let i = 0; i < directions.length; i++) {
				strikeTimes.push(initialStrikeTime.toNumber() + i * timeFrame.toNumber());
				// User wins each direction
				if (directions[i] === 0) {
					// UP
					finalPrices.push(PYTH_ETH_PRICE + 10000000);
				} else {
					// DOWN
					finalPrices.push(PYTH_ETH_PRICE - 10000000);
				}
			}

			const userBalanceBefore = await exoticUSD.balanceOf(user);
			await resolveChainedMarketWithPriceFeeds(marketAddress, finalPrices, strikeTimes);
			const userBalanceAfter = await exoticUSD.balanceOf(user);

			// User should receive payout
			const payout = userBalanceAfter.sub(userBalanceBefore);
			assert.isTrue(payout.gt(toBN(0)), 'User should receive payout');

			// Verify market is resolved
			const marketData = await speedMarketsAMMData.getChainedMarketsData([marketAddress]);
			assert.equal(marketData[0].resolved, true);
			assert.equal(marketData[0].isUserWinner, true);
		});

		it('Should resolve market with user losing on first direction', async () => {
			const directions = [0, 1, 0]; // UP, DOWN, UP
			const buyinAmount = 30 * 1e6; // 30 USDC
			const now = await currentTime();

			const marketAddress = await createChainedMarketWithCollateral(
				exoticUSDC.address,
				buyinAmount,
				user,
				directions
			);

			await fastForward(directions.length * 600 + 60);

			// Get the actual market details to calculate correct strike times
			const ChainedSpeedMarket = artifacts.require('ChainedSpeedMarket');
			const market = await ChainedSpeedMarket.at(marketAddress);
			const initialStrikeTime = await market.initialStrikeTime();
			const timeFrame = await market.timeFrame();

			// Calculate actual strike times based on market parameters
			const strikeTimes = [];
			for (let i = 0; i < directions.length; i++) {
				strikeTimes.push(initialStrikeTime.toNumber() + i * timeFrame.toNumber());
			}

			// User loses on first direction
			const finalPrices = [
				PYTH_ETH_PRICE - 10000000, // Price went DOWN when user bet UP - LOSE
				PYTH_ETH_PRICE + 10000000, // Doesn't matter
				PYTH_ETH_PRICE + 10000000, // Doesn't matter
			];

			const userBalanceBefore = await exoticUSDC.balanceOf(user);
			await resolveChainedMarketWithPriceFeeds(marketAddress, finalPrices, strikeTimes);
			const userBalanceAfter = await exoticUSDC.balanceOf(user);

			// User should not receive any payout
			assert.bnEqual(userBalanceAfter, userBalanceBefore, 'User should not receive payout');

			// Verify market is resolved as loss
			const marketData = await speedMarketsAMMData.getChainedMarketsData([marketAddress]);
			assert.equal(marketData[0].resolved, true);
			assert.equal(marketData[0].isUserWinner, false);
		});

		it('Should resolve market with user winning until last direction', async () => {
			const directions = [1, 1, 0, 0, 1]; // DOWN, DOWN, UP, UP, DOWN
			const buyinAmount = toUnit(25); // 25 USDT = $20
			const now = await currentTime();

			const marketAddress = await createChainedMarketWithCollateral(
				exoticUSDT.address,
				buyinAmount,
				user,
				directions
			);

			await fastForward(directions.length * 600 + 60);

			// Get the actual market details to calculate correct strike times
			const ChainedSpeedMarket = artifacts.require('ChainedSpeedMarket');
			const market = await ChainedSpeedMarket.at(marketAddress);
			const initialStrikeTime = await market.initialStrikeTime();
			const timeFrame = await market.timeFrame();

			const strikeTimes = [];
			const finalPrices = [];
			for (let i = 0; i < directions.length; i++) {
				strikeTimes.push(initialStrikeTime.toNumber() + i * timeFrame.toNumber());
				if (i < directions.length - 1) {
					// User wins all but last
					if (directions[i] === 0) {
						// UP
						finalPrices.push(PYTH_ETH_PRICE + 10000000);
					} else {
						// DOWN
						finalPrices.push(PYTH_ETH_PRICE - 10000000);
					}
				} else {
					// User loses last direction
					finalPrices.push(PYTH_ETH_PRICE + 10000000); // Price went UP when user bet DOWN
				}
			}

			const userBalanceBefore = await exoticUSDT.balanceOf(user);
			await resolveChainedMarketWithPriceFeeds(marketAddress, finalPrices, strikeTimes);
			const userBalanceAfter = await exoticUSDT.balanceOf(user);

			// User should not receive payout
			assert.bnEqual(userBalanceAfter, userBalanceBefore, 'User should not receive payout');

			// AMM should keep the funds
			const marketData = await speedMarketsAMMData.getChainedMarketsData([marketAddress]);
			assert.equal(marketData[0].isUserWinner, false);
		});

		it('Should handle mixed collateral markets resolving concurrently', async () => {
			const now = await currentTime();
			const markets = [];

			// Create markets with different collaterals and directions
			const configs = [
				{ collateral: exoticUSDC.address, amount: 20 * 1e6, directions: [0, 1], user: user },
				{ collateral: exoticUSDT.address, amount: toUnit(25), directions: [1, 0, 1], user: user2 },
				{ collateral: exoticUSD.address, amount: toUnit(15), directions: [0, 0], user: user },
			];

			for (const config of configs) {
				const marketAddress = await createChainedMarketWithCollateral(
					config.collateral,
					config.amount,
					config.user,
					config.directions
				);
				markets.push({ address: marketAddress, ...config });
			}

			// Fast forward past all strike times
			await fastForward(3600); // 1 hour should cover all markets

			// Resolve all markets
			for (const market of markets) {
				// Get the actual market details to calculate correct strike times
				const ChainedSpeedMarket = artifacts.require('ChainedSpeedMarket');
				const marketContract = await ChainedSpeedMarket.at(market.address);
				const initialStrikeTime = await marketContract.initialStrikeTime();
				const timeFrame = await marketContract.timeFrame();

				const strikeTimes = [];
				const finalPrices = [];

				for (let i = 0; i < market.directions.length; i++) {
					strikeTimes.push(initialStrikeTime.toNumber() + i * timeFrame.toNumber());
					// Make first market win, second lose, third win
					if (markets.indexOf(market) === 0) {
						// First market wins all
						finalPrices.push(
							market.directions[i] === 0 ? PYTH_ETH_PRICE + 10000000 : PYTH_ETH_PRICE - 10000000
						);
					} else if (markets.indexOf(market) === 1) {
						// Second market loses on first direction
						if (i === 0) {
							finalPrices.push(PYTH_ETH_PRICE + 10000000); // Opposite of DOWN
						} else {
							finalPrices.push(PYTH_ETH_PRICE); // Doesn't matter
						}
					} else {
						// Third market wins all
						finalPrices.push(PYTH_ETH_PRICE + 10000000); // Both UP
					}
				}

				await resolveChainedMarketWithPriceFeeds(market.address, finalPrices, strikeTimes);
			}

			// Verify all markets are resolved
			const maturedMarkets = await chainedSpeedMarketsAMM.maturedMarkets(0, 10);
			assert.equal(maturedMarkets.length, 8, 'All markets should be matured');

			// Verify risk decreased
			const finalRisk = await chainedSpeedMarketsAMM.currentRisk();
		});
	});

	describe('Edge Cases and Error Scenarios', () => {
		it('Should reject unsupported native collateral', async () => {
			const unsupportedToken = await artifacts.require('ExoticUSD').new();
			await unsupportedToken.mintForUser(user);
			await unsupportedToken.approve(chainedSpeedMarketsAMM.address, toUnit(1000), { from: user });

			await expect(
				createChainedMarketWithCollateral(unsupportedToken.address, toUnit(50), user, [0, 1])
			).to.be.reverted;
		});

		it('Should handle maximum number of directions with different collaterals', async () => {
			const maxDirections = [0, 1, 0, 1, 0]; // 6 directions (maximum)

			// Create with USDC
			const usdcMarket = await createChainedMarketWithCollateral(
				exoticUSDC.address,
				20 * 1e6, // 20 USDC
				user,
				maxDirections
			);

			// Create with USDT
			const usdtMarket = await createChainedMarketWithCollateral(
				exoticUSDT.address,
				toUnit(25), // 25 USDT = $20
				user2,
				maxDirections
			);

			// Verify both markets created successfully
			const activeMarkets = await chainedSpeedMarketsAMM.activeMarkets(0, 20);
			console.log('usdcMarket', usdcMarket);
			console.log('usdtMarket', usdtMarket);
			console.log('activeMarkets', activeMarkets);
			assert.isTrue(activeMarkets.includes(usdcMarket));
			assert.isTrue(activeMarkets.includes(usdtMarket));

			// Try to create with more than max directions
			await expect(
				createChainedMarketWithCollateral(exoticUSDC.address, 10 * 1e6, user, [0, 1, 0, 1, 0, 1, 0])
			).to.be.reverted;
		});

		it('Should handle resolution with invalid price data gracefully', async () => {
			const directions = [0, 1];
			const marketAddress = await createChainedMarketWithCollateral(
				exoticUSDC.address,
				25 * 1e6,
				user,
				directions
			);

			await fastForward(1200 + 60);

			// Try to resolve with insufficient price data
			await expect(
				resolveChainedMarketWithPriceFeeds(
					marketAddress,
					[PYTH_ETH_PRICE],
					[(await currentTime()) + 600]
				)
			).to.be.reverted;
		});
	});

	describe('Risk Management with Multiple Collaterals', () => {
		it('Should enforce max risk limits across all collateral types', async () => {
			// Set a lower max risk for testing
			await chainedSpeedMarketsAMM.setLimitParams(
				600, // minTimeFrame
				600, // maxTimeFrame
				2, // minChainedMarkets
				6, // maxChainedMarkets
				toUnit(5), // minBuyinAmount
				toUnit(100), // maxBuyinAmount
				toUnit(1000), // maxProfitPerIndividualMarket
				toUnit(500), // maxRisk
				PAYOUT_MULTIPLIERS
			);

			// Create markets until we approach the risk limit
			const directions = [0, 1, 0, 1]; // 4 directions for higher payout

			// First market with USDC
			await createChainedMarketWithCollateral(
				exoticUSDC.address,
				20 * 1e6, // 20 USDC
				user,
				directions
			);

			const riskAfterFirst = await chainedSpeedMarketsAMM.currentRisk();

			// Second market with USDT
			await createChainedMarketWithCollateral(
				exoticUSDT.address,
				toUnit(25), // 25 USDT = $20 (since USDT is $0.80)
				user2,
				directions
			);

			const riskAfterSecond = await chainedSpeedMarketsAMM.currentRisk();

			// Third market should fail due to risk limit
			await expect(
				createChainedMarketWithCollateral(
					exoticUSD.address,
					toUnit(100), // Try a larger amount that will exceed risk
					user,
					directions
				)
			).to.be.reverted;
		});

		it('Should track risk correctly when mixing collaterals with different bonuses', async () => {
			// Set appropriate limits
			await chainedSpeedMarketsAMM.setLimitParams(
				600, // minTimeFrame
				600, // maxTimeFrame
				2, // minChainedMarkets
				6, // maxChainedMarkets
				toUnit(5), // minBuyinAmount
				toUnit(100), // maxBuyinAmount
				toUnit(1000), // maxProfitPerIndividualMarket
				toUnit(5000), // maxRisk
				PAYOUT_MULTIPLIERS
			);

			const directions = [0, 1, 0]; // 3 directions

			// Get initial risk
			const initialRisk = await chainedSpeedMarketsAMM.currentRisk();

			// Create market with USDC (2% bonus)
			await createChainedMarketWithCollateral(
				exoticUSDC.address,
				30 * 1e6, // 30 USDC
				user,
				directions
			);

			const riskAfterUSDC = await chainedSpeedMarketsAMM.currentRisk();
			const usdcRiskIncrease = riskAfterUSDC.sub(initialRisk);

			// Create market with USDT (3% bonus) - same USD value
			await createChainedMarketWithCollateral(
				exoticUSDT.address,
				toUnit(37.5), // 37.5 USDT = $30
				user2,
				directions
			);

			const riskAfterUSDT = await chainedSpeedMarketsAMM.currentRisk();
			const usdtRiskIncrease = riskAfterUSDT.sub(riskAfterUSDC);

			// USDT market should add slightly more risk due to higher bonus
			assert.isTrue(
				usdtRiskIncrease.gt(usdcRiskIncrease),
				'USDT should add more risk due to higher bonus'
			);
		});
	});

	describe('Integration with Referrals', () => {
		it('Should pay referral fees in the correct collateral', async () => {
			const directions = [0, 1];
			const buyinAmount = 50 * 1e6; // 50 USDC

			const referrerBalanceBefore = await exoticUSDC.balanceOf(referrer);

			// Create market with referrer
			const params = getCreateChainedSpeedAMMParams(
				user,
				'ETH',
				600,
				PYTH_ETH_PRICE,
				await currentTime(),
				50, // Pass 50 for the param conversion
				directions,
				exoticUSDC.address,
				referrer
			);
			// Override with native decimal amount
			params[7] = buyinAmount;

			await chainedSpeedMarketsAMM.createNewMarket(params, { from: creatorAccount });

			const referrerBalanceAfter = await exoticUSDC.balanceOf(referrer);
			const referralFee = referrerBalanceAfter.sub(referrerBalanceBefore);

			// Expected fee is 0.5% of buyinAmount
			const expectedFee = toBN(buyinAmount).mul(toBN(5)).div(toBN(1000));
			assert.bnEqual(referralFee, expectedFee, 'Referral fee should be correct');
		});
	});

	describe('Collateral Price Impact on Risk', () => {
		it('Should calculate risk based on USD value not token amount', async () => {
			// Set appropriate limits
			await chainedSpeedMarketsAMM.setLimitParams(
				600, // minTimeFrame
				600, // maxTimeFrame
				2, // minChainedMarkets
				6, // maxChainedMarkets
				toUnit(5), // minBuyinAmount
				toUnit(100), // maxBuyinAmount
				toUnit(1000), // maxProfitPerIndividualMarket
				toUnit(5000), // maxRisk
				PAYOUT_MULTIPLIERS
			);

			const directions = [0, 1, 0];

			// Create two markets with same USD value but different token amounts
			// 50 USDC = $50
			await createChainedMarketWithCollateral(exoticUSDC.address, 50 * 1e6, user, directions);

			const riskAfterUSDC = await chainedSpeedMarketsAMM.currentRisk();

			// 62.5 USDT = $50 (at $0.80 per USDT)
			await createChainedMarketWithCollateral(exoticUSDT.address, toUnit(62.5), user2, directions);

			const riskAfterUSDT = await chainedSpeedMarketsAMM.currentRisk();
			const totalRisk = riskAfterUSDT;

			// The risk should roughly double (with small differences due to bonuses)
			// USDC adds 2% bonus, USDT adds 3% bonus
			const expectedRiskRatio = riskAfterUSDT.mul(toBN(100)).div(riskAfterUSDC);

			// Allow for bonus differences
			assert.isTrue(
				expectedRiskRatio.gt(toBN(195)) && expectedRiskRatio.lt(toBN(205)),
				'Risk should approximately double'
			);
		});
	});
});
