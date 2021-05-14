'use strict';

const { artifacts, contract, web3 } = require('hardhat');
const { toBN } = web3.utils;

const { assert, addSnapshotBeforeRestoreAfterEach } = require('./common');
const { fastForward, toUnit } = require('../utils')();
const { toBytes32 } = require('../..');
const { setupContract, setupAllContracts } = require('./setup');

const { ensureOnlyExpectedMutativeFunctions, onlyGivenAddressCanInvoke } = require('./helpers');

let BinaryOptionMarketFactory, factory, BinaryOptionMarketManager, manager, addressResolver;

const ZERO_ADDRESS = '0x' + '0'.repeat(40);

contract('BinaryOption', accounts => {
	const sUSDQty = toUnit(10000);

	const capitalRequirement = toUnit(2);
	const skewLimit = toUnit(0.05);
	const maxOraclePriceAge = toBN(60 * 61);
	const expiryDuration = toBN(26 * 7 * 24 * 60 * 60);
	const maxTimeToMaturity = toBN(365 * 24 * 60 * 60);

	const initialPoolFee = toUnit(0.008);
	const initialCreatorFee = toUnit(0.002);

	const initialFeeAddress = 0xfeefeefeefeefeefeefeefeefeefeefeefeefeef;

	const sAUDKey = toBytes32('sAUD');
	const iAUDKey = toBytes32('iAUD');

	before(async () => {
		({
			BinaryOptionMarketManager: manager,
			AddressResolver: addressResolver,
		} = await setupAllContracts({
			accounts,
			synths: ['sUSD'],
			contracts: [
				'BinaryOptionMarketMastercopy',
				'BinaryOptionMastercopy',
				'BinaryOptionMarketFactory',
				'ExchangeRates',
				'FeePool',
			],
		}));
	});

	describe('Basic Parameters', () => {
		it('Created the manager', async () => {
			console.log('Manager is:' + manager.address);
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
					'setBinaryOptionsMasterCopy',
					'setFeeAddress',
					'setCreatorCapitalRequirement',
					'setCreatorFee',
					'setExpiryDuration',
					'setMarketCreationEnabled',
					'setMaxOraclePriceAge',
					'setMaxTimeToMaturity',
					'setMigratingManager',
					'setPoolFee',
				],
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
			assert.bnEqual(await manager.totalDeposited(), toBN(0));
			assert.bnEqual(await manager.marketCreationEnabled(), true);
			assert.equal(await manager.resolver(), addressResolver.address);
			assert.equal(await manager.owner(), accounts[1]);
			assert.equal(await manager.feeAddress(), initialFeeAddress);
		});
	});
});
