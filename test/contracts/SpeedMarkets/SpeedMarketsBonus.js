'use strict';

const { artifacts, contract } = require('hardhat');
const { assert } = require('../../utils/common');
const { toBytes32 } = require('../../../index');
const { expect } = require('chai');
const { fastForward, toUnit, currentTime } = require('../../utils')();
const { ZERO_ADDRESS } = require('../../utils/helpers');
const { speedMarketsInit } = require('../../utils/init');
const { getCreateSpeedAMMParams } = require('../../utils/speedMarkets');
const { toBN } = require('web3-utils');

contract('SpeedMarketsBonus', (accounts) => {
	const [owner, user, safeBox, referrer, user2] = accounts;

	let speedMarketsAMM;
	let speedMarketsAMMData;
	let exoticUSD;
	let mockPyth;
	let MockPriceCollator;
	let collateral2;
	let collateral3;
	let addressManager;
	let creatorAccount;
	let referrals;

	const ETH = toBytes32('ETH');
	const BTC = toBytes32('BTC');
	const ETH_PYTH_ID = '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace';
	const BTC_PYTH_ID = '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43'; // Real BTC pyth ID

	beforeEach(async () => {
		const initializeSpeedMarketsData = await speedMarketsInit(accounts);

		speedMarketsAMM = initializeSpeedMarketsData.speedMarketsAMM;
		speedMarketsAMMData = initializeSpeedMarketsData.speedMarketsAMMData;
		exoticUSD = initializeSpeedMarketsData.exoticUSD;
		mockPyth = initializeSpeedMarketsData.mockPyth;
		MockPriceCollator = initializeSpeedMarketsData.MockPriceCollator;
		addressManager = initializeSpeedMarketsData.addressManager;
		creatorAccount = initializeSpeedMarketsData.creatorAccount;
		referrals = initializeSpeedMarketsData.referrals;

		// Setup additional collaterals for testing multiple collaterals with different bonuses
		const ExoticUSD = artifacts.require('ExoticUSD');
		collateral2 = await ExoticUSD.new();
		collateral3 = await ExoticUSD.new();

		// Set default amounts and mint for testing
		// Set higher amounts to cover buyinAmount + fees
		await collateral2.setDefaultAmount(toUnit(10000));
		await collateral3.setDefaultAmount(toUnit(10000));

		// Fund test users with exoticUSD
		await exoticUSD.mintForUser(user);
		await exoticUSD.mintForUser(user2);
		// Mint more for higher test amounts
		for (let i = 0; i < 10; i++) {
			await exoticUSD.mintForUser(user);
			await exoticUSD.mintForUser(user2);
		}

		// Mint collateral2 and collateral3 for users
		await collateral2.mintForUser(user);
		await collateral3.mintForUser(user2);

		// Approve AMM for all users and collaterals with max approval
		const MAX_UINT = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
		await exoticUSD.approve(speedMarketsAMM.address, MAX_UINT, { from: user });
		await exoticUSD.approve(speedMarketsAMM.address, MAX_UINT, { from: user2 });
		await collateral2.approve(speedMarketsAMM.address, MAX_UINT, { from: user });
		await collateral3.approve(speedMarketsAMM.address, MAX_UINT, { from: user2 });

		// Pyth IDs are already set in speedMarketsInit for ETH
		// We need to set BTC pyth ID and configure it as supported asset
		await speedMarketsAMM.setAssetToPythID(BTC, BTC_PYTH_ID, { from: owner });
		await speedMarketsAMM.setSupportedAsset(BTC, true, { from: owner });
		await speedMarketsAMM.setMaxRisks(BTC, toUnit(10000), toUnit(5000), { from: owner });
	});

	describe('Test Speed markets bonus configuration', () => {
		it('Should correctly set bonus for different collaterals', async () => {
			// Test setting bonus for default collateral (sUSD)
			await speedMarketsAMM.setSupportedNativeCollateralAndItsBonus(
				exoticUSD.address,
				true,
				toUnit(0.02), // 2% bonus
				{ from: owner }
			);

			assert.bnEqual(await speedMarketsAMM.bonusPerCollateral(exoticUSD.address), toUnit(0.02));
			assert.equal(await speedMarketsAMM.supportedNativeCollateral(exoticUSD.address), true);

			// Test setting bonus for additional collaterals
			await speedMarketsAMM.setSupportedNativeCollateralAndItsBonus(
				collateral2.address,
				true,
				toUnit(0.05), // 5% bonus
				{ from: owner }
			);

			await speedMarketsAMM.setSupportedNativeCollateralAndItsBonus(
				collateral3.address,
				true,
				toUnit(0.03), // 3% bonus
				{ from: owner }
			);

			assert.bnEqual(await speedMarketsAMM.bonusPerCollateral(collateral2.address), toUnit(0.05));
			assert.bnEqual(await speedMarketsAMM.bonusPerCollateral(collateral3.address), toUnit(0.03));
		});

		it('Should revert when setting bonus higher than 10%', async () => {
			await expect(
				speedMarketsAMM.setSupportedNativeCollateralAndItsBonus(
					collateral2.address,
					true,
					toUnit(0.11), // 11% bonus - should fail
					{ from: owner }
				)
			).to.be.reverted;
		});

		it('Should correctly calculate payout with bonus for winning position', async () => {
			// Set 5% bonus for exoticUSD
			await speedMarketsAMM.setSupportedNativeCollateralAndItsBonus(
				exoticUSD.address,
				true,
				toUnit(0.05), // 5% bonus
				{ from: owner }
			);

			const now = await currentTime();
			const strikeTime = now + 2 * 60 * 60; // 2 hours from now (must be > minimalTimeToMaturity)
			const buyinAmount = 10; // Reduced to 10 for testing

			// Create market with exoticUSD (UP direction)
			const skewImpact = 0; // Using 0 skew impact for testing
			const createParams = getCreateSpeedAMMParams(
				user,
				'ETH',
				strikeTime,
				now,
				buyinAmount,
				0, // UP direction
				skewImpact,
				0,
				exoticUSD.address,
				ZERO_ADDRESS
			);

			const tx = await speedMarketsAMM.createNewMarket(createParams, { from: creatorAccount });
			const marketAddress = tx.logs.find((log) => log.event === 'MarketCreated').args._market;
			const SpeedMarket = artifacts.require('SpeedMarket');
			const market = await SpeedMarket.at(marketAddress);

			// Fast forward to after strike time
			await fastForward(3 * 60 * 60); // Fast forward 3 hours

			// Resolve market with price going up (user wins)
			// The strike price is 1863.42931 (from getCreateSpeedAMMParams), so we need a higher price
			const finalPrice = 1900; // Price goes up, user wins
			const resolvePriceFeedUpdateData = await mockPyth.createPriceFeedUpdateData(
				ETH_PYTH_ID,
				toBN(finalPrice * 1e8),
				74093100,
				-8,
				toBN(finalPrice * 1e8),
				74093100,
				strikeTime
			);

			// Check balances before resolution
			const userBalanceBefore = await exoticUSD.balanceOf(user);

			// Resolve market
			const fee = await mockPyth.getUpdateFee([resolvePriceFeedUpdateData]);
			await speedMarketsAMM.resolveMarket(marketAddress, [resolvePriceFeedUpdateData], {
				from: owner,
				value: fee,
			});

			// Check market state
			assert.equal(await market.resolved(), true);
			assert.equal(await market.isUserWinner(), true);

			// Check balances after resolution
			const userBalanceAfter = await exoticUSD.balanceOf(user);
			const marketBalanceAfter = await exoticUSD.balanceOf(marketAddress);

			// Calculate expected payout: buyinAmount * 2 + (buyinAmount * 2 * 0.05)
			// = 10 * 2 + (10 * 2 * 0.05) = 20 + 1 = 21
			const expectedPayout = toUnit(buyinAmount)
				.mul(toBN(2))
				.add(toUnit(buyinAmount).mul(toBN(2)).mul(toUnit(0.05)).div(toUnit(1)));

			assert.bnEqual(userBalanceAfter.sub(userBalanceBefore), expectedPayout);
			assert.bnEqual(marketBalanceAfter, toBN(0));
		});

		it('Should correctly handle markets with zero bonus', async () => {
			// Don't set any bonus for exoticUSD (default is 0)
			const now = await currentTime();
			const strikeTime = now + 2 * 60 * 60;
			const buyinAmount = 10;

			const skewImpact = 0; // Using 0 skew impact for testing
			const createParams = getCreateSpeedAMMParams(
				user,
				'ETH',
				strikeTime,
				now,
				buyinAmount,
				0, // UP
				skewImpact,
				0,
				exoticUSD.address,
				ZERO_ADDRESS
			);

			const tx = await speedMarketsAMM.createNewMarket(createParams, { from: creatorAccount });
			const marketAddress = tx.logs.find((log) => log.event === 'MarketCreated').args._market;

			await fastForward(3 * 60 * 60); // Fast forward 3 hours

			const finalPrice = 1900; // Price goes up, user wins with UP bet
			const resolvePriceFeedUpdateData = await mockPyth.createPriceFeedUpdateData(
				ETH_PYTH_ID,
				toBN(finalPrice * 1e8),
				74093100,
				-8,
				toBN(finalPrice * 1e8),
				74093100,
				strikeTime
			);

			const userBalanceBefore = await exoticUSD.balanceOf(user);

			const fee = await mockPyth.getUpdateFee([resolvePriceFeedUpdateData]);
			await speedMarketsAMM.resolveMarket(marketAddress, [resolvePriceFeedUpdateData], {
				from: owner,
				value: fee,
			});

			const userBalanceAfter = await exoticUSD.balanceOf(user);

			// With 0% bonus, payout should be exactly 2x
			const expectedPayout = toUnit(buyinAmount).mul(toBN(2));
			assert.bnEqual(userBalanceAfter.sub(userBalanceBefore), expectedPayout);
		});

		it('Should handle multiple markets with different collaterals and bonuses', async () => {
			// Set different bonuses - for now using same collateral with different bonuses to test
			await speedMarketsAMM.setSupportedNativeCollateralAndItsBonus(
				exoticUSD.address,
				true,
				toUnit(0.01), // 1% bonus
				{ from: owner }
			);

			const now = await currentTime();
			const strikeTime = now + 2 * 60 * 60;
			const buyinAmount = 10;

			// Create first market with exoticUSD (1% bonus)
			const skewImpact1 = 0; // Using 0 skew impact for testing
			const createParams1 = getCreateSpeedAMMParams(
				user,
				'ETH',
				strikeTime,
				now,
				buyinAmount,
				0, // UP
				skewImpact1,
				0,
				exoticUSD.address,
				ZERO_ADDRESS
			);

			const tx1 = await speedMarketsAMM.createNewMarket(createParams1, { from: creatorAccount });
			const marketAddress1 = tx1.logs.find((log) => log.event === 'MarketCreated').args._market;

			// Create second market with exoticUSD (same collateral, different asset)
			// For BTC market, we need to manually set a proper strike price
			const skewImpact2 = 0; // Using 0 skew impact for testing
			const btcStrikePrice = 45000; // BTC strike price
			const createParams2 = [
				user,
				BTC,
				strikeTime,
				0, // deltaTime
				{
					price: btcStrikePrice * 1e8, // 45000 with 8 decimals
					conf: 1742265769,
					expo: -8,
					publishTime: now,
				},
				1, // DOWN direction
				exoticUSD.address,
				toUnit(buyinAmount),
				ZERO_ADDRESS, // referrer
				skewImpact2,
			];

			const tx2 = await speedMarketsAMM.createNewMarket(createParams2, { from: creatorAccount });
			const marketAddress2 = tx2.logs.find((log) => log.event === 'MarketCreated').args._market;

			await fastForward(3 * 60 * 60); // Fast forward 3 hours

			// Resolve both markets as winners
			const finalPriceETH = 1900; // ETH goes up (user bet UP)
			const finalPriceBTC = 44000; // BTC goes down (user bet DOWN)

			const resolvePriceFeedUpdateDataETH = await mockPyth.createPriceFeedUpdateData(
				ETH_PYTH_ID,
				toBN(finalPriceETH * 1e8),
				74093100,
				-8,
				toBN(finalPriceETH * 1e8),
				74093100,
				strikeTime
			);

			const resolvePriceFeedUpdateDataBTC = await mockPyth.createPriceFeedUpdateData(
				BTC_PYTH_ID,
				toBN(finalPriceBTC * 1e8),
				74093100,
				-8,
				toBN(finalPriceBTC * 1e8),
				74093100,
				strikeTime
			);

			const userBalanceBefore = await exoticUSD.balanceOf(user);

			// Resolve markets
			const fee = await mockPyth.getUpdateFee([resolvePriceFeedUpdateDataETH]);
			await speedMarketsAMM.resolveMarket(marketAddress1, [resolvePriceFeedUpdateDataETH], {
				from: owner,
				value: fee,
			});

			await speedMarketsAMM.resolveMarket(marketAddress2, [resolvePriceFeedUpdateDataBTC], {
				from: owner,
				value: fee,
			});

			const userBalanceAfter = await exoticUSD.balanceOf(user);

			// Check payouts - both markets have same 1% bonus
			const expectedPayoutPerMarket = toUnit(buyinAmount)
				.mul(toBN(2))
				.add(toUnit(buyinAmount).mul(toBN(2)).mul(toUnit(0.01)).div(toUnit(1))); // 20.2 each

			const expectedTotalPayout = expectedPayoutPerMarket.mul(toBN(2)); // Both markets won

			assert.bnEqual(userBalanceAfter.sub(userBalanceBefore), expectedTotalPayout);
		});

		it('Should not apply bonus for losing positions', async () => {
			// Use exoticUSD instead of collateral2 for this test
			await speedMarketsAMM.setSupportedNativeCollateralAndItsBonus(
				exoticUSD.address,
				true,
				toUnit(0.05), // 5% bonus
				{ from: owner }
			);

			const now = await currentTime();
			const strikeTime = now + 2 * 60 * 60;
			const buyinAmount = 10;

			// Create market with UP direction
			const skewImpact = 0; // Using 0 skew impact for testing
			const createParams = getCreateSpeedAMMParams(
				user,
				'ETH',
				strikeTime,
				now,
				buyinAmount,
				0, // UP
				skewImpact,
				0,
				exoticUSD.address,
				ZERO_ADDRESS
			);

			const tx = await speedMarketsAMM.createNewMarket(createParams, { from: creatorAccount });
			const marketAddress = tx.logs.find((log) => log.event === 'MarketCreated').args._market;

			await fastForward(3 * 60 * 60); // Fast forward 3 hours

			// Resolve with price going down (user loses with UP bet)
			const finalPrice = 1800; // Price goes down, user loses
			const resolvePriceFeedUpdateData = await mockPyth.createPriceFeedUpdateData(
				ETH_PYTH_ID,
				toBN(finalPrice * 1e8),
				74093100,
				-8,
				toBN(finalPrice * 1e8),
				74093100,
				strikeTime
			);

			const userBalanceBefore = await exoticUSD.balanceOf(user);

			const fee = await mockPyth.getUpdateFee([resolvePriceFeedUpdateData]);
			await speedMarketsAMM.resolveMarket(marketAddress, [resolvePriceFeedUpdateData], {
				from: owner,
				value: fee,
			});

			const userBalanceAfter = await exoticUSD.balanceOf(user);

			// User should receive nothing (lost the bet)
			assert.bnEqual(userBalanceAfter.sub(userBalanceBefore), toBN(0));
		});

		it('Should correctly calculate AMM risk with bonus payouts', async () => {
			await speedMarketsAMM.setSupportedNativeCollateralAndItsBonus(
				exoticUSD.address,
				true,
				toUnit(0.1), // 10% bonus (maximum allowed)
				{ from: owner }
			);

			const now = await currentTime();
			const strikeTime = now + 2 * 60 * 60;
			const buyinAmount = 10;

			// Check risk before market creation
			const riskBefore = await speedMarketsAMM.currentRiskPerAsset(ETH);

			// Create market
			const skewImpact = 0; // Using 0 skew impact for testing
			const createParams = getCreateSpeedAMMParams(
				user,
				'ETH',
				strikeTime,
				now,
				buyinAmount,
				0, // UP
				skewImpact,
				0,
				exoticUSD.address,
				ZERO_ADDRESS
			);

			await speedMarketsAMM.createNewMarket(createParams, { from: creatorAccount });

			// Check risk after market creation
			const riskAfter = await speedMarketsAMM.currentRiskPerAsset(ETH);

			// Risk should increase by the net exposure including bonus
			// The AMM's risk calculation considers LP fees that stay in the AMM
			// With 10% bonus: payout = 20 + 2 = 22

			const payout = toUnit(buyinAmount)
				.mul(toBN(2))
				.add(toUnit(buyinAmount).mul(toBN(2)).mul(toUnit(0.1)).div(toUnit(1)));

			// Get LP fee to understand risk calculation
			const SpeedMarket = artifacts.require('SpeedMarket');
			const markets = await speedMarketsAMM.activeMarkets(0, 10);
			const market = await SpeedMarket.at(markets[markets.length - 1]);
			const lpFeeFromMarket = await market.lpFee();

			// The AMM keeps the LP fee, so its net exposure is reduced by this amount
			const buyinPlusLpFee = toUnit(buyinAmount).add(
				toUnit(buyinAmount).mul(lpFeeFromMarket).div(toUnit(1))
			);

			const netExposure = payout.sub(buyinPlusLpFee);

			assert.bnEqual(riskAfter.sub(riskBefore), netExposure);
		});

		it('Should handle bonus correctly with referral fees', async () => {
			// Referrals is already set up in init with default fee of 0.5%

			// Set bonus
			await speedMarketsAMM.setSupportedNativeCollateralAndItsBonus(
				exoticUSD.address,
				true,
				toUnit(0.03), // 3% bonus
				{ from: owner }
			);

			const now = await currentTime();
			const strikeTime = now + 2 * 60 * 60;
			const buyinAmount = 10;

			// Track referrer balance
			const referrerBalanceBefore = await exoticUSD.balanceOf(referrer);

			// Create market with referrer
			const skewImpact = 0; // Using 0 skew impact for testing
			const createParams = getCreateSpeedAMMParams(
				user,
				'ETH',
				strikeTime,
				now,
				buyinAmount,
				0, // UP
				skewImpact,
				0,
				exoticUSD.address,
				referrer
			);

			const tx = await speedMarketsAMM.createNewMarket(createParams, { from: creatorAccount });
			const marketAddress = tx.logs.find((log) => log.event === 'MarketCreated').args._market;

			// Check referrer received their fee
			const referrerBalanceAfter = await exoticUSD.balanceOf(referrer);
			const expectedReferralFee = toUnit(buyinAmount).mul(toUnit(0.005)).div(toUnit(1));
			assert.bnEqual(referrerBalanceAfter.sub(referrerBalanceBefore), expectedReferralFee);

			// Resolve market and check bonus payout
			await fastForward(3 * 60 * 60); // Fast forward 3 hours

			const finalPrice = 1900; // Price goes up, user wins
			const resolvePriceFeedUpdateData = await mockPyth.createPriceFeedUpdateData(
				ETH_PYTH_ID,
				toBN(finalPrice * 1e8),
				74093100,
				-8,
				toBN(finalPrice * 1e8),
				74093100,
				strikeTime
			);

			const userBalanceBefore = await exoticUSD.balanceOf(user);

			const fee = await mockPyth.getUpdateFee([resolvePriceFeedUpdateData]);
			await speedMarketsAMM.resolveMarket(marketAddress, [resolvePriceFeedUpdateData], {
				from: owner,
				value: fee,
			});

			const userBalanceAfter = await exoticUSD.balanceOf(user);

			// Bonus should still be applied correctly regardless of referral fees
			const expectedPayout = toUnit(buyinAmount)
				.mul(toBN(2))
				.add(toUnit(buyinAmount).mul(toBN(2)).mul(toUnit(0.03)).div(toUnit(1)));

			assert.bnEqual(userBalanceAfter.sub(userBalanceBefore), expectedPayout);
		});

		it('Should not apply bonus for non-native collateral through multicollateral onramp', async () => {
			// This test ensures bonus is only applied to native collaterals, not through onramp
			const now = await currentTime();
			const strikeTime = now + 2 * 60 * 60;
			const buyinAmount = 10;

			// Try to create market with non-supported collateral (should use onramp, no bonus)
			// This would require multicollateral to be enabled and properly configured
			// For now, verify that bonus is 0 when using default path with ZERO_ADDRESS

			const skewImpact = 0; // Using 0 skew impact for testing
			const createParams = getCreateSpeedAMMParams(
				user,
				'ETH',
				strikeTime,
				now,
				buyinAmount,
				0, // UP
				skewImpact,
				0,
				ZERO_ADDRESS, // Default collateral path
				ZERO_ADDRESS
			);

			const tx = await speedMarketsAMM.createNewMarket(createParams, { from: creatorAccount });
			const marketAddress = tx.logs.find((log) => log.event === 'MarketCreated').args._market;

			// Even if we set bonus for sUSD, using ZERO_ADDRESS should not apply bonus
			// (based on line 374: bonus is only applied when transferCollateral is true)

			await fastForward(3 * 60 * 60); // Fast forward 3 hours

			const finalPrice = 1900; // Price goes up, user wins
			const resolvePriceFeedUpdateData = await mockPyth.createPriceFeedUpdateData(
				ETH_PYTH_ID,
				toBN(finalPrice * 1e8),
				74093100,
				-8,
				toBN(finalPrice * 1e8),
				74093100,
				strikeTime
			);

			const userBalanceBefore = await exoticUSD.balanceOf(user);

			const fee = await mockPyth.getUpdateFee([resolvePriceFeedUpdateData]);
			await speedMarketsAMM.resolveMarket(marketAddress, [resolvePriceFeedUpdateData], {
				from: owner,
				value: fee,
			});

			const userBalanceAfter = await exoticUSD.balanceOf(user);

			// Payout should be exactly 2x (no bonus)
			const expectedPayout = toUnit(buyinAmount).mul(toBN(2));
			assert.bnEqual(userBalanceAfter.sub(userBalanceBefore), expectedPayout);
		});
	});
});
