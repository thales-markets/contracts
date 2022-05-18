'use strict';

const { artifacts, contract, web3 } = require('hardhat');
const { toBN } = web3.utils;

const { assert } = require('../../utils/common');
const {
	fastForward,
	toUnit,
	currentTime
} = require('../../utils')();
const { toBytes32 } = require('../../../index');
const { setupContract, setupAllContracts } = require('../../utils/setup');

const {
	getEventByName,
	convertToDecimals,
} = require('../../utils/helpers');

const MockAggregator = artifacts.require('MockAggregatorV2V3');

let factory, manager, addressResolver;
let PositionalMarket,
	priceFeed,
	sUSDSynth,
	Synth,
	PositionalMarketMastercopy,
	PositionMastercopy;
let market, Position;
let aggregator_sAUD;

const ZERO_ADDRESS = '0x' + '0'.repeat(40);

contract('PositionalMarketManager', accounts => {
	const [initialCreator, managerOwner, minter, dummy, exerciser, secondCreator] = accounts;
	let creator, owner, minterSigner, exerciserSigner, dummySigner;

	const sUSDQty = toUnit(10000);

	const expiryDuration = toBN(26 * 7 * 24 * 60 * 60);
	const sAUDKey = toBytes32('sAUD');

	let timeToMaturity = 200;

	const createMarket = async (man, oracleKey, strikePrice, maturity, initialMint, creator) => {
		const tx = await man
			.connect(creator)
			.createMarket(
				oracleKey,
				strikePrice.toString(),
				maturity,
				initialMint.toString(),
				false,
				ZERO_ADDRESS
			);
		let receipt = await tx.wait();
		const marketEvent = receipt.events.find(
			event => event['event'] && event['event'] === 'MarketCreated'
		);
		return PositionalMarket.at(marketEvent.args.market);
	};

	before(async () => {
		PositionalMarket = artifacts.require('PositionalMarket');
	});

	before(async () => {
		Synth = artifacts.require('Synth');
	});

	before(async () => {
		Position = artifacts.require('Position');
	});

	before(async () => {
		({
			PositionalMarketManager: manager,
			PositionalMarketFactory: factory,
			PositionalMarketMastercopy: PositionalMarketMastercopy,
			PositionMastercopy: PositionMastercopy,
			AddressResolver: addressResolver,
			PriceFeed: priceFeed,
			SynthsUSD: sUSDSynth,
		} = await setupAllContracts({
			accounts,
			synths: ['sUSD'],
			contracts: [
				'PriceFeed',
				'PositionalMarketMastercopy',
				'PositionMastercopy',
				'PositionalMarketFactory',
				'PositionalMarketManager',
			],
		}));
		[creator, owner, minterSigner, dummySigner] = await ethers.getSigners();

		await manager.connect(creator).setPositionalMarketFactory(factory.address);
		await factory.connect(owner).setPositionalMarketManager(manager.address);
		await factory
			.connect(owner)
			.setPositionalMarketMastercopy(PositionalMarketMastercopy.address);
		await factory.connect(owner).setPositionMastercopy(PositionMastercopy.address);

		aggregator_sAUD = await MockAggregator.new({ from: managerOwner });
		aggregator_sAUD.setDecimals('8');
		const timestamp = await currentTime();

		await aggregator_sAUD.setLatestAnswer(convertToDecimals(100, 8), timestamp);

		await priceFeed.connect(owner).addAggregator(sAUDKey, aggregator_sAUD.address);

		await Promise.all([
			sUSDSynth.issue(initialCreator, sUSDQty),
			sUSDSynth.approve(manager.address, sUSDQty, { from: initialCreator }),
			sUSDSynth.issue(minter, sUSDQty),
			sUSDSynth.approve(manager.address, sUSDQty, { from: minter }),
			sUSDSynth.issue(dummy, sUSDQty),
			sUSDSynth.approve(manager.address, sUSDQty, { from: dummy }),
		]);
	});

	describe('Market tracking', () => {
		it('Multiple markets can exist simultaneously, and debt is tracked properly across them. [ @cov-skip ]', async () => {
			const newValue = toUnit(1);
			const tx = await manager.connect(creator).setCreatorCapitalRequirement(newValue.toString());

			const now = await currentTime();
			const markets = await Promise.all(
				[toUnit(1), toUnit(2), toUnit(3)].map(price =>
					createMarket(manager, sAUDKey, price, now + 200, toUnit(1), creator)
				)
			);

			let beforeDeposit = await manager.totalDeposited();
			assert.bnEqual(beforeDeposit, toUnit(3));
			await markets[0].mint(toUnit(2), { from: initialCreator });
			let afterDeposit = toUnit(5);

			assert.bnEqual(await manager.totalDeposited(), afterDeposit);

			await fastForward(expiryDuration + 1000);
			await aggregator_sAUD.setLatestAnswer(convertToDecimals(2, 8), await currentTime());

			await Promise.all(
				markets.map(m => {
					manager.resolveMarket(m.address);
				})
			);

			assert.bnEqual(await markets[0].result(), toBN(0));
			assert.bnEqual(await markets[1].result(), toBN(0));
			assert.bnEqual(await markets[2].result(), toBN(1));

			await manager.connect(creator).expireMarkets([markets[1].address]);

			assert.bnEqual(await manager.totalDeposited(), afterDeposit.sub(toUnit(1)));
			await manager.connect(creator).expireMarkets([markets[0].address]);
			await manager.connect(creator).expireMarkets([markets[2].address]);
		});

		it('Market resolution fails for unknown markets', async () => {
			await assert.revert(manager.resolveMarket(initialCreator), 'Not an active market');
		});

		it('Adding, resolving, and expiring markets properly updates market lists [ @cov-skip ]', async () => {
			const numMarkets = 8;
			assert.bnEqual(await manager.numActiveMarkets(), toBN(0));
			assert.equal((await manager.activeMarkets(0, 100)).length, 0);
			const now = await currentTime();
			const markets = await Promise.all(
				new Array(numMarkets)
					.fill(0)
					.map(() => createMarket(manager, sAUDKey, toUnit(1), now + 200, toUnit(1), creator))
			);
			assert.bnEqual(await manager.numMaturedMarkets(), toBN(0));
			assert.equal((await manager.maturedMarkets(0, 100)).length, 0);

			const evenMarkets = markets
				.filter((e, i) => i % 2 === 0)
				.map(m => m.address)
				.sort();
			const oddMarkets = markets
				.filter((e, i) => i % 2 !== 0)
				.map(m => m.address)
				.sort();

			const createdMarkets = markets.map(m => m.address).sort();

			let recordedMarkets = await manager.activeMarkets(0, 100);
			let recordedMarketsSorted = [...recordedMarkets].sort();
			assert.bnEqual(await manager.numActiveMarkets(), toBN(numMarkets));
			assert.equal(createdMarkets.length, recordedMarketsSorted.length);
			createdMarkets.forEach((p, i) => assert.equal(p, recordedMarketsSorted[i]));

			// Resolve all the even markets, ensuring they have been transferred.
			await fastForward(expiryDuration + 1000);
			await aggregator_sAUD.setLatestAnswer(convertToDecimals(2, 8), await currentTime());

			await Promise.all(evenMarkets.map(m => manager.resolveMarket(m)));

			assert.bnEqual(await manager.numActiveMarkets(), toBN(4));
			recordedMarkets = await manager.activeMarkets(0, 100);
			recordedMarketsSorted = [...recordedMarkets].sort();
			assert.equal(oddMarkets.length, recordedMarketsSorted.length);
			oddMarkets.forEach((p, i) => assert.equal(p, recordedMarketsSorted[i]));

			assert.bnEqual(await manager.numMaturedMarkets(), toBN(4));
			recordedMarkets = await manager.maturedMarkets(0, 100);
			recordedMarketsSorted = [...recordedMarkets].sort();
			assert.equal(evenMarkets.length, recordedMarkets.length);
			evenMarkets.forEach((p, i) => assert.equal(p, recordedMarkets[i]));

			// Destroy those markets
			await manager.connect(creator).expireMarkets(evenMarkets);

			// Mature the rest of the markets
			await Promise.all(oddMarkets.map(m => manager.resolveMarket(m)));
			let remainingMarkets = await manager.maturedMarkets(0, 100);
			let remainingMarketsSorted = [...remainingMarkets].sort();
			assert.bnEqual(await manager.numMaturedMarkets(), toBN(numMarkets / 2));
			oddMarkets.forEach((p, i) => assert.equal(p, remainingMarketsSorted[i]));

			// Can remove the last market
			const lastMarket = (await manager.maturedMarkets(numMarkets / 2 - 1, 1))[0];
			assert.isTrue(remainingMarkets.includes(lastMarket));
			await manager.connect(creator).expireMarkets([lastMarket]);
			remainingMarkets = await manager.maturedMarkets(0, 100);
			remainingMarketsSorted = [...remainingMarkets].sort();
			assert.bnEqual(await manager.numMaturedMarkets(), toBN(numMarkets / 2 - 1));
			assert.isFalse(remainingMarketsSorted.includes(lastMarket));

			// Destroy the remaining markets.
			await manager.connect(creator).expireMarkets(remainingMarketsSorted);
			assert.bnEqual(await manager.numActiveMarkets(), toBN(0));
			assert.equal((await manager.activeMarkets(0, 100)).length, 0);
			assert.bnEqual(await manager.numMaturedMarkets(), toBN(0));
			assert.equal((await manager.maturedMarkets(0, 100)).length, 0);
		});

		it('Pagination works properly [ @cov-skip ]', async () => {
			const numMarkets = 8;
			const now = await currentTime();
			const markets = [];
			const windowSize = 3;
			let ms;

			// Empty list
			for (let i = 0; i < numMarkets; i++) {
				ms = await manager.activeMarkets(i, 2);
				assert.equal(ms.length, 0);
			}

			for (let i = 1; i <= numMarkets; i++) {
				markets.push(
					await createMarket(manager, sAUDKey, toUnit(i), now + 100, toUnit(1), creator)
				);
			}

			// Single elements
			for (let i = 0; i < numMarkets; i++) {
				ms = await manager.activeMarkets(i, 1);
				assert.equal(ms.length, 1);
				const m = await PositionalMarket.at(ms[0]);
				assert.bnEqual((await m.oracleDetails()).strikePrice, toUnit(i + 1));
			}

			// shifting window
			for (let i = 0; i < numMarkets - windowSize; i++) {
				ms = await manager.activeMarkets(i, windowSize);
				assert.equal(ms.length, windowSize);

				for (let j = 0; j < windowSize; j++) {
					const m = await PositionalMarket.at(ms[j]);
					assert.bnEqual((await m.oracleDetails()).strikePrice, toUnit(i + j + 1));
				}
			}

			// entire list
			ms = await manager.activeMarkets(0, numMarkets);
			assert.equal(ms.length, numMarkets);
			for (let i = 0; i < numMarkets; i++) {
				const m = await PositionalMarket.at(ms[i]);
				assert.bnEqual((await m.oracleDetails()).strikePrice, toUnit(i + 1));
			}

			// Page extends past end of list
			ms = await manager.activeMarkets(numMarkets - windowSize, windowSize * 2);
			assert.equal(ms.length, windowSize);
			for (let i = numMarkets - windowSize; i < numMarkets; i++) {
				const j = i - (numMarkets - windowSize);
				const m = await PositionalMarket.at(ms[j]);
				assert.bnEqual((await m.oracleDetails()).strikePrice, toUnit(i + 1));
			}

			// zero page size
			for (let i = 0; i < numMarkets; i++) {
				ms = await manager.activeMarkets(i, 0);
				assert.equal(ms.length, 0);
			}

			// index past the end
			for (let i = 0; i < 3; i++) {
				ms = await manager.activeMarkets(numMarkets, i);
				assert.equal(ms.length, 0);
			}

			// Page size larger than entire list
			ms = await manager.activeMarkets(0, numMarkets * 2);
			assert.equal(ms.length, numMarkets);
			for (let i = 0; i < numMarkets; i++) {
				const m = await PositionalMarket.at(ms[i]);
				assert.bnEqual((await m.oracleDetails()).strikePrice, toUnit(i + 1));
			}
		});

		it('Only owner can expire markets', async () => {
			const now = await currentTime();
			const newMarket = await createMarket(
				manager,
				sAUDKey,
				toUnit(1),
				now + 100,
				toUnit(3),
				creator
			);
			await fastForward(expiryDuration.add(toBN(timeToMaturity + 10)));
			await manager.resolveMarket(newMarket.address);
			const REVERT = 'Only the contract owner may perform this action';
			await assert.revert(manager.connect(minterSigner).expireMarkets([newMarket.address]), REVERT);
		});
	});

	describe('Manager conducts all sUSD transfers', () => {
		it('Can not be called by non market address', async () => {
			await assert.revert(
				manager.transferSusdTo(initialCreator, exerciser, toUnit(1).toString()),
				'Market unknown'
			);
		});
	});

	describe('Deposit management', () => {
		it('Only active markets can modify the total deposits.', async () => {
			const now = await currentTime();
			await createMarket(manager, sAUDKey, toUnit(1), now + 100, toUnit(3), creator);

			await assert.revert(
				manager.connect(minterSigner).incrementTotalDeposited(toUnit(2).toString()),
				'Permitted only for active markets'
			);
			await assert.revert(
				manager.connect(minterSigner).decrementTotalDeposited(toUnit(2).toString()),
				'Permitted only for known markets'
			);
		});
		it('Creating and destroying a market affects total deposits properly.', async () => {
			const now = await currentTime();
			let depositBefore = await manager.totalDeposited();
			const newMarket = await createMarket(
				manager,
				sAUDKey,
				toUnit(1),
				now + 200,
				toUnit(5),
				creator
			);
			assert.bnEqual(await manager.totalDeposited(), depositBefore.add(toUnit(5).toString()));

			await fastForward(expiryDuration + 1000);
			await aggregator_sAUD.setLatestAnswer(convertToDecimals(5, 8), await currentTime());

			await manager.resolveMarket(newMarket.address);
			await manager.connect(creator).expireMarkets([newMarket.address]);

			assert.bnEqual(await manager.totalDeposited(), depositBefore);
		});
		it('Minting more reflects total deposit properly.', async () => {
			const now = await currentTime();
			let depositBefore = await manager.totalDeposited();
			const newMarket = await createMarket(
				manager,
				sAUDKey,
				toUnit(1),
				now + 200,
				toUnit(5),
				creator
			);
			assert.bnEqual(await manager.totalDeposited(), depositBefore.add(toUnit(5).toString()));

			await newMarket.mint(toUnit(2), { from: initialCreator });
			assert.bnEqual(await manager.totalDeposited(), depositBefore.add(toUnit(7).toString()));
		});
	});

	describe('Market migration', () => {
		let markets, newManager, newerManager, now;

		before(async () => {
			now = await currentTime();
			markets = [];

			for (const p of [1, 2, 3]) {
				markets.push(
					await createMarket(manager, sAUDKey, toUnit(p), now + 100, toUnit(1), creator)
				);
			}

			newManager = await setupContract({
				accounts,
				contract: 'PositionalMarketManager',
				args: [
					managerOwner,
					sUSDSynth.address,
					priceFeed.address,
					26 * 7 * 24 * 60 * 60, // expiry duration: 26 weeks (~ 6 months)
					365 * 24 * 60 * 60, // Max time to maturity: ~ 1 year
					toUnit('2'), // Capital requirement
				],
			});

			await addressResolver.importAddresses(
				[toBytes32('PositionalMarketManager')],
				[newManager.address],
				{
					from: accounts[1],
				}
			);

			await Promise.all(
				markets.map(m => sUSDSynth.approve(m.address, toUnit(1000), { from: minter }))
			);
			await sUSDSynth.approve(newManager.address, toUnit(1000), { from: minter });

			await newManager.connect(creator).setMigratingManager(manager.address);
		});
		it('Migrating manager can be set', async () => {
			await manager.connect(creator).setMigratingManager(initialCreator);
		});

		it("Can't migrate to self", async () => {
			await assert.revert(
				manager.connect(creator).migrateMarkets(manager.address, true, [markets[0].address]),
				"Can't migrate to self"
			);
		});

		it('Migrating manager can only be set by the manager owner', async () => {
			await assert.revert(
				manager.connect(minterSigner).setMigratingManager(initialCreator),
				'Only the contract owner may perform this action'
			);
		});

		it('Markets can be migrated between factories.', async () => {
			await manager.connect(creator).migrateMarkets(newManager.address, true, [markets[1].address]);

			const oldMarkets = await manager.activeMarkets(0, 100);
			assert.bnEqual(await manager.numActiveMarkets(), toBN(12));
			assert.equal(oldMarkets.length, 12);
			assert.equal(oldMarkets[10], markets[0].address);
			assert.equal(oldMarkets[11], markets[2].address);

			const newMarkets = await newManager.activeMarkets(0, 100);
			assert.bnEqual(await newManager.numActiveMarkets(), toBN(1));
			assert.equal(newMarkets.length, 1);
			assert.equal(newMarkets[0], markets[1].address);

			assert.equal(await markets[0].owner(), manager.address);
			assert.equal(await markets[2].owner(), manager.address);
			assert.equal(await markets[1].owner(), newManager.address);
		});

		it('Markets cannot be migrated between factories if the migrating manager unset', async () => {
			await newManager.connect(creator).setMigratingManager('0x' + '0'.repeat(40));
			await assert.revert(
				manager.connect(creator).migrateMarkets(newManager.address, true, [markets[0].address]),
				'Only permitted for migrating manager.'
			);
		});

		it('Markets can only be migrated by the owner.', async () => {
			await assert.revert(
				manager.connect(minterSigner).migrateMarkets(newManager.address, true, [markets[1].address]),
				'Only the contract owner may perform this action'
			);
		});

		it('An empty migration does nothing, as does migration from an empty manager', async () => {
			newerManager = await setupContract({
				accounts,
				contract: 'PositionalMarketManager',
				args: [
					managerOwner,
					sUSDSynth.address,
					priceFeed.address,
					26 * 7 * 24 * 60 * 60, // expiry duration: 26 weeks (~ 6 months)
					365 * 24 * 60 * 60, // Max time to maturity: ~ 1 year
					toUnit('2'), // Capital requirement
				],
			});
			await newerManager.connect(creator).setMigratingManager(newManager.address);
			await newManager.connect(creator).migrateMarkets(newerManager.address, true, []);
			assert.equal(await newerManager.numActiveMarkets(), 0);
		});

		it('Receiving an empty market list does nothing.', async () => {
			await newerManager.connect(creator).setMigratingManager(managerOwner);
			await newerManager.connect(owner).receiveMarkets(true, []);
			assert.bnEqual(await newerManager.numActiveMarkets(), 0);
		});

		it('Cannot receive duplicate markets.', async () => {
			await newerManager.connect(creator).setMigratingManager(manager.address);
			await manager.connect(creator).migrateMarkets(newerManager.address, true, [markets[0].address]);
			await newerManager.connect(creator).setMigratingManager(managerOwner);
			await assert.revert(
				newerManager.connect(owner).receiveMarkets(true, [markets[0].address]),
				'Market already known.'
			);
		});

		it('Markets can only be received from the migrating manager.', async () => {
			await assert.revert(
				manager.connect(minterSigner).receiveMarkets(true, [markets[1].address]),
				'Only permitted for migrating manager.'
			);
		});
	});

	describe('Whitelisted addresses', () => {
		it('Only owner can set whitelisted addresses', async () => {
			await assert.revert(
				manager.connect(minterSigner).setWhitelistedAddresses([dummy, exerciser, secondCreator]),
				'Only the contract owner may perform this action'
			);
		});

		it('Cannot enable whitelisted feature if whitelist addresses is empty', async () => {
			await assert.revert(
				manager.connect(creator).setWhitelistedAddresses([]),
				'Whitelisted addresses cannot be empty'
			);

			assert.equal(await manager.onlyWhitelistedAddressesCanCreateMarkets(), false);
		});

		it('Only whitelisted address can create markets', async () => {
			const now = await currentTime();

			await manager.connect(creator).setWhitelistedAddresses([dummy, exerciser, secondCreator]);

			await assert.revert(
				manager
					.connect(minterSigner)
					.createMarket(
						sAUDKey,
						toUnit(1).toString(),
						now + 100,
						toUnit(5).toString(),
						false,
						ZERO_ADDRESS
					),
				'Only whitelisted addresses can create markets'
			);
		});

		it('Can remove whitelisted address', async () => {
			const now = await currentTime();

			await manager.connect(creator).removeWhitelistedAddress(dummy);

			await assert.revert(
				manager
					.connect(dummySigner)
					.createMarket(
						sAUDKey,
						toUnit(1).toString(),
						now + 100,
						toUnit(5).toString(),
						false,
						ZERO_ADDRESS
					),
				'Only whitelisted addresses can create markets'
			);
		});

		it('Can add whitelisted address', async () => {
			const now = await currentTime();

			await manager.connect(creator).addWhitelistedAddress(initialCreator);

			const tx = await manager
				.connect(creator)
				.createMarket(
					sAUDKey,
					toUnit(1).toString(),
					now + 100,
					toUnit(5).toString(),
					false,
					ZERO_ADDRESS
				);
			let receipt = await tx.wait();
			assert.equal(receipt.events.length, 10);
		});

		it('Anyone can create market if whitelisted addresses feature is disabled', async () => {
			const now = await currentTime();
			await manager.connect(creator).disableWhitelistedAddresses();

			const tx = await manager
				.connect(minterSigner)
				.createMarket(
					sAUDKey,
					toUnit(1).toString(),
					now + 100,
					toUnit(5).toString(),
					false,
					ZERO_ADDRESS
				);
			let receipt = await tx.wait();
			assert.equal(receipt.events.length, 10);
		});
	});
});
