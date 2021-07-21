'use strict';

const { artifacts, contract, web3 } = require('hardhat');
const { toBN } = web3.utils;

const { assert, addSnapshotBeforeRestoreAfterEach } = require('../common');
const {
	fastForward,
	toUnit,
	currentTime,
	multiplyDecimalRound,
	divideDecimalRound,
} = require('../../utils')();
const { toBytes32 } = require('../../../index');
const { setupContract, setupAllContracts } = require('../Token/setup');

const {
	ensureOnlyExpectedMutativeFunctions,
	onlyGivenAddressCanInvoke,
	getEventByName,
	getDecodedLogs,
	decodedEventEqual,
} = require('../helpers');

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

contract('BinaryOption', accounts => {
	const [initialCreator, managerOwner, minter, dummy, exersicer, secondCreator] = accounts;

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

	describe('Basic Parameters', () => {
		it('Created the manager', async () => {
			assert.notEqual(ZERO_ADDRESS, manager.address);
		});

		it('Only expected functions are mutative', async () => {
			ensureOnlyExpectedMutativeFunctions({
				abi: manager.abi,
				ignoreParents: ['Owned', 'Pausable'],
				expected: [
					'createMarket',
					'decrementTotalDeposited',
					'expireMarkets',
					'incrementTotalDeposited',
					'migrateMarkets',
					'receiveMarkets',
					'resolveMarket',
					'setBinaryOptionsMarketFactory',
					'setFeeAddress',
					'setCreatorCapitalRequirement',
					'setCreatorFee',
					'setExpiryDuration',
					'setMarketCreationEnabled',
					'setMaxOraclePriceAge',
					'setMaxTimeToMaturity',
					'setMigratingManager',
					'setPoolFee',
					'transferSusdTo',
				],
			});
		});

		it('Set capital requirement', async () => {
			const newValue = toUnit(1);
			const tx = await manager.setCreatorCapitalRequirement(newValue, { from: managerOwner });
			assert.bnEqual(await manager.capitalRequirement(), newValue);
			const log = tx.logs[0];
			assert.equal(log.event, 'CreatorCapitalRequirementUpdated');
			assert.bnEqual(log.args.value, newValue);
		});

		it('Only the owner can set the capital requirement', async () => {
			await onlyGivenAddressCanInvoke({
				fnc: manager.setCreatorCapitalRequirement,
				args: [toUnit(1)],
				accounts,
				address: managerOwner,
				reason: 'Only the contract owner may perform this action',
			});
		});

		it("Total fee can't be set too high", async () => {
			await assert.revert(
				manager.setPoolFee(toUnit(1), { from: managerOwner }),
				'Total fee must be less than 100%.'
			);
			await assert.revert(
				manager.setCreatorFee(toUnit(1), { from: managerOwner }),
				'Total fee must be less than 100%.'
			);
		});

		it('Total fee must be nonzero.', async () => {
			await manager.setCreatorFee(toUnit(0), { from: managerOwner });
			await assert.revert(
				manager.setPoolFee(toBN(0), { from: managerOwner }),
				'Total fee must be nonzero.'
			);
			await manager.setCreatorFee(toUnit(0.5), { from: managerOwner });
			await manager.setPoolFee(toUnit(0), { from: managerOwner });
			await assert.revert(
				manager.setCreatorFee(toBN(0), { from: managerOwner }),
				'Total fee must be nonzero.'
			);
		});

		it('Set pool fee', async () => {
			const newFee = toUnit(0.005);
			const tx = await manager.setPoolFee(newFee, { from: managerOwner });
			assert.bnEqual((await manager.fees()).poolFee, newFee);
			const log = tx.logs[0];
			assert.equal(log.event, 'PoolFeeUpdated');
			assert.bnEqual(log.args.fee, newFee);
		});

		it('Only the owner can set the pool fee', async () => {
			await onlyGivenAddressCanInvoke({
				fnc: manager.setPoolFee,
				args: [toUnit(0.005)],
				accounts,
				address: managerOwner,
				reason: 'Only the contract owner may perform this action',
			});
		});

		it('Set creator fee', async () => {
			const newFee = toUnit(0.005);
			const tx = await manager.setCreatorFee(newFee, { from: managerOwner });
			assert.bnEqual((await manager.fees()).creatorFee, newFee);
			const log = tx.logs[0];
			assert.equal(log.event, 'CreatorFeeUpdated');
			assert.bnEqual(log.args.fee, newFee);
		});

		it('Only the owner can set the creator fee', async () => {
			await onlyGivenAddressCanInvoke({
				fnc: manager.setCreatorFee,
				args: [toUnit(0.005)],
				accounts,
				address: managerOwner,
				reason: 'Only the contract owner may perform this action',
			});
		});

		it('Set oracle maturity window', async () => {
			const tx = await manager.setMaxOraclePriceAge(maxOraclePriceAge, { from: managerOwner });
			assert.bnEqual((await manager.durations()).maxOraclePriceAge, maxOraclePriceAge);
			const log = tx.logs[0];
			assert.equal(log.event, 'MaxOraclePriceAgeUpdated');
			assert.bnEqual(log.args.duration, maxOraclePriceAge);
		});

		it('Only the owner can set the oracle maturity window', async () => {
			await onlyGivenAddressCanInvoke({
				fnc: manager.setMaxOraclePriceAge,
				args: [maxOraclePriceAge],
				accounts,
				address: managerOwner,
				reason: 'Only the contract owner may perform this action',
			});
		});

		it('Set expiry duration', async () => {
			const tx = await manager.setExpiryDuration(expiryDuration, { from: managerOwner });
			assert.bnEqual((await manager.durations()).expiryDuration, expiryDuration);
			assert.eventEqual(tx.logs[0], 'ExpiryDurationUpdated', { duration: expiryDuration });
		});

		it('Only the owner can set the expiry duration', async () => {
			await onlyGivenAddressCanInvoke({
				fnc: manager.setExpiryDuration,
				args: [expiryDuration],
				accounts,
				address: managerOwner,
				reason: 'Only the contract owner may perform this action',
			});
		});

		it('Set max time to maturity', async () => {
			const tx = await manager.setMaxTimeToMaturity(maxTimeToMaturity, {
				from: managerOwner,
			});
			assert.bnEqual((await manager.durations()).maxTimeToMaturity, maxTimeToMaturity);
			const log = tx.logs[0];
			assert.equal(log.event, 'MaxTimeToMaturityUpdated');
			assert.bnEqual(log.args.duration, maxTimeToMaturity);
		});

		it('Only the owner can set the max time to maturity', async () => {
			await onlyGivenAddressCanInvoke({
				fnc: manager.setMaxTimeToMaturity,
				args: [maxTimeToMaturity],
				accounts,
				address: managerOwner,
				reason: 'Only the contract owner may perform this action',
			});
		});

		it('Static parameters are set properly', async () => {
			const durations = await manager.durations();
			assert.bnEqual(durations.expiryDuration, expiryDuration);
			assert.bnEqual(durations.maxOraclePriceAge, maxOraclePriceAge);
			assert.bnEqual(durations.maxTimeToMaturity, maxTimeToMaturity);

			const fees = await manager.fees();
			assert.bnEqual(fees.poolFee, initialPoolFee);
			assert.bnEqual(fees.creatorFee, initialCreatorFee);

			const capitalRequirement = await manager.capitalRequirement();
			assert.bnEqual(capitalRequirement, capitalRequirement);
			assert.bnEqual(await manager.totalDeposited(), toUnit(0));
			assert.bnEqual(await manager.marketCreationEnabled(), true);
			assert.equal(await manager.resolver(), addressResolver.address);
			assert.equal(await manager.owner(), accounts[1]);
			assert.equal(await manager.feeAddress(), initialFeeAddress);
		});
	});

	describe('BinaryOptionMarketFactory', () => {
		it('createMarket cannot be invoked except by the manager.', async () => {
			const now = await currentTime();
			await onlyGivenAddressCanInvoke({
				fnc: factory.createMarket,
				args: [
					initialCreator,
					addressResolver.address,
					sAUDKey,
					toUnit(1),
					[now + 200, now + expiryDuration + 200],
					toUnit(2),
					[initialPoolFee, initialCreatorFee],
					false,
					ZERO_ADDRESS,
				],
				accounts,
				skipPassCheck: true,
				reason: 'Only permitted by the manager.',
			});
		});

		it('Only expected functions are mutative.', async () => {
			await ensureOnlyExpectedMutativeFunctions({
				abi: factory.abi,
				ignoreParents: ['Owned', 'MinimalProxyFactory'],
				expected: [
					'createMarket',
					'setBinaryOptionMarketManager',
					'setBinaryOptionMarketMastercopy',
					'setBinaryOptionMastercopy',
				],
			});
		});

		it('Can create a market', async () => {
			const now = await currentTime();

			const result = await manager.createMarket(
				sAUDKey,
				initialStrikePrice,
				now + 200,
				toUnit(2),
				false,
				ZERO_ADDRESS,
				{
					from: initialCreator,
				}
			);

			let createdMarket = await BinaryOptionMarket.at(
				getEventByName({ tx: result, name: 'MarketCreated' }).args.market
			);
			const options = await createdMarket.options();
			long = await BinaryOption.at(options.long);
			short = await BinaryOption.at(options.short);
			let longAddress = long.address;
			let shortAddress = short.address;

			assert.eventEqual(getEventByName({ tx: result, name: 'MarketCreated' }), 'MarketCreated', {
				creator: initialCreator,
				oracleKey: sAUDKey,
				strikePrice: initialStrikePrice,
				maturityDate: toBN(now + timeToMaturity),
				expiryDate: toBN(now + timeToMaturity).add(expiryDuration),
				long: longAddress,
				short: shortAddress,
			});

			const decodedLogs = BinaryOptionMarket.decodeLogs(result.receipt.rawLogs);
			assert.eventEqual(decodedLogs[1], 'Mint', {
				side: Side.Long,
				account: initialCreator,
				value: toUnit(2),
			});
			assert.eventEqual(decodedLogs[2], 'Mint', {
				side: Side.Short,
				account: initialCreator,
				value: toUnit(2),
			});

			market = await BinaryOptionMarket.at(
				getEventByName({ tx: result, name: 'MarketCreated' }).args.market
			);

			const times = await market.times();
			assert.bnEqual(times.maturity, toBN(now + 200));
			assert.bnEqual(times.expiry, toBN(now + 200).add(expiryDuration));
			const oracleDetails = await market.oracleDetails();
			assert.equal(oracleDetails.key, sAUDKey);
			assert.bnEqual(oracleDetails.strikePrice, toUnit(100));
			assert.equal(await market.creator(), initialCreator);
			assert.equal(await market.owner(), manager.address);
			assert.equal(await market.resolver(), addressResolver.address);

			const fees = await market.fees();
			assert.bnEqual(fees.poolFee, initialPoolFee);
			assert.bnEqual(fees.creatorFee, initialCreatorFee);

			assert.bnEqual(await manager.numActiveMarkets(), toBN(1));
			assert.equal((await manager.activeMarkets(0, 100))[0], market.address);
			assert.bnEqual(await manager.numMaturedMarkets(), toBN(0));
			assert.equal((await manager.maturedMarkets(0, 100)).length, 0);
		});

		it('Cannot create markets for invalid keys.', async () => {
			const now = await currentTime();

			const sUSDKey = toBytes32('sUSD');
			const nonRate = toBytes32('nonExistent');

			await assert.revert(
				manager.createMarket(sUSDKey, toUnit(1), now + 100, toUnit(2), false, ZERO_ADDRESS, {
					from: initialCreator,
				}),
				'Invalid key'
			);

			await exchangeRates.setInversePricing(
				iAUDKey,
				toUnit(150),
				toUnit(200),
				toUnit(110),
				false,
				false,
				{ from: await exchangeRates.owner() }
			);
			await exchangeRates.updateRates([iAUDKey], [toUnit(151)], await currentTime(), {
				from: oracle,
			});

			await assert.revert(
				manager.createMarket(iAUDKey, toUnit(1), now + 100, toUnit(2), false, ZERO_ADDRESS, {
					from: initialCreator,
				}),
				'Invalid key'
			);

			await assert.revert(
				manager.createMarket(nonRate, toUnit(1), now + 100, toUnit(2), false, ZERO_ADDRESS, {
					from: initialCreator,
				}),
				'Invalid key'
			);
		});

		it('Cannot create a market providing insufficient initial mint', async () => {
			const now = await currentTime();
			await assert.revert(
				manager.createMarket(sAUDKey, toUnit(1), now + 100, toUnit(0.1), false, ZERO_ADDRESS, {
					from: initialCreator,
				}),
				'Insufficient capital'
			);
		});

		it('Cannot create a market too far into the future', async () => {
			const now = await currentTime();
			await assert.revert(
				manager.createMarket(
					sAUDKey,
					toUnit(1),
					now + maxTimeToMaturity + 200,
					toUnit(0.1),
					false,
					ZERO_ADDRESS,
					{
						from: initialCreator,
					}
				),
				'Maturity too far in the future'
			);
		});

		it('Cannot create a market if the manager is paused', async () => {
			await manager.setPaused(true, { from: managerOwner });
			const now = await currentTime();
			await assert.revert(
				manager.createMarket(sAUDKey, toUnit(1), now + 200, toUnit(5), false, ZERO_ADDRESS, {
					from: initialCreator,
				}),
				'This action cannot be performed while the contract is paused'
			);
			await manager.setPaused(false, { from: managerOwner });
		});

		it('Market creation can be enabled and disabled.', async () => {
			let tx = await manager.setMarketCreationEnabled(false, { from: managerOwner });
			assert.eventEqual(tx.logs[0], 'MarketCreationEnabledUpdated', {
				enabled: false,
			});
			assert.isFalse(await manager.marketCreationEnabled());

			tx = await manager.setMarketCreationEnabled(true, { from: managerOwner });
			assert.eventEqual(tx.logs[0], 'MarketCreationEnabledUpdated', {
				enabled: true,
			});

			assert.isTrue(await manager.marketCreationEnabled());

			tx = await manager.setMarketCreationEnabled(true, { from: managerOwner });
			assert.equal(tx.logs.length, 0);
		});

		it('Cannot create a market if market creation is disabled.', async () => {
			await manager.setMarketCreationEnabled(false, { from: managerOwner });
			const now = await currentTime();
			await assert.revert(
				manager.createMarket(sAUDKey, toUnit(1), now + 200, toUnit(5), false, ZERO_ADDRESS, {
					from: initialCreator,
				}),
				'Market creation is disabled'
			);

			await manager.setMarketCreationEnabled(true, { from: managerOwner });
			const tx = await manager.createMarket(
				sAUDKey,
				toUnit(1),
				now + 200,
				toUnit(5),
				false,
				ZERO_ADDRESS,
				{
					from: initialCreator,
				}
			);
			const localMarket = await BinaryOptionMarket.at(
				getEventByName({ tx, name: 'MarketCreated' }).args.market
			);

			assert.bnEqual((await localMarket.oracleDetails()).strikePrice, toUnit(1));
		});

		it('Cannot create a market if maturity is in the past.', async () => {
			const now = await currentTime();
			await assert.revert(
				manager.createMarket(sAUDKey, toUnit(1), now - 1, toUnit(2), false, ZERO_ADDRESS, {
					from: initialCreator,
				}),
				'Maturity has to be in the future'
			);
		});
	});

	describe('Market expiry', () => {
		it('Can expire markets', async () => {
			const now = await currentTime();
			const [newMarket, newerMarket] = await Promise.all([
				createMarket(manager, sAUDKey, toUnit(1), now + 200, toUnit(3), initialCreator),
				createMarket(manager, sAUDKey, toUnit(1), now + 100, toUnit(1), initialCreator),
			]);

			assert.bnEqual(await manager.totalDeposited(), toUnit(11));

			const newAddress = newMarket.address;
			const newerAddress = newerMarket.address;

			await fastForward(expiryDuration.add(toBN(1000)));
			await exchangeRates.updateRates([sAUDKey], [toUnit(5)], await currentTime(), {
				from: oracle,
			});
			await manager.resolveMarket(newAddress);
			await manager.resolveMarket(newerAddress);
			const tx = await manager.expireMarkets([newAddress, newerAddress], { from: managerOwner });

			assert.eventEqual(tx.logs[0], 'MarketExpired', { market: newAddress });
			assert.eventEqual(tx.logs[1], 'MarketExpired', { market: newerAddress });
			assert.equal(await web3.eth.getCode(newAddress), '0x');
			assert.equal(await web3.eth.getCode(newerAddress), '0x');
			assert.bnEqual(await manager.totalDeposited(), toUnit(7));
		});

		it('Cannot expire a market that does not exist', async () => {
			await assert.revert(manager.expireMarkets([initialCreator], { from: initialCreator }));
		});

		it('Cannot expire an unresolved market.', async () => {
			const now = await currentTime();
			const newMarket = await createMarket(
				manager,
				sAUDKey,
				toUnit(1),
				now + 200,
				toUnit(3),
				initialCreator
			);
			await assert.revert(
				manager.expireMarkets([newMarket.address], { from: managerOwner }),
				'Unexpired options remaining'
			);

			it('Cannot expire an unexpired market.', async () => {
				const now = await currentTime();
				const newMarket = await createMarket(
					manager,
					sAUDKey,
					toUnit(1),
					now + 200,
					toUnit(3),
					initialCreator
				);

				await fastForward(300);
				await exchangeRates.updateRates([sAUDKey], [toUnit(5)], await currentTime(), {
					from: oracle,
				});
				await manager.resolveMarket(newMarket.address);
				await assert.revert(
					manager.expireMarkets([newMarket.address], { from: initialCreator }),
					'Unexpired options remaining'
				);
			});

			it('Cannot expire a market if the manager is paused.', async () => {
				const now = await currentTime();
				const newMarket = await createMarket(
					manager,
					sAUDKey,
					toUnit(1),
					now + 200,
					toUnit(3),
					initialCreator
				);
				await fastForward(expiryDuration.add(toBN(1000)));
				await exchangeRates.updateRates([sAUDKey], [toUnit(5)], await currentTime(), {
					from: oracle,
				});
				await manager.resolveMarket(newMarket.address);

				await manager.setPaused(true, { from: managerOwner });
				await assert.revert(
					manager.expireMarkets([newMarket.address], { from: bidder }),
					'This action cannot be performed while the contract is paused'
				);
				await manager.setPaused(false, { from: managerOwner });
			});
		});
	});

	describe('BinaryOptionMarket and balances', () => {
		it('Total Minted options', async () => {
			let totalSupplies = await market.totalSupplies();
			assert.bnEqual(totalSupplies[0], toUnit(2));
		});

		it('Held by owner', async () => {
			const options = await market.options();
			long = await BinaryOption.at(options.long);
			short = await BinaryOption.at(options.short);
			assert.bnEqual(await long.balanceOf(initialCreator), toUnit(2));
			assert.bnEqual(await short.balanceOf(initialCreator), toUnit(2));
			assert.bnEqual(await long.totalSupply(), toUnit(2));
			assert.bnEqual(await short.totalSupply(), toUnit(2));
		});

		it('Mint more and check balance', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(
				sAUDKey,
				initialStrikePrice,
				now,
				initialCreator,
				timeToMaturity
			);

			const options = await market.options();
			long = await BinaryOption.at(options.long);
			short = await BinaryOption.at(options.short);

			let fees = await market.fees();
			console.log('Fees are ' + fees[0] + ' ' + fees[1]);

			let _feeMultiplier = toUnit(1).sub(fees[0].add(fees[1]));
			let valueAfterFees = multiplyDecimalRound(_feeMultiplier, toUnit(1)).add(toUnit(2));
			totalDepositedAfterFees = valueAfterFees;
			assert.bnEqual(await long.balanceOf(initialCreator), valueAfterFees);
			assert.bnEqual(await short.balanceOf(initialCreator), valueAfterFees);

			const totalSupplies = await market.totalSupplies();
			assert.bnEqual(totalSupplies.long, valueAfterFees);
			assert.bnEqual(totalSupplies.short, valueAfterFees);
		});

		it('Only expected functions are mutative', async () => {
			ensureOnlyExpectedMutativeFunctions({
				abi: market.abi,
				ignoreParents: ['MinimalProxyFactory', 'OwnedWithInit'],
				expected: [
					'mint',
					'resolve',
					'exerciseOptions',
					'expire',
					'initialize',
					'setIOracleInstance',
				],
			});
		});

		it('BinaryOption instances cannot transfer if the system is suspended or paused', async () => {
			await manager.setPaused(true, { from: accounts[1] });
			await assert.revert(
				long.transfer(market.address, toUnit(1), { from: initialCreator }),
				'This action cannot be performed while the contract is paused'
			);
			await manager.setPaused(false, { from: accounts[1] });
		});

		it('Bad constructor parameters revert.', async () => {
			// Insufficient capital
			let now = await currentTime();
			await assert.revert(
				manager.createMarket(
					sAUDKey,
					initialStrikePrice,
					now + timeToMaturity,
					toUnit(0),
					false,
					ZERO_ADDRESS,
					{
						from: initialCreator,
					}
				),
				'Insufficient capital'
			);
		});

		it('Current oracle price and timestamp are correct.', async () => {
			const now = await currentTime();
			const price = toUnit(0.7);
			await exchangeRates.updateRates([sAUDKey], [price], now, { from: oracle });
			const result = await market.oraclePriceAndTimestamp();

			assert.bnEqual(result.price, price);
			assert.bnEqual(result.updatedAt, now);
		});

		it('Result can fluctuate while unresolved, but is fixed after resolution.', async () => {
			const two = toBN(2);
			assert.isFalse(await market.resolved());

			let now = await currentTime();
			await exchangeRates.updateRates([sAUDKey], [initialStrikePrice.div(two)], now, {
				from: oracle,
			});
			assert.bnEqual(await market.result(), Side.Short);
			now = await currentTime();
			await exchangeRates.updateRates([sAUDKey], [initialStrikePrice.mul(two)], now, {
				from: oracle,
			});
			assert.bnEqual(await market.result(), Side.Long);

			await fastForward(timeToMaturity + 10);
			now = await currentTime();

			await exchangeRates.updateRates([sAUDKey], [initialStrikePrice.mul(two)], now, {
				from: oracle,
			});
			await manager.resolveMarket(market.address);

			assert.isTrue(await market.resolved());
			now = await currentTime();
			await exchangeRates.updateRates([sAUDKey], [initialStrikePrice.div(two)], now, {
				from: oracle,
			});
			assert.bnEqual(await market.result(), Side.Long);
			now = await currentTime();
			await exchangeRates.updateRates([sAUDKey], [initialStrikePrice.mul(two)], now, {
				from: oracle,
			});
			assert.bnEqual(await market.result(), Side.Long);
		});

		it('Result resolves correctly long.', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(
				sAUDKey,
				initialStrikePrice,
				now,
				initialCreator,
				timeToMaturity
			);
			now = await currentTime();
			await fastForward(timeToMaturity + 1);
			now = await currentTime();
			const price = initialStrikePrice.add(toBN(1));
			await exchangeRates.updateRates([sAUDKey], [price], now, { from: oracle });
			const tx = await manager.resolveMarket(market.address);
			assert.bnEqual(await market.result(), Side.Long);
			assert.isTrue(await market.resolved());
			assert.bnEqual((await market.oracleDetails()).finalPrice, price);

			const poolFees = multiplyDecimalRound(toUnit(1), initialPoolFee);
			const creatorFees = multiplyDecimalRound(toUnit(1), initialCreatorFee);

			const log = BinaryOptionMarket.decodeLogs(tx.receipt.rawLogs)[0];
			assert.eventEqual(log, 'MarketResolved', {
				result: Side.Long,
				oraclePrice: price,
				oracleTimestamp: now,
				deposited: totalDepositedAfterFees,
				poolFees,
				creatorFees,
			});
			assert.equal(log.event, 'MarketResolved');
			assert.bnEqual(log.args.result, Side.Long);
			assert.bnEqual(log.args.oraclePrice, price);
			assert.bnEqual(log.args.oracleTimestamp, now);
		});

		it('Result resolves correctly short.', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(
				sAUDKey,
				initialStrikePrice,
				now,
				initialCreator,
				timeToMaturity
			);
			await fastForward(timeToMaturity + 1);
			now = await currentTime();
			const price = initialStrikePrice.sub(toBN(1));

			await exchangeRates.updateRates([sAUDKey], [price], now, { from: oracle });

			const tx = await manager.resolveMarket(market.address);
			assert.isTrue(await market.resolved());
			assert.bnEqual(await market.result(), Side.Short);
			assert.bnEqual((await market.oracleDetails()).finalPrice, price);

			const log = BinaryOptionMarket.decodeLogs(tx.receipt.rawLogs)[0];
			assert.equal(log.event, 'MarketResolved');
			assert.bnEqual(log.args.result, Side.Short);
			assert.bnEqual(log.args.oraclePrice, price);
			assert.bnEqual(log.args.oracleTimestamp, now);
		});

		it('A result equal to the strike price resolves long.', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(
				sAUDKey,
				initialStrikePrice,
				now,
				initialCreator,
				timeToMaturity
			);
			await fastForward(timeToMaturity + 1);
			now = await currentTime();
			await exchangeRates.updateRates([sAUDKey], [initialStrikePrice], now, { from: oracle });
			await manager.resolveMarket(market.address);
			assert.isTrue(await market.resolved());
			assert.bnEqual(await market.result(), Side.Long);
			assert.bnEqual((await market.oracleDetails()).finalPrice, initialStrikePrice);
		});

		it('Resolution cannot occur before maturity.', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(
				sAUDKey,
				initialStrikePrice,
				now,
				initialCreator,
				timeToMaturity
			);
			assert.isFalse(await market.canResolve());
			await assert.revert(manager.resolveMarket(market.address), 'Not yet mature');
		});

		it('Resolution can only occur once.', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(
				sAUDKey,
				initialStrikePrice,
				now,
				initialCreator,
				timeToMaturity
			);
			await fastForward(timeToMaturity + 1);
			now = await currentTime();
			await exchangeRates.updateRates([sAUDKey], [initialStrikePrice], now, { from: oracle });
			assert.isTrue(await market.canResolve());
			await manager.resolveMarket(market.address);
			assert.isFalse(await market.canResolve());
			await assert.revert(manager.resolveMarket(market.address), 'Not an active market');
		});

		it('Resolution can occur if the price was updated within the maturity window but before maturity.', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(
				sAUDKey,
				initialStrikePrice,
				now,
				initialCreator,
				timeToMaturity
			);
			await fastForward(timeToMaturity + 1);
			now = await currentTime();
			await exchangeRates.updateRates(
				[sAUDKey],
				[initialStrikePrice],
				now - (maxOraclePriceAge - 60),
				{
					from: oracle,
				}
			);
			assert.isTrue(await market.canResolve());
			await manager.resolveMarket(market.address);
		});

		it('Resolution cannot occur if the price is too old.', async () => {
			let result = await market.oraclePriceAndTimestamp();
			let now = await currentTime();

			let timeToMaturityExtended = 60 * 61 + 200;

			await createMarketAndMintMore(
				sAUDKey,
				initialStrikePrice,
				now,
				initialCreator,
				timeToMaturityExtended
			);
			await fastForward(maxOraclePriceAge + 1);
			result = await market.oraclePriceAndTimestamp();
			now = await currentTime();
			assert.isFalse(await market.canResolve());
			await assert.revert(manager.resolveMarket(market.address), 'Can not resolve market');
		});

		it('Resolution properly remits the collected fees.', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(
				sAUDKey,
				initialStrikePrice,
				now,
				initialCreator,
				timeToMaturity
			);

			await fastForward(timeToMaturity + 1);
			await exchangeRates.updateRates([sAUDKey], [toUnit(0.7)], await currentTime(), {
				from: oracle,
			});

			const feeAddress = await manager.feeAddress();

			const [creatorPrebalance, poolPrebalance, preDeposits] = await Promise.all([
				sUSDSynth.balanceOf(initialCreator),
				sUSDSynth.balanceOf(feeAddress),
				market.deposited(),
			]);

			const tx = await manager.resolveMarket(market.address);
			const logs = Synth.decodeLogs(tx.receipt.rawLogs);

			const [creatorPostbalance, poolPostbalance, postDeposits] = await Promise.all([
				sUSDSynth.balanceOf(initialCreator),
				sUSDSynth.balanceOf(feeAddress),
				market.deposited(),
			]);

			const poolFee = multiplyDecimalRound(toUnit(1), initialPoolFee);
			const creatorFee = multiplyDecimalRound(toUnit(1), initialCreatorFee);

			const poolReceived = poolPostbalance.sub(poolPrebalance);
			const creatorReceived = creatorPostbalance.sub(creatorPrebalance);

			assert.bnClose(poolReceived, poolFee, 1);
			assert.bnClose(creatorReceived, creatorFee, 1);
			assert.bnClose(postDeposits, preDeposits.sub(poolFee.add(creatorFee)));

			assert.eventEqual(logs[0], 'Transfer', {
				from: market.address,
				to: feeAddress,
				value: poolReceived,
			});
			assert.eventEqual(logs[1], 'Transfer', {
				from: market.address,
				to: initialCreator,
				value: creatorReceived,
			});
		});

		it('Empty mints do nothing.', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(
				sAUDKey,
				initialStrikePrice,
				now,
				initialCreator,
				timeToMaturity
			);
			const tx1 = await market.mint(toUnit(0), {
				from: dummy,
			});

			assert.equal(tx1.logs.length, 0);
			assert.equal(tx1.receipt.rawLogs, 0);

			assert.bnEqual(await long.balanceOf(dummy), 0);
		});

		it('Mint less than $0.01 revert.', async () => {
			await assert.revert(market.mint(toUnit('0.0099'), { from: dummy }), 'Balance < $0.01');
		});
	});

	describe('Pauses', () => {
		it('Resolution cannot occur if the manager is paused', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(
				sAUDKey,
				initialStrikePrice,
				now,
				initialCreator,
				timeToMaturity
			);
			await fastForward(timeToMaturity + 1);
			await exchangeRates.updateRates([sAUDKey], [toUnit(0.7)], await currentTime(), {
				from: oracle,
			});
			await manager.setPaused(true, { from: accounts[1] });
			await assert.revert(
				manager.resolveMarket(market.address),
				'This action cannot be performed while the contract is paused'
			);
		});
		it('Minting fails when the manager is paused.', async () => {
			await manager.setPaused(false, { from: accounts[1] });
			let now = await currentTime();
			await createMarketAndMintMore(
				sAUDKey,
				initialStrikePrice,
				now,
				initialCreator,
				timeToMaturity
			);
			await manager.setPaused(true, { from: accounts[1] });
			await assert.revert(
				market.mint(toUnit(1), { from: dummy }),
				'This action cannot be performed while the contract is paused'
			);
		});
	});

	describe('Phases', () => {
		it('Can proceed through the phases properly.', async () => {
			await manager.setPaused(false, { from: accounts[1] });
			let now = await currentTime();
			await createMarketAndMintMore(
				sAUDKey,
				initialStrikePrice,
				now,
				initialCreator,
				timeToMaturity
			);
			assert.bnEqual(await market.phase(), Phase.Trading);
			await fastForward(timeToMaturity + 1);
			assert.bnEqual(await market.phase(), Phase.Maturity);
			await fastForward(expiryDuration + 1);

			now = await currentTime();
			await exchangeRates.updateRates([sAUDKey], [initialStrikePrice], now, {
				from: oracle,
			});
			await manager.resolveMarket(market.address);

			assert.bnEqual(await market.phase(), Phase.Expiry);
		});

		it('Market can expire early if everything has been exercised.', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(
				sAUDKey,
				initialStrikePrice,
				now,
				initialCreator,
				timeToMaturity
			);
			await fastForward(timeToMaturity + 1);

			now = await currentTime();
			await exchangeRates.updateRates([sAUDKey], [initialStrikePrice], now, {
				from: oracle,
			});
			await manager.resolveMarket(market.address);

			assert.bnEqual(await market.phase(), Phase.Maturity);
			await market.exerciseOptions({ from: initialCreator });
			assert.bnEqual(await market.phase(), Phase.Expiry);
		});
	});

	describe('Exercising Options', () => {
		it('Exercising options yields the proper balances.', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(
				sAUDKey,
				initialStrikePrice,
				now,
				initialCreator,
				timeToMaturity
			);

			const options = await market.options();
			long = await BinaryOption.at(options.long);
			short = await BinaryOption.at(options.short);

			let susdBalance = toUnit(10);
			await sUSDSynth.issue(exersicer, susdBalance);
			await sUSDSynth.approve(manager.address, sUSDQty, { from: exersicer });

			assert.bnEqual(await sUSDSynth.balanceOf(exersicer), susdBalance);

			await market.mint(susdBalance, { from: exersicer });

			// susd is transfered out after minting and options are in the wallet
			assert.bnEqual(await sUSDSynth.balanceOf(exersicer), toBN(0));

			let fees = await market.fees();
			let _feeMultiplier = toUnit(1).sub(fees[0].add(fees[1]));
			let longBalanceAfterMinting = multiplyDecimalRound(_feeMultiplier, toUnit(10));

			assert.bnEqual(await long.balanceOf(exersicer), longBalanceAfterMinting);

			await fastForward(timeToMaturity + 100);

			now = await currentTime();
			const price = (await market.oracleDetails()).strikePrice;
			await exchangeRates.updateRates([sAUDKey], [price], now, { from: oracle });
			await manager.resolveMarket(market.address);

			assert.bnEqual(await long.balanceOf(exersicer), longBalanceAfterMinting);

			const tx1 = await market.exerciseOptions({ from: exersicer });

			// options no longer in the wallet
			assert.bnEqual(await long.balanceOf(exersicer), toBN(0));

			let logs = BinaryOption.decodeLogs(tx1.receipt.rawLogs);
			assert.equal(logs.length, 5);
			assert.equal(logs[0].address, long.address);
			assert.equal(logs[0].event, 'Transfer');
			assert.equal(logs[0].args.from, exersicer);
			assert.equal(logs[0].args.to, '0x' + '0'.repeat(40));
			assert.bnClose(logs[0].args.value, longBalanceAfterMinting, 1);
			assert.equal(logs[1].address, long.address);
			assert.equal(logs[1].event, 'Burned');
			assert.equal(logs[1].args.account, exersicer);
			assert.bnClose(logs[1].args.value, longBalanceAfterMinting, 1);
			assert.equal(tx1.logs.length, 1);
			assert.equal(tx1.logs[0].event, 'OptionsExercised');
			assert.equal(tx1.logs[0].args.account, exersicer);
			assert.bnClose(tx1.logs[0].args.value, longBalanceAfterMinting, 1);
		});

		it('Exercising options resolves an unresolved market.', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(
				sAUDKey,
				initialStrikePrice,
				now,
				initialCreator,
				timeToMaturity
			);
			await market.mint(toUnit(1), { from: exersicer });
			await fastForward(timeToMaturity + 100);
			await exchangeRates.updateRates(
				[sAUDKey],
				[(await market.oracleDetails()).strikePrice],
				await currentTime(),
				{ from: oracle }
			);
			assert.isFalse(await market.resolved());
			await market.exerciseOptions({ from: exersicer });
			assert.isTrue(await market.resolved());
		});

		it('Exercising options with none owned reverts.', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(
				sAUDKey,
				initialStrikePrice,
				now,
				initialCreator,
				timeToMaturity
			);
			await fastForward(timeToMaturity + 100);
			now = await currentTime();
			const price = (await market.oracleDetails()).strikePrice;
			await exchangeRates.updateRates([sAUDKey], [price], now, { from: oracle });
			await manager.resolveMarket(market.address);

			await assert.revert(market.exerciseOptions({ from: exersicer }), 'Nothing to exercise');
		});

		it('Options cannot be exercised if the manager is paused.', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(
				sAUDKey,
				initialStrikePrice,
				now,
				initialCreator,
				timeToMaturity
			);

			await market.mint(toUnit(1), { from: exersicer });
			await fastForward(timeToMaturity + 100);
			await exchangeRates.updateRates(
				[sAUDKey],
				[(await market.oracleDetails()).strikePrice],
				await currentTime(),
				{ from: oracle }
			);
			await manager.resolveMarket(market.address);

			await manager.setPaused(true, { from: accounts[1] });
			await assert.revert(
				market.exerciseOptions({ from: exersicer }),
				'This action cannot be performed while the contract is paused'
			);
		});

		it('Options can be exercised if transferred to another account.', async () => {
			await manager.setPaused(false, { from: accounts[1] });
			let now = await currentTime();
			await createMarketAndMintMore(
				sAUDKey,
				initialStrikePrice,
				now,
				initialCreator,
				timeToMaturity
			);

			await market.mint(toUnit(2), { from: exersicer });
			const options = await market.options();
			long = await BinaryOption.at(options.long);
			short = await BinaryOption.at(options.short);

			await long.transfer(dummy, toUnit(1), { from: exersicer });
			await fastForward(timeToMaturity + 100);
			now = await currentTime();
			const price = (await market.oracleDetails()).strikePrice;
			await exchangeRates.updateRates([sAUDKey], [price], now, { from: oracle });
			await manager.resolveMarket(market.address);

			let tx = await market.exerciseOptions({ from: dummy });
			let logs = await getDecodedLogs({
				hash: tx.receipt.transactionHash,
				contracts: [manager, market, long],
			});

			assert.equal(logs.length, 4);
			decodedEventEqual({
				event: 'Transfer',
				emittedFrom: long.address,
				args: [dummy, ZERO_ADDRESS, toUnit(1)],
				log: logs[0],
			});
			decodedEventEqual({
				event: 'Burned',
				emittedFrom: long.address,
				args: [dummy, toUnit(1)],
				log: logs[1],
			});
		});
	});

	describe('Expiry', () => {
		it('Expired markets destroy themselves and their options.', async () => {
			await manager.setPaused(false, { from: accounts[1] });
			let now = await currentTime();
			await createMarketAndMintMore(
				sAUDKey,
				initialStrikePrice,
				now,
				initialCreator,
				timeToMaturity
			);

			const options = await market.options();
			long = await BinaryOption.at(options.long);
			short = await BinaryOption.at(options.short);

			const marketAddress = market.address;
			const longAddress = long.address;
			const shortAddress = short.address;

			await fastForward(expiryDuration.add(toBN(timeToMaturity + 10)));
			await exchangeRates.updateRates([sAUDKey], [initialStrikePrice], await currentTime(), {
				from: oracle,
			});
			await manager.resolveMarket(market.address);
			await manager.expireMarkets([market.address], { from: managerOwner });

			assert.equal(await web3.eth.getCode(marketAddress), '0x');
			assert.equal(await web3.eth.getCode(longAddress), '0x');
			assert.equal(await web3.eth.getCode(shortAddress), '0x');
		});

		it('Unresolved markets cannot be expired', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(
				sAUDKey,
				initialStrikePrice,
				now,
				initialCreator,
				timeToMaturity
			);
			now = await currentTime();

			await fastForward(expiryDuration.add(toBN(timeToMaturity + 10)));
			await assert.revert(
				manager.expireMarkets([market.address], { from: managerOwner }),
				'Unexpired options remaining'
			);
		});

		it('Market cannot be expired before its time', async () => {
			let now = await currentTime();

			await createMarketAndMintMore(
				sAUDKey,
				initialStrikePrice,
				now,
				initialCreator,
				timeToMaturity
			);

			now = await currentTime();

			await fastForward(timeToMaturity + 10);
			now = await currentTime();
			await exchangeRates.updateRates([sAUDKey], [initialStrikePrice], now, {
				from: oracle,
			});

			await manager.resolveMarket(market.address);
			await assert.revert(
				manager.expireMarkets([market.address], { from: managerOwner }),
				'Unexpired options remaining'
			);
		});

		it('Market can be expired early if all options are exercised', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(
				sAUDKey,
				initialStrikePrice,
				now,
				initialCreator,
				timeToMaturity
			);

			await fastForward(timeToMaturity + 10);
			await exchangeRates.updateRates([sAUDKey], [initialStrikePrice], await currentTime(), {
				from: oracle,
			});
			await market.exerciseOptions({ from: initialCreator });
			const marketAddress = market.address;
			await manager.expireMarkets([market.address], { from: managerOwner });
			assert.equal(await web3.eth.getCode(marketAddress), '0x');
		});

		it('Market cannot be expired except by the manager', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(
				sAUDKey,
				initialStrikePrice,
				now,
				initialCreator,
				timeToMaturity
			);

			await fastForward(expiryDuration.add(toBN(timeToMaturity + 10)));
			await exchangeRates.updateRates([sAUDKey], [initialStrikePrice], await currentTime(), {
				from: oracle,
			});
			await manager.resolveMarket(market.address);

			await onlyGivenAddressCanInvoke({
				fnc: market.expire,
				args: [initialCreator],
				accounts,
				skipPassCheck: true,
				reason: 'Only the contract owner may perform this action',
			});
		});

		it('Expired market remits any unclaimed options and extra sUSD to the caller.', async () => {
			sUSDSynth.issue(secondCreator, toUnit(3));
			sUSDSynth.approve(manager.address, toUnit(3), { from: secondCreator });

			const creatorBalance = await sUSDSynth.balanceOf(secondCreator);

			let now = await currentTime();
			await createMarketAndMintMore(
				sAUDKey,
				initialStrikePrice,
				now,
				secondCreator,
				timeToMaturity
			);

			let fees = await market.fees();
			let _feeMultiplier = toUnit(1).sub(fees[0].add(fees[1]));
			// creator fee goes back to creator
			let valueAfterFees = multiplyDecimalRound(_feeMultiplier, toUnit(1)).add(toUnit(4));

			await sUSDSynth.transfer(market.address, toUnit(1));

			await sUSDSynth.issue(exersicer, sUSDQty);
			await market.mint(toUnit(1), { from: exersicer });

			const deposited = await market.deposited();
			const preTotalDeposited = await manager.totalDeposited();

			await fastForward(expiryDuration.add(toBN(timeToMaturity + 10)));
			await exchangeRates.updateRates([sAUDKey], [initialStrikePrice], await currentTime(), {
				from: oracle,
			});
			await manager.resolveMarket(market.address);
			await manager.expireMarkets([market.address], { from: managerOwner });

			assert.bnEqual(await manager.totalDeposited(), preTotalDeposited.sub(deposited));
		});

		it('Expired market emits no transfer if there is nothing to remit.', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(
				sAUDKey,
				initialStrikePrice,
				now,
				initialCreator,
				timeToMaturity
			);

			await fastForward(expiryDuration.add(toBN(timeToMaturity + 10)));
			await exchangeRates.updateRates([sAUDKey], [initialStrikePrice], await currentTime(), {
				from: oracle,
			});

			const marketAddress = market.address;
			await market.exerciseOptions({ from: initialCreator });

			const creatorBalance = await sUSDSynth.balanceOf(managerOwner);
			const tx = await manager.expireMarkets([market.address], { from: managerOwner });
			const postCreatorBalance = await sUSDSynth.balanceOf(managerOwner);
			assert.bnEqual(postCreatorBalance, creatorBalance);

			const log = tx.receipt.logs[0];
			assert.eventEqual(log, 'MarketExpired', {
				market: marketAddress,
			});

			const logs = Synth.decodeLogs(tx.receipt.rawLogs);
			assert.equal(logs.length, 0);
		});

		it('Market cannot be expired if the manager is paused', async () => {
			let now = await currentTime();
			await createMarketAndMintMore(
				sAUDKey,
				initialStrikePrice,
				now,
				initialCreator,
				timeToMaturity
			);

			await fastForward(expiryDuration.add(toBN(timeToMaturity + 10)));
			await exchangeRates.updateRates([sAUDKey], [initialStrikePrice], await currentTime(), {
				from: oracle,
			});
			await manager.resolveMarket(market.address);
			await manager.setPaused(true, { from: accounts[1] });
			await assert.revert(
				manager.expireMarkets([market.address], { from: initialCreator }),
				'This action cannot be performed while the contract is paused'
			);
			await manager.setPaused(false, { from: accounts[1] });
		});
	});
});
