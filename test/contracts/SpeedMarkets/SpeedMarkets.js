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
	const [owner, user] = accounts;

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

			balance = await exoticUSD.balanceOf(speedMarketsAMM.address);
			console.log('Balance of speedMarketsAMM.address is ' + balance / 1e18);

			await exoticUSD.approve(speedMarketsAMM.address, toUnit(100));

			let MockPriceFeed = artifacts.require('MockPriceFeed');
			let MockPriceFeedDeployed = await MockPriceFeed.new(owner);
			await MockPriceFeedDeployed.setPricetoReturn(10000);

			let MockPyth = artifacts.require('MockPythCustom');
			let mockPyth = await MockPyth.new(60, 1e6);

			await speedMarketsAMM.initialize(
				owner,
				MockPriceFeedDeployed.address,
				exoticUSD.address,
				mockPyth.address
			);

			let SpeedMarketMastercopy = artifacts.require('SpeedMarketMastercopy');
			let speedMarketMastercopy = await SpeedMarketMastercopy.new();

			await speedMarketsAMM.setAmounts(toUnit(5), toUnit(1000));

			await speedMarketsAMM.setTimes(3600, 86400);

			await speedMarketsAMM.setMaximumPriceDelay(60);

			await speedMarketsAMM.setMaxRiskPerAsset(toBytes32('ETH'), toUnit(1000));

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

			await speedMarketsAMM.createNewMarket(
				toBytes32('ETH'),
				now + 36000,
				0,
				toUnit(10),
				[priceFeedUpdateData],
				{ value: fee }
			);

			let price = await mockPyth.getPrice(pythId);
			console.log('price of pyth Id is ' + price);

			console.log('market created');

			let numActiveMarkets = await speedMarketsAMM.numActiveMarkets();

			console.log('numActiveMarkets ' + numActiveMarkets);

			await speedMarketsAMM.createNewMarket(
				toBytes32('ETH'),
				now + 36000,
				0,
				toUnit(10),
				[priceFeedUpdateData],
				{ value: fee }
			);

			numActiveMarkets = await speedMarketsAMM.numActiveMarkets();
			console.log('numActiveMarkets ' + numActiveMarkets);

			await fastForward(86400);

			await expect(
				speedMarketsAMM.createNewMarket(
					toBytes32('ETH'),
					now + 36000,
					0,
					toUnit(10),
					[priceFeedUpdateData],
					{ value: fee }
				)
			).to.be.revertedWith('time has to be in the future + minimalTimeToMaturity');
		});
	});
});
