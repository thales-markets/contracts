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

			numActiveMarkets = await speedMarketsAMM.numActiveMarkets();
			console.log('numActiveMarkets before resolve ' + numActiveMarkets);

			let balanceOfMarketBefore = await exoticUSD.balanceOf(market);
			let balanceOfUserBefore = await exoticUSD.balanceOf(owner);

			await speedMarketsAMM.resolveMarket(market, [resolvePriceFeedUpdateData], { value: fee });

			numActiveMarkets = await speedMarketsAMM.numActiveMarkets();
			console.log('numActiveMarkets after resolve' + numActiveMarkets);

			let resolved = await speedMarket.resolved();
			console.log('resolved  is ' + resolved);

			let result = await speedMarket.result();
			console.log('result  is ' + result);

			let direction = await speedMarket.direction();
			console.log('direction  is ' + direction);

			let buyinAmount = await speedMarket.buyinAmount();
			console.log('buyinAmount  is ' + buyinAmount / 1e18);

			let isUserWinner = await speedMarket.isUserWinner();
			console.log('isUserWinner  is ' + isUserWinner);

			let balanceOfMarketAfter = await exoticUSD.balanceOf(market);
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
