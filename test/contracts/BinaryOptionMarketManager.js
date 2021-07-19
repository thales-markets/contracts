'use strict';

const { artifacts, contract, web3 } = require('hardhat');
const { toBN } = web3.utils;

const { assert, addSnapshotBeforeRestoreAfterEach } = require('./common');
const {
	fastForward,
	toUnit,
	currentTime,
	multiplyDecimalRound,
	divideDecimalRound,
} = require('../utils')();
const { toBytes32 } = require('../..');
const { setupContract, setupAllContracts } = require('./setup');

const {
	ensureOnlyExpectedMutativeFunctions,
	onlyGivenAddressCanInvoke,
	getEventByName,
	getDecodedLogs,
	decodedEventEqual,
} = require('./helpers');

let BinaryOptionMarketFactory, factory, BinaryOptionMarketManager, manager, addressResolver;
let BinaryOptionMarket,
	exchangeRates,
	oracle,
	sUSDSynth,
	binaryOptionMarketMastercopy,
	binaryOptionMastercopy;
let market, long, short, BinaryOption, Synth;

const ZERO_ADDRESS = '0x' + '0'.repeat(40);

const Phase = {
	Trading: toBN(0),
	Maturity: toBN(1),
	Expiry: toBN(2),
};

async function createMarketAndMintMore(
	sAUDKey,
	initialStrikePrice,
	now,
	initialCreator,
	timeToMaturityParam
) {
	const result = await manager.createMarket(
		sAUDKey,
		initialStrikePrice,
		now + timeToMaturityParam,
		toUnit(2),
		false,
		ZERO_ADDRESS,
		{
			from: initialCreator,
		}
	);
	market = await BinaryOptionMarket.at(
		getEventByName({ tx: result, name: 'MarketCreated' }).args.market
	);
	await market.mint(toUnit(1), {
		from: initialCreator,
	});
}

