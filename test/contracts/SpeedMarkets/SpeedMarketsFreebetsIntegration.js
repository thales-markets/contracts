'use strict';

const { artifacts, contract } = require('hardhat');
const { assert } = require('../../utils/common');
const { toBytes32 } = require('../../../index');
const { expect } = require('chai');
const { fastForward, toUnit, currentTime } = require('../../utils')();
const { ZERO_ADDRESS } = require('../../utils/helpers');
const { speedMarketsInit } = require('../../utils/init');
const { getPendingSpeedParams, getPendingChainedSpeedParams } = require('../../utils/speedMarkets');
const { toBN } = require('web3-utils');

contract('SpeedMarketsFreebetsIntegration', (accounts) => {
	const [owner, user, user2, safeBox, referrer, referrer2] = accounts;

	describe('Speed Markets Freebets Integration Tests', () => {
		let mockFreeBetsHolder;
		let speedMarketsAMM;
		let chainedSpeedMarketsAMM;
		let speedMarketsAMMData;
		let speedMarketsAMMResolver;
		let speedMarketsAMMCreator;
		let exoticUSD;
		let exoticOP;
		let mockPyth;
		let pythId;
		let priceFeedUpdateData;
		let fee;
		let now;
		let requestId1;
		let requestId2;
		let addressManager;

		beforeEach(async () => {
			// Initialize speed markets with chained support
			const initResult = await speedMarketsInit(accounts, true);
			({
				speedMarketsAMM,
				chainedSpeedMarketsAMM,
				speedMarketsAMMData,
				speedMarketsAMMResolver,
				exoticUSD,
				mockPyth,
				pythId,
				priceFeedUpdateData,
				fee,
				now,
				addressManager,
			} = initResult);

			// Get exoticOP from initResult (over)
			exoticOP = initResult.over;

			// Deploy the SpeedMarketsAMMCreator contract
			const Creator = artifacts.require('SpeedMarketsAMMCreator');
			speedMarketsAMMCreator = await Creator.new();
			await speedMarketsAMMCreator.initialize(owner, addressManager.address);
			await speedMarketsAMMCreator.setMaxCreationDelay(300); // 5 minutes

			// Update address manager with creator
			await addressManager.setAddressInAddressBook(
				'SpeedMarketsAMMCreator',
				speedMarketsAMMCreator.address
			);

			// Deploy enhanced MockFreeBetsHolder
			const MockFreeBetsHolder = artifacts.require('MockFreeBetsHolder');
			mockFreeBetsHolder = await MockFreeBetsHolder.new(speedMarketsAMMCreator.address);

			// Update address manager
			await addressManager.setAddressInAddressBook('FreeBetsHolder', mockFreeBetsHolder.address);

			// Set AMM addresses in mock
			await mockFreeBetsHolder.setAMMAddresses(
				speedMarketsAMM.address,
				chainedSpeedMarketsAMM.address
			);

			// Fund the mock contract with multiple collaterals
			await exoticUSD.transfer(mockFreeBetsHolder.address, toUnit(100), { from: owner });
			await exoticOP.transfer(mockFreeBetsHolder.address, toUnit(100), { from: owner });

			// Generate request IDs
			requestId1 = toBytes32('INT_REQ001');
			requestId2 = toBytes32('INT_REQ002');
		});

		// Helper function to create speed market params
		const createSpeedMarketParams = (
			strikePrice,
			buyinAmount,
			direction = 0,
			collateral = null
		) => {
			const DELTA_TIME = 60 * 60; // 1 hour
			const STRIKE_PRICE_SLIPPAGE = 0.02;

			const pendingSpeedParams = getPendingSpeedParams(
				'ETH', // Always use ETH since it's configured
				DELTA_TIME,
				strikePrice,
				STRIKE_PRICE_SLIPPAGE,
				buyinAmount / 1e18
			);

			return {
				asset: pendingSpeedParams[0],
				strikeTime: now + DELTA_TIME,
				delta: pendingSpeedParams[2],
				strikePrice: pendingSpeedParams[3].toString(),
				strikePriceSlippage: pendingSpeedParams[4].toString(),
				direction: direction,
				collateral: collateral || exoticUSD.address,
				buyinAmount: pendingSpeedParams[7].toString(),
				referrer: pendingSpeedParams[8],
				skewImpact: pendingSpeedParams[9],
			};
		};

		// Helper function to create chained market params
		const createChainedMarketParams = (
			timeFrame,
			strikePrice,
			strikePriceSlippage,
			directions,
			buyinAmount,
			collateral = null
		) => {
			const pendingChainedParams = getPendingChainedSpeedParams(
				'ETH', // Always use ETH
				timeFrame,
				strikePrice,
				strikePriceSlippage,
				buyinAmount / 1e18,
				directions,
				collateral || exoticUSD.address,
				ZERO_ADDRESS
			);

			return {
				asset: pendingChainedParams[0],
				timeFrame: pendingChainedParams[1],
				strikePrice: pendingChainedParams[2].toString(),
				strikePriceSlippage: pendingChainedParams[3].toString(),
				directions: pendingChainedParams[4],
				collateral: pendingChainedParams[5],
				buyinAmount: pendingChainedParams[6].toString(),
				referrer: pendingChainedParams[7],
			};
		};

		// Helper to ensure creator is whitelisted
		const ensureWhitelisted = async () => {
			const isWhitelisted = await speedMarketsAMMCreator.whitelistedAddresses(
				mockFreeBetsHolder.address
			);
			if (!isWhitelisted) {
				await speedMarketsAMMCreator.addToWhitelist(mockFreeBetsHolder.address, true, {
					from: owner,
				});
			}
			const isOwnerWhitelisted = await speedMarketsAMMCreator.whitelistedAddresses(owner);
			if (!isOwnerWhitelisted) {
				await speedMarketsAMMCreator.addToWhitelist(owner, true, { from: owner });
			}
		};

		describe('Basic Integration Tests', () => {
			it('should handle both speed and chained markets with same freebet allocation', async () => {
				// Allocate freebets
				await mockFreeBetsHolder.allocateFreebets(user, toUnit(50), requestId1);

				// Create speed market
				const speedParams = createSpeedMarketParams(1863, toUnit(10), 0);

				await ensureWhitelisted();
				await mockFreeBetsHolder.createSpeedMarketWithFreebets(
					speedMarketsAMMCreator.address,
					speedParams,
					requestId1,
					{ from: user }
				);

				// Create chained market
				const chainedParams = createChainedMarketParams(60 * 60, 1863, 0.02, [0, 1], toUnit(15));

				await mockFreeBetsHolder.createChainedSpeedMarketWithFreebets(
					speedMarketsAMMCreator.address,
					chainedParams,
					requestId1,
					{ from: user }
				);

				// Process both types of pending markets
				await speedMarketsAMMCreator.createFromPendingSpeedMarkets([priceFeedUpdateData], {
					from: owner,
					value: fee,
				});

				await speedMarketsAMMCreator.createFromPendingChainedSpeedMarkets([priceFeedUpdateData], {
					from: owner,
					value: fee,
				});

				// Check remaining balance
				const remainingBalance = await mockFreeBetsHolder.getFreebetBalance(user, requestId1);
				assert.bnEqual(remainingBalance, toUnit(25)); // 50 - 10 - 15
			});

			it('should track multiple users with different freebet allocations', async () => {
				// Allocate freebets to multiple users
				await mockFreeBetsHolder.allocateFreebets(user, toUnit(30), requestId1);
				await mockFreeBetsHolder.allocateFreebets(user2, toUnit(40), requestId2);

				await ensureWhitelisted();

				// User 1 creates speed market
				const speedParams1 = createSpeedMarketParams(1863, toUnit(10), 0);
				await mockFreeBetsHolder.createSpeedMarketWithFreebets(
					speedMarketsAMMCreator.address,
					speedParams1,
					requestId1,
					{ from: user }
				);

				// User 2 creates chained market
				const chainedParams2 = createChainedMarketParams(60 * 60, 1863, 0.02, [1, 0], toUnit(20));
				await mockFreeBetsHolder.createChainedSpeedMarketWithFreebets(
					speedMarketsAMMCreator.address,
					chainedParams2,
					requestId2,
					{ from: user2 }
				);

				// Process all pending markets
				await speedMarketsAMMCreator.createFromPendingSpeedMarkets([priceFeedUpdateData], {
					from: owner,
					value: fee,
				});

				await speedMarketsAMMCreator.createFromPendingChainedSpeedMarkets([priceFeedUpdateData], {
					from: owner,
					value: fee,
				});

				// Check remaining balances
				const balance1 = await mockFreeBetsHolder.getFreebetBalance(user, requestId1);
				const balance2 = await mockFreeBetsHolder.getFreebetBalance(user2, requestId2);

				assert.bnEqual(balance1, toUnit(20)); // 30 - 10
				assert.bnEqual(balance2, toUnit(20)); // 40 - 20
			});

			it('should handle freebets with different collaterals', async () => {
				// Allocate freebets
				await mockFreeBetsHolder.allocateFreebets(user, toUnit(50), requestId1);

				await ensureWhitelisted();

				// Create market with USD
				const paramsUSD = createSpeedMarketParams(1863, toUnit(10), 0, exoticUSD.address);
				await mockFreeBetsHolder.createSpeedMarketWithFreebets(
					speedMarketsAMMCreator.address,
					paramsUSD,
					requestId1,
					{ from: user }
				);

				// Create market with OP
				const paramsOP = createSpeedMarketParams(1863, toUnit(15), 1, exoticOP.address);
				await mockFreeBetsHolder.createSpeedMarketWithFreebets(
					speedMarketsAMMCreator.address,
					paramsOP,
					requestId1,
					{ from: user }
				);

				// Process pending markets
				await speedMarketsAMMCreator.createFromPendingSpeedMarkets([priceFeedUpdateData], {
					from: owner,
					value: fee,
				});

				// Verify freebet balance decreased correctly
				const remainingBalance = await mockFreeBetsHolder.getFreebetBalance(user, requestId1);
				assert.bnEqual(remainingBalance, toUnit(25)); // 50 - 10 - 15
			});

			it('should handle exact freebet usage', async () => {
				// Allocate exact amount
				await mockFreeBetsHolder.allocateFreebets(user, toUnit(25), requestId1);

				await ensureWhitelisted();

				// Create speed market with 10
				const speedParams = createSpeedMarketParams(1863, toUnit(10), 0);
				await mockFreeBetsHolder.createSpeedMarketWithFreebets(
					speedMarketsAMMCreator.address,
					speedParams,
					requestId1,
					{ from: user }
				);

				// Create chained market with remaining 15
				const chainedParams = createChainedMarketParams(60 * 60, 1863, 0.02, [1, 0], toUnit(15));
				await mockFreeBetsHolder.createChainedSpeedMarketWithFreebets(
					speedMarketsAMMCreator.address,
					chainedParams,
					requestId1,
					{ from: user }
				);

				// Process markets
				await speedMarketsAMMCreator.createFromPendingSpeedMarkets([priceFeedUpdateData], {
					from: owner,
					value: fee,
				});
				await speedMarketsAMMCreator.createFromPendingChainedSpeedMarkets([priceFeedUpdateData], {
					from: owner,
					value: fee,
				});

				// Should have zero balance
				const remainingBalance = await mockFreeBetsHolder.getFreebetBalance(user, requestId1);
				assert.bnEqual(remainingBalance, toBN(0));
			});

			it('should prevent market creation with no allocation', async () => {
				await ensureWhitelisted();

				const params = createSpeedMarketParams(1863, toUnit(10), 0);

				await expect(
					mockFreeBetsHolder.createSpeedMarketWithFreebets(
						speedMarketsAMMCreator.address,
						params,
						requestId1,
						{ from: user }
					)
				).to.be.revertedWith('No active freebet allocation');
			});

			it('should handle multiple allocations per user', async () => {
				// Allocate different amounts with different request IDs
				await mockFreeBetsHolder.allocateFreebets(user, toUnit(30), requestId1);
				await mockFreeBetsHolder.allocateFreebets(user, toUnit(20), requestId2);

				await ensureWhitelisted();

				// Use first allocation
				const params1 = createSpeedMarketParams(1863, toUnit(15), 0);
				await mockFreeBetsHolder.createSpeedMarketWithFreebets(
					speedMarketsAMMCreator.address,
					params1,
					requestId1,
					{ from: user }
				);

				// Use second allocation
				const params2 = createChainedMarketParams(60 * 60, 1863, 0.02, [0, 1], toUnit(10));
				await mockFreeBetsHolder.createChainedSpeedMarketWithFreebets(
					speedMarketsAMMCreator.address,
					params2,
					requestId2,
					{ from: user }
				);

				// Process markets
				await speedMarketsAMMCreator.createFromPendingSpeedMarkets([priceFeedUpdateData], {
					from: owner,
					value: fee,
				});
				await speedMarketsAMMCreator.createFromPendingChainedSpeedMarkets([priceFeedUpdateData], {
					from: owner,
					value: fee,
				});

				// Check both balances
				const balance1 = await mockFreeBetsHolder.getFreebetBalance(user, requestId1);
				const balance2 = await mockFreeBetsHolder.getFreebetBalance(user, requestId2);

				assert.bnEqual(balance1, toUnit(15)); // 30 - 15
				assert.bnEqual(balance2, toUnit(10)); // 20 - 10

				// Verify request IDs are tracked
				const userRequestIds = await mockFreeBetsHolder.getUserRequestIds(user);
				assert.equal(userRequestIds.length, 2);
			});

			it('should handle expired freebets', async () => {
				// Allocate freebets with custom expiry
				await mockFreeBetsHolder.allocateFreebets(user, toUnit(20), requestId1);

				await ensureWhitelisted();

				// Create speed market before expiry
				const speedParams = createSpeedMarketParams(1863, toUnit(5), 0);
				await mockFreeBetsHolder.createSpeedMarketWithFreebets(
					speedMarketsAMMCreator.address,
					speedParams,
					requestId1,
					{ from: user }
				);

				// Process the market to confirm it works
				await speedMarketsAMMCreator.createFromPendingSpeedMarkets([priceFeedUpdateData], {
					from: owner,
					value: fee,
				});

				// Verify balance reduced
				let balance = await mockFreeBetsHolder.getFreebetBalance(user, requestId1);
				assert.bnEqual(balance, toUnit(15)); // 20 - 5

				// Now set expiry to past
				await mockFreeBetsHolder.setFreebetExpiry(user, requestId1, now - 1);

				// Try to create another market after expiry
				const expiredParams = createSpeedMarketParams(1863, toUnit(10), 1);

				await expect(
					mockFreeBetsHolder.createSpeedMarketWithFreebets(
						speedMarketsAMMCreator.address,
						expiredParams,
						requestId1,
						{ from: user }
					)
				).to.be.revertedWith('Freebet expired');
			});

			it('should handle concurrent market creations', async () => {
				// Allocate freebets to multiple users
				await mockFreeBetsHolder.allocateFreebets(user, toUnit(50), requestId1);
				await mockFreeBetsHolder.allocateFreebets(user2, toUnit(50), requestId2);

				await ensureWhitelisted();

				// Create multiple markets
				const params1 = createSpeedMarketParams(1863, toUnit(10), 0);
				const params2 = createSpeedMarketParams(1863, toUnit(15), 1);
				const params3 = createChainedMarketParams(60 * 60, 1863, 0.02, [0, 1], toUnit(20));
				const params4 = createChainedMarketParams(60 * 60, 1863, 0.02, [1, 0], toUnit(15));

				// User 1 creates markets
				await mockFreeBetsHolder.createSpeedMarketWithFreebets(
					speedMarketsAMMCreator.address,
					params1,
					requestId1,
					{ from: user }
				);
				await mockFreeBetsHolder.createChainedSpeedMarketWithFreebets(
					speedMarketsAMMCreator.address,
					params3,
					requestId1,
					{ from: user }
				);

				// User 2 creates markets
				await mockFreeBetsHolder.createSpeedMarketWithFreebets(
					speedMarketsAMMCreator.address,
					params2,
					requestId2,
					{ from: user2 }
				);
				await mockFreeBetsHolder.createChainedSpeedMarketWithFreebets(
					speedMarketsAMMCreator.address,
					params4,
					requestId2,
					{ from: user2 }
				);

				// Process all pending markets
				await speedMarketsAMMCreator.createFromPendingSpeedMarkets([priceFeedUpdateData], {
					from: owner,
					value: fee,
				});
				await speedMarketsAMMCreator.createFromPendingChainedSpeedMarkets([priceFeedUpdateData], {
					from: owner,
					value: fee,
				});

				// Verify balances
				const balance1 = await mockFreeBetsHolder.getFreebetBalance(user, requestId1);
				const balance2 = await mockFreeBetsHolder.getFreebetBalance(user2, requestId2);

				assert.bnEqual(balance1, toUnit(20)); // 50 - 10 - 20
				assert.bnEqual(balance2, toUnit(20)); // 50 - 15 - 15
			});
		});
	});
});
