'use strict';

const { artifacts, contract } = require('hardhat');
const { assert } = require('../../utils/common');
const { toBytes32 } = require('../../../index');
const { expect } = require('chai');
const { fastForward, toUnit, currentTime } = require('../../utils')();
const { speedMarketsInit } = require('../../utils/init');
const { getCreateSpeedAMMParams, getSkewImpact } = require('../../utils/speedMarkets');

contract('SpeedMarkets', (accounts) => {
	const [owner, user, safeBox] = accounts;

	describe('Test Speed markets ', () => {
		it('deploy and test', async () => {
			let {
				creatorAccount,
				speedMarketsAMM,
				speedMarketsAMMData,
				balanceOfSpeedMarketAMMBefore,
				fee,
				mockPyth,
				pythId,
				exoticUSD,
				now,
			} = await speedMarketsInit(accounts);

			const strikeTimeParam = now + 10 * 60 * 60; // 10 hours from now
			const buyinAmountParam = 10;
			const defaultCreateSpeedAMMParams = getCreateSpeedAMMParams(
				user,
				'ETH',
				strikeTimeParam,
				now,
				buyinAmountParam
			);

			await expect(speedMarketsAMM.createNewMarket(defaultCreateSpeedAMMParams)).to.be.reverted;

			await speedMarketsAMM.setSupportedAsset(toBytes32('ETH'), false);
			await speedMarketsAMM.setMaxRisks(toBytes32('ETH'), toUnit(10), toUnit(100));

			await expect(
				speedMarketsAMM.createNewMarket(defaultCreateSpeedAMMParams, {
					from: creatorAccount,
				})
			).to.be.reverted;

			await speedMarketsAMM.setSupportedAsset(toBytes32('ETH'), true);

			await expect(
				speedMarketsAMM.createNewMarket(
					getCreateSpeedAMMParams(user, 'ETH', strikeTimeParam, now, 11),
					{
						from: creatorAccount,
					}
				)
			).to.be.reverted;

			await speedMarketsAMM.setMaxRisks(toBytes32('ETH'), toUnit(10), toUnit(5));

			await expect(
				speedMarketsAMM.createNewMarket(
					getCreateSpeedAMMParams(user, 'ETH', strikeTimeParam, now, 6),
					{
						from: creatorAccount,
					}
				)
			).to.be.reverted;

			await speedMarketsAMM.setMaxRisks(toBytes32('ETH'), toUnit(1000), toUnit(100));

			const maxSkewImpact = (await speedMarketsAMM.maxSkewImpact()) / 1e18;
			let riskPerAssetAndDirectionData = await speedMarketsAMMData.getDirectionalRiskPerAsset(
				toBytes32('ETH')
			);
			let skewImapct = getSkewImpact(riskPerAssetAndDirectionData, maxSkewImpact);

			// buy UP for 10
			await speedMarketsAMM.createNewMarket(
				getCreateSpeedAMMParams(user, 'ETH', strikeTimeParam, now, buyinAmountParam, 0, skewImapct),
				{ from: creatorAccount }
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
			skewImapct = getSkewImpact(riskPerAssetAndDirectionData, maxSkewImpact);
			console.log('skewImapct ' + skewImapct / 1e18);

			console.log('buy DOWN for the same amount as previous UP');
			await speedMarketsAMM.createNewMarket(
				getCreateSpeedAMMParams(user, 'ETH', strikeTimeParam, now, buyinAmountParam, 1, skewImapct),
				{ from: creatorAccount }
			);

			let riskPerAssetData = await speedMarketsAMMData.getRiskPerAsset(toBytes32('ETH'));
			console.log('riskPerAssetData', riskPerAssetData);

			riskPerAssetAndDirectionData = await speedMarketsAMMData.getDirectionalRiskPerAsset(
				toBytes32('ETH')
			);
			console.log('riskPerAssetAndDirectionData', riskPerAssetAndDirectionData);

			let pythPrice = await mockPyth.getPrice(pythId);
			console.log('price of pyth Id is ' + pythPrice.price);

			console.log('market created');

			let ammData = await speedMarketsAMMData.getSpeedMarketsAMMParameters(user);
			console.log('AMM Data ' + ammData);
			console.log('numActiveMarkets ' + ammData.numActiveMarkets);
			console.log('numActiveMarketsPerUser ' + ammData.numActiveMarketsPerUser);

			riskPerAssetAndDirectionData = await speedMarketsAMMData.getDirectionalRiskPerAsset(
				toBytes32('ETH')
			);
			skewImapct = getSkewImpact(riskPerAssetAndDirectionData, maxSkewImpact);

			await speedMarketsAMM.createNewMarket(defaultCreateSpeedAMMParams, {
				from: creatorAccount,
			});

			let balanceOfSpeedMarketAMMAfterCreation = await exoticUSD.balanceOf(speedMarketsAMM.address);

			ammData = await speedMarketsAMMData.getSpeedMarketsAMMParameters(user);
			console.log('numActiveMarkets ' + ammData.numActiveMarkets);

			let markets = await speedMarketsAMM.activeMarkets(0, 1);
			let market = markets[0];
			console.log('market is ' + market);

			let marketsPerUser = await speedMarketsAMM.activeMarketsPerUser(0, 1, user);
			let marketPerUser = marketsPerUser[0];
			console.log('marketPerUser is ' + marketPerUser);

			let SpeedMarket = artifacts.require('SpeedMarket');
			let speedMarket = await SpeedMarket.at(market);
			let strikeTime = await speedMarket.strikeTime();
			const publishTime = await speedMarket.strikePricePublishTime();
			console.log('Strike time is ' + strikeTime);
			console.log('Publish time is ' + publishTime);

			let marketData = await speedMarketsAMMData.getMarketsData([market]);
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
			).to.be.reverted;

			await fastForward(86400);

			await expect(
				speedMarketsAMM.resolveMarket(market, [resolvePriceFeedUpdateData], { value: fee })
			).to.be.reverted;

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
			).to.be.reverted;

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

			let balanceOfMarketBefore = await exoticUSD.balanceOf(market);
			let balanceOfUserBefore = await exoticUSD.balanceOf(user);

			// User won
			await speedMarketsAMM.resolveMarket(market, [resolvePriceFeedUpdateData], { value: fee });

			ammData = await speedMarketsAMMData.getSpeedMarketsAMMParameters(user);
			console.log('numActiveMarkets after resolve ' + ammData.numActiveMarkets);

			let resolved = await speedMarket.resolved();
			console.log('resolved is ' + resolved);

			let result = await speedMarket.result();
			console.log('result is ' + result);

			let direction = await speedMarket.direction();
			console.log('direction is ' + direction);

			let buyinAmount = await speedMarket.buyinAmount();
			console.log('buyinAmount is ' + buyinAmount / 1e18);

			let isUserWinner = await speedMarket.isUserWinner();
			console.log('isUserWinner is ' + isUserWinner);

			let balanceOfMarketAfter = await exoticUSD.balanceOf(market);
			console.log('balanceOfMarketBefore ' + balanceOfMarketBefore / 1e18);
			console.log('balanceOfMarketAfter ' + balanceOfMarketAfter / 1e18);

			let balanceOfUserAfter = await exoticUSD.balanceOf(user);
			console.log('balanceOfUserBefore ' + balanceOfUserBefore / 1e18);
			console.log('balanceOfUserAfter ' + balanceOfUserAfter / 1e18);
			assert.bnEqual(balanceOfUserBefore.add(toUnit(2 * buyinAmountParam)), balanceOfUserAfter);

			let balanceOfSpeedMarketAMMAfterResolve = await exoticUSD.balanceOf(speedMarketsAMM.address);
			console.log('balanceOfSpeedMarketAMMBefore ' + balanceOfSpeedMarketAMMBefore / 1e18);
			console.log(
				'balanceOfSpeedMarketAMMAfterCreation ' + balanceOfSpeedMarketAMMAfterCreation / 1e18
			);
			console.log(
				'balanceOfSpeedMarketAMMAfterFirstResolve ' + balanceOfSpeedMarketAMMAfterResolve / 1e18
			);
			assert.bnEqual(balanceOfSpeedMarketAMMAfterResolve, balanceOfSpeedMarketAMMAfterCreation);

			let balanceSafeBox = await exoticUSD.balanceOf(safeBox);
			console.log('balanceSafeBox ' + balanceSafeBox / 1e18);

			console.log('numActiveMarkets before batch resolve ' + ammData.numActiveMarkets);
			console.log('numMaturedMarkets before batch resolve ' + ammData.numMaturedMarkets);
			markets = await speedMarketsAMM.activeMarkets(0, ammData.numActiveMarkets);
			await speedMarketsAMM.resolveMarketsBatch(
				markets,
				[resolvePriceFeedUpdateData, resolvePriceFeedUpdateData],
				{
					value: fee * ammData.numActiveMarkets,
				}
			);

			ammData = await speedMarketsAMMData.getSpeedMarketsAMMParameters(user);
			console.log('numActiveMarkets after batch resolve ' + ammData.numActiveMarkets);
			console.log('numMaturedMarkets after batch resolve ' + ammData.numMaturedMarkets);
			console.log('numMaturedMarketsPerUser ' + ammData.numMaturedMarketsPerUser);

			let ammBalance = await exoticUSD.balanceOf(speedMarketsAMM.address);
			console.log('Balance of AMM', ammBalance / 1e18);
			assert.bnEqual(
				ammBalance,
				balanceOfSpeedMarketAMMAfterCreation.add(toUnit(2 * buyinAmountParam))
			);

			await speedMarketsAMM.transferAmount(user, toUnit(1));
			ammBalance = await exoticUSD.balanceOf(speedMarketsAMM.address);
			console.log('Balance of AMM after transfer', ammBalance / 1e18);
		});

		it('Should correctly increase risk per asset for non-bonus collateral', async () => {
			let { creatorAccount, speedMarketsAMM, speedMarketsAMMData, exoticUSD, now } =
				await speedMarketsInit(accounts);

			const ETH = toBytes32('ETH');
			const strikeTime = now + 10 * 60 * 60; // 10 hours from now
			const buyinAmount = 50;

			// Set up supported asset and risk limits
			await speedMarketsAMM.setSupportedAsset(ETH, true);
			await speedMarketsAMM.setMaxRisks(ETH, toUnit(1000), toUnit(500));

			// Check initial risk
			const initialRiskPerAsset = await speedMarketsAMM.currentRiskPerAsset(ETH);
			const initialRiskUp = await speedMarketsAMM.currentRiskPerAssetAndDirection(ETH, 0);
			const initialRiskDown = await speedMarketsAMM.currentRiskPerAssetAndDirection(ETH, 1);

			console.log('Initial risk per asset:', initialRiskPerAsset / 1e18);
			console.log('Initial risk UP:', initialRiskUp / 1e18);
			console.log('Initial risk DOWN:', initialRiskDown / 1e18);

			// Get skew impact for first market
			const maxSkewImpact = await speedMarketsAMM.maxSkewImpact();
			let riskPerAssetAndDirectionData = await speedMarketsAMMData.getDirectionalRiskPerAsset(ETH);
			let skewImpact = getSkewImpact(riskPerAssetAndDirectionData, maxSkewImpact / 1e18);

			// Create first market (UP direction)
			const createParams1 = getCreateSpeedAMMParams(
				user,
				'ETH',
				strikeTime,
				now,
				buyinAmount,
				0, // UP
				skewImpact
			);

			await speedMarketsAMM.createNewMarket(createParams1, { from: creatorAccount });

			// Check risk after first market
			const riskAfterFirst = await speedMarketsAMM.currentRiskPerAsset(ETH);
			const riskUpAfterFirst = await speedMarketsAMM.currentRiskPerAssetAndDirection(ETH, 0);

			// Get LP fee from the created market
			const SpeedMarket = artifacts.require('SpeedMarket');
			const markets = await speedMarketsAMM.activeMarkets(0, 10);
			const market1 = await SpeedMarket.at(markets[0]);
			const lpFee1 = await market1.lpFee();

			// Calculate expected risk increase
			// Risk = payout - (buyinAmount * (1 + lpFee))
			const payout1 = toUnit(buyinAmount * 2);
			const buyinPlusLpFee1 = toUnit(buyinAmount).add(
				toUnit(buyinAmount).mul(lpFee1).div(toUnit(1))
			);
			const expectedRiskIncrease1 = payout1.sub(buyinPlusLpFee1);

			console.log('Risk after first market:', riskAfterFirst / 1e18);
			console.log('Expected risk increase:', expectedRiskIncrease1 / 1e18);
			console.log('Actual risk increase:', (riskAfterFirst - initialRiskPerAsset) / 1e18);

			assert.bnEqual(riskAfterFirst.sub(initialRiskPerAsset), expectedRiskIncrease1);
			assert.bnEqual(riskUpAfterFirst, toUnit(buyinAmount));

			// Create second market (DOWN direction) - should reduce UP risk
			riskPerAssetAndDirectionData = await speedMarketsAMMData.getDirectionalRiskPerAsset(ETH);
			skewImpact = getSkewImpact(riskPerAssetAndDirectionData, maxSkewImpact / 1e18);

			const createParams2 = getCreateSpeedAMMParams(
				user,
				'ETH',
				strikeTime + 60,
				now,
				buyinAmount / 2,
				1, // DOWN
				skewImpact
			);

			await speedMarketsAMM.createNewMarket(createParams2, { from: creatorAccount });

			// Check risk after second market
			const riskAfterSecond = await speedMarketsAMM.currentRiskPerAsset(ETH);
			const riskUpAfterSecond = await speedMarketsAMM.currentRiskPerAssetAndDirection(ETH, 0);
			const riskDownAfterSecond = await speedMarketsAMM.currentRiskPerAssetAndDirection(ETH, 1);

			console.log('Risk after second market:', riskAfterSecond / 1e18);
			console.log('Risk UP after second:', riskUpAfterSecond / 1e18);
			console.log('Risk DOWN after second:', riskDownAfterSecond / 1e18);

			// UP risk should be reduced by DOWN buyinAmount
			assert.bnEqual(riskUpAfterSecond, toUnit(buyinAmount - buyinAmount / 2));

			// Test approaching max risk limit
			const currentRisk = await speedMarketsAMM.currentRiskPerAsset(ETH);
			const maxRisk = await speedMarketsAMM.maxRiskPerAsset(ETH);
			const remainingRisk = maxRisk.sub(currentRisk);
			console.log('Remaining risk capacity:', remainingRisk / 1e18);

			// Try to create a market that would exceed risk limit
			const exceedingBuyinAmount = 600; // This should exceed the 1000 limit
			const createParams3 = getCreateSpeedAMMParams(
				user,
				'ETH',
				strikeTime + 120,
				now,
				exceedingBuyinAmount,
				0, // UP
				0
			);

			await expect(speedMarketsAMM.createNewMarket(createParams3, { from: creatorAccount })).to.be
				.reverted;
		});
	});
});