contract('BinaryOptionMarketManager', accounts => {
	const [initialCreator, managerOwner, minter, dummy, exerciser, secondCreator] = accounts;

	const sUSDQty = toUnit(10000);

	const capitalRequirement = toUnit(2);
	const skewLimit = toUnit(0.05);
	const maxOraclePriceAge = toBN(60 * 61);
	const expiryDuration = toBN(26 * 7 * 24 * 60 * 60);
	const maxTimeToMaturity = toBN(365 * 24 * 60 * 60);

	const initialStrikePrice = toUnit(100);

	const initialPoolFee = toUnit(0.005);
	const initialCreatorFee = toUnit(0.005);

	const initialFeeAddress = 0xfeefeefeefeefeefeefeefeefeefeefeefeefeef;

	const sAUDKey = toBytes32('sAUD');
	const iAUDKey = toBytes32('iAUD');

	let timeToMaturity = 200;
	let totalDepositedAfterFees;

	const Side = {
		Long: toBN(0),
		Short: toBN(1),
	};

	const createMarket = async (man, oracleKey, strikePrice, maturity, initialMint, creator) => {
		const tx = await man.createMarket(
			oracleKey,
			strikePrice,
			maturity,
			initialMint,
			false,
			ZERO_ADDRESS,
			{
				from: creator,
			}
		);
		return BinaryOptionMarket.at(getEventByName({ tx, name: 'MarketCreated' }).args.market);
	};

	before(async () => {
		BinaryOptionMarket = artifacts.require('BinaryOptionMarket');
	});

	before(async () => {
		Synth = artifacts.require('Synth');
	});

	before(async () => {
		BinaryOption = artifacts.require('BinaryOption');
	});

	before(async () => {
		({
			BinaryOptionMarketManager: manager,
			BinaryOptionMarketFactory: factory,
			BinaryOptionMarketMastercopy: binaryOptionMarketMastercopy,
			BinaryOptionMastercopy: binaryOptionMastercopy,
			AddressResolver: addressResolver,
			ExchangeRates: exchangeRates,
			SynthsUSD: sUSDSynth,
		} = await setupAllContracts({
			accounts,
			synths: ['sUSD'],
			contracts: [
				'FeePool',
				'ExchangeRates',
				'BinaryOptionMarketMastercopy',
				'BinaryOptionMastercopy',
				'BinaryOptionMarketFactory',
			],
		}));

		manager.setBinaryOptionsMarketFactory(factory.address, { from: managerOwner });

		factory.setBinaryOptionMarketManager(manager.address, { from: managerOwner });
		factory.setBinaryOptionMarketMastercopy(binaryOptionMarketMastercopy.address, {
			from: managerOwner,
		});
		factory.setBinaryOptionMastercopy(binaryOptionMastercopy.address, { from: managerOwner });

		oracle = await exchangeRates.oracle();

		await exchangeRates.updateRates([sAUDKey], [toUnit(5)], await currentTime(), {
			from: oracle,
		});

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
		it('Multiple markets can exist simultaneously, and debt is tracked properly across them.', async () => {
			const newValue = toUnit(1);
			const tx = await manager.setCreatorCapitalRequirement(newValue, { from: managerOwner });

			const now = await currentTime();
			const markets = await Promise.all(
				[toUnit(1), toUnit(2), toUnit(3)].map(price =>
					createMarket(manager, sAUDKey, price, now + 200, toUnit(1), initialCreator)
				)
			);

			let beforeDeposit = await manager.totalDeposited();
			assert.bnEqual(beforeDeposit, toUnit(3));
			await markets[0].mint(toUnit(2), { from: initialCreator });
			let afterDeposit = toUnit(2).add(beforeDeposit);

			assert.bnEqual(await manager.totalDeposited(), afterDeposit);

			await fastForward(expiryDuration + 1000);
			await exchangeRates.updateRates([sAUDKey], [toUnit(2)], await currentTime(), {
				from: oracle,
			});
			await Promise.all(
				markets.map(m => {
					manager.resolveMarket(m.address);
				})
			);

			assert.bnEqual(await markets[0].result(), toBN(0));
			assert.bnEqual(await markets[1].result(), toBN(0));
			assert.bnEqual(await markets[2].result(), toBN(1));

			const feesRemitted = multiplyDecimalRound(initialPoolFee.add(initialCreatorFee), toUnit(2));

			await manager.expireMarkets([markets[1].address], { from: managerOwner });

			assert.bnEqual(await manager.totalDeposited(), afterDeposit.sub(feesRemitted).sub(toUnit(1)));
			await manager.expireMarkets([markets[0].address], { from: managerOwner });
			await manager.expireMarkets([markets[2].address], { from: managerOwner });
		});

		it('Market resolution fails for unknown markets', async () => {
			await assert.revert(manager.resolveMarket(initialCreator), 'Not an active market');
		});

		it('Adding, resolving, and expiring markets properly updates market lists', async () => {
			const numMarkets = 8;
			assert.bnEqual(await manager.numActiveMarkets(), toBN(0));
			assert.equal((await manager.activeMarkets(0, 100)).length, 0);
			const now = await currentTime();
			const markets = await Promise.all(
				new Array(numMarkets)
					.fill(0)
					.map(() =>
						createMarket(manager, sAUDKey, toUnit(1), now + 200, toUnit(1), initialCreator)
					)
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
			await exchangeRates.updateRates([sAUDKey], [toUnit(2)], await currentTime(), {
				from: oracle,
			});
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
			await manager.expireMarkets(evenMarkets, { from: managerOwner });

			// Mature the rest of the markets
			await Promise.all(oddMarkets.map(m => manager.resolveMarket(m)));
			let remainingMarkets = await manager.maturedMarkets(0, 100);
			let remainingMarketsSorted = [...remainingMarkets].sort();
			assert.bnEqual(await manager.numMaturedMarkets(), toBN(numMarkets / 2));
			oddMarkets.forEach((p, i) => assert.equal(p, remainingMarketsSorted[i]));

			// Can remove the last market
			const lastMarket = (await manager.maturedMarkets(numMarkets / 2 - 1, 1))[0];
			assert.isTrue(remainingMarkets.includes(lastMarket));
			await manager.expireMarkets([lastMarket], { from: managerOwner });
			remainingMarkets = await manager.maturedMarkets(0, 100);
			remainingMarketsSorted = [...remainingMarkets].sort();
			assert.bnEqual(await manager.numMaturedMarkets(), toBN(numMarkets / 2 - 1));
			assert.isFalse(remainingMarketsSorted.includes(lastMarket));

			// Destroy the remaining markets.
			await manager.expireMarkets(remainingMarketsSorted, { from: managerOwner });
			assert.bnEqual(await manager.numActiveMarkets(), toBN(0));
			assert.equal((await manager.activeMarkets(0, 100)).length, 0);
			assert.bnEqual(await manager.numMaturedMarkets(), toBN(0));
			assert.equal((await manager.maturedMarkets(0, 100)).length, 0);
		});

		it('Pagination works properly', async () => {
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
					await createMarket(manager, sAUDKey, toUnit(i), now + 100, toUnit(1), initialCreator)
				);
			}

			// Single elements
			for (let i = 0; i < numMarkets; i++) {
				ms = await manager.activeMarkets(i, 1);
				assert.equal(ms.length, 1);
				const m = await BinaryOptionMarket.at(ms[0]);
				assert.bnEqual((await m.oracleDetails()).strikePrice, toUnit(i + 1));
			}

			// shifting window
			for (let i = 0; i < numMarkets - windowSize; i++) {
				ms = await manager.activeMarkets(i, windowSize);
				assert.equal(ms.length, windowSize);

				for (let j = 0; j < windowSize; j++) {
					const m = await BinaryOptionMarket.at(ms[j]);
					assert.bnEqual((await m.oracleDetails()).strikePrice, toUnit(i + j + 1));
				}
			}

			// entire list
			ms = await manager.activeMarkets(0, numMarkets);
			assert.equal(ms.length, numMarkets);
			for (let i = 0; i < numMarkets; i++) {
				const m = await BinaryOptionMarket.at(ms[i]);
				assert.bnEqual((await m.oracleDetails()).strikePrice, toUnit(i + 1));
			}

			// Page extends past end of list
			ms = await manager.activeMarkets(numMarkets - windowSize, windowSize * 2);
			assert.equal(ms.length, windowSize);
			for (let i = numMarkets - windowSize; i < numMarkets; i++) {
				const j = i - (numMarkets - windowSize);
				const m = await BinaryOptionMarket.at(ms[j]);
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
				const m = await BinaryOptionMarket.at(ms[i]);
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
				initialCreator
			);
			await fastForward(expiryDuration.add(toBN(timeToMaturity + 10)));
			await manager.resolveMarket(newMarket.address);
			await onlyGivenAddressCanInvoke({
				fnc: manager.expireMarkets,
				args: [[newMarket.address]],
				address: managerOwner,
				accounts,
				skipPassCheck: true,
				reason: 'Only the contract owner may perform this action',
			});
		});
	});

	describe('Manager conducts all sUSD transfers', () => {
		it('Can not be called by non market address', async () => {
			await assert.revert(
				manager.transferSusdTo(initialCreator, exerciser, toUnit(1)),
				'Market unknown'
			);
		});
	});

	describe('Deposit management', () => {
		it('Only active markets can modify the total deposits.', async () => {
			const now = await currentTime();
			await createMarket(manager, sAUDKey, toUnit(1), now + 100, toUnit(3), initialCreator);

			await onlyGivenAddressCanInvoke({
				fnc: manager.incrementTotalDeposited,
				args: [toUnit(2)],
				accounts,
				reason: 'Permitted only for active markets',
			});
			await onlyGivenAddressCanInvoke({
				fnc: manager.decrementTotalDeposited,
				args: [toUnit(2)],
				accounts,
				reason: 'Permitted only for known markets',
			});
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
				initialCreator
			);
			assert.bnEqual(await manager.totalDeposited(), depositBefore.add(toUnit(5)));

			await fastForward(expiryDuration + 1000);
			await exchangeRates.updateRates([sAUDKey], [toUnit(5)], await currentTime(), {
				from: oracle,
			});
			await manager.resolveMarket(newMarket.address);
			await manager.expireMarkets([newMarket.address], { from: managerOwner });

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
				initialCreator
			);
			assert.bnEqual(await manager.totalDeposited(), depositBefore.add(toUnit(5)));

			await newMarket.mint(toUnit(2), { from: initialCreator });
			assert.bnEqual(await manager.totalDeposited(), depositBefore.add(toUnit(7)));
		});
	});

	describe('Market migration', () => {
		let markets, newManager, newerManager, now;

		before(async () => {
			now = await currentTime();
			markets = [];

			for (const p of [1, 2, 3]) {
				markets.push(
					await createMarket(manager, sAUDKey, toUnit(p), now + 100, toUnit(1), initialCreator)
				);
			}

			newManager = await setupContract({
				accounts,
				contract: 'BinaryOptionMarketManager',
				args: [
					managerOwner,
					addressResolver.address,
					61 * 60, // max oracle price age: 61 minutes
					26 * 7 * 24 * 60 * 60, // expiry duration: 26 weeks (~ 6 months)
					365 * 24 * 60 * 60, // Max time to maturity: ~ 1 year
					toUnit('2'), // Capital requirement
					toUnit('0.005'), // pool fee
					toUnit('0.005'), // creator fee
					'0xfeEFEEfeefEeFeefEEFEEfEeFeefEEFeeFEEFEeF',
				],
			});

			await addressResolver.importAddresses(
				[toBytes32('BinaryOptionMarketManager')],
				[newManager.address],
				{
					from: accounts[1],
				}
			);

			await Promise.all(
				markets.map(m => sUSDSynth.approve(m.address, toUnit(1000), { from: minter }))
			);
			await sUSDSynth.approve(newManager.address, toUnit(1000), { from: minter });

			await newManager.setMigratingManager(manager.address, { from: managerOwner });
		});
		it('Migrating manager can be set', async () => {
			await manager.setMigratingManager(initialCreator, { from: managerOwner });
		});

		it("Can't migrate to self", async () => {
			await assert.revert(
				manager.migrateMarkets(manager.address, true, [markets[0].address], {
					from: managerOwner,
				}),
				"Can't migrate to self"
			);
		});

		it('Migrating manager can only be set by the manager owner', async () => {
			await onlyGivenAddressCanInvoke({
				fnc: manager.setMigratingManager,
				args: [initialCreator],
				accounts,
				address: managerOwner,
				reason: 'Only the contract owner may perform this action',
			});
		});

		it('Markets can be migrated between factories.', async () => {
			await manager.migrateMarkets(newManager.address, true, [markets[1].address], {
				from: managerOwner,
			});

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
			await newManager.setMigratingManager('0x' + '0'.repeat(40), { from: managerOwner });
			await assert.revert(
				manager.migrateMarkets(newManager.address, true, [markets[0].address], {
					from: managerOwner,
				}),
				'Only permitted for migrating manager.'
			);
		});

		it('Markets can only be migrated by the owner.', async () => {
			onlyGivenAddressCanInvoke({
				fnc: manager.migrateMarkets,
				args: [newManager.address, true, [markets[1].address]],
				accounts,
				address: managerOwner,
				skipPassCheck: true,
				reason: 'Only the contract owner may perform this action',
			});
		});

		it('An empty migration does nothing, as does migration from an empty manager', async () => {
			newerManager = await setupContract({
				accounts,
				contract: 'BinaryOptionMarketManager',
				args: [
					managerOwner,
					addressResolver.address,
					61 * 60, // max oracle price age: 61 minutes
					26 * 7 * 24 * 60 * 60, // expiry duration: 26 weeks (~ 6 months)
					365 * 24 * 60 * 60, // Max time to maturity: ~ 1 year
					toUnit('2'), // Capital requirement
					toUnit('0.005'), // pool fee
					toUnit('0.005'), // creator fee
					'0xfeEFEEfeefEeFeefEEFEEfEeFeefEEFeeFEEFEeF',
				],
			});
			await newerManager.setMigratingManager(newManager.address, { from: managerOwner });
			await newManager.migrateMarkets(newerManager.address, true, [], { from: managerOwner });
			assert.equal(await newerManager.numActiveMarkets(), 0);
		});

		it('Receiving an empty market list does nothing.', async () => {
			await newerManager.setMigratingManager(managerOwner, { from: managerOwner });
			await newerManager.receiveMarkets(true, [], { from: managerOwner });
			assert.bnEqual(await newerManager.numActiveMarkets(), 0);
		});

		it('Cannot receive duplicate markets.', async () => {
			await newerManager.setMigratingManager(manager.address, { from: managerOwner });
			await manager.migrateMarkets(newerManager.address, true, [markets[0].address], {
				from: managerOwner,
			});
			await newerManager.setMigratingManager(managerOwner, { from: managerOwner });
			await assert.revert(
				newerManager.receiveMarkets(true, [markets[0].address], { from: managerOwner }),
				'Market already known.'
			);
		});

		it('Markets can only be received from the migrating manager.', async () => {
			onlyGivenAddressCanInvoke({
				fnc: manager.receiveMarkets,
				args: [true, [markets[1].address]],
				accounts,
				address: managerOwner,
				skipPassCheck: true,
				reason: 'Only permitted for migrating manager.',
			});
		});
	});
});
