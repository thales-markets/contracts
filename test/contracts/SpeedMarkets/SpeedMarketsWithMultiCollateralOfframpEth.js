'use strict';

const { artifacts, contract } = require('hardhat');
const { assert } = require('../../utils/common');
const { toBytes32 } = require('../../../index');
const { expect } = require('chai');
const { fastForward, toUnit, currentTime } = require('../../utils')();
const { speedMarketsInit } = require('../../utils/init');

const ZERO_ADDRESS = '0x' + '0'.repeat(40);

contract('SpeedMarkets', (accounts) => {
	const [owner, user, safeBox, proxyUser] = accounts;

	describe('Test Speed markets ', () => {
		it('deploy and test', async () => {
			let {
				speedMarketsAMM,
				balanceOfSpeedMarketAMMBefore,
				priceFeedUpdateData,
				fee,
				mockPyth,
				MockPriceFeedDeployed,
				exoticUSD,
				now,
			} = await speedMarketsInit(accounts);

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

			await speedMarketsAMM.setMultiCollateralOnOffRamp(multiCollateralOnOffRamp.address, true);

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

			await speedMarketsAMM.createNewMarketWithDifferentCollateral(
				toBytes32('ETH'),
				now + 36000,
				0,
				[priceFeedUpdateData],
				exoticOP.address,
				toUnit(10),
				false,
				ZERO_ADDRESS,
				{ value: fee, from: user }
			);

			let numActiveMarkets = await speedMarketsAMM.numActiveMarkets();
			console.log('numActiveMarkets ' + numActiveMarkets);

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

			console.log('swapRouterMockWethBalance before ' + swapRouterMockWethBalance / 1e18);
			await speedMarketsAMM.resolveMarketWithOfframp(
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

			assert.bnGte(toUnit(userEthBalanceAfterDiff), toUnit('0.01'));
			assert.bnLte(toUnit(userEthBalanceAfterDiff), toUnit('0.02'));
		});
	});
});
