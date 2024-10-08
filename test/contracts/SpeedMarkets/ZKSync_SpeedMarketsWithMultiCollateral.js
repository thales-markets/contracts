'use strict';

const { artifacts, contract } = require('hardhat');
const { toBytes32 } = require('../../../index');
const { expect } = require('chai');
const { fastForward, toUnit, currentTime } = require('../../utils')();
const { ZERO_ADDRESS } = require('../../utils/helpers');
const { speedMarketsInit } = require('../../utils/zksync_init');
const { getCreateSpeedAMMParamsZkSync, getSkewImpact } = require('../../utils/speedMarkets');

contract('SpeedMarkets', (accounts) => {
	const [owner, user, safeBox, proxyUser] = accounts;

	describe('Test Speed markets ', () => {
		it('deploy and test', async () => {
			let {
				creatorAccount,
				speedMarketsAMM,
				speedMarketsAMMData,
				addressManager,
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

			await addressManager.setAddresses(
				safeBox,
				ZERO_ADDRESS,
				ZERO_ADDRESS,
				multiCollateralOnOffRamp.address,
				mockPyth.address,
				speedMarketsAMM.address
			);
			await speedMarketsAMM.setMultiCollateralOnOffRampEnabled(true);

			await exoticOP.setDefaultAmount(toUnit(100));
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

			const maxSkewImpact = (await speedMarketsAMM.maxSkewImpact()) / 1e18;
			let riskPerAssetAndDirectionData = await speedMarketsAMMData.getDirectionalRiskPerAsset(
				toBytes32('ETH')
			);
			let skewImapct = getSkewImpact(riskPerAssetAndDirectionData, toUnit(10), maxSkewImpact);

			const strikeTimeParam = now + 10 * 60 * 60; // 10 hours from now
			const buyinAmountParam = 10;

			await speedMarketsAMM.createNewMarket(
				getCreateSpeedAMMParamsZkSync(
					user,
					'ETH',
					strikeTimeParam,
					now,
					buyinAmountParam,
					0,
					skewImapct,
					0,
					exoticOP.address,
					ZERO_ADDRESS
				),
				{ from: creatorAccount }
			);

			riskPerAssetAndDirectionData = await speedMarketsAMMData.getDirectionalRiskPerAsset(
				toBytes32('ETH')
			);
			skewImapct = getSkewImpact(riskPerAssetAndDirectionData, toUnit(10), maxSkewImpact);

			const deltaTimeParam = 10 * 60 * 60; // 10 hours

			await speedMarketsAMM.createNewMarket(
				getCreateSpeedAMMParamsZkSync(
					user,
					'ETH',
					0,
					now,
					buyinAmountParam,
					0,
					skewImapct,
					deltaTimeParam,
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

			let speedMarket = await speedMarketsAMM.speedMarket(market);
			let strikeTime = speedMarket.strikeTime;
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

			ammData = await speedMarketsAMMData.getSpeedMarketsAMMParameters(user);
			console.log('numActiveMarkets before resolve ' + ammData.numActiveMarkets);

			let balanceOfMarketBefore = await exoticUSD.balanceOf(speedMarketsAMM.address);
			let balanceOfUserBefore = await exoticUSD.balanceOf(owner);

			await speedMarketsAMM.resolveMarket(market, [resolvePriceFeedUpdateData], { value: fee });

			ammData = await speedMarketsAMMData.getSpeedMarketsAMMParameters(user);
			console.log('numActiveMarkets after resolve' + ammData.numActiveMarkets);

			let resolved = await speedMarket.resolved;
			console.log('resolved is ' + resolved);

			let result = await speedMarket.result;
			console.log('result is ' + result);

			let direction = await speedMarket.direction;
			console.log('direction is ' + direction);

			let buyinAmount = await speedMarket.buyinAmount;
			console.log('buyinAmount is ' + buyinAmount / 1e18);

			let isUserWinner = await speedMarketsAMM.isUserWinnerForMarket(market);
			console.log('isUserWinner is ' + isUserWinner);

			let balanceOfMarketAfter = await exoticUSD.balanceOf(speedMarketsAMM.address);
			console.log('balanceOfMarketBefore ' + balanceOfMarketBefore / 1e18);
			console.log('balanceOfMarketAfter ' + balanceOfMarketAfter / 1e18);

			let balanceOfUserAfter = await exoticUSD.balanceOf(user);
			console.log('balanceOfUserBefore ' + balanceOfUserBefore / 1e18);
			console.log('balanceOfUserAfter ' + balanceOfUserAfter / 1e18);

			let balanceOfUserAfterExoticOP = await exoticOP.balanceOf(user);
			console.log('balanceOfUserAfterExoticOP ' + balanceOfUserAfterExoticOP / 1e18);

			let balanceOfSpeedMarketAMMAfterResolve = await exoticUSD.balanceOf(speedMarketsAMM.address);
			console.log('balanceOfSpeedMarketAMMBefore ' + balanceOfSpeedMarketAMMBefore / 1e18);
			console.log(
				'balanceOfSpeedMarketAMMAfterResolve ' + balanceOfSpeedMarketAMMAfterResolve / 1e18
			);

			let balanceSafeBox = await exoticUSD.balanceOf(safeBox);
			console.log('balanceSafeBox ' + balanceSafeBox / 1e18);
		});
	});
});
