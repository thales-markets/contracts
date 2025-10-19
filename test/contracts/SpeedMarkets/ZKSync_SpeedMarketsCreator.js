'use strict';

const { artifacts, contract } = require('hardhat');
const { assert } = require('../../utils/common');
const { toBytes32 } = require('../../../index');
const { expect } = require('chai');
const { fastForward, toUnit, currentTime } = require('../../utils')();
const { ZERO_ADDRESS } = require('../../utils/helpers');
const { getPendingSpeedParamsZkSync } = require('../../utils/speedMarkets');
const { toBN } = require('web3-utils');

contract('SpeedMarketsCreator', (accounts) => {
	const [owner, user, safeBox] = accounts;
	let exoticUSD;
	let creator, speedMarkets;
	let mockPyth, priceFeedUpdateData, fee;
	let now;

	const PYTH_ETH_PRICE = 186342931000;

	beforeEach(async () => {
		// -------------------------- Speed Markets --------------------------
		let SpeedMarketsContract = artifacts.require('SpeedMarkets');
		speedMarkets = await SpeedMarketsContract.new();

		let ExoticUSD = artifacts.require('ExoticUSD');
		exoticUSD = await ExoticUSD.new();

		await exoticUSD.setDefaultAmount(toUnit(5000));

		await exoticUSD.mintForUser(owner);
		let balance = await exoticUSD.balanceOf(owner);
		console.log('Balance of owner is ' + balance / 1e18);

		await exoticUSD.transfer(speedMarkets.address, toUnit(100), { from: owner });

		await exoticUSD.mintForUser(user);
		balance = await exoticUSD.balanceOf(user);
		console.log('Balance of user is ' + balance / 1e18);

		await speedMarkets.initialize(owner, exoticUSD.address);

		await speedMarkets.setLimitParams(toUnit(5), toUnit(500), 300, 86400, 60, 60);
		await speedMarkets.setSupportedAsset(toBytes32('ETH'), true);
		await speedMarkets.setMaxRisks(toBytes32('ETH'), toUnit(1000), toUnit(500));
		await speedMarkets.setSafeBoxAndMaxSkewImpact(toUnit(0.02), toUnit(0.05), toUnit(0.02));
		await speedMarkets.setAssetToPythID(
			toBytes32('ETH'),
			'0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace'
		);
		await speedMarkets.setLPFeeParams(
			[5, 10, 15, 60],
			[toUnit(0.18), toUnit(0.13), toUnit(0.11), toUnit(0.1)],
			toUnit(0.1)
		);

		now = await currentTime();

		let MockPyth = artifacts.require('MockPythCustom');
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
		let addressManager = await AddressManagerContract.new();

		await addressManager.initialize(
			owner,
			safeBox,
			ZERO_ADDRESS,
			ZERO_ADDRESS,
			ZERO_ADDRESS,
			mockPyth.address,
			speedMarkets.address
		);

		await speedMarkets.setAMMAddresses(addressManager.address);

		// -------------------------- Creator of Speed Markets --------------------------
		const Creator = artifacts.require('SpeedMarketsCreator');
		creator = await Creator.new();

		await creator.initialize(owner, addressManager.address);
		await creator.setAddressManager(addressManager.address);
		await creator.setMaxCreationDelay(5); // 5s
		await creator.addToWhitelist(user, true);

		await addressManager.setAddressInAddressBook('SpeedMarketsCreator', creator.address);
	});

	describe('Test creator of speed markets', () => {
		it('Should add speed markets to pending and create from pending', async () => {
			const DELTA_TIME = 5 * 60; // 5 min
			const ETH_STRIKE_PRICE = 1856;
			const STRIKE_PRICE_SLIPPAGE = 0.02; // 2%
			const BUYIN_AMOUNT = 10;

			const pendingSpeedParams = getPendingSpeedParamsZkSync(
				'ETH',
				DELTA_TIME,
				ETH_STRIKE_PRICE,
				STRIKE_PRICE_SLIPPAGE,
				BUYIN_AMOUNT
			);

			await creator.addPendingSpeedMarket(pendingSpeedParams, { from: user });

			let pendingSize = await creator.getPendingSpeedMarketsSize();
			assert.equal(pendingSize, 1, 'Should add 1 pending speed market!');

			await exoticUSD.approve(speedMarkets.address, toUnit(100), { from: user });

			await creator.createFromPendingSpeedMarkets([priceFeedUpdateData], {
				value: fee,
				from: user,
			});

			pendingSize = await creator.getPendingSpeedMarketsSize();
			assert.equal(pendingSize, 0, 'Should remove 1 pending speed market!');
			const activeMarketsSize = (await speedMarkets.activeMarkets(0, 10)).length;
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
				(await speedMarkets.activeMarkets(0, 10)).length - activeMarketsSize;
			assert.equal(additionalActiveMarketsSize, 2, 'Should be created 2 speed markets!');

			// when no pending markets just return
			expect(creator.createFromPendingSpeedMarkets([], { from: user })).to.be.ok;
		});

		it('Should add speed markets to pending and skip creation as old market', async () => {
			const DELTA_TIME = 5 * 60; // 5 min
			const ETH_STRIKE_PRICE = 1856;
			const STRIKE_PRICE_SLIPPAGE = 0.02; // 2%
			const BUYIN_AMOUNT = 10;

			const pendingSpeedParams = getPendingSpeedParamsZkSync(
				'ETH',
				DELTA_TIME,
				ETH_STRIKE_PRICE,
				STRIKE_PRICE_SLIPPAGE,
				BUYIN_AMOUNT
			);

			const activeMarketsSizeBefore = (await speedMarkets.activeMarkets(0, 10)).length;

			await exoticUSD.approve(speedMarkets.address, toUnit(100), { from: user });

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
				(await speedMarkets.activeMarkets(0, 10)).length - activeMarketsSizeBefore;
			assert.equal(additionalActiveMarketsSize, 0, 'Should not create speed market!');
		});

		it('Should check all validations', async () => {
			const DELTA_TIME = 5 * 60; // 5 min
			const ETH_STRIKE_PRICE = 1856;
			const STRIKE_PRICE_SLIPPAGE = 0.02; // 2%
			const BUYIN_AMOUNT = 10;

			const pendingSpeedParams = getPendingSpeedParamsZkSync(
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
			 * 3. Pyth price exceeds slippage
			 */

			// create new pending market
			await exoticUSD.approve(speedMarkets.address, toUnit(100), { from: user });
			await creator.addPendingSpeedMarket(pendingSpeedParams, { from: user });

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
			await speedMarkets.setLimitParams(toUnit(5), toUnit(500), 300, 86400, maxPriceDelay, 60);
			await expect(
				creator.createFromPendingSpeedMarkets([priceFeedUpdateData], {
					value: fee,
					from: user,
				})
			).to.be.revertedWith('Stale price');

			// 3. Pyth price exceeds slippage
			console.log('3. Check pyth price exceeds slippage');
			maxPriceDelay = 60;
			await speedMarkets.setLimitParams(toUnit(5), toUnit(500), 300, 86400, maxPriceDelay, 60);

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

			await expect(
				creator.createFromPendingSpeedMarkets([priceFeedUpdateDataLocal], {
					value: fee,
					from: user,
				})
			).to.be.revertedWith('Pyth price exceeds slippage');
		});

		it('Should create speed market directly (no pending)', async () => {
			const DELTA_TIME = 5 * 60; // 5 min
			const ETH_STRIKE_PRICE = 1856;
			const STRIKE_PRICE_SLIPPAGE = 0.02; // 2%
			const BUYIN_AMOUNT = 10;

			const pendingSpeedParams = getPendingSpeedParamsZkSync(
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

			const activeSpeedMarketsSizeBefore = (await speedMarkets.activeMarkets(0, 10)).length;

			await exoticUSD.approve(speedMarkets.address, toUnit(100), { from: user });
			await creator.createSpeedMarket(pendingSpeedParams, [priceFeedUpdateDataLocal], {
				value: fee,
				from: user,
			});

			const additionalActiveSpeedMarketsSize =
				(await speedMarkets.activeMarkets(0, 10)).length - activeSpeedMarketsSizeBefore;
			assert.equal(additionalActiveSpeedMarketsSize, 1, 'Should create 1 speed market!');
		});

		it('Should catch creation errors and not to create speed markets', async () => {
			const DELTA_TIME = 5 * 60; // 5 min
			const ETH_STRIKE_PRICE = 1856;
			const STRIKE_PRICE_SLIPPAGE = 0.02; // 2%
			const BUYIN_AMOUNT = 10;

			let pendingSpeedParams = getPendingSpeedParamsZkSync(
				'ETH',
				DELTA_TIME,
				ETH_STRIKE_PRICE,
				STRIKE_PRICE_SLIPPAGE,
				BUYIN_AMOUNT
			);

			const pendingSizeBefore = Number(await creator.getPendingSpeedMarketsSize());

			await creator.addPendingSpeedMarket(pendingSpeedParams, { from: user });

			let pendingSize = Number(await creator.getPendingSpeedMarketsSize());
			assert.equal(pendingSize, pendingSizeBefore + 1, 'Should add 1 pending speed market!');

			const activeMarketsSizeBefore = (await speedMarkets.activeMarkets(0, 10)).length;

			// no approval
			await creator.createFromPendingSpeedMarkets([priceFeedUpdateData], {
				value: fee,
				from: user,
			});

			pendingSize = await creator.getPendingSpeedMarketsSize();
			assert.equal(pendingSize, 0, 'Should remove 1 pending speed market!');
			let activeMarketsSize = (await speedMarkets.activeMarkets(0, 10)).length;
			assert.equal(
				activeMarketsSize,
				activeMarketsSizeBefore,
				'Should not be created any new speed markets!'
			);

			await speedMarkets.setAMMAddresses(ZERO_ADDRESS);
			await creator.addPendingSpeedMarket(pendingSpeedParams, { from: user });

			// Missing address for AddressManager
			await creator.createFromPendingSpeedMarkets([priceFeedUpdateData], {
				value: fee,
				from: user,
			});

			pendingSize = await creator.getPendingSpeedMarketsSize();
			assert.equal(pendingSize, 0, 'Should remove 1 pending speed market!');
			activeMarketsSize = (await speedMarkets.activeMarkets(0, 10)).length;
			assert.equal(
				activeMarketsSize,
				activeMarketsSizeBefore,
				'Should not be created any new speed markets!'
			);
		});
	});
});
