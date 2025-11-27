'use strict';

const { artifacts, contract } = require('hardhat');
const { assert } = require('../../utils/common');
const { toBytes32 } = require('../../../index');
const { expect } = require('chai');
const { fastForward, toUnit, currentTime } = require('../../utils')();
const { ZERO_ADDRESS } = require('../../utils/helpers');
const { getPendingSpeedParams, getPendingChainedSpeedParams } = require('../../utils/speedMarkets');

contract('SpeedMarketsAMMResolver', (accounts) => {
	const [owner, user, safeBox] = accounts;
	let exoticUSD;
	let creator, resolver, speedMarketsAMM, chainedSpeedMarketsAMM;
	let mockPyth, priceFeedUpdateData, mockChainlinkVerifier, fee, unverifiedReport;
	let now;
	let addressManager;

	const PAYOUT_MULTIPLIERS = [toUnit(1.7), toUnit(1.78), toUnit(1.82), toUnit(1.84), toUnit(1.9)];
	const PYTH_ETH_PRICE = 186342931000;
	const PYTH_ETH_RESOLVE_PRICE = 186461758000;
	const CHAINLINK_ETH_PRICE = toUnit(4168.89);
	const CHAINLINK_ETH_RESOLVE_PRICE = toUnit(4167.25);
	const oracleSource = {
		Pyth: 0,
		Chainlink: 1,
	};

	beforeEach(async () => {
		// -------------------------- Speed Markets --------------------------
		let SpeedMarketsAMMContract = artifacts.require('SpeedMarketsAMM');
		speedMarketsAMM = await SpeedMarketsAMMContract.new();

		let ExoticUSD = artifacts.require('ExoticUSD');
		exoticUSD = await ExoticUSD.new();

		await exoticUSD.setDefaultAmount(toUnit(5000));

		await exoticUSD.mintForUser(owner);
		let balance = await exoticUSD.balanceOf(owner);
		console.log('Balance of owner is ' + balance / 1e18);

		await exoticUSD.transfer(speedMarketsAMM.address, toUnit(100), { from: owner });

		await exoticUSD.mintForUser(user);
		balance = await exoticUSD.balanceOf(user);
		console.log('Balance of user is ' + balance / 1e18);

		let SpeedMarketMastercopy = artifacts.require('SpeedMarketMastercopy');
		let speedMarketMastercopy = await SpeedMarketMastercopy.new();

		let SpeedMarketsAMMUtilsContract = artifacts.require('SpeedMarketsAMMUtils');
		let speedMarketsAMMUtils = await SpeedMarketsAMMUtilsContract.new();

		await speedMarketsAMM.initialize(owner, exoticUSD.address);
		await speedMarketsAMM.setAMMAddresses(
			speedMarketMastercopy.address,
			speedMarketsAMMUtils.address,
			ZERO_ADDRESS
		);
		// await speedMarketsAMM.setSupportedNativeCollateralAndBonus(exoticUSD.address, true, 0);
		await speedMarketsAMM.setLimitParams(toUnit(5), toUnit(500), 300, 86400, 60, 60);
		await speedMarketsAMM.setSupportedAsset(toBytes32('ETH'), true);
		await speedMarketsAMM.setMaxRisks(toBytes32('ETH'), toUnit(1000), toUnit(500));
		await speedMarketsAMM.setSafeBoxAndMaxSkewImpact(toUnit(0.02), toUnit(0.05), toUnit(0.02));
		await speedMarketsAMM.setAssetToPriceOracleID(
			toBytes32('ETH'),
			'0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
			'0x000359843a543ee2fe414dc14c7e7920ef10f4372990b79d6361cdc0dd1ba782'
		);
		await speedMarketsAMM.setLPFeeParams(
			[5, 10, 15, 60],
			[toUnit(0.18), toUnit(0.13), toUnit(0.11), toUnit(0.1)],
			toUnit(0.1)
		);

		now = await currentTime();

		const MockPyth = artifacts.require('MockPythCustom');
		mockPyth = await MockPyth.new(60, 1e6);

		priceFeedUpdateData = await mockPyth.createPriceFeedUpdateData(
			'0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace', // ETH pyth ID
			PYTH_ETH_PRICE,
			74093100,
			-8,
			PYTH_ETH_PRICE,
			74093100,
			now // publishTime
		);

		let updateDataArray = [];
		updateDataArray[0] = priceFeedUpdateData;

		fee = await mockPyth.getUpdateFee(updateDataArray);

		// ------------------------- Address Manager -------------------------
		let AddressManagerContract = artifacts.require('AddressManager');
		addressManager = await AddressManagerContract.new();

		await addressManager.initialize(
			owner,
			safeBox,
			ZERO_ADDRESS,
			ZERO_ADDRESS,
			ZERO_ADDRESS,
			mockPyth.address,
			speedMarketsAMM.address
		);

		await speedMarketsAMM.setAMMAddresses(
			speedMarketMastercopy.address,
			speedMarketsAMMUtils.address,
			addressManager.address
		);

		// -------------------------- Chained Speed Markets --------------------------
		let ChainedSpeedMarketsAMMContract = artifacts.require('ChainedSpeedMarketsAMM');
		chainedSpeedMarketsAMM = await ChainedSpeedMarketsAMMContract.new();

		await chainedSpeedMarketsAMM.initialize(owner, exoticUSD.address);

		await exoticUSD.transfer(chainedSpeedMarketsAMM.address, toUnit(5000), { from: owner });

		let ChainedSpeedMarketMastercopy = artifacts.require('ChainedSpeedMarketMastercopy');
		let chainedSpeedMarketMastercopy = await ChainedSpeedMarketMastercopy.new();

		await chainedSpeedMarketsAMM.setMastercopy(chainedSpeedMarketMastercopy.address);
		await chainedSpeedMarketsAMM.setAddressManager(addressManager.address);
		await chainedSpeedMarketsAMM.setMultiCollateralOnOffRampEnabled(true);
		await chainedSpeedMarketsAMM.setLimitParams(
			120, // minTimeFrame
			600, // maxTimeFrame
			2, // minChainedMarkets
			6, // maxChainedMarkets
			toUnit(5), // minBuyinAmount
			toUnit(20), // maxBuyinAmount
			toUnit(500), // maxProfitPerIndividualMarket
			toUnit(1000), // maxRisk
			PAYOUT_MULTIPLIERS
		);

		await addressManager.setAddressInAddressBook('SpeedMarketsAMM', speedMarketsAMM.address);
		await addressManager.setAddressInAddressBook(
			'ChainedSpeedMarketsAMM',
			chainedSpeedMarketsAMM.address
		);

		// -------------------------- Creator of Speed/Chained Markets --------------------------
		const Creator = artifacts.require('SpeedMarketsAMMCreator');
		creator = await Creator.new();

		await creator.initialize(owner, addressManager.address);
		await creator.setAddressManager(addressManager.address);
		await creator.setMaxCreationDelay(5); // 5s
		await creator.addToWhitelist(user, true);

		await addressManager.setAddressInAddressBook('SpeedMarketsAMMCreator', creator.address);

		const MockChainlinkVerifier = artifacts.require('MockChainlinkVerifier');
		mockChainlinkVerifier = await MockChainlinkVerifier.new(ZERO_ADDRESS);
		await addressManager.setAddressInAddressBook(
			'ChainlinkVerifier',
			mockChainlinkVerifier.address
		);

		unverifiedReport = await mockChainlinkVerifier.createUnverifiedReport(
			'0x000359843a543ee2fe414dc14c7e7920ef10f4372990b79d6361cdc0dd1ba782', // ETH feed ID
			now, // validFromTimestamp
			'0x3d9c4bf380da', // nativeFee
			'0x2d299261f9bc63', // linkFee
			CHAINLINK_ETH_PRICE
		);

		// -------------------------- Resolver of Speed/Chained Markets --------------------------
		let SpeedMarketsAMMResolverContract = artifacts.require('SpeedMarketsAMMResolver');
		resolver = await SpeedMarketsAMMResolverContract.new();
		await resolver.initialize(owner, speedMarketsAMM.address, addressManager.address);
		await addressManager.setAddressInAddressBook('SpeedMarketsAMMResolver', resolver.address);
	});

	describe('Test resolver of speed markets using Pyth', () => {
		it('Should resolve speed markets using Pyth', async () => {
			const DELTA_TIME = 5 * 60; // 5 min
			const ETH_STRIKE_PRICE = 1856;
			const STRIKE_PRICE_SLIPPAGE = 0.02; // 2%
			const BUYIN_AMOUNT = 10;

			const pendingSpeedParams = getPendingSpeedParams(
				'ETH',
				DELTA_TIME,
				ETH_STRIKE_PRICE,
				STRIKE_PRICE_SLIPPAGE,
				BUYIN_AMOUNT
			);

			await exoticUSD.approve(speedMarketsAMM.address, toUnit(100), { from: user });
			await creator.addPendingSpeedMarket(pendingSpeedParams, { from: user });
			await creator.createFromPendingSpeedMarkets([oracleSource.Pyth, [priceFeedUpdateData], 0], {
				value: fee,
				from: user,
			});

			let activeMarkets = await speedMarketsAMM.activeMarkets(0, 10);
			const market = activeMarkets[0];

			await fastForward(86400);
			const SpeedMarket = artifacts.require('SpeedMarket');
			const speedMarket = await SpeedMarket.at(market);
			const strikeTime = await speedMarket.strikeTime();
			const resolvePriceFeedUpdateData = await mockPyth.createPriceFeedUpdateData(
				'0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
				PYTH_ETH_RESOLVE_PRICE,
				74093100,
				-8,
				PYTH_ETH_RESOLVE_PRICE,
				74093100,
				strikeTime
			);
			await resolver.resolveMarket(market, [resolvePriceFeedUpdateData], { value: fee });
			activeMarkets = await speedMarketsAMM.activeMarkets(0, 10);
			assert.equal(activeMarkets.length, 0, 'Should be 0 active speed market!');
			const resolvedMarkets = await speedMarketsAMM.maturedMarkets(0, 10);
			assert.equal(resolvedMarkets.length, 1, 'Should be 1 resolved speed market!');
		});
	});

	describe('Test resolver of speed markets using Chainlink', () => {
		it('Should resolve speed markets using Chainlink', async () => {
			const DELTA_TIME = 5 * 60; // 5 min
			const ETH_STRIKE_PRICE = 4168;
			const STRIKE_PRICE_SLIPPAGE = 0.02; // 2%
			const BUYIN_AMOUNT = 10;

			const pendingSpeedParams = getPendingSpeedParams(
				'ETH',
				DELTA_TIME,
				ETH_STRIKE_PRICE,
				STRIKE_PRICE_SLIPPAGE,
				BUYIN_AMOUNT
			);

			await exoticUSD.approve(speedMarketsAMM.address, toUnit(100), { from: user });
			await creator.addPendingSpeedMarket(pendingSpeedParams, { from: user });
			await creator.createFromPendingSpeedMarkets([oracleSource.Chainlink, [unverifiedReport], 0], {
				from: user,
			});

			let activeMarkets = await speedMarketsAMM.activeMarkets(0, 10);
			const market = activeMarkets[0];

			await fastForward(86400);
			const SpeedMarket = artifacts.require('SpeedMarket');
			const speedMarket = await SpeedMarket.at(market);
			const strikeTime = await speedMarket.strikeTime();
			let resolveUnverifiedReport = await mockChainlinkVerifier.createUnverifiedReport(
				'0x000359843a543ee2fe414dc14c7e7920ef10f4372990b79d6361cdc0dd1ba782', // ETH feed ID
				now, // validFromTimestamp
				'0x3d9c4bf380da', // nativeFee
				'0x2d299261f9bc63', // linkFee
				CHAINLINK_ETH_RESOLVE_PRICE
			);

			// price validFromTimestamp is not valid
			await expect(resolver.resolveMarket(market, [resolveUnverifiedReport], { value: fee })).to.be
				.reverted;

			resolveUnverifiedReport = await mockChainlinkVerifier.createUnverifiedReport(
				'0x000359843a543ee2fe414dc14c7e7920ef10f4372990b79d6361cdc0dd1ba782', // ETH feed ID
				strikeTime, // validFromTimestamp
				'0x3d9c4bf380da', // nativeFee
				'0x2d299261f9bc63', // linkFee
				CHAINLINK_ETH_RESOLVE_PRICE
			);

			await resolver.resolveMarket(market, [resolveUnverifiedReport], {
				value: fee,
			});
			activeMarkets = await speedMarketsAMM.activeMarkets(0, 10);
			assert.equal(activeMarkets.length, 0, 'Should be 0 active speed market!');
			const resolvedMarkets = await speedMarketsAMM.maturedMarkets(0, 10);
			assert.equal(resolvedMarkets.length, 1, 'Should be 1 resolved speed market!');
		});
	});

	describe('Test resolver of Chained speed markets using Pyth', () => {
		it('Should resolve chained speed markets using Pyth', async () => {
			const TIME_FRAME = 5 * 60; // 5 min
			const ETH_STRIKE_PRICE = 1856;
			const STRIKE_PRICE_SLIPPAGE = 0.02; // 2%
			const BUYIN_AMOUNT = 10;

			const pendingChainedSpeedParams = getPendingChainedSpeedParams(
				'ETH',
				TIME_FRAME,
				ETH_STRIKE_PRICE,
				STRIKE_PRICE_SLIPPAGE,
				BUYIN_AMOUNT
			);

			await exoticUSD.approve(chainedSpeedMarketsAMM.address, toUnit(100), { from: user });
			await creator.addPendingChainedSpeedMarket(pendingChainedSpeedParams, { from: user });
			await creator.createFromPendingChainedSpeedMarkets(oracleSource.Pyth, [priceFeedUpdateData], {
				value: fee,
				from: user,
			});

			let activeMarkets = await chainedSpeedMarketsAMM.activeMarkets(0, 10);
			const market = activeMarkets[0];

			await fastForward(86400);
			const ChainedSpeedMarket = artifacts.require('ChainedSpeedMarket');
			const chainedMarket = await ChainedSpeedMarket.at(market);
			const initialStrikeTime = await chainedMarket.initialStrikeTime();
			const initialStrikePrice = await chainedMarket.initialStrikePrice();

			let resolvePriceFeedUpdateData = await mockPyth.createPriceFeedUpdateData(
				'0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
				Number(initialStrikePrice) - 500000000, // DOWN
				74093100,
				-8,
				Number(initialStrikePrice) - 500000000,
				74093100,
				initialStrikeTime
			);

			await resolver.resolveChainedMarket(market, [[resolvePriceFeedUpdateData]], { value: fee });
			activeMarkets = await chainedSpeedMarketsAMM.activeMarkets(0, 10);
			assert.equal(activeMarkets.length, 0, 'Should be 0 active speed market!');
			const resolvedMarkets = await chainedSpeedMarketsAMM.maturedMarkets(0, 10);
			assert.equal(resolvedMarkets.length, 1, 'Should be 1 resolved speed market!');
		});
	});

	describe('Test resolver of Chained speed markets using Chainlink', () => {
		it('Should resolve chained speed markets using Chainlink', async () => {
			const TIME_FRAME = 5 * 60; // 5 min
			const ETH_STRIKE_PRICE = 4168;
			const STRIKE_PRICE_SLIPPAGE = 0.02; // 2%
			const BUYIN_AMOUNT = 10;

			const pendingChainedSpeedParams = getPendingChainedSpeedParams(
				'ETH',
				TIME_FRAME,
				ETH_STRIKE_PRICE,
				STRIKE_PRICE_SLIPPAGE,
				BUYIN_AMOUNT
			);

			await exoticUSD.approve(chainedSpeedMarketsAMM.address, toUnit(100), { from: user });
			await creator.addPendingChainedSpeedMarket(pendingChainedSpeedParams, { from: user });
			await creator.createFromPendingChainedSpeedMarkets(
				oracleSource.Chainlink,
				[unverifiedReport],
				{
					value: fee,
					from: user,
				}
			);

			let activeMarkets = await chainedSpeedMarketsAMM.activeMarkets(0, 10);
			const market = activeMarkets[0];

			await fastForward(86400);
			const ChainedSpeedMarket = artifacts.require('ChainedSpeedMarket');
			const chainedMarket = await ChainedSpeedMarket.at(market);
			const initialStrikeTime = await chainedMarket.initialStrikeTime();

			let resolveUnverifiedReport = await mockChainlinkVerifier.createUnverifiedReport(
				'0x000359843a543ee2fe414dc14c7e7920ef10f4372990b79d6361cdc0dd1ba782', // ETH feed ID
				now, // validFromTimestamp
				'0x3d9c4bf380da', // nativeFee
				'0x2d299261f9bc63', // linkFee
				CHAINLINK_ETH_RESOLVE_PRICE
			);

			// price validFromTimestamp is not valid
			await expect(
				resolver.resolveChainedMarket(market, [[resolveUnverifiedReport]], { value: fee })
			).to.be.reverted;

			resolveUnverifiedReport = await mockChainlinkVerifier.createUnverifiedReport(
				'0x000359843a543ee2fe414dc14c7e7920ef10f4372990b79d6361cdc0dd1ba782', // ETH feed ID
				initialStrikeTime, // validFromTimestamp
				'0x3d9c4bf380da', // nativeFee
				'0x2d299261f9bc63', // linkFee
				CHAINLINK_ETH_RESOLVE_PRICE // DOWN
			);

			await resolver.resolveChainedMarket(market, [[resolveUnverifiedReport]], { value: fee });
			activeMarkets = await chainedSpeedMarketsAMM.activeMarkets(0, 10);
			assert.equal(activeMarkets.length, 0, 'Should be 0 active speed market!');
			const resolvedMarkets = await chainedSpeedMarketsAMM.maturedMarkets(0, 10);
			assert.equal(resolvedMarkets.length, 1, 'Should be 1 resolved speed market!');
		});
	});

	describe('Test resolver withdraw token', () => {
		it('Should withdraw tokens', async () => {
			await exoticUSD.transfer(resolver.address, toUnit(10), { from: user });
			const balanceBefore = await exoticUSD.balanceOf(user);

			const amountToWithdraw = toUnit(10);

			await resolver.transferAmount(user, exoticUSD.address, amountToWithdraw, { from: owner });

			const balanceAfter = await exoticUSD.balanceOf(user);
			assert.equal(
				(balanceAfter / 1e18).toFixed(0),
				(balanceBefore / 1e18 + amountToWithdraw / 1e18).toFixed(0),
				'Should add token amount to user balance!'
			);
		});
	});
});
