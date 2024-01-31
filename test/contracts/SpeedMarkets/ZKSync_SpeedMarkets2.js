'use strict';

const { artifacts, contract } = require('hardhat');
const { assert } = require('../../utils/common');
const { toBytes32 } = require('../../../index');
const { expect } = require('chai');
const { fastForward, toUnit, currentTime } = require('../../utils')();
const { speedMarketsInit } = require('../../utils/zksync_init');
const { getSkewImpact } = require('../../utils/speedMarkets');

const ZERO_ADDRESS = '0x' + '0'.repeat(40);

contract('SpeedMarkets', (accounts) => {
	const [owner, user, safeBox] = accounts;
	let speedMarketsAMM,
		speedMarketsAMMData,
		balanceOfSpeedMarketAMMBefore,
		priceFeedUpdateData,
		fee,
		mockPyth,
		pythId,
		exoticUSD,
		now;

	describe('Test Speed markets ', () => {
		beforeEach(async () => {
			let {
				speedMarketsAMM: local_speedMarketsAMM,
				speedMarketsAMMData: local_speedMarketsAMMData,
				balanceOfSpeedMarketAMMBefore: local_balanceOfSpeedMarketAMMBefore,
				priceFeedUpdateData: local_priceFeedUpdateData,
				fee: local_fee,
				mockPyth: local_mockPyth,
				pythId: local_pythId,
				exoticUSD: local_exoticUSD,
				now: local_now,
			} = await speedMarketsInit(accounts);
			speedMarketsAMM = local_speedMarketsAMM;
			speedMarketsAMMData = local_speedMarketsAMMData;
			balanceOfSpeedMarketAMMBefore = local_balanceOfSpeedMarketAMMBefore;
			priceFeedUpdateData = local_priceFeedUpdateData;
			fee = local_fee;
			mockPyth = local_mockPyth;
			pythId = local_pythId;
			exoticUSD = local_exoticUSD;
			now = local_now;

			await speedMarketsAMM.setSupportedAsset(toBytes32('ETH'), true);
			await speedMarketsAMM.setMaxRisks(toBytes32('ETH'), toUnit(1000), toUnit(100));
		});

		it('deploy and test', async () => {
			const maxSkewImpact = (await speedMarketsAMM.maxSkewImpact()) / 1e18;
			let riskPerAssetAndDirectionData = await speedMarketsAMMData.getDirectionalRiskPerAsset(
				toBytes32('ETH')
			);
			let skewImapct = getSkewImpact(riskPerAssetAndDirectionData, maxSkewImpact);

			let collateralizedAmount = await speedMarketsAMM.totalCollateralizedAmount();
			console.log('totalCollateralizedAmount: ', collateralizedAmount / 1e18);
			let availableAmount = await speedMarketsAMM.getAvailableAmountForNewMarkets();
			console.log('availableAmount: ', availableAmount / 1e18);

			await speedMarketsAMM.createNewMarket(
				toBytes32('ETH'),
				now + 36000,
				0,
				0,
				toUnit(10),
				[priceFeedUpdateData],
				ZERO_ADDRESS,
				skewImapct,
				{ value: fee }
			);

			collateralizedAmount = await speedMarketsAMM.totalCollateralizedAmount();
			console.log('totalCollateralizedAmount after create: ', collateralizedAmount / 1e18);
			availableAmount = await speedMarketsAMM.getAvailableAmountForNewMarkets();
			console.log('availableAmount after create: ', availableAmount / 1e18);
			let balanceOnContract = await exoticUSD.balanceOf(speedMarketsAMM.address);
			console.log('balance in contract after create: ', balanceOnContract / 1e18);
			assert.equal(
				parseFloat(balanceOnContract / 1e18),
				parseFloat(availableAmount / 1e18) + parseFloat(collateralizedAmount / 1e18)
			);

			let currentRiskPerAsset = await speedMarketsAMM.currentRiskPerAsset(toBytes32('ETH'));
			console.log('currentRiskPerAsset ' + currentRiskPerAsset / 1e18);

			let currentRiskPerAssetAndDirection = await speedMarketsAMM.currentRiskPerAssetAndDirection(
				toBytes32('ETH'),
				0
			);
			console.log('currentRiskPerAssetAndDirection ' + currentRiskPerAssetAndDirection / 1e18);

			riskPerAssetAndDirectionData = await speedMarketsAMMData.getDirectionalRiskPerAsset(
				toBytes32('ETH')
			);
			console.log('riskPerAssetAndDirectionData: ', riskPerAssetAndDirectionData);
			skewImapct = getSkewImpact(riskPerAssetAndDirectionData, maxSkewImpact);

			console.log('buy UP for the same amount as previous DOWN');
			await speedMarketsAMM.createNewMarket(
				toBytes32('ETH'),
				now + 36000,
				0,
				1,
				toUnit(10),
				[priceFeedUpdateData],
				ZERO_ADDRESS,
				skewImapct,
				{ value: fee }
			);

			let riskPerAssetData = await speedMarketsAMMData.getRiskPerAsset(toBytes32('ETH'));
			console.log('riskPerAssetData', riskPerAssetData);

			riskPerAssetAndDirectionData = await speedMarketsAMMData.getDirectionalRiskPerAsset(
				toBytes32('ETH')
			);
			console.log('riskPerAssetAndDirectionData', riskPerAssetAndDirectionData);

			let price = await mockPyth.getPrice(pythId);
			console.log('price of pyth Id is ' + price);

			console.log('market created');

			let ammData = await speedMarketsAMMData.getSpeedMarketsAMMParameters(owner);
			console.log('AMM Data ' + ammData);
			console.log('numActiveMarkets ' + ammData.numActiveMarkets);
			console.log('numActiveMarketsPerUser ' + ammData.numActiveMarketsPerUser);

			riskPerAssetAndDirectionData = await speedMarketsAMMData.getDirectionalRiskPerAsset(
				toBytes32('ETH')
			);
			skewImapct = getSkewImpact(riskPerAssetAndDirectionData, maxSkewImpact);

			await speedMarketsAMM.createNewMarket(
				toBytes32('ETH'),
				now + 36000,
				0,
				0,
				toUnit(10),
				[priceFeedUpdateData],
				ZERO_ADDRESS,
				skewImapct,
				{ value: fee }
			);

			let balanceOfSpeedMarketAMMAfterCreation = await exoticUSD.balanceOf(speedMarketsAMM.address);

			ammData = await speedMarketsAMMData.getSpeedMarketsAMMParameters(owner);
			console.log('numActiveMarkets ' + ammData.numActiveMarkets);

			let markets = await speedMarketsAMM.activeMarkets(0, 10);
			let market = markets[0];
			console.log('market is ' + market);

			let marketsPerUser = await speedMarketsAMM.activeMarketsPerUser(0, 1, owner);
			console.log('allMarketsPerUser: ', marketsPerUser);
			let marketPerUser = marketsPerUser[0];
			console.log('marketPerUser is ' + marketPerUser);

			// let SpeedMarket = artifacts.require('SpeedMarket');
			// let speedMarket = await SpeedMarket.at(market);
			let speedMarket = await speedMarketsAMM.speedMarket(market);
			let strikeTime = speedMarket.strikeTime;
			console.log('Strike time is ' + speedMarket.strikeTime);

			let marketData = await speedMarketsAMMData.getMarketsData([
				markets[0],
				markets[1],
				markets[2],
			]);
			console.log('marketData ' + marketData);

			const lpFeeByDeltaTime = 0.05; // set in init for above 2h market
			const expectedLpFee =
				lpFeeByDeltaTime + getSkewImpact(riskPerAssetAndDirectionData, maxSkewImpact) / 1e18;
			assert.equal(marketData[0].lpFee / 1e18, expectedLpFee.toFixed(5));

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

			ammData = await speedMarketsAMMData.getSpeedMarketsAMMParameters(owner);
			console.log('numActiveMarkets before resolve ' + ammData.numActiveMarkets);

			let balanceOfMarketBefore = speedMarket.buyinAmount * 2;
			let balanceOfUserBefore = await exoticUSD.balanceOf(owner);

			await speedMarketsAMM.resolveMarket(market, [resolvePriceFeedUpdateData], { value: fee });
			speedMarket = await speedMarketsAMM.speedMarket(market);
			ammData = await speedMarketsAMMData.getSpeedMarketsAMMParameters(owner);
			console.log('numActiveMarkets after resolve ' + ammData.numActiveMarkets);

			let resolved = speedMarket.resolved;
			console.log('resolved  is ' + resolved);

			let result = speedMarket.result;
			console.log('result  is ' + result);

			let direction = speedMarket.direction;
			console.log('direction  is ' + direction);

			let buyinAmount = speedMarket.buyinAmount;
			console.log('buyinAmount  is ' + buyinAmount / 1e18);

			let isUserWinner = await speedMarketsAMM.isUserWinnerForMarket(market);
			console.log('isUserWinner  is ' + isUserWinner);
		});
	});
});
