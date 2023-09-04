'use strict';

const { artifacts, contract, web3 } = require('hardhat');
const { toBN } = web3.utils;

const { assert } = require('../../utils/common');

const { toBytes32 } = require('../../../index');
const { expect } = require('chai');
const { toDecimal } = require('web3-utils');
const { setupAllContracts } = require('../../utils/setup');

const ZERO_ADDRESS = '0x' + '0'.repeat(40);

const { fastForward, toUnit, fromUnit, currentTime } = require('../../utils')();
const { encodeCall, convertToDecimals } = require('../../utils/helpers');

contract('SpeedMarkets', (accounts) => {
	const [owner, user, safeBox] = accounts;

	describe('Test Speed markets ', () => {
		it('deploy and test', async () => {
			let SpeedMarketsAMMContract = artifacts.require('SpeedMarketsAMM');
			let speedMarketsAMM = await SpeedMarketsAMMContract.new();

			let ExoticUSD = artifacts.require('ExoticUSD');
			let exoticUSD = await ExoticUSD.new();

			await exoticUSD.setDefaultAmount(toUnit(100));

			await exoticUSD.mintForUser(user);
			let balance = await exoticUSD.balanceOf(user);
			console.log('Balance of user is ' + balance / 1e18);

			await exoticUSD.transfer(speedMarketsAMM.address, toUnit(100), { from: user });

			await exoticUSD.mintForUser(owner);
			balance = await exoticUSD.balanceOf(owner);
			console.log('Balance of user is ' + balance / 1e18);

			let balanceOfSpeedMarketAMMBefore = await exoticUSD.balanceOf(speedMarketsAMM.address);

			await exoticUSD.approve(speedMarketsAMM.address, toUnit(100));

			let MockPriceFeed = artifacts.require('MockPriceFeed');
			let MockPriceFeedDeployed = await MockPriceFeed.new(owner);
			await MockPriceFeedDeployed.setPricetoReturn(10000);

			let MockPyth = artifacts.require('MockPythCustom');
			let mockPyth = await MockPyth.new(60, 1e6);

			await speedMarketsAMM.initialize(owner, exoticUSD.address, mockPyth.address);

			let SpeedMarketMastercopy = artifacts.require('SpeedMarketMastercopy');
			let speedMarketMastercopy = await SpeedMarketMastercopy.new();

			await speedMarketsAMM.setMastercopy(speedMarketMastercopy.address);

			await speedMarketsAMM.setAmounts(toUnit(5), toUnit(1000));

			await speedMarketsAMM.setTimes(3600, 86400);

			await speedMarketsAMM.setMaximumPriceDelay(60);

			await speedMarketsAMM.setMaxRiskPerAsset(toBytes32('ETH'), toUnit(1000));
			await speedMarketsAMM.setMaxRiskPerAssetAndDirection(toBytes32('ETH'), toUnit(100));
			await speedMarketsAMM.setMaxRiskPerAssetAndDirection(toBytes32('BTC'), toUnit(100));
			await speedMarketsAMM.setSafeBoxParams(safeBox, toUnit(0.01));
			await speedMarketsAMM.setLPFee(toUnit(0.01));

			await speedMarketsAMM.setAssetToPythID(
				toBytes32('ETH'),
				'0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace'
			);

			let pythId = await speedMarketsAMM.assetToPythId(toBytes32('ETH'));
			console.log('Pyth Id is ' + pythId);

			let now = await currentTime();

			let priceFeedUpdateData = await mockPyth.createPriceFeedUpdateData(
				'0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
				186342931000,
				74093100,
				-8,
				186342931000,
				74093100,
				now
			);

			console.log('price feed update data is ' + priceFeedUpdateData);

			let updateDataArray = [];
			updateDataArray[0] = priceFeedUpdateData;

			let fee = await mockPyth.getUpdateFee(updateDataArray);
			console.log('Fee is ' + fee);

			// await mockPyth.updatePriceFeeds([priceFeedUpdateData], { value: fee });

			let minimalTimeToMaturity = await speedMarketsAMM.minimalTimeToMaturity();
			console.log('minimalTimeToMaturity ' + minimalTimeToMaturity);

			await expect(
				speedMarketsAMM.createNewMarket(
					toBytes32('BTC'),
					now + 36000,
					0,
					toUnit(10),
					[priceFeedUpdateData],
					{ value: fee }
				)
			).to.be.revertedWith('revert');

			await speedMarketsAMM.setMaxRiskPerAsset(toBytes32('ETH'), toUnit(10));

			await expect(
				speedMarketsAMM.createNewMarket(
					toBytes32('ETH'),
					now + 36000,
					0,
					toUnit(10),
					[priceFeedUpdateData],
					{ value: fee }
				)
			).to.be.revertedWith('Asset is not supported');

			await speedMarketsAMM.setSupportedAsset(toBytes32('ETH'), true);

			await expect(
				speedMarketsAMM.createNewMarket(
					toBytes32('ETH'),
					now + 36000,
					0,
					toUnit(11),
					[priceFeedUpdateData],
					{ value: fee }
				)
			).to.be.revertedWith('OI cap breached');

			await speedMarketsAMM.setMaxRiskPerAssetAndDirection(toBytes32('ETH'), toUnit(5));

			await expect(
				speedMarketsAMM.createNewMarket(
					toBytes32('ETH'),
					now + 36000,
					0,
					toUnit(6),
					[priceFeedUpdateData],
					{ value: fee }
				)
			).to.be.revertedWith('Risk per direction exceeded');

			await speedMarketsAMM.setMaxRiskPerAsset(toBytes32('ETH'), toUnit(1000));
			await speedMarketsAMM.setMaxRiskPerAssetAndDirection(toBytes32('ETH'), toUnit(100));

			await speedMarketsAMM.createNewMarket(
				toBytes32('ETH'),
				now + 36000,
				0,
				toUnit(10),
				[priceFeedUpdateData],
				{ value: fee }
			);

			let currentRiskPerAsset = await speedMarketsAMM.currentRiskPerAsset(toBytes32('ETH'));
			console.log('currentRiskPerAsset ' + currentRiskPerAsset / 1e18);

			let currentRiskPerAssetAndDirection = await speedMarketsAMM.currentRiskPerAssetAndDirection(
				toBytes32('ETH'),
				0
			);
			console.log('currentRiskPerAssetAndDirection ' + currentRiskPerAssetAndDirection / 1e18);

			console.log('buy UP for the same amount as previous DOWN');
			await speedMarketsAMM.createNewMarket(
				toBytes32('ETH'),
				now + 36000,
				1,
				toUnit(10),
				[priceFeedUpdateData],
				{ value: fee }
			);

			let currentRiskPerAssetAndDirectionData = await speedMarketsAMM.getRiskPerAssetAndDirection(
				toBytes32('ETH')
			);
			console.log('currentRiskPerAssetAndDirectionData', currentRiskPerAssetAndDirectionData);

			let price = await mockPyth.getPrice(pythId);
			console.log('price of pyth Id is ' + price);

			console.log('market created');

			let numActiveMarkets = await speedMarketsAMM.numActiveMarkets();
			console.log('numActiveMarkets ' + numActiveMarkets);

			let numActiveMarketsPerUser = await speedMarketsAMM.numActiveMarketsPerUser(user);
			console.log('numActiveMarketsPerUser ' + numActiveMarketsPerUser);

			await speedMarketsAMM.createNewMarket(
				toBytes32('ETH'),
				now + 36000,
				0,
				toUnit(10),
				[priceFeedUpdateData],
				{ value: fee }
			);

			let balanceOfSpeedMarketAMMAfterCreation = await exoticUSD.balanceOf(speedMarketsAMM.address);

			numActiveMarkets = await speedMarketsAMM.numActiveMarkets();
			console.log('numActiveMarkets ' + numActiveMarkets);

			let markets = await speedMarketsAMM.activeMarkets(0, 1);
			let market = markets[0];
			console.log('market is ' + market);

			let marketsPerUser = await speedMarketsAMM.activeMarketsPerUser(0, 1, user);
			let marketPerUser = marketsPerUser[0];
			console.log('marketPerUser is ' + marketPerUser);

			let SpeedMarket = artifacts.require('SpeedMarket');
			let speedMarket = await SpeedMarket.at(market);
			let strikeTime = await speedMarket.strikeTime();
			console.log('Strike time is ' + strikeTime);

			let marketData = await speedMarketsAMM.getMarketsData([market]);
			console.log('marketData ' + marketData);

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

			await expect(
				speedMarketsAMM.resolveMarket(market, [resolvePriceFeedUpdateData], { value: fee })
			).to.be.revertedWith('Can not resolve');

			await fastForward(86400);

			await expect(
				speedMarketsAMM.resolveMarket(market, [resolvePriceFeedUpdateData], { value: fee })
			).to.be.revertedWith('revert');

			now = await currentTime();
			resolvePriceFeedUpdateData = await mockPyth.createPriceFeedUpdateData(
				'0x63f341689d98a12ef60a5cff1d7f85c70a9e17bf1575f0e7c0b2512d48b1c8b3',
				196342931000,
				74093100,
				-8,
				196342931000,
				74093100,
				strikeTime
			);
			await expect(
				speedMarketsAMM.resolveMarket(market, [resolvePriceFeedUpdateData], { value: fee })
			).to.be.revertedWith('revert');

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

			let balanceOfUserAfter = await exoticUSD.balanceOf(owner);
			console.log('balanceOfUserBefore ' + balanceOfUserBefore / 1e18);
			console.log('balanceOfUserAfter ' + balanceOfUserAfter / 1e18);

			let balanceOfSpeedMarketAMMAfterResolve = await exoticUSD.balanceOf(speedMarketsAMM.address);
			console.log('balanceOfSpeedMarketAMMBefore ' + balanceOfSpeedMarketAMMBefore / 1e18);
			console.log(
				'balanceOfSpeedMarketAMMAfterCreation ' + balanceOfSpeedMarketAMMAfterCreation / 1e18
			);
			console.log(
				'balanceOfSpeedMarketAMMAfterResolve ' + balanceOfSpeedMarketAMMAfterResolve / 1e18
			);

			let balanceSafeBox = await exoticUSD.balanceOf(safeBox);
			console.log('balanceSafeBox ' + balanceSafeBox / 1e18);

			let numMaturedMarkets = await speedMarketsAMM.numMaturedMarkets();
			console.log('numMaturedMarkets before resolve ' + numMaturedMarkets);

			let numMaturedMarketsPerUser = await speedMarketsAMM.numMaturedMarketsPerUser(user);
			console.log('numMaturedMarketsPerUser ' + numMaturedMarketsPerUser);
		});
	});
});
