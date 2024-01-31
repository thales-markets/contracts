'use strict';

const { contract } = require('hardhat');
const { assert } = require('../../utils/common');
const { toBytes32 } = require('../../../index');
const { expect } = require('chai');

const ZERO_ADDRESS = '0x' + '0'.repeat(40);

const { fastForward, toUnit } = require('../../utils')();
const { speedMarketsInit } = require('../../utils/zksync_init');
const { getSkewImpact } = require('../../utils/speedMarkets');

contract('SpeedMarkets', (accounts) => {
	const [owner, user] = accounts;

	describe('Test Speed markets ', () => {
		it('resolve markets manually', async () => {
			let {
				speedMarketsAMM,
				speedMarketsAMMData,
				priceFeedUpdateData,
				fee,
				mockPyth,
				pythId,
				initialSkewImapct,
			} = await speedMarketsInit(accounts);

			await speedMarketsAMM.createNewMarket(
				toBytes32('ETH'),
				0,
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
			let riskPerAssetAndDirectionData = await speedMarketsAMMData.getDirectionalRiskPerAsset(
				toBytes32('ETH')
			);
			let skewImapct = getSkewImpact(riskPerAssetAndDirectionData, toUnit(10), maxSkewImpact);

			await speedMarketsAMM.createNewMarket(
				toBytes32('ETH'),
				0,
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

		it('resolve market as owner', async () => {
			let { speedMarketsAMM, priceFeedUpdateData, fee, initialSkewImapct } = await speedMarketsInit(
				accounts
			);

			await speedMarketsAMM.createNewMarket(
				toBytes32('ETH'),
				0,
				36000,
				0,
				toUnit(10),
				[priceFeedUpdateData],
				ZERO_ADDRESS,
				initialSkewImapct,
				{ value: fee }
			);

			await fastForward(86400);

			let PRICE_DOWN = 180042931000;
			let markets = await speedMarketsAMM.activeMarkets(0, 1);
			let market = markets[0];

			await expect(
				speedMarketsAMM.resolveMarketAsOwner(market, PRICE_DOWN, { from: user })
			).to.be.revertedWith('Only the contract owner may perform this action');
			await speedMarketsAMM.resolveMarketAsOwner(market, PRICE_DOWN, { from: owner });
		});
	});
});
