'use strict';

const { contract } = require('hardhat');
const { assert } = require('../../utils/common');
const { toBytes32 } = require('../../../index');
const { expect } = require('chai');

const ZERO_ADDRESS = '0x' + '0'.repeat(40);

const { fastForward, toUnit } = require('../../utils')();
const { speedMarketsInit } = require('../../utils/init');

contract('SpeedMarkets', (accounts) => {
	const [user] = accounts;

	describe('Test Speed markets ', () => {
		it('deploy and test', async () => {
			let { speedMarketsAMM, priceFeedUpdateData, fee, mockPyth, pythId } = await speedMarketsInit(
				accounts
			);

			await speedMarketsAMM.createNewMarketWithDelta(
				toBytes32('ETH'),
				36000,
				0,
				toUnit(10),
				[priceFeedUpdateData],
				ZERO_ADDRESS,
				{ value: fee }
			);

			let currestRiskPerAssetAndDirection = await speedMarketsAMM.currentRiskPerAssetAndDirection(
				toBytes32('ETH'),
				0
			);
			assert.bnEqual(toUnit(10), currestRiskPerAssetAndDirection);

			let price = await mockPyth.getPrice(pythId);
			console.log('price of pyth Id is ' + price);

			let markets = await speedMarketsAMM.activeMarkets(0, 1);
			let market = markets[0];
			console.log('market is ' + market);

			await fastForward(86400);

			await expect(
				speedMarketsAMM.resolveMarketManually(market, toUnit(1), { from: user })
			).to.be.revertedWith('Resolver not whitelisted');

			await speedMarketsAMM.addToWhitelist(user, true);
			await speedMarketsAMM.resolveMarketManually(market, toUnit(1), { from: user });

			currestRiskPerAssetAndDirection = await speedMarketsAMM.currentRiskPerAssetAndDirection(
				toBytes32('ETH'),
				0
			);
			assert.bnEqual(toUnit(0), currestRiskPerAssetAndDirection);

			let numActiveMarkets = await speedMarketsAMM.numActiveMarkets();
			console.log('numActiveMarkets after resolve' + numActiveMarkets);
		});
	});
});
