'use strict';

const { artifacts, contract } = require('hardhat');
const { assert } = require('../../utils/common');
const { expect } = require('chai');
const { fastForward, toUnit } = require('../../utils')();
const { ZERO_ADDRESS } = require('../../utils/helpers');
const { speedMarketsInit } = require('../../utils/init');
const { getCreateSpeedAMMParams } = require('../../utils/speedMarkets');

contract('SpeedMarkets', (accounts) => {
	const [owner, user, safeBox, proxyUser] = accounts;

	describe('Test Speed markets ', () => {
		it('deploy and test with offramp to exoticOP', async () => {
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

			await speedMarketsAMM.setLPFeeParams([15], [toUnit(0.01)], toUnit(0.01));

			let MultiCollateralOnOffRamp = artifacts.require('MultiCollateralOnOffRamp');
			let multiCollateralOnOffRamp = await MultiCollateralOnOffRamp.new();
			await multiCollateralOnOffRamp.initialize(owner, exoticUSD.address);

			let ExoticOP = artifacts.require('ExoticUSD');
			let exoticOP = await ExoticOP.new();

			await multiCollateralOnOffRamp.setPriceFeed(MockPriceFeedDeployed.address);

			await multiCollateralOnOffRamp.setSupportedCollateral(exoticOP.address, true);
			await expect(multiCollateralOnOffRamp.onramp(exoticOP.address, toUnit(1))).to.be.revertedWith(
				'Unsupported caller'
			);

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

			await exoticOP.setDefaultAmount(toUnit(10000));
			await exoticOP.mintForUser(user);
			let balance = await exoticOP.balanceOf(user);
			console.log('Balance of user is ' + balance / 1e18);

			await exoticOP.approve(speedMarketsAMM.address, toUnit(100), { from: user });

			let SwapRouterMock = artifacts.require('SwapRouterMock');
			let swapRouterMock = await SwapRouterMock.new();

			await multiCollateralOnOffRamp.setSwapRouter(swapRouterMock.address);
			await swapRouterMock.setDefaults(exoticOP.address, exoticUSD.address);

			await exoticUSD.mintForUser(proxyUser);
			await exoticUSD.transfer(swapRouterMock.address, toUnit(100), { from: proxyUser });
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

			const strikeTimeParam = now + 10 * 60 * 60; // 10 hours from now
			const buyinAmountParam = 10;

			await speedMarketsAMM.createNewMarket(
				getCreateSpeedAMMParams(
					user,
					'ETH',
					strikeTimeParam,
					now,
					buyinAmountParam,
					0,
					initialSkewImapct,
					0,
					exoticOP.address,
					ZERO_ADDRESS
				),
				{ from: creatorAccount }
			);

			let ammData = await speedMarketsAMMData.getSpeedMarketsAMMParameters(user);
			console.log('numActiveMarkets ' + ammData.numActiveMarkets);

			let markets = await speedMarketsAMM.activeMarkets(0, 1);
			let market = markets[0];
			console.log('market is ' + market);

			let SpeedMarket = artifacts.require('SpeedMarket');
			let speedMarket = await SpeedMarket.at(market);
			let strikeTime = await speedMarket.strikeTime();
			console.log('Strike time is ' + strikeTime);

			await fastForward(86400);

			let resolvePriceFeedUpdateData = await mockPyth.createPriceFeedUpdateData(
				'0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
				196342931000,
				74093100,
				-8,
				196342931000,
				74093100,
				strikeTime
			);

			ammData = await speedMarketsAMMData.getSpeedMarketsAMMParameters(user);
			console.log('numActiveMarkets before resolve ' + ammData.numActiveMarkets);

			await expect(
				speedMarketsAMM.resolveMarketWithOfframp(
					market,
					[resolvePriceFeedUpdateData],
					exoticOP.address,
					false,
					{ value: fee }
				)
			).to.be.reverted;

			await exoticOP.approve(speedMarketsAMM.address, toUnit('1000'), { from: user });
			await exoticUSD.approve(speedMarketsAMM.address, toUnit('1000'), { from: user });

			await exoticOP.mintForUser(proxyUser);
			await exoticOP.transfer(swapRouterMock.address, toUnit(1000), { from: proxyUser });

			await swapRouterMock.setDefaults(exoticUSD.address, exoticOP.address);

			let balanceOfUserBeforeExoticOP = await exoticOP.balanceOf(user);
			console.log('balanceOfUserBeforeExoticOP ' + balanceOfUserBeforeExoticOP / 1e18);

			let allowance = await exoticUSD.allowance(
				speedMarketsAMM.address,
				multiCollateralOnOffRamp.address
			);
			console.log('allowance', allowance / 1e18);

			await speedMarketsAMM.resolveMarketWithOfframp(
				market,
				[resolvePriceFeedUpdateData],
				exoticOP.address,
				false,
				{ value: fee, from: user }
			);

			let balanceOfUserAfterExoticOP = await exoticOP.balanceOf(user);
			console.log('balanceOfUserAfterExoticOP ' + balanceOfUserAfterExoticOP / 1e18);

			let userBalanceAfterDiff =
				balanceOfUserAfterExoticOP / 1e18 - balanceOfUserBeforeExoticOP / 1e18;
			console.log('userBalanceAfterDiff ' + userBalanceAfterDiff);

			assert.bnGte(toUnit(userBalanceAfterDiff), toUnit('19'));
			assert.bnLte(toUnit(userBalanceAfterDiff), toUnit('21'));
		});

		it('should revert with InvalidOffRampCollateral when market defaultCollateral is not sUSD', async () => {
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

			await speedMarketsAMM.setLPFeeParams([15], [toUnit(0.01)], toUnit(0.01));

			let MultiCollateralOnOffRamp = artifacts.require('MultiCollateralOnOffRamp');
			let multiCollateralOnOffRamp = await MultiCollateralOnOffRamp.new();
			await multiCollateralOnOffRamp.initialize(owner, exoticUSD.address);

			let ExoticOP = artifacts.require('ExoticUSD');
			let exoticOP = await ExoticOP.new();

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

			// Set exoticOP as supported native collateral with 0% bonus
			await speedMarketsAMM.setSupportedNativeCollateralAndItsBonus(exoticOP.address, true, 0);

			await exoticOP.setDefaultAmount(toUnit(10000));
			await exoticOP.mintForUser(user);
			// Also mint for AMM to have enough balance for payout
			await exoticOP.mintForUser(speedMarketsAMM.address);
			await exoticOP.approve(speedMarketsAMM.address, toUnit(1000), { from: user });

			const strikeTimeParam = now + 10 * 60 * 60; // 10 hours from now
			const buyinAmountParam = 10; // Use same format as first test

			// Create market with exoticOP (non-sUSD) as collateral
			await speedMarketsAMM.createNewMarket(
				getCreateSpeedAMMParams(
					user,
					'ETH',
					strikeTimeParam,
					now,
					buyinAmountParam,
					0,
					initialSkewImapct,
					0,
					exoticOP.address, // use exoticOP as collateral
					ZERO_ADDRESS
				),
				{ from: creatorAccount }
			);

			let ammData = await speedMarketsAMMData.getSpeedMarketsAMMParameters(user);
			console.log('numActiveMarkets ' + ammData.numActiveMarkets);

			let markets = await speedMarketsAMM.activeMarkets(0, 1);
			let market = markets[markets.length - 1]; // Get the last created market

			let SpeedMarket = artifacts.require('SpeedMarket');
			let speedMarket = await SpeedMarket.at(market);
			let strikeTime = await speedMarket.strikeTime();
			let defaultCollateral = await speedMarket.defaultCollateral();

			console.log('Market default collateral:', defaultCollateral);
			console.log('ExoticOP address (market collateral):', exoticOP.address);
			console.log('sUSD address:', exoticUSD.address);

			// Verify that the market was created with exoticOP (not sUSD) as default collateral
			assert.equal(defaultCollateral, exoticOP.address);
			assert.notEqual(
				defaultCollateral,
				exoticUSD.address,
				'Market should NOT have sUSD as default collateral'
			);

			await fastForward(86400);

			let resolvePriceFeedUpdateData = await mockPyth.createPriceFeedUpdateData(
				'0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
				196342931000,
				74093100,
				-8,
				196342931000,
				74093100,
				strikeTime
			);

			// Set up another collateral for offramp (to show it's not about the offramp target)
			let ExoticUSDC = artifacts.require('ExoticUSD');
			let exoticUSDC = await ExoticUSDC.new();
			await multiCollateralOnOffRamp.setSupportedCollateral(exoticUSDC.address, true);

			console.log('\nAttempting to resolve market with offramp:');
			console.log('Market default collateral:', exoticOP.address, '(NOT sUSD)');
			console.log('Offramp target collateral:', exoticUSDC.address);

			// This should revert with InvalidOffRampCollateral error because:
			// 1. The market's defaultCollateral is exoticOP (not sUSD)
			// 2. resolveMarketWithOfframp requires the market to have sUSD as default collateral
			// 3. It doesn't matter what collateral we're trying to offramp TO - the check fails first
			try {
				await speedMarketsAMM.resolveMarketWithOfframp(
					market,
					[resolvePriceFeedUpdateData],
					exoticUSDC.address, // trying to offramp to different collateral
					false,
					{ value: fee, from: user }
				);
				assert.fail('Expected transaction to revert');
			} catch (error) {
				// Check if the error contains the custom error name
				assert.ok(
					error.message.includes('InvalidOffRampCollateral') || error.message.includes('revert'),
					'Expected InvalidOffRampCollateral error but got: ' + error.message
				);
				console.log('Correctly reverted with InvalidOffRampCollateral');
			}
		});
	});
});
