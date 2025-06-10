'use strict';

const { artifacts, contract } = require('hardhat');
const { assert } = require('../../utils/common');
const { toBytes32 } = require('../../../index');
const { expect } = require('chai');
const { fastForward, toUnit, currentTime } = require('../../utils')();
const { ZERO_ADDRESS } = require('../../utils/helpers');
const { speedMarketsInit } = require('../../utils/init');
const { getCreateSpeedAMMParams } = require('../../utils/speedMarkets');

contract('SpeedMarketsBonusIntegration', (accounts) => {
	const [owner, user, safeBox, proxyUser] = accounts;

	describe('Test Speed markets bonus integration', () => {
		it('should apply bonus correctly for non-default collateral', async () => {
			let {
				creatorAccount,
				speedMarketsAMM,
				speedMarketsAMMData,
				addressManager,
				fee,
				mockPyth,
				MockPriceFeedDeployed,
				exoticUSD,
				initialSkewImapct,
				now,
			} = await speedMarketsInit(accounts);

			// Setup multi-collateral
			let MultiCollateralOnOffRamp = artifacts.require('MultiCollateralOnOffRamp');
			let multiCollateralOnOffRamp = await MultiCollateralOnOffRamp.new();
			await multiCollateralOnOffRamp.initialize(owner, exoticUSD.address);

			// Create alternative collateral token (e.g., OVER token)
			let ExoticOP = artifacts.require('ExoticUSD');
			let exoticOP = await ExoticOP.new();
			await exoticOP.setDefaultAmount(toUnit(10000));

			// Setup multi-collateral infrastructure
			await multiCollateralOnOffRamp.setPriceFeed(MockPriceFeedDeployed.address);
			await multiCollateralOnOffRamp.setSupportedCollateral(exoticOP.address, true);
			await multiCollateralOnOffRamp.setSupportedAMM(speedMarketsAMM.address, true);

			await addressManager.setAddresses(
				safeBox,
				ZERO_ADDRESS,
				ZERO_ADDRESS,
				multiCollateralOnOffRamp.address,
				mockPyth.address,
				speedMarketsAMM.address
			);
			await speedMarketsAMM.setMultiCollateralOnOffRampEnabled(true);

			// Setup swap router for conversion
			let SwapRouterMock = artifacts.require('SwapRouterMock');
			let swapRouterMock = await SwapRouterMock.new();
			await multiCollateralOnOffRamp.setSwapRouter(swapRouterMock.address);
			await swapRouterMock.setDefaults(exoticOP.address, exoticUSD.address);

			// Fund swap router with sUSD
			await exoticUSD.setDefaultAmount(toUnit(10000));
			await exoticUSD.mintForUser(proxyUser);
			await exoticUSD.transfer(swapRouterMock.address, toUnit(1000), { from: proxyUser });

			// Fund AMM with extra sUSD to cover bonus payouts
			await exoticUSD.mintForUser(owner);
			await exoticUSD.transfer(speedMarketsAMM.address, toUnit(500), { from: owner });

			// Set exchange rate 1:1
			await MockPriceFeedDeployed.setPricetoReturn(toUnit(1));

			// Configure curve for conversions
			await multiCollateralOnOffRamp.setCurveSUSD(
				exoticUSD.address,
				exoticUSD.address,
				exoticUSD.address,
				exoticUSD.address,
				true,
				toUnit('0.01')
			);

			// BONUS CONFIGURATION: Set 5% bonus for OVER token
			await speedMarketsAMM.setCollateralBonus(exoticOP.address, toUnit(0.05));

			// Verify bonus was set
			let bonusPercentage = await speedMarketsAMM.bonusPerCollateral(exoticOP.address);
			assert.equal(bonusPercentage.toString(), toUnit(0.05).toString(), 'Bonus should be 5%');

			// Fund user with OVER tokens
			await exoticOP.mintForUser(user);
			let userBalance = await exoticOP.balanceOf(user);
			console.log('User OVER balance:', userBalance / 1e18);

			// Approve spending
			await exoticOP.approve(speedMarketsAMM.address, toUnit(100), { from: user });

			// Create market parameters
			const strikeTimeParam = now + 10 * 60 * 60; // 10 hours from now
			const buyinAmountParam = toUnit(10); // This is the collateral amount including fees

			// Check AMM sUSD balance before
			let ammBalanceBefore = await exoticUSD.balanceOf(speedMarketsAMM.address);
			console.log('AMM sUSD balance before:', ammBalanceBefore / 1e18);

			// Create market with OVER tokens
			const tx = await speedMarketsAMM.createNewMarket(
				getCreateSpeedAMMParams(
					user,
					'ETH',
					strikeTimeParam,
					now,
					buyinAmountParam / 1e18,
					0,
					initialSkewImapct,
					0,
					exoticOP.address, // Using OVER token as collateral
					ZERO_ADDRESS
				),
				{ from: creatorAccount }
			);

			// Get created market address from events
			let marketCreatedEvent = tx.logs.find((log) => log.event === 'MarketCreated');
			assert.exists(marketCreatedEvent, 'MarketCreated event should be emitted');

			let marketAddress = marketCreatedEvent.args._market;
			console.log('Created market:', marketAddress);

			// Load the market contract
			let SpeedMarket = artifacts.require('SpeedMarket');
			let speedMarket = await SpeedMarket.at(marketAddress);

			// Check market balance (should include bonus)
			let marketBalance = await exoticUSD.balanceOf(marketAddress);
			console.log('Market sUSD balance:', marketBalance / 1e18);

			// Calculate expected values
			let buyinAmount = await speedMarket.buyinAmount();
			console.log('Buyin amount:', buyinAmount / 1e18);

			// Expected payout: buyinAmount * 2 * (1 + 0.05) = buyinAmount * 2.1
			let expectedPayout = buyinAmount * 2 + buyinAmount * 2 * 0.05;
			console.log('Expected payout with 5% bonus:', expectedPayout / 1e18);

			// Verify the market received the correct payout with bonus (allowing for small rounding)
			let difference = Math.abs(marketBalance - expectedPayout);
			assert.isTrue(
				difference <= 5000, // Allow up to 5000 wei difference for rounding (0.000000000000005 ETH)
				`Market should receive payout with 5% bonus. Expected: ${expectedPayout}, Actual: ${marketBalance}, Diff: ${difference}`
			);

			// Test with default collateral (should have no bonus)
			await exoticUSD.mintForUser(user);
			await exoticUSD.approve(speedMarketsAMM.address, toUnit(100), { from: user });

			const tx2 = await speedMarketsAMM.createNewMarket(
				getCreateSpeedAMMParams(
					user,
					'ETH',
					strikeTimeParam + 3600, // Different strike time
					now,
					toUnit(10) / 1e18,
					0,
					initialSkewImapct,
					0,
					ZERO_ADDRESS, // Using default collateral (sUSD)
					ZERO_ADDRESS
				),
				{ from: creatorAccount }
			);

			let marketCreatedEvent2 = tx2.logs.find((log) => log.event === 'MarketCreated');
			let marketAddress2 = marketCreatedEvent2.args._market;
			let speedMarket2 = await SpeedMarket.at(marketAddress2);

			let marketBalance2 = await exoticUSD.balanceOf(marketAddress2);
			let buyinAmount2 = await speedMarket2.buyinAmount();

			// Expected payout without bonus: buyinAmount * 2
			let expectedPayoutNoBonus = buyinAmount2 * 2;
			console.log('Expected payout without bonus:', expectedPayoutNoBonus / 1e18);

			assert.equal(
				marketBalance2.toString(),
				expectedPayoutNoBonus.toString(),
				'Market with default collateral should receive standard 2x payout'
			);

			console.log('All bonus integration tests passed!');
		});

		it('should handle different bonus percentages correctly', async () => {
			let {
				creatorAccount,
				speedMarketsAMM,
				addressManager,
				mockPyth,
				MockPriceFeedDeployed,
				exoticUSD,
				initialSkewImapct,
				now,
			} = await speedMarketsInit(accounts);

			// Create multiple collateral tokens
			let ExoticToken1 = artifacts.require('ExoticUSD');
			let token1 = await ExoticToken1.new();

			let ExoticToken2 = artifacts.require('ExoticUSD');
			let token2 = await ExoticToken2.new();

			// Set different bonuses
			await speedMarketsAMM.setCollateralBonus(token1.address, toUnit(0.02)); // 2%
			await speedMarketsAMM.setCollateralBonus(token2.address, toUnit(0.1)); // 10% (max)

			// Verify bonuses
			let bonus1 = await speedMarketsAMM.bonusPerCollateral(token1.address);
			let bonus2 = await speedMarketsAMM.bonusPerCollateral(token2.address);

			assert.equal(bonus1.toString(), toUnit(0.02).toString(), 'Token1 should have 2% bonus');
			assert.equal(bonus2.toString(), toUnit(0.1).toString(), 'Token2 should have 10% bonus');

			// Test updating bonus
			await speedMarketsAMM.setCollateralBonus(token1.address, toUnit(0.03)); // Update to 3%
			let updatedBonus1 = await speedMarketsAMM.bonusPerCollateral(token1.address);
			assert.equal(
				updatedBonus1.toString(),
				toUnit(0.03).toString(),
				'Token1 bonus should be updated to 3%'
			);

			// Test removing bonus
			await speedMarketsAMM.setCollateralBonus(token1.address, 0); // Remove bonus
			let removedBonus1 = await speedMarketsAMM.bonusPerCollateral(token1.address);
			assert.equal(removedBonus1.toString(), '0', 'Token1 bonus should be removed');

			console.log('Bonus percentage tests passed!');
		});

		it('should emit CollateralBonusSet event correctly', async () => {
			let { speedMarketsAMM } = await speedMarketsInit(accounts);

			let TestToken = artifacts.require('ExoticUSD');
			let testToken = await TestToken.new();

			// Set bonus and check event
			const tx = await speedMarketsAMM.setCollateralBonus(testToken.address, toUnit(0.075)); // 7.5%

			const event = tx.logs.find((log) => log.event === 'CollateralBonusSet');
			assert.exists(event, 'CollateralBonusSet event should be emitted');
			assert.equal(
				event.args.collateral,
				testToken.address,
				'Event should have correct collateral'
			);
			assert.equal(
				event.args.bonus.toString(),
				toUnit(0.075).toString(),
				'Event should have correct bonus'
			);

			console.log('Event emission test passed!');
		});

		it('should enforce bonus limits and access control', async () => {
			let { speedMarketsAMM } = await speedMarketsInit(accounts);

			let TestToken = artifacts.require('ExoticUSD');
			let testToken = await TestToken.new();

			// Test maximum bonus limit
			await expect(
				speedMarketsAMM.setCollateralBonus(testToken.address, toUnit(0.11)) // 11%
			).to.be.revertedWith('Bonus too high');

			// Test only owner can set bonus
			await expect(
				speedMarketsAMM.setCollateralBonus(testToken.address, toUnit(0.05), { from: user })
			).to.be.revertedWith('Only the contract owner may perform this action');

			// Test edge cases
			await speedMarketsAMM.setCollateralBonus(testToken.address, toUnit(0.1)); // Exactly 10% should work
			let maxBonus = await speedMarketsAMM.bonusPerCollateral(testToken.address);
			assert.equal(maxBonus.toString(), toUnit(0.1).toString(), 'Should accept exactly 10% bonus');

			console.log('Limit and access control tests passed!');
		});
	});
});
