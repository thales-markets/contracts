'use strict';

const { contract } = require('hardhat');
const { assert } = require('../../utils/common');
const { toBytes32 } = require('../../../index');
const { expect } = require('chai');

const { fastForward, toUnit } = require('../../utils')();
const { speedMarketsInit } = require('../../utils/init');
const { getCreateSpeedAMMParams, getSkewImpact } = require('../../utils/speedMarkets');

contract('SpeedMarkets', (accounts) => {
	const [owner, user] = accounts;

	describe('Test Speed markets ', () => {
		it('resolve markets manually', async () => {
			let {
				creatorAccount,
				speedMarketsAMM,
				speedMarketsAMMData,
				mockPyth,
				pythId,
				initialSkewImapct,
				now,
				exoticUSD,
			} = await speedMarketsInit(accounts);

			const deltaTimeParam = 10 * 60 * 60; // 10 hours

			await speedMarketsAMM.createNewMarket(
				getCreateSpeedAMMParams(user, 'ETH', 0, now, 10, 0, initialSkewImapct, deltaTimeParam),
				{ from: creatorAccount }
			);

			let currestRiskPerAssetAndDirection = await speedMarketsAMM.currentRiskPerAssetAndDirection(
				toBytes32('ETH'),
				0
			);
			assert.bnEqual(toUnit(10), currestRiskPerAssetAndDirection);

			const maxSkewImpact = (await speedMarketsAMM.maxSkewImpact()) / 1e18;
			let riskPerAssetAndDirectionData = await speedMarketsAMMData.getDirectionalRiskPerAsset(
				toBytes32('ETH')
			);
			let skewImapct = getSkewImpact(riskPerAssetAndDirectionData, toUnit(10), maxSkewImpact);

			await speedMarketsAMM.createNewMarket(
				getCreateSpeedAMMParams(user, 'ETH', 0, now, 10, 0, skewImapct, deltaTimeParam),
				{ from: creatorAccount }
			);

			let price = await mockPyth.getPrice(pythId);
			console.log('price of pyth Id is ' + price);

			let markets = await speedMarketsAMM.activeMarkets(0, 2);
			let market = markets[0];
			console.log('market is ' + market);

			await fastForward(86400);

			const PRICE_DOWN = 180042931000;
			await expect(speedMarketsAMM.resolveMarketManually(market, PRICE_DOWN, { from: user })).to.be
				.reverted;

			await speedMarketsAMM.addToWhitelist(user, true);
			await speedMarketsAMM.resolveMarketManually(market, PRICE_DOWN, { from: user });

			market = markets[1];
			await speedMarketsAMM.resolveMarketManuallyBatch([market], [PRICE_DOWN], { from: user });

			currestRiskPerAssetAndDirection = await speedMarketsAMM.currentRiskPerAssetAndDirection(
				toBytes32('ETH'),
				0
			);
			assert.bnEqual(toUnit(0), currestRiskPerAssetAndDirection);

			let ammData = await speedMarketsAMMData.getSpeedMarketsAMMParameters(user);
			console.log('numActiveMarkets after resolve' + ammData.numActiveMarkets);
		});

		it('resolve market as owner', async () => {
			let { creatorAccount, speedMarketsAMM, initialSkewImapct, now, exoticUSD } =
				await speedMarketsInit(accounts);
			await speedMarketsAMM.setSupportedNativeCollateralAndItsBonus(exoticUSD.address, true, 0);
			const deltaTimeParam = 10 * 60 * 60; // 10 hours

			await speedMarketsAMM.createNewMarket(
				getCreateSpeedAMMParams(user, 'ETH', 0, now, 10, 0, initialSkewImapct, deltaTimeParam),
				{ from: creatorAccount }
			);

			await fastForward(86400);

			let PRICE_DOWN = 180042931000;
			let markets = await speedMarketsAMM.activeMarkets(0, 1);
			let market = markets[0];

			await expect(speedMarketsAMM.resolveMarketAsOwner(market, PRICE_DOWN, { from: user })).to.be
				.reverted;
			await speedMarketsAMM.resolveMarketAsOwner(market, PRICE_DOWN, { from: owner });
		});
	});
});
