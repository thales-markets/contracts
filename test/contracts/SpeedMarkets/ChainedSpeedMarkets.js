'use strict';

const { artifacts, contract } = require('hardhat');
const { assert } = require('../../utils/common');
const { toBytes32 } = require('../../../index');
const { expect } = require('chai');
const { roundUp } = require('big.js');
const { fastForward, toUnit, currentTime } = require('../../utils')();

const ZERO_ADDRESS = '0x' + '0'.repeat(40);

contract('ChainedSpeedMarkets', (accounts) => {
	const [owner, user, safeBox] = accounts;

	describe('Test Chained speed markets ', () => {
		it('deploy and test', async () => {
			// -------------------------- Speed Markets --------------------------
			let SpeedMarketsAMMContract = artifacts.require('SpeedMarketsAMM');
			let speedMarketsAMM = await SpeedMarketsAMMContract.new();

			let SpeedMarketsAMMDataContract = artifacts.require('SpeedMarketsAMMData');
			let speedMarketsAMMData = await SpeedMarketsAMMDataContract.new();
			await speedMarketsAMMData.initialize(owner, speedMarketsAMM.address);
			await speedMarketsAMMData.setSpeedMarketsAMM(speedMarketsAMM.address, { from: owner });

			let ExoticUSD = artifacts.require('ExoticUSD');
			let exoticUSD = await ExoticUSD.new();

			await exoticUSD.setDefaultAmount(toUnit(2000));

			await exoticUSD.mintForUser(owner);
			let balance = await exoticUSD.balanceOf(owner);
			console.log('Balance of owner is ' + balance / 1e18);

			await exoticUSD.transfer(speedMarketsAMM.address, toUnit(100), { from: owner });

			await exoticUSD.mintForUser(user);
			balance = await exoticUSD.balanceOf(user);
			console.log('Balance of user is ' + balance / 1e18);

			let MockPriceFeed = artifacts.require('MockPriceFeed');
			let MockPriceFeedDeployed = await MockPriceFeed.new(owner);
			await MockPriceFeedDeployed.setPricetoReturn(10000);

			let MockPyth = artifacts.require('MockPythCustom');
			let mockPyth = await MockPyth.new(60, 1e6);

			await speedMarketsAMM.initialize(owner, exoticUSD.address, mockPyth.address);

			let SpeedMarketMastercopy = artifacts.require('SpeedMarketMastercopy');
			let speedMarketMastercopy = await SpeedMarketMastercopy.new();

			await speedMarketsAMM.setMastercopy(speedMarketMastercopy.address);
			await speedMarketsAMM.setAmounts(toUnit(5), toUnit(500));
			await speedMarketsAMM.setTimes(3600, 86400);
			await speedMarketsAMM.setMaximumPriceDelays(30, 30);
			await speedMarketsAMM.setSupportedAsset(toBytes32('ETH'), true);
			await speedMarketsAMM.setMaxRiskPerAsset(toBytes32('ETH'), toUnit(1000));
			await speedMarketsAMM.setSafeBoxParams(safeBox, toUnit(0.02));
			await speedMarketsAMM.setAssetToPythID(
				toBytes32('ETH'),
				'0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace'
			);

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

			let updateDataArray = [];
			updateDataArray[0] = priceFeedUpdateData;

			let fee = await mockPyth.getUpdateFee(updateDataArray);

			let Referrals = artifacts.require('Referrals');
			let referrals = await Referrals.new();

			await referrals.initialize(owner, ZERO_ADDRESS, ZERO_ADDRESS);
			await referrals.setWhitelistedAddress(speedMarketsAMM.address, true);
			await referrals.setReferrerFees(toUnit(0.005), toUnit(0.0075), toUnit(0.01));

			await speedMarketsAMM.setAddresses(mockPyth.address, referrals.address, ZERO_ADDRESS, {
				from: owner,
			});

			// -------------------------- Chained Speed Markets --------------------------
			let ChainedSpeedMarketsAMMContract = artifacts.require('ChainedSpeedMarketsAMM');
			let chainedSpeedMarketsAMM = await ChainedSpeedMarketsAMMContract.new();
			await chainedSpeedMarketsAMM.initialize(owner, exoticUSD.address);

			await exoticUSD.transfer(chainedSpeedMarketsAMM.address, toUnit(1000), { from: owner });

			let ChainedSpeedMarketMastercopy = artifacts.require('ChainedSpeedMarketMastercopy');
			let chainedSpeedMarketMastercopy = await ChainedSpeedMarketMastercopy.new();

			await chainedSpeedMarketsAMM.setMastercopy(chainedSpeedMarketMastercopy.address);
			await chainedSpeedMarketsAMM.setAddresses(speedMarketsAMM.address, ZERO_ADDRESS);
			await chainedSpeedMarketsAMM.setMaxRiskPerAsset(toBytes32('ETH'), toUnit(1000));
			let payoutMultiplier = 1.9;
			await chainedSpeedMarketsAMM.setLimitParams(
				600, // minTimeFrame
				2, // minChainedMarkets
				6, // maxChainedMarkets
				toUnit(5), // minBuyinAmount
				toUnit(20), // maxBuyinAmount
				toUnit(500), // maxProfitPerIndividualMarket
				toUnit(payoutMultiplier)
			);
			await exoticUSD.approve(chainedSpeedMarketsAMM.address, toUnit(100), { from: user });

			let buyinAmount = 10;
			let timeFrame = 600; // 10 min

			await expect(
				chainedSpeedMarketsAMM.createNewMarket(
					toBytes32('ETH'),
					timeFrame,
					[0, 1, 0, 0, 0, 0, 1], // 7 directions
					toUnit(buyinAmount),
					[priceFeedUpdateData],
					ZERO_ADDRESS,
					{ value: fee, from: user }
				)
			).to.be.revertedWith('Wrong number of directions');

			await chainedSpeedMarketsAMM.createNewMarket(
				toBytes32('ETH'),
				timeFrame,
				[0, 1, 0, 0, 0, 0], // UP, DOWN, UP, UP, UP, UP
				toUnit(buyinAmount),
				[priceFeedUpdateData],
				ZERO_ADDRESS,
				{ value: fee, from: user }
			);

			let markets = await chainedSpeedMarketsAMM.activeMarkets(0, 1);
			let market = markets[0];
			let marketData = await speedMarketsAMMData.getChainedMarketsData([market]);
			let numOfDirections = marketData[0].directions.length;
			// Check strike times
			assert.equal(Number(marketData[0].createdAt) + timeFrame, marketData[0].initialStrikeTime);
			assert.equal(
				Number(marketData[0].createdAt) + numOfDirections * timeFrame,
				marketData[0].strikeTime
			);
			// Check payout
			let marketBalance = await exoticUSD.balanceOf(market);
			assert.equal(
				marketBalance / 1e18,
				(buyinAmount * payoutMultiplier ** numOfDirections).toFixed(5)
			);
		});
	});
});
