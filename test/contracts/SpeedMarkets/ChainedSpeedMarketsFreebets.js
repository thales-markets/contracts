'use strict';

const { artifacts, contract } = require('hardhat');
const { assert } = require('../../utils/common');
const { toBytes32 } = require('../../../index');
const { expect } = require('chai');
const { fastForward, toUnit, currentTime } = require('../../utils')();
const { ZERO_ADDRESS } = require('../../utils/helpers');
const { speedMarketsInit } = require('../../utils/init');
const {
	getCreateChainedSpeedAMMParams,
	getSkewImpact,
	getPendingChainedSpeedParams,
} = require('../../utils/speedMarkets');
const { toBN } = require('web3-utils');

const PAYOUT_MULTIPLIERS = [toUnit(1.7), toUnit(1.78), toUnit(1.82), toUnit(1.84), toUnit(1.9)];
const PYTH_ETH_PRICE = 186342931000;
const CHAINLINK_ETH_PRICE = toUnit(4168.89);
const oracleSource = {
	Pyth: 0,
	Chainlink: 1,
};

contract('ChainedSpeedMarketsFreebets', (accounts) => {
	const [owner, user, user2, safeBox, referrer] = accounts;

	describe('Chained Speed Markets Freebets Tests', () => {
		let mockFreeBetsHolder;
		let chainedSpeedMarketsAMM;
		let speedMarketsAMM;
		let speedMarketsAMMData;
		let speedMarketsAMMResolver;
		let speedMarketsAMMCreator;
		let exoticUSD;
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
			const initResult = await speedMarketsInit(accounts, true); // true for chained markets
			({
				chainedSpeedMarketsAMM,
				speedMarketsAMM,
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

			// Configure ChainedSpeedMarketsAMM (required for creating chained markets)
			const ChainedSpeedMarketMastercopy = artifacts.require('ChainedSpeedMarketMastercopy');
			const chainedSpeedMarketMastercopy = await ChainedSpeedMarketMastercopy.new();

			await chainedSpeedMarketsAMM.setSusdAddress(exoticUSD.address);
			await chainedSpeedMarketsAMM.setMastercopy(chainedSpeedMarketMastercopy.address);
			await chainedSpeedMarketsAMM.setAddressManager(addressManager.address);
			await chainedSpeedMarketsAMM.setLimitParams(
				600, // minTimeFrame
				86400, // maxTimeFrame (24 hours)
				2, // minChainedMarkets
				6, // maxChainedMarkets
				toUnit(5), // minBuyinAmount
				toUnit(200), // maxBuyinAmount
				toUnit(500), // maxProfitPerIndividualMarket
				toUnit(1100), // maxRisk
				PAYOUT_MULTIPLIERS
			);

			// Fund ChainedSpeedMarketsAMM (need to mint enough tokens)
			await exoticUSD.setDefaultAmount(toUnit(5000));
			await exoticUSD.mintForUser(owner);
			await exoticUSD.transfer(chainedSpeedMarketsAMM.address, toUnit(5000), { from: owner });
			await exoticUSD.setDefaultAmount(toUnit(100)); // Reset to default amount

			// Set ChainedSpeedMarketsAMM on resolver (required for chained market resolution)
			await speedMarketsAMMResolver.setChainedSpeedMarketsAMM(chainedSpeedMarketsAMM.address);

			// Deploy enhanced MockFreeBetsHolder
			const MockFreeBetsHolder = artifacts.require('MockFreeBetsHolder');
			mockFreeBetsHolder = await MockFreeBetsHolder.new(speedMarketsAMMCreator.address);

			// Update address manager with FreeBetsHolder
			await addressManager.setAddressInAddressBook('FreeBetsHolder', mockFreeBetsHolder.address);

			// Set AMM addresses in mock
			await mockFreeBetsHolder.setAMMAddresses(
				speedMarketsAMM.address,
				chainedSpeedMarketsAMM.address,
				speedMarketsAMMResolver.address
			);

			// Fund the mock contract with collateral
			await exoticUSD.transfer(mockFreeBetsHolder.address, toUnit(100), { from: owner });

			// Generate request IDs
			requestId1 = toBytes32('CHAIN_REQ001');
			requestId2 = toBytes32('CHAIN_REQ002');
		});

		describe('Chained Market Creation with Freebets', () => {
			const buyinAmount = toUnit(100);
			let strikeTime;
			let strikeTimes;

			beforeEach(async () => {
				// Set up strike times for chained markets
				strikeTime = now + 2 * 60 * 60; // 2 hours from now
				strikeTimes = [
					strikeTime,
					strikeTime + 60 * 60, // 1 hour after first
					strikeTime + 2 * 60 * 60, // 2 hours after first
				];

				// Allocate freebets
				await mockFreeBetsHolder.allocateFreebets(user, toUnit(500), requestId1);
			});

			it('should create chained market with freebets', async () => {
				const directions = [0, 1, 0]; // UP, DOWN, UP
				const STRIKE_PRICE = 1863; // Price in dollars
				const STRIKE_PRICE_SLIPPAGE = 0.02; // 2%
				const TIME_FRAME = 60 * 60; // 1 hour

				// Use getPendingChainedSpeedParams to create the parameters
				const pendingChainedParams = getPendingChainedSpeedParams(
					'ETH',
					TIME_FRAME,
					STRIKE_PRICE,
					STRIKE_PRICE_SLIPPAGE,
					buyinAmount / 1e18, // Convert from wei to units
					directions,
					exoticUSD.address,
					ZERO_ADDRESS // referrer
				);

				// Convert array to struct format expected by the contract
				const params = {
					asset: pendingChainedParams[0],
					timeFrame: pendingChainedParams[1],
					strikePrice: pendingChainedParams[2].toString(),
					strikePriceSlippage: pendingChainedParams[3].toString(),
					directions: pendingChainedParams[4],
					collateral: pendingChainedParams[5],
					buyinAmount: pendingChainedParams[6].toString(),
					referrer: pendingChainedParams[7],
				};

				// Whitelist if needed
				const isWhitelisted = await speedMarketsAMMCreator.whitelistedAddresses(
					mockFreeBetsHolder.address
				);
				if (!isWhitelisted) {
					await speedMarketsAMMCreator.addToWhitelist(mockFreeBetsHolder.address, true, {
						from: owner,
					});
				}

				// Create chained market through freebet holder
				const tx = await mockFreeBetsHolder.createChainedSpeedMarketWithFreebets(
					speedMarketsAMMCreator.address,
					params,
					requestId1,
					{ from: user }
				);

				// Get the creator request ID from event
				const pendingMarketEvent = tx.logs.find(
					(log) => log.event === 'PendingFreebetMarketCreated'
				);
				assert.exists(pendingMarketEvent, 'PendingFreebetMarketCreated event should be emitted');
				const creatorRequestId = pendingMarketEvent.args.creatorRequestId;

				// Verify freebet was used
				const freebetUsedEvent = tx.logs.find((log) => log.event === 'FreebetUsed');
				assert.exists(freebetUsedEvent, 'FreebetUsed event should be emitted');
				assert.equal(freebetUsedEvent.args.user, user);
				assert.equal(freebetUsedEvent.args.requestId, requestId1);
				assert.bnEqual(freebetUsedEvent.args.amount, buyinAmount);

				// Whitelist owner to create from pending markets
				await speedMarketsAMMCreator.addToWhitelist(user, true, { from: owner });

				// Process pending markets through creator
				await speedMarketsAMMCreator.createFromPendingChainedSpeedMarkets(
					oracleSource.Pyth,
					[priceFeedUpdateData],
					{
						value: fee,
						from: user,
					}
				);

				// Check remaining balance
				const remainingBalance = await mockFreeBetsHolder.getFreebetBalance(user, requestId1);
				assert.bnEqual(remainingBalance, toUnit(400));
			});

			it('should test partial freebet usage in chains', async () => {
				// Allocate smaller amount
				await mockFreeBetsHolder.allocateFreebets(user2, toUnit(50), requestId2);

				const directions = [0, 1]; // Two-step chain
				const STRIKE_PRICE = 1863;
				const STRIKE_PRICE_SLIPPAGE = 0.02;
				const TIME_FRAME = 60 * 60;

				const pendingChainedParams = getPendingChainedSpeedParams(
					'ETH',
					TIME_FRAME,
					STRIKE_PRICE,
					STRIKE_PRICE_SLIPPAGE,
					50, // Use all allocated freebets
					directions,
					exoticUSD.address,
					ZERO_ADDRESS
				);

				const params = {
					asset: pendingChainedParams[0],
					timeFrame: pendingChainedParams[1],
					strikePrice: pendingChainedParams[2].toString(),
					strikePriceSlippage: pendingChainedParams[3].toString(),
					directions: pendingChainedParams[4],
					collateral: pendingChainedParams[5],
					buyinAmount: pendingChainedParams[6].toString(),
					referrer: pendingChainedParams[7],
				};

				// Whitelist if needed
				const isWhitelisted = await speedMarketsAMMCreator.whitelistedAddresses(
					mockFreeBetsHolder.address
				);
				if (!isWhitelisted) {
					await speedMarketsAMMCreator.addToWhitelist(mockFreeBetsHolder.address, true, {
						from: owner,
					});
				}

				await mockFreeBetsHolder.createChainedSpeedMarketWithFreebets(
					speedMarketsAMMCreator.address,
					params,
					requestId2,
					{ from: user2 }
				);

				// Should have zero balance left
				const remainingBalance = await mockFreeBetsHolder.getFreebetBalance(user2, requestId2);
				assert.bnEqual(remainingBalance, toBN(0));
			});

			it('should verify freebet tracking across chain steps', async () => {
				const directions = [0, 1, 0];
				const STRIKE_PRICE = 1863;
				const STRIKE_PRICE_SLIPPAGE = 0.02;
				const TIME_FRAME = 60 * 60;

				const pendingChainedParams = getPendingChainedSpeedParams(
					'ETH',
					TIME_FRAME,
					STRIKE_PRICE,
					STRIKE_PRICE_SLIPPAGE,
					buyinAmount / 1e18,
					directions,
					exoticUSD.address,
					ZERO_ADDRESS
				);

				const params = {
					asset: pendingChainedParams[0],
					timeFrame: pendingChainedParams[1],
					strikePrice: pendingChainedParams[2].toString(),
					strikePriceSlippage: pendingChainedParams[3].toString(),
					directions: pendingChainedParams[4],
					collateral: pendingChainedParams[5],
					buyinAmount: pendingChainedParams[6].toString(),
					referrer: pendingChainedParams[7],
				};

				// Whitelist if needed
				const isWhitelisted = await speedMarketsAMMCreator.whitelistedAddresses(
					mockFreeBetsHolder.address
				);
				if (!isWhitelisted) {
					await speedMarketsAMMCreator.addToWhitelist(mockFreeBetsHolder.address, true, {
						from: owner,
					});
				}

				const tx = await mockFreeBetsHolder.createChainedSpeedMarketWithFreebets(
					speedMarketsAMMCreator.address,
					params,
					requestId1,
					{ from: user }
				);

				// Verify the pending market was created
				const pendingMarketEvent = tx.logs.find(
					(log) => log.event === 'PendingFreebetMarketCreated'
				);
				assert.exists(pendingMarketEvent, 'PendingFreebetMarketCreated event should be emitted');

				// Whitelist owner and process pending markets
				await speedMarketsAMMCreator.addToWhitelist(user, true, { from: owner });
				await speedMarketsAMMCreator.createFromPendingChainedSpeedMarkets(
					oracleSource.Pyth,
					[priceFeedUpdateData],
					{
						from: user,
						value: fee,
					}
				);

				// Simple verification that we can still use freebets after one market
				const remainingBalance = await mockFreeBetsHolder.getFreebetBalance(user, requestId1);
				assert.bnEqual(remainingBalance, toUnit(400)); // Started with 500, used 100
			});

			it('should revert with insufficient freebets for chain', async () => {
				const directions = [0, 1, 0, 1]; // 4-step chain
				const largeBuyinAmount = toUnit(600); // More than allocated
				const STRIKE_PRICE = 1863;
				const STRIKE_PRICE_SLIPPAGE = 0.02;
				const TIME_FRAME = 60 * 60;

				const pendingChainedParams = getPendingChainedSpeedParams(
					'ETH',
					TIME_FRAME,
					STRIKE_PRICE,
					STRIKE_PRICE_SLIPPAGE,
					largeBuyinAmount / 1e18,
					directions,
					exoticUSD.address,
					ZERO_ADDRESS
				);

				const params = {
					asset: pendingChainedParams[0],
					timeFrame: pendingChainedParams[1],
					strikePrice: pendingChainedParams[2].toString(),
					strikePriceSlippage: pendingChainedParams[3].toString(),
					directions: pendingChainedParams[4],
					collateral: pendingChainedParams[5],
					buyinAmount: pendingChainedParams[6].toString(),
					referrer: pendingChainedParams[7],
				};

				await expect(
					mockFreeBetsHolder.createChainedSpeedMarketWithFreebets(
						speedMarketsAMMCreator.address,
						params,
						requestId1,
						{
							from: user,
						}
					)
				).to.be.revertedWith('Insufficient freebet balance');
			});
		});

		describe('Chained Market Resolution with Freebets', () => {
			it('should resolve chained speed market with native collateral (covers lines 443, 498 in resolver and 404 in creator)', async () => {
				// Register exoticUSD as native collateral to hit the native collateral code path
				await speedMarketsAMM.setSupportedNativeCollateralAndBonus(
					exoticUSD.address,
					true,
					toUnit(0.02),
					toBytes32('ExoticUSD')
				);

				// Allocate freebets to user
				await mockFreeBetsHolder.allocateFreebets(user, toUnit(500), requestId1);

				const directions = [0, 1]; // UP, DOWN - two-step chain
				const STRIKE_PRICE = 1863;
				const STRIKE_PRICE_SLIPPAGE = 0.02;
				const TIME_FRAME = 60 * 60; // 1 hour

				const pendingChainedParams = getPendingChainedSpeedParams(
					'ETH',
					TIME_FRAME,
					STRIKE_PRICE,
					STRIKE_PRICE_SLIPPAGE,
					50, // 50 units buyin
					directions,
					exoticUSD.address,
					ZERO_ADDRESS
				);

				const params = {
					asset: pendingChainedParams[0],
					timeFrame: pendingChainedParams[1],
					strikePrice: pendingChainedParams[2].toString(),
					strikePriceSlippage: pendingChainedParams[3].toString(),
					directions: pendingChainedParams[4],
					collateral: pendingChainedParams[5],
					buyinAmount: pendingChainedParams[6].toString(),
					referrer: pendingChainedParams[7],
				};

				// Whitelist FreeBetsHolder
				await speedMarketsAMMCreator.addToWhitelist(mockFreeBetsHolder.address, true, {
					from: owner,
				});

				// Create chained market through freebet holder
				await mockFreeBetsHolder.createChainedSpeedMarketWithFreebets(
					speedMarketsAMMCreator.address,
					params,
					requestId1,
					{ from: user }
				);

				// Create fresh price feed data with current time to avoid stale price error
				const currentTimeNow = await currentTime();
				const freshPriceFeedUpdateData = await mockPyth.createPriceFeedUpdateData(
					pythId,
					PYTH_ETH_PRICE,
					74093100,
					-8,
					PYTH_ETH_PRICE,
					74093100,
					currentTimeNow
				);

				// Whitelist user and process pending chained markets
				// This covers line 404 in SpeedMarketsAMMCreator.sol (native collateral adjustment)
				await speedMarketsAMMCreator.addToWhitelist(user, true, { from: owner });
				await speedMarketsAMMCreator.createFromPendingChainedSpeedMarkets(
					oracleSource.Pyth,
					[freshPriceFeedUpdateData],
					{
						value: fee,
						from: user,
					}
				);

				// Verify native collateral is registered
				const isNativeCollateral = await speedMarketsAMM.supportedNativeCollateral(
					exoticUSD.address
				);
				assert.isTrue(isNativeCollateral, 'exoticUSD should be registered as native collateral');

				// Get the created chained market
				const activeChainedMarkets = await chainedSpeedMarketsAMM.activeMarkets(0, 10);
				assert.equal(activeChainedMarkets.length, 1, 'Should have 1 active chained market');
				const chainedMarketAddress = activeChainedMarkets[0];

				const ChainedSpeedMarket = artifacts.require('ChainedSpeedMarket');
				const chainedMarket = await ChainedSpeedMarket.at(chainedMarketAddress);

				// Fast forward past all strike times
				await fastForward(3 * 60 * 60); // 3 hours

				// Get strike times for resolution prices
				// For chained markets: initialStrikeTime is the first strike, then each subsequent is +timeFrame
				const initialStrikeTime = await chainedMarket.initialStrikeTime();
				const timeFrame = await chainedMarket.timeFrame();
				const strikeTime1 = initialStrikeTime;
				const strikeTime2 = toBN(initialStrikeTime.toString()).add(toBN(timeFrame.toString()));

				// Create resolution price data for each step
				// Step 1: UP direction wins if final price > strike price
				const RESOLVE_PRICE_1 = toBN(2100 * 1e8); // Higher than strike price (UP wins)
				const resolvePriceFeedUpdateData1 = await mockPyth.createPriceFeedUpdateData(
					pythId,
					RESOLVE_PRICE_1,
					74093100,
					-8,
					RESOLVE_PRICE_1,
					74093100,
					strikeTime1
				);

				// Step 2: DOWN direction wins if final price < previous final price
				const RESOLVE_PRICE_2 = toBN(2000 * 1e8); // Lower than previous (DOWN wins)
				const resolvePriceFeedUpdateData2 = await mockPyth.createPriceFeedUpdateData(
					pythId,
					RESOLVE_PRICE_2,
					74093100,
					-8,
					RESOLVE_PRICE_2,
					74093100,
					strikeTime2
				);

				// Verify market can be resolved
				const canResolve = await chainedSpeedMarketsAMM.canResolveMarket(chainedMarketAddress);
				assert.isTrue(canResolve, 'Market should be resolvable');

				// Calculate proper fee for all price updates
				const updateDataArray = [[resolvePriceFeedUpdateData1], [resolvePriceFeedUpdateData2]];
				const flattenedUpdateData = updateDataArray.flat();
				const resolveFee = await mockPyth.getUpdateFee(flattenedUpdateData);

				// Resolve chained market through resolver
				// This covers lines 443/498 in SpeedMarketsAMMResolver.sol (native collateral adjustment for chained markets)
				// Note: Each price feed update data needs to be wrapped in an array
				await speedMarketsAMMResolver.resolveChainedMarket(chainedMarketAddress, updateDataArray, {
					value: resolveFee,
				});

				// Verify market is resolved
				const resolvedMarkets = await chainedSpeedMarketsAMM.maturedMarkets(0, 10);
				assert.equal(resolvedMarkets.length, 1, 'Should have 1 resolved chained market');

				// Verify market was resolved successfully
				const isResolved = await chainedMarket.resolved();
				assert.isTrue(isResolved, 'Chained market should be resolved');
			});
		});

		describe('Complex Scenarios', () => {
			it('should handle multiple chains with same freebet allocation', async () => {
				// Allocate large freebet amount
				await mockFreeBetsHolder.allocateFreebets(user, toUnit(1000), requestId1);

				// Create first chain
				const params1 = createChainedMarketParams(
					'ETH',
					60 * 60,
					1863,
					0.02,
					[0, 1], // UP, DOWN
					200
				);

				// Whitelist if needed
				const isWhitelisted = await speedMarketsAMMCreator.whitelistedAddresses(
					mockFreeBetsHolder.address
				);
				if (!isWhitelisted) {
					await speedMarketsAMMCreator.addToWhitelist(mockFreeBetsHolder.address, true, {
						from: owner,
					});
				}

				await mockFreeBetsHolder.createChainedSpeedMarketWithFreebets(
					speedMarketsAMMCreator.address,
					params1,
					requestId1,
					{ from: user }
				);

				// Create second chain with same allocation
				const params2 = createChainedMarketParams(
					'BTC',
					60 * 60,
					30000,
					0.02,
					[1, 0], // DOWN, UP
					300
				);

				await mockFreeBetsHolder.createChainedSpeedMarketWithFreebets(
					speedMarketsAMMCreator.address,
					params2,
					requestId1,
					{ from: user }
				);

				// Check remaining balance
				const remainingBalance = await mockFreeBetsHolder.getFreebetBalance(user, requestId1);
				assert.bnEqual(remainingBalance, toUnit(500)); // 1000 - 200 - 300
			});

			it('should prevent creating chains when freebet expires mid-creation', async () => {
				// Allocate freebets with very short expiry
				await mockFreeBetsHolder.allocateFreebets(user, toUnit(200), requestId2);
				await mockFreeBetsHolder.setFreebetExpiry(user, requestId2, now + 30); // Expires in 30 seconds

				const params = createChainedMarketParams('ETH', 60 * 60, 1863, 0.02, [0, 1], 100);

				// Fast forward to expire the freebet
				await fastForward(31);

				await expect(
					mockFreeBetsHolder.createChainedSpeedMarketWithFreebets(
						speedMarketsAMMCreator.address,
						params,
						requestId2,
						{
							from: user,
						}
					)
				).to.be.revertedWith('Freebet expired');
			});

			it('should track freebets across different chain lengths', async () => {
				await mockFreeBetsHolder.allocateFreebets(user, toUnit(500), requestId1);

				// Whitelist if needed
				const isWhitelisted = await speedMarketsAMMCreator.whitelistedAddresses(
					mockFreeBetsHolder.address
				);
				if (!isWhitelisted) {
					await speedMarketsAMMCreator.addToWhitelist(mockFreeBetsHolder.address, true, {
						from: owner,
					});
				}

				// Create 2-step chain
				const params2Step = createChainedMarketParams('ETH', 60 * 60, 1863, 0.02, [0, 1], 100);

				const tx1 = await mockFreeBetsHolder.createChainedSpeedMarketWithFreebets(
					speedMarketsAMMCreator.address,
					params2Step,
					requestId1,
					{ from: user }
				);

				// Create 3-step chain
				const params3Step = createChainedMarketParams('BTC', 60 * 60, 30000, 0.02, [1, 0, 1], 150);

				const tx2 = await mockFreeBetsHolder.createChainedSpeedMarketWithFreebets(
					speedMarketsAMMCreator.address,
					params3Step,
					requestId1,
					{ from: user }
				);

				// Verify both markets are tracked
				const pendingMarket1 = tx1.logs.find((log) => log.event === 'PendingFreebetMarketCreated');
				const pendingMarket2 = tx2.logs.find((log) => log.event === 'PendingFreebetMarketCreated');

				assert.exists(pendingMarket1);
				assert.exists(pendingMarket2);

				// Check remaining balance
				const remainingBalance = await mockFreeBetsHolder.getFreebetBalance(user, requestId1);
				assert.bnEqual(remainingBalance, toUnit(250)); // 500 - 100 - 150
			});
		});

		// Helper function to create chained market params
		function createChainedMarketParams(
			asset,
			timeFrame,
			strikePrice,
			strikePriceSlippage,
			directions,
			buyinAmount
		) {
			const pendingChainedParams = getPendingChainedSpeedParams(
				asset,
				timeFrame,
				strikePrice,
				strikePriceSlippage,
				buyinAmount,
				directions,
				exoticUSD.address,
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
		}
	});
});
