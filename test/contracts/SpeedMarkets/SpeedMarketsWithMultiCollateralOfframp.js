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
				speedMarketsAMMData,
				addressManager,
				priceFeedUpdateData,
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

			await speedMarketsAMM.createNewMarketWithDifferentCollateral(
				toBytes32('ETH'),
				now + 36000,
				0,
				[priceFeedUpdateData],
				exoticOP.address,
				toUnit(10),
				false,
				ZERO_ADDRESS,
				initialSkewImapct,
				{ value: fee, from: user }
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
			).to.be.revertedWith('Only allowed from market owner');

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
	});
});
