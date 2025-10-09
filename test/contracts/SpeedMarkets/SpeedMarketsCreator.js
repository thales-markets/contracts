'use strict';

const { artifacts, contract } = require('hardhat');
const { assert } = require('../../utils/common');
const { toBytes32 } = require('../../../index');
const { expect } = require('chai');
const { fastForward, toUnit, currentTime } = require('../../utils')();
const { ZERO_ADDRESS, DEAD_ADDRESS } = require('../../utils/helpers');
const { getPendingSpeedParams, getPendingChainedSpeedParams } = require('../../utils/speedMarkets');
const { toBN } = require('web3-utils');

contract('SpeedMarketsAMMCreator', (accounts) => {
	const [owner, user, safeBox] = accounts;
	let exoticUSD;
	let creator, speedMarketsAMM, chainedSpeedMarketsAMM;
	let mockPyth, priceFeedUpdateData, fee, unverifiedReport;
	let now;
	let addressManager;

	const PAYOUT_MULTIPLIERS = [toUnit(1.7), toUnit(1.78), toUnit(1.82), toUnit(1.84), toUnit(1.9)];
	const PYTH_ETH_PRICE = 186342931000;
	const CHAINLINK_ETH_PRICE = toUnit(4168.89);

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
		const mockChainlinkVerifier = await MockChainlinkVerifier.new(ZERO_ADDRESS);
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
	});

	describe('Test creator of speed markets', () => {
		it('Should add speed markets to pending and create from pending', async () => {
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

			await creator.addPendingSpeedMarket(pendingSpeedParams, { from: user });

			let pendingSize = await creator.getPendingSpeedMarketsSize();
			assert.equal(pendingSize, 1, 'Should add 1 pending speed market!');

			await exoticUSD.approve(speedMarketsAMM.address, toUnit(100), { from: user });

			await creator.createFromPendingSpeedMarkets([priceFeedUpdateData], {
				value: fee,
				from: user,
			});

			pendingSize = await creator.getPendingSpeedMarketsSize();
			assert.equal(pendingSize, 0, 'Should remove 1 pending speed market!');
			const activeMarketsSize = (await speedMarketsAMM.activeMarkets(0, 10)).length;
			assert.equal(activeMarketsSize, 1, 'Should be created 1 speed market!');

			// ---------------- Add 2 pending speed markets ----------------

			await creator.addPendingSpeedMarket(pendingSpeedParams, { from: user });
			await creator.addPendingSpeedMarket(pendingSpeedParams, { from: user });

			pendingSize = await creator.getPendingSpeedMarketsSize();
			assert.equal(pendingSize, 2, 'Should add 2 pending speed markets!');

			await creator.createFromPendingSpeedMarkets([priceFeedUpdateData], {
				value: 2 * fee,
				from: user,
			});

			pendingSize = await creator.getPendingSpeedMarketsSize();
			assert.equal(pendingSize, 0, 'Should remove 2 pending speed market!');
			const additionalActiveMarketsSize =
				(await speedMarketsAMM.activeMarkets(0, 10)).length - activeMarketsSize;
			assert.equal(additionalActiveMarketsSize, 2, 'Should be created 2 speed markets!');

			// when no pending markets just return
			expect(creator.createFromPendingSpeedMarkets([], { from: user })).to.be.ok;
		});

		it('Should add speed markets to pending and skip creation as old market', async () => {
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

			const activeMarketsSizeBefore = (await speedMarketsAMM.activeMarkets(0, 10)).length;

			await exoticUSD.approve(speedMarketsAMM.address, toUnit(100), { from: user });

			await creator.addPendingSpeedMarket(pendingSpeedParams, { from: user });
			const maxDelayForCreation = Number(await creator.maxCreationDelay());

			await fastForward(maxDelayForCreation);

			await creator.createFromPendingSpeedMarkets([priceFeedUpdateData], {
				value: fee,
				from: user,
			});

			const pendingSize = await creator.getPendingSpeedMarketsSize();
			assert.equal(pendingSize, 0, 'Should remove one pending speed market!');
			const additionalActiveMarketsSize =
				(await speedMarketsAMM.activeMarkets(0, 10)).length - activeMarketsSizeBefore;
			assert.equal(additionalActiveMarketsSize, 0, 'Should not create speed market!');
		});

		it('Should check all validations', async () => {
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

			/*
			 * Check validations:
			 * 1. Empty price update data
			 * 2. Stale price
			 * 3. price exceeds slippage
			 */

			// create new pending market
			await exoticUSD.approve(speedMarketsAMM.address, toUnit(100), { from: user });
			let tx = await creator.addPendingSpeedMarket(pendingSpeedParams, { from: user });
			let requestId = tx.receipt.logs[0].args._requestId;

			// 1. Empty price update data
			console.log('1. Check empty price update data');
			await expect(
				creator.createFromPendingSpeedMarkets([], {
					value: fee,
					from: user,
				})
			).to.be.revertedWith('Empty price update data');

			// 2. Stale price
			console.log('2. Check stale price');
			let maxPriceDelay = 1; // 1s
			await speedMarketsAMM.setLimitParams(toUnit(5), toUnit(500), 300, 86400, maxPriceDelay, 60);
			tx = await creator.createFromPendingSpeedMarkets([priceFeedUpdateData], {
				value: fee,
				from: user,
			});
			let createdMarketAddress = await creator.requestIdToMarket(requestId);
			assert.equal(createdMarketAddress, DEAD_ADDRESS, 'Market should not be created');
			assert.equal(tx.receipt.logs[0].args._errorMessage, 'Stale price');

			// 3. price exceeds slippage
			console.log('3. Check price exceeds slippage');
			tx = await creator.addPendingSpeedMarket(pendingSpeedParams, { from: user });
			requestId = tx.receipt.logs[0].args._requestId;

			maxPriceDelay = 60;
			await speedMarketsAMM.setLimitParams(toUnit(5), toUnit(500), 300, 86400, maxPriceDelay, 60);

			await creator.setMaxCreationDelay(60); // 60s

			const currentPrice = Math.round(ETH_STRIKE_PRICE * (1 + STRIKE_PRICE_SLIPPAGE + 0.001)); // 0.1% higher than slippage
			const nowLocal = await currentTime();
			const priceFeedUpdateDataLocal = await mockPyth.createPriceFeedUpdateData(
				'0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace', // ETH pyth ID
				toBN(currentPrice * 1e8),
				74093100,
				-8,
				toBN(currentPrice * 1e8),
				74093100,
				nowLocal // publishTime
			);

			tx = await creator.createFromPendingSpeedMarkets([priceFeedUpdateDataLocal], {
				value: fee,
				from: user,
			});
			createdMarketAddress = await creator.requestIdToMarket(requestId);
			assert.equal(createdMarketAddress, DEAD_ADDRESS, 'Market should not be created');
			assert.equal(tx.receipt.logs[0].args._errorMessage, 'price exceeds slippage');
		});

		it('Should create speed market directly (no pending)', async () => {
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

			const nowLocal = await currentTime();
			const priceFeedUpdateDataLocal = await mockPyth.createPriceFeedUpdateData(
				'0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace', // ETH pyth ID
				PYTH_ETH_PRICE,
				74093100,
				-8,
				PYTH_ETH_PRICE,
				74093100,
				nowLocal // publishTime
			);

			await expect(
				creator.createSpeedMarket(pendingSpeedParams, [], {
					value: fee,
					from: user,
				})
			).to.be.revertedWith('Empty price update data');

			const activeSpeedMarketsSizeBefore = (await speedMarketsAMM.activeMarkets(0, 10)).length;

			await exoticUSD.approve(speedMarketsAMM.address, toUnit(100), { from: user });
			await creator.createSpeedMarket(pendingSpeedParams, [priceFeedUpdateDataLocal], {
				value: fee,
				from: user,
			});

			const additionalActiveSpeedMarketsSize =
				(await speedMarketsAMM.activeMarkets(0, 10)).length - activeSpeedMarketsSizeBefore;
			assert.equal(additionalActiveSpeedMarketsSize, 1, 'Should create 1 speed market!');
		});

		it('Should catch creation errors and not to create speed markets', async () => {
			const DELTA_TIME = 5 * 60; // 5 min
			const ETH_STRIKE_PRICE = 1856;
			const STRIKE_PRICE_SLIPPAGE = 0.02; // 2%
			const BUYIN_AMOUNT = 10;

			let pendingSpeedParams = getPendingSpeedParams(
				'ETH',
				DELTA_TIME,
				ETH_STRIKE_PRICE,
				STRIKE_PRICE_SLIPPAGE,
				BUYIN_AMOUNT
			);

			const pendingSizeBefore = Number(await creator.getPendingSpeedMarketsSize());
			await exoticUSD.approve(speedMarketsAMM.address, toUnit(0), { from: user });
			console.log('exoticUSD address', exoticUSD.address);
			await creator.addPendingSpeedMarket(pendingSpeedParams, { from: user });

			let pendingSize = Number(await creator.getPendingSpeedMarketsSize());
			assert.equal(pendingSize, pendingSizeBefore + 1, 'Should add 1 pending speed market!');

			const activeMarketsSizeBefore = (await speedMarketsAMM.activeMarkets(0, 10)).length;
			console.log('activeMarketsSizeBefore', activeMarketsSizeBefore);
			// no approval
			await creator.createFromPendingSpeedMarkets([priceFeedUpdateData], {
				value: fee,
				from: user,
			});
			console.log('activeMarketsSizeAfter', (await speedMarketsAMM.activeMarkets(0, 10)).length);
			pendingSize = await creator.getPendingSpeedMarketsSize();
			assert.equal(pendingSize, 0, 'Should remove 1 pending speed market!');
			let activeMarketsSize = (await speedMarketsAMM.activeMarkets(0, 10)).length;
			assert.equal(
				activeMarketsSize,
				activeMarketsSizeBefore,
				'Should not be created any new speed markets!'
			);

			await speedMarketsAMM.setAMMAddresses(ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS);
			await creator.addPendingSpeedMarket(pendingSpeedParams, { from: user });

			// Missing addresses for AddressManager, Utils and Mastercopy
			await creator.createFromPendingSpeedMarkets([priceFeedUpdateData], {
				value: fee,
				from: user,
			});

			pendingSize = await creator.getPendingSpeedMarketsSize();
			assert.equal(pendingSize, 0, 'Should remove 1 pending speed market!');
			activeMarketsSize = (await speedMarketsAMM.activeMarkets(0, 10)).length;
			assert.equal(
				activeMarketsSize,
				activeMarketsSizeBefore,
				'Should not be created any new speed markets!'
			);
		});
	});

	describe('Test creator of speed markets using Chainlink', () => {
		it('Should add speed markets to pending and create using Chainlink', async () => {
			await creator.setOracleSource(1); // 1 = Chainlink

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

			await creator.addPendingSpeedMarket(pendingSpeedParams, { from: user });

			let pendingSize = await creator.getPendingSpeedMarketsSize();
			assert.equal(pendingSize, 1, 'Should add 1 pending speed market!');

			await exoticUSD.approve(speedMarketsAMM.address, toUnit(100), { from: user });

			await creator.createFromPendingSpeedMarkets([unverifiedReport], { from: user });

			pendingSize = await creator.getPendingSpeedMarketsSize();
			assert.equal(pendingSize, 0, 'Should remove 1 pending speed market!');
			const activeMarketsSize = (await speedMarketsAMM.activeMarkets(0, 10)).length;
			assert.equal(activeMarketsSize, 1, 'Should be created 1 speed market!');
		});
	});

	describe('Test creator of Chained speed markets', () => {
		it('Should add chained speed markets to pending and create from pending', async () => {
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

			await creator.addPendingChainedSpeedMarket(pendingChainedSpeedParams, { from: user });

			let pendingSize = await creator.getPendingChainedSpeedMarketsSize();
			assert.equal(pendingSize, 1, 'Should add 1 pending chained speed market!');

			await exoticUSD.approve(chainedSpeedMarketsAMM.address, toUnit(100), { from: user });

			await creator.createFromPendingChainedSpeedMarkets([priceFeedUpdateData], {
				value: fee,
				from: user,
			});

			pendingSize = await creator.getPendingChainedSpeedMarketsSize();
			assert.equal(pendingSize, 0, 'Should remove 1 pending chained speed market!');
			const activeMarketsSize = (await chainedSpeedMarketsAMM.activeMarkets(0, 10)).length;
			assert.equal(activeMarketsSize, 1, 'Should be created 1 chained speed market!');

			// ---------------- Add 2 pending speed markets ----------------

			await creator.addPendingChainedSpeedMarket(pendingChainedSpeedParams, { from: user });
			await creator.addPendingChainedSpeedMarket(pendingChainedSpeedParams, { from: user });

			pendingSize = await creator.getPendingChainedSpeedMarketsSize();
			assert.equal(pendingSize, 2, 'Should add 2 pending chained speed markets!');

			await creator.createFromPendingChainedSpeedMarkets([priceFeedUpdateData], {
				value: fee,
				from: user,
			});

			pendingSize = await creator.getPendingChainedSpeedMarketsSize();
			assert.equal(pendingSize, 0, 'Should remove 2 pending chained speed market!');
			const additionalActiveMarketsSize =
				(await chainedSpeedMarketsAMM.activeMarkets(0, 10)).length - activeMarketsSize;
			assert.equal(additionalActiveMarketsSize, 2, 'Should be created 2 chained speed markets!');

			// when no pending markets just return
			expect(creator.createFromPendingChainedSpeedMarkets([], { from: user })).to.be.ok;
		});

		it('Should add chained speed markets to pending and skip creation as old market', async () => {
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

			const activeMarketsSizeBefore = (await chainedSpeedMarketsAMM.activeMarkets(0, 10)).length;

			await exoticUSD.approve(chainedSpeedMarketsAMM.address, toUnit(100), { from: user });

			await creator.addPendingChainedSpeedMarket(pendingChainedSpeedParams, { from: user });
			const maxDelayForCreation = Number(await creator.maxCreationDelay());

			await fastForward(maxDelayForCreation);

			await creator.createFromPendingChainedSpeedMarkets([priceFeedUpdateData], {
				value: fee,
				from: user,
			});

			const pendingSize = await creator.getPendingChainedSpeedMarketsSize();
			assert.equal(pendingSize, 0, 'Should remove one pending chained speed market!');
			const additionalActiveMarketsSize =
				(await chainedSpeedMarketsAMM.activeMarkets(0, 10)).length - activeMarketsSizeBefore;
			assert.equal(additionalActiveMarketsSize, 0, 'Should not create chained speed market!');
		});

		it('Should check all validations of chained creator', async () => {
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

			/*
			 * Check validations:
			 * 1. Empty price update data
			 * 2. Stale price
			 * 3. price exceeds slippage
			 */

			// create new pending market
			await exoticUSD.approve(chainedSpeedMarketsAMM.address, toUnit(100), { from: user });
			let tx = await creator.addPendingChainedSpeedMarket(pendingChainedSpeedParams, {
				from: user,
			});
			let requestId = tx.receipt.logs[0].args._requestId;

			// 1. Empty price update data
			console.log('1. Check empty price update data');
			await expect(
				creator.createFromPendingChainedSpeedMarkets([], {
					value: fee,
					from: user,
				})
			).to.be.revertedWith('Empty price update data');

			// 2. Stale price
			console.log('2. Check stale price');
			let maxPriceDelay = 1; // 1s
			await speedMarketsAMM.setLimitParams(toUnit(5), toUnit(500), 300, 86400, maxPriceDelay, 60);
			tx = await creator.createFromPendingChainedSpeedMarkets([priceFeedUpdateData], {
				value: fee,
				from: user,
			});
			let createdMarketAddress = await creator.requestIdToMarket(requestId);
			assert.equal(createdMarketAddress, DEAD_ADDRESS, 'Market should not be created');
			assert.equal(tx.receipt.logs[0].args._errorMessage, 'Stale price');

			// 3. price exceeds slippage
			console.log('3. Check price exceeds slippage');
			tx = await creator.addPendingChainedSpeedMarket(pendingChainedSpeedParams, {
				from: user,
			});
			requestId = tx.receipt.logs[0].args._requestId;

			maxPriceDelay = 60;
			await speedMarketsAMM.setLimitParams(toUnit(5), toUnit(500), 300, 86400, maxPriceDelay, 60);

			await creator.setMaxCreationDelay(60); // 60s

			const currentPrice = Math.round(ETH_STRIKE_PRICE * (1 + STRIKE_PRICE_SLIPPAGE + 0.001)); // 0.1% higher than slippage
			const nowLocal = await currentTime();
			const priceFeedUpdateDataLocal = await mockPyth.createPriceFeedUpdateData(
				'0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace', // ETH pyth ID
				toBN(currentPrice * 1e8),
				74093100,
				-8,
				toBN(currentPrice * 1e8),
				74093100,
				nowLocal // publishTime
			);

			tx = await creator.createFromPendingChainedSpeedMarkets([priceFeedUpdateDataLocal], {
				value: fee,
				from: user,
			});
			createdMarketAddress = await creator.requestIdToMarket(requestId);
			assert.equal(createdMarketAddress, DEAD_ADDRESS, 'Market should not be created');
			assert.equal(tx.receipt.logs[0].args._errorMessage, 'price exceeds slippage');
		});

		it('Should create chained speed market directly (no pending)', async () => {
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

			const nowLocal = await currentTime();
			const priceFeedUpdateDataLocal = await mockPyth.createPriceFeedUpdateData(
				'0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace', // ETH pyth ID
				PYTH_ETH_PRICE,
				74093100,
				-8,
				PYTH_ETH_PRICE,
				74093100,
				nowLocal // publishTime
			);

			await expect(
				creator.createChainedSpeedMarket(pendingChainedSpeedParams, [], {
					value: fee,
					from: user,
				})
			).to.be.revertedWith('Empty price update data');

			const activeSpeedMarketsSizeBefore = (await chainedSpeedMarketsAMM.activeMarkets(0, 10))
				.length;

			await exoticUSD.approve(chainedSpeedMarketsAMM.address, toUnit(100), { from: user });
			await creator.createChainedSpeedMarket(
				pendingChainedSpeedParams,
				[priceFeedUpdateDataLocal],
				{
					value: fee,
					from: user,
				}
			);

			const additionalActiveSpeedMarketsSize =
				(await chainedSpeedMarketsAMM.activeMarkets(0, 10)).length - activeSpeedMarketsSizeBefore;
			assert.equal(additionalActiveSpeedMarketsSize, 1, 'Should create 1 chained speed market!');
		});

		it('Should catch chained creation errors and not to create chained speed markets', async () => {
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

			const pendingSizeBefore = Number(await creator.getPendingChainedSpeedMarketsSize());

			await creator.addPendingChainedSpeedMarket(pendingChainedSpeedParams, { from: user });

			let pendingSize = Number(await creator.getPendingChainedSpeedMarketsSize());
			assert.equal(
				pendingSize,
				pendingSizeBefore + 1,
				'Should add 1 pending chained speed market!'
			);

			const activeMarketsSizeBefore = (await chainedSpeedMarketsAMM.activeMarkets(0, 10)).length;

			// no approval
			await creator.createFromPendingChainedSpeedMarkets([priceFeedUpdateData], {
				value: fee,
				from: user,
			});

			pendingSize = await creator.getPendingSpeedMarketsSize();
			assert.equal(pendingSize, 0, 'Should remove 1 pending chained speed market!');
			let activeMarketsSize = (await chainedSpeedMarketsAMM.activeMarkets(0, 10)).length;
			assert.equal(
				activeMarketsSize,
				activeMarketsSizeBefore,
				'Should not be created any new chained speed markets!'
			);

			await chainedSpeedMarketsAMM.setAddressManager(ZERO_ADDRESS);
			await creator.addPendingChainedSpeedMarket(pendingChainedSpeedParams, { from: user });

			// Missing address for AddressManager
			await creator.createFromPendingChainedSpeedMarkets([priceFeedUpdateData], {
				value: fee,
				from: user,
			});

			pendingSize = await creator.getPendingSpeedMarketsSize();
			assert.equal(pendingSize, 0, 'Should remove 1 pending chained speed market!');
			activeMarketsSize = (await chainedSpeedMarketsAMM.activeMarkets(0, 10)).length;
			assert.equal(
				activeMarketsSize,
				activeMarketsSizeBefore,
				'Should not be created any new chained speed markets!'
			);
		});
	});

	describe('Test creator of Chained speed markets using Chainlink', () => {
		it('Should add chained speed markets to pending and create using Chainlink', async () => {
			await creator.setOracleSource(1); // 1 = Chainlink

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

			await creator.addPendingChainedSpeedMarket(pendingChainedSpeedParams, { from: user });

			let pendingSize = await creator.getPendingChainedSpeedMarketsSize();
			assert.equal(pendingSize, 1, 'Should add 1 pending chained speed market!');

			await exoticUSD.approve(chainedSpeedMarketsAMM.address, toUnit(100), { from: user });

			await creator.createFromPendingChainedSpeedMarkets([unverifiedReport], {
				value: fee,
				from: user,
			});

			pendingSize = await creator.getPendingChainedSpeedMarketsSize();
			assert.equal(pendingSize, 0, 'Should remove 1 pending chained speed market!');
			const activeMarketsSize = (await chainedSpeedMarketsAMM.activeMarkets(0, 10)).length;
			assert.equal(activeMarketsSize, 1, 'Should be created 1 chained speed market!');
		});
	});

	describe('Test creator withdraw token', () => {
		it('Should withdraw tokens', async () => {
			await exoticUSD.transfer(creator.address, toUnit(10), { from: user });
			const balanceBefore = await exoticUSD.balanceOf(user);

			const amountToWithdraw = toUnit(10);

			await creator.transferAmount(user, exoticUSD.address, amountToWithdraw, { from: owner });

			const balanceAfter = await exoticUSD.balanceOf(user);
			assert.equal(
				(balanceAfter / 1e18).toFixed(0),
				(balanceBefore / 1e18 + amountToWithdraw / 1e18).toFixed(0),
				'Should add token amount to user balance!'
			);
		});
	});
});
