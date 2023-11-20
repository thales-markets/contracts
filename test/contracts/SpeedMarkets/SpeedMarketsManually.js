'use strict';

const { contract } = require('hardhat');
const { assert } = require('../../utils/common');
const { toBytes32 } = require('../../../index');
const { expect } = require('chai');

const ZERO_ADDRESS = '0x' + '0'.repeat(40);

const { fastForward, toUnit } = require('../../utils')();
const { speedMarketsInit } = require('../../utils/init');
const { getSkewImpact } = require('../../utils/speedMarkets');

contract('SpeedMarkets', (accounts) => {
	const [user] = accounts;

	describe('Test Speed markets ', () => {
		it('deploy and test', async () => {
			let {
				speedMarketsAMM,
				speedMarketsAMMData,
				priceFeedUpdateData,
				fee,
				mockPyth,
				pythId,
				initialSkewImapct,
			} = await speedMarketsInit(accounts);

			await speedMarketsAMM.createNewMarketWithDelta(
				toBytes32('ETH'),
				36000,
				0,
				toUnit(10),
				[priceFeedUpdateData],
				ZERO_ADDRESS,
				initialSkewImapct,
				{ value: fee }
			);

			let currestRiskPerAssetAndDirection = await speedMarketsAMM.currentRiskPerAssetAndDirection(
				toBytes32('ETH'),
				0
			);
			assert.bnEqual(toUnit(10), currestRiskPerAssetAndDirection);

			const maxSkewImpact = (await speedMarketsAMM.maxSkewImpact()) / 1e18;
			const riskPerAssetAndDirectionData = await speedMarketsAMMData.getDirectionalRiskPerAsset(
				toBytes32('ETH')
			);
			const skewImapct = getSkewImpact(riskPerAssetAndDirectionData, toUnit(10), maxSkewImpact);

			await speedMarketsAMM.createNewMarketWithDelta(
				toBytes32('ETH'),
				36000,
				0,
				toUnit(10),
				[priceFeedUpdateData],
				ZERO_ADDRESS,
				skewImapct,
				{ value: fee }
			);

			let price = await mockPyth.getPrice(pythId);
			console.log('price of pyth Id is ' + price);

			let markets = await speedMarketsAMM.activeMarkets(0, 2);
			let market = markets[0];
			console.log('market is ' + market);

			await fastForward(86400);

			const PRICE_DOWN = 180042931000;
			await expect(
				speedMarketsAMM.resolveMarketManually(market, PRICE_DOWN, { from: user })
			).to.be.revertedWith('Resolver not whitelisted');

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
	});
});
