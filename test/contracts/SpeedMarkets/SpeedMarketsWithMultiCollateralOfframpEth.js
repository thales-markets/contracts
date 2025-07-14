'use strict';

const { artifacts, contract } = require('hardhat');
const { assert } = require('../../utils/common');
const { expect } = require('chai');
const { fastForward, toUnit, currentTime } = require('../../utils')();
const { ZERO_ADDRESS } = require('../../utils/helpers');
const { speedMarketsInit } = require('../../utils/init');
const { getCreateSpeedAMMParams } = require('../../utils/speedMarkets');

contract('SpeedMarkets', (accounts) => {
	const [owner, user, safeBox, proxyUser] = accounts;

	describe('Test Speed markets ', () => {
		it('deploy and test', async () => {
			let {
				creatorAccount,
				speedMarketsAMM,
				speedMarketsAMMResolver,
				speedMarketsAMMData,
				addressManager,
				fee,
				mockPyth,
				MockPriceFeedDeployed,
				exoticUSD,
				initialSkewImapct,
				now,
			} = await speedMarketsInit(accounts);

			await speedMarketsAMM.setSupportedNativeCollateralAndItsBonus(exoticUSD.address, true, 0);

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
			await multiCollateralOnOffRamp.setSupportedAMM(speedMarketsAMMResolver.address, true);

			await addressManager.setAddresses(
				safeBox,
				ZERO_ADDRESS,
				ZERO_ADDRESS,
				multiCollateralOnOffRamp.address,
				mockPyth.address,
				speedMarketsAMM.address
			);
			await speedMarketsAMM.setMultiCollateralOnOffRampEnabled(true);

			await speedMarketsAMMResolver.setupMultiCollateralApproval(
				toUnit('1000000000000000000000000000000'),
				{ from: owner }
			);

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

			now = await currentTime();
			let resolvePriceFeedUpdateData = await mockPyth.createPriceFeedUpdateData(
				'0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
				196342931000,
				74093100,
				-8,
				196342931000,
				74093100,
				now
			);

			await fastForward(86400);

			now = await currentTime();
			resolvePriceFeedUpdateData = await mockPyth.createPriceFeedUpdateData(
				'0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
				196342931000,
				74093100,
				-8,
				196342931000,
				74093100,
				strikeTime
			);

			let MockWeth = artifacts.require('MockWeth');
			let mockWeth = await MockWeth.new();
			await multiCollateralOnOffRamp.setWETH(mockWeth.address, { from: owner });

			await MockPriceFeedDeployed.setPricetoReturn(toUnit(1000));

			let minimumReceivedOfframp = await multiCollateralOnOffRamp.getMinimumReceivedOfframp(
				mockWeth.address,
				toUnit(20)
			);
			console.log('minimumReceivedOfframp weth for 100 sUSD is ' + minimumReceivedOfframp / 1e18);

			let maximumReceivedOfframp = await multiCollateralOnOffRamp.getMaximumReceivedOfframp(
				mockWeth.address,
				toUnit(20)
			);
			console.log('maximumReceivedOfframp weth for 100 sUSD is ' + maximumReceivedOfframp / 1e18);

			await mockWeth.deposit({ value: toUnit(1), from: user });
			let userEthBalance = await web3.eth.getBalance(user);
			console.log('userEthBalance ' + userEthBalance);

			await multiCollateralOnOffRamp.setSupportedCollateral(mockWeth.address, true, {
				from: owner,
			});
			await swapRouterMock.setDefaults(exoticUSD.address, mockWeth.address);

			await mockWeth.transfer(swapRouterMock.address, toUnit(0.5), { from: user });
			userEthBalance = await web3.eth.getBalance(user);
			console.log('userEthBalance ' + userEthBalance);

			let swapRouterMockWethBalance = await mockWeth.balanceOf(swapRouterMock.address);

			await exoticUSD.approve(speedMarketsAMM.address, toUnit('1000'), { from: user });
			await exoticUSD.approve(speedMarketsAMMResolver.address, toUnit('1000'), { from: user });

			console.log('swapRouterMockWethBalance before ' + swapRouterMockWethBalance / 1e18);
			await speedMarketsAMMResolver.resolveMarketWithOfframp(
				market,
				[resolvePriceFeedUpdateData],
				mockWeth.address,
				true,
				{ value: fee, from: user }
			);

			let userEthBalanceAfter = await web3.eth.getBalance(user);
			console.log('userEthBalance after ' + userEthBalanceAfter);

			let userEthBalanceAfterDiff = userEthBalanceAfter / 1e18 - userEthBalance / 1e18;
			console.log('userEthBalanceAfterDiff ' + userEthBalanceAfterDiff);

			// User wins ~20 sUSD (minus fees), which converts to ~0.008-0.012 ETH based on the mock rates
			assert.bnGte(toUnit(userEthBalanceAfterDiff), toUnit('0.008'));
			assert.bnLte(toUnit(userEthBalanceAfterDiff), toUnit('0.05'));
		});
	});
});
