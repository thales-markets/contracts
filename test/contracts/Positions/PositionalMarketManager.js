'use strict';

const { artifacts, contract, web3 } = require('hardhat');
const { toBN } = web3.utils;

const { assert } = require('../../utils/common');
const { fastForward, toUnit, currentTime } = require('../../utils')();
const { toBytes32 } = require('../../../index');
const { setupContract, setupAllContracts } = require('../../utils/setup');

const { getEventByName, convertToDecimals } = require('../../utils/helpers');
const { toWei } = require('web3-utils');

const MockAggregator = artifacts.require('MockAggregatorV2V3');

let factory, manager, addressResolver;
let PositionalMarket,
	priceFeed,
	sUSDSynth,
	Synth,
	PositionalMarketMastercopy,
	PositionMastercopy,
	thalesAMM;
let market, Position;
let aggregator_sAUD;

const ZERO_ADDRESS = '0x' + '0'.repeat(40);
const DAY = 24 * 60 * 60;
const WEEK = 7 * DAY;

contract('PositionalMarketManager', (accounts) => {
	const [initialCreator, managerOwner, minter, dummy, exerciser, secondCreator] = accounts;
	let creator, owner, minterSigner, exerciserSigner, dummySigner;

	const sUSDQty = toUnit(10000);

	const expiryDuration = toBN(26 * 7 * 24 * 60 * 60);
	const sAUDKey = toBytes32('sAUD');
	const ETHKey = toBytes32('ETH');

	let timeToMaturity = 200;

	const createMarket = async (man, oracleKey, strikePrice, maturity, initialMint, creator) => {
		const tx = await man
			.connect(creator)
			.createMarket(oracleKey, strikePrice.toString(), maturity, initialMint.toString());
		let receipt = await tx.wait();
		const marketEvent = receipt.events.find(
			(event) => event['event'] && event['event'] === 'MarketCreated'
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
		await manager.connect(creator).setTimeframeBuffer(1);
		await manager.connect(creator).setPriceBuffer(toUnit(0.05).toString());
		await factory.connect(owner).setPositionalMarketManager(manager.address);
		await factory.connect(owner).setPositionalMarketMastercopy(PositionalMarketMastercopy.address);
		await factory.connect(owner).setPositionMastercopy(PositionMastercopy.address);

		await manager.connect(creator).setMaxTimeToMaturity(30 * DAY);

		const hour = 60 * 60;
		let ThalesAMM = artifacts.require('ThalesAMM');
		thalesAMM = await ThalesAMM.new();
		await thalesAMM.initialize(
			owner.address,
			priceFeed.address,
			sUSDSynth.address,
			toUnit(1000),
			owner.address, //placeholder
			toUnit(0.01),
			toUnit(0.05),
			hour * 2
		);

		await factory.connect(owner).setThalesAMM(thalesAMM.address);

		aggregator_sAUD = await MockAggregator.new({ from: managerOwner });
		aggregator_sAUD.setDecimals('8');
		const timestamp = await currentTime();

		await aggregator_sAUD.setLatestAnswer(convertToDecimals(100, 8), timestamp);

		await priceFeed.connect(owner).addAggregator(sAUDKey, aggregator_sAUD.address);
		await priceFeed.connect(owner).addAggregator(ETHKey, aggregator_sAUD.address);

		await thalesAMM.setImpliedVolatilityPerAsset(ETHKey, toUnit(134), { from: owner.address });
		await thalesAMM.setImpliedVolatilityPerAsset(sAUDKey, toUnit(120), { from: owner.address });

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
		it('Multiple markets can exist simultaneously, and debt is tracked properly across them. ', async () => {
			const now = await currentTime();
			await manager.setMarketCreationParameters(now - WEEK + 200, now - 3 * DAY + 200);
			let price = (await priceFeed.rateForCurrency(sAUDKey)) / 1e18;
			let strikePriceStep = (await manager.getStrikePriceStep(sAUDKey)) / 1e18;

			const markets = await Promise.all(
				[
					toUnit(price + strikePriceStep),
					toUnit(price - strikePriceStep),
					toUnit(price + 2 * strikePriceStep),
				].map((price) => createMarket(manager, sAUDKey, price, now + 200, toUnit(1), creator))
			);

			let beforeDeposit = await manager.totalDeposited();
			assert.bnEqual(beforeDeposit, toUnit(3));
			await markets[0].mint(toUnit(2), { from: initialCreator });
			let afterDeposit = toUnit(5);

			assert.bnEqual(await manager.totalDeposited(), afterDeposit);

			await fastForward(expiryDuration + 1000);
			await aggregator_sAUD.setLatestAnswer(convertToDecimals(price, 8), await currentTime());

			await Promise.all(
				markets.map((m) => {
					manager.resolveMarket(m.address);
				})
			);

			assert.bnEqual(await markets[0].result(), toBN(1));
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

		it('Adding, resolving, and expiring markets properly updates market lists ', async () => {
			const numMarkets = 8;
			const markets = [];
			assert.bnEqual(await manager.numActiveMarkets(), toBN(0));
			assert.equal((await manager.activeMarkets(0, 100)).length, 0);
			const now = await currentTime();

			await manager.setMarketCreationParameters(now - WEEK + 200, now - 3 * DAY + 200);
			let price = (await priceFeed.rateForCurrency(sAUDKey)) / 1e18;
			let strikePriceStep = (await manager.getStrikePriceStep(sAUDKey)) / 1e18;

			for (let i = 0; i < numMarkets; i++) {
				let market = await createMarket(
					manager,
					sAUDKey,
					toUnit(price + i * strikePriceStep),
					now + 200,
					toUnit(1),
					creator
				);
				markets.push(market);
			}
			assert.bnEqual(await manager.numMaturedMarkets(), toBN(0));
			assert.equal((await manager.maturedMarkets(0, 100)).length, 0);

			const evenMarkets = markets
				.filter((e, i) => i % 2 === 0)
				.map((m) => m.address)
				.sort();
			const oddMarkets = markets
				.filter((e, i) => i % 2 !== 0)
				.map((m) => m.address)
				.sort();

			const createdMarkets = markets.map((m) => m.address).sort();

			let recordedMarkets = await manager.activeMarkets(0, 100);
			let recordedMarketsSorted = [...recordedMarkets].sort();
			assert.bnEqual(await manager.numActiveMarkets(), toBN(numMarkets));
			assert.equal(createdMarkets.length, recordedMarketsSorted.length);
			createdMarkets.forEach((p, i) => assert.equal(p, recordedMarketsSorted[i]));

			// Resolve all the even markets, ensuring they have been transferred.
			await fastForward(expiryDuration + 1000);
			await aggregator_sAUD.setLatestAnswer(convertToDecimals(2, 8), await currentTime());

			await Promise.all(evenMarkets.map((m) => manager.resolveMarket(m)));

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
			await Promise.all(oddMarkets.map((m) => manager.resolveMarket(m)));
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

		it('Pagination works properly ', async () => {
			const numMarkets = 8;
			const now = await currentTime();
			const markets = [];
			const windowSize = 3;
			let ms;

			await manager.setMarketCreationParameters(now - WEEK + 200, now - 3 * DAY + 200);
			let price = (await priceFeed.rateForCurrency(sAUDKey)) / 1e18;
			let strikePriceStep = (await manager.getStrikePriceStep(sAUDKey)) / 1e18;

			// Empty list
			for (let i = 0; i < numMarkets; i++) {
				ms = await manager.activeMarkets(i, 2);
				//assert.equal(ms.length, 0);
			}

			for (let i = 1; i <= numMarkets; i++) {
				markets.push(
					await createMarket(
						manager,
						sAUDKey,
						toUnit(price + i * strikePriceStep),
						now + 200,
						toUnit(1),
						creator
					)
				);
			}

			// Single elements
			for (let i = 0; i < numMarkets; i++) {
				console.log(markets[i].address);
				ms = await manager.activeMarkets(i, 1);
				console.log(ms[0]);
				assert.equal(ms.length, 1);
				const m = await PositionalMarket.at(ms[0]);
				assert.bnEqual(
					(await m.oracleDetails()).strikePrice,
					toUnit(price + (i + 1) * strikePriceStep)
				);
			}

			// shifting window
			for (let i = 0; i < numMarkets - windowSize; i++) {
				ms = await manager.activeMarkets(i, windowSize);
				assert.equal(ms.length, windowSize);

				for (let j = 0; j < windowSize; j++) {
					const m = await PositionalMarket.at(ms[j]);
					assert.bnEqual(
						(await m.oracleDetails()).strikePrice,
						toUnit(price + (i + j + 1) * strikePriceStep)
					);
				}
			}

			// entire list
			ms = await manager.activeMarkets(0, numMarkets);
			assert.equal(ms.length, numMarkets);
			for (let i = 0; i < numMarkets; i++) {
				const m = await PositionalMarket.at(ms[i]);
				assert.bnEqual(
					(await m.oracleDetails()).strikePrice,
					toUnit(price + (i + 1) * strikePriceStep)
				);
			}

			// Page extends past end of list
			ms = await manager.activeMarkets(numMarkets - windowSize, windowSize * 2);
			assert.equal(ms.length, windowSize);
			for (let i = numMarkets - windowSize; i < numMarkets; i++) {
				const j = i - (numMarkets - windowSize);
				const m = await PositionalMarket.at(ms[j]);
				assert.bnEqual(
					(await m.oracleDetails()).strikePrice,
					toUnit(price + (i + 1) * strikePriceStep)
				);
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
				assert.bnEqual(
					(await m.oracleDetails()).strikePrice,
					toUnit(price + (i + 1) * strikePriceStep)
				);
			}
		});

		it('Only owner can expire markets', async () => {
			const now = await currentTime();
			await manager.setMarketCreationParameters(now - WEEK + 200, now - 3 * DAY + 200);
			let price = (await priceFeed.rateForCurrency(sAUDKey)) / 1e18;
			let strikePriceStep = (await manager.getStrikePriceStep(sAUDKey)) / 1e18;
			const newMarket = await createMarket(
				manager,
				sAUDKey,
				toUnit(price - 2 * strikePriceStep),
				now + 200,
				toUnit(3),
				creator
			);
			await fastForward(expiryDuration.add(toBN(timeToMaturity + 10)));
			await manager.resolveMarket(newMarket.address);
			const REVERT = 'Only the contract owner may perform this action';
			await assert.revert(manager.connect(minterSigner).expireMarkets([newMarket.address]), REVERT);
		});
	});

	describe('Create market checks', async () => {
		let now, price, strikePriceStep;
		beforeEach(async () => {
			now = await currentTime();
			await manager.setMarketCreationParameters(now - WEEK + 200, now - 3 * DAY + 200);
			price = (await priceFeed.rateForCurrency(sAUDKey)) / 1e18;
			strikePriceStep = (await manager.getStrikePriceStep(sAUDKey)) / 1e18;
		});

		it('Cannot create same market', async () => {
			await createMarket(
				manager,
				sAUDKey,
				toUnit(price - 2 * strikePriceStep),
				now + 200,
				toUnit(3),
				creator
			);

			await assert.revert(
				createMarket(
					manager,
					sAUDKey,
					toUnit(price - 2 * strikePriceStep),
					now + 200,
					toUnit(3),
					creator
				),
				'Market already exists'
			);
		});

		it('Cannot create market with invalid strike price', async () => {
			await assert.revert(
				createMarket(manager, sAUDKey, toUnit(123.45), now + 200, toUnit(3), creator),
				'Invalid strike price'
			);
		});

		it('Cannot create market with invalid maturity', async () => {
			await assert.revert(
				createMarket(
					manager,
					sAUDKey,
					toUnit(price - 2 * strikePriceStep),
					now + 400,
					toUnit(1),
					creator
				),
				'Invalid maturity'
			);
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
			await manager.setMarketCreationParameters(now - WEEK + 200, now - 3 * DAY + 200);
			let price = (await priceFeed.rateForCurrency(sAUDKey)) / 1e18;
			let strikePriceStep = (await manager.getStrikePriceStep(sAUDKey)) / 1e18;

			await createMarket(
				manager,
				sAUDKey,
				toUnit(price - 2 * strikePriceStep),
				now + 200,
				toUnit(3),
				creator
			);

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
			await manager.setMarketCreationParameters(now - WEEK + 200, now - 3 * DAY + 200);
			let price = (await priceFeed.rateForCurrency(sAUDKey)) / 1e18;
			let strikePriceStep = (await manager.getStrikePriceStep(sAUDKey)) / 1e18;
			const newMarket = await createMarket(
				manager,
				sAUDKey,
				toUnit(price + 3 * strikePriceStep),
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
			await manager.setMarketCreationParameters(now - WEEK + 200, now - 3 * DAY + 200);
			let price = (await priceFeed.rateForCurrency(sAUDKey)) / 1e18;
			let strikePriceStep = (await manager.getStrikePriceStep(sAUDKey)) / 1e18;
			const newMarket = await createMarket(
				manager,
				sAUDKey,
				toUnit(price),
				now + 200,
				toUnit(5),
				creator
			);
			assert.bnEqual(await manager.totalDeposited(), depositBefore.add(toUnit(5).toString()));

			await newMarket.mint(toUnit(2), { from: initialCreator });
			assert.bnEqual(await manager.totalDeposited(), depositBefore.add(toUnit(7).toString()));
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
			await manager.setMarketCreationParameters(now - WEEK + 200, now - 3 * DAY + 200);
			let price = (await priceFeed.rateForCurrency(sAUDKey)) / 1e18;
			let strikePriceStep = (await manager.getStrikePriceStep(sAUDKey)) / 1e18;

			await manager.connect(creator).setWhitelistedAddresses([dummy, exerciser, secondCreator]);

			await assert.revert(
				manager
					.connect(minterSigner)
					.createMarket(sAUDKey, toUnit(price).toString(), now + 200, toUnit(5).toString()),
				'Only whitelisted addresses can create markets'
			);
		});

		it('Can remove whitelisted address', async () => {
			const now = await currentTime();

			await manager.connect(creator).removeWhitelistedAddress(dummy);
			await manager.setMarketCreationParameters(now - WEEK + 200, now - 3 * DAY + 200);
			let price = (await priceFeed.rateForCurrency(sAUDKey)) / 1e18;
			let strikePriceStep = (await manager.getStrikePriceStep(sAUDKey)) / 1e18;

			await assert.revert(
				manager
					.connect(dummySigner)
					.createMarket(sAUDKey, toUnit(price).toString(), now + 200, toUnit(5).toString()),
				'Only whitelisted addresses can create markets'
			);
		});

		it('Can add whitelisted address', async () => {
			const now = await currentTime();

			await manager.connect(creator).addWhitelistedAddress(initialCreator);

			await manager.setMarketCreationParameters(now - WEEK + 200, now - 3 * DAY + 200);
			let price = (await priceFeed.rateForCurrency(sAUDKey)) / 1e18;
			let strikePriceStep = (await manager.getStrikePriceStep(sAUDKey)) / 1e18;

			const tx = await manager
				.connect(creator)
				.createMarket(
					sAUDKey,
					toUnit(price - strikePriceStep).toString(),
					now + 200,
					toUnit(5).toString()
				);
			let receipt = await tx.wait();
			assert.equal(receipt.events.length, 10);
		});

		it('Anyone can create market if whitelisted addresses feature is disabled', async () => {
			const now = await currentTime();
			await manager.connect(creator).disableWhitelistedAddresses();

			await manager.setMarketCreationParameters(now - WEEK + 200, now - 3 * DAY + 200);
			let price = (await priceFeed.rateForCurrency(sAUDKey)) / 1e18;
			let strikePriceStep = (await manager.getStrikePriceStep(sAUDKey)) / 1e18;

			const tx = await manager
				.connect(minterSigner)
				.createMarket(
					sAUDKey,
					toUnit(price + strikePriceStep).toString(),
					now + 200,
					toUnit(5).toString()
				);
			let receipt = await tx.wait();
			assert.equal(receipt.events.length, 10);
		});

		it('Enable whitelisted addresses feature', async () => {
			const now = await currentTime();
			await manager.connect(creator).enableWhitelistedAddresses();

			await manager.setMarketCreationParameters(now - WEEK + 200, now - 3 * DAY + 200);
			let price = (await priceFeed.rateForCurrency(sAUDKey)) / 1e18;
			let strikePriceStep = (await manager.getStrikePriceStep(sAUDKey)) / 1e18;

			await assert.revert(
				manager
					.connect(dummySigner)
					.createMarket(
						sAUDKey,
						toUnit(price + 6 * strikePriceStep).toString(),
						now + 200,
						toUnit(5).toString()
					),
				'Only whitelisted addresses can create markets'
			);
		});

		it('Price feed can be set', async () => {
			await manager.connect(creator).setPriceFeed(priceFeed.address);

			assert.equal(await manager.priceFeed(), priceFeed.address);
		});
	});
});
