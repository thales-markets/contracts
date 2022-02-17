'use strict';

const { artifacts, contract, web3 } = require('hardhat');
const { toBN } = web3.utils;

const BTC_TOTAL_MARKETCAP = '0x47E1e89570689c13E723819bf633548d611D630C';
const ETH_TOTAL_MARKETCAP = '0xAA2FE1324b84981832AafCf7Dc6E6Fe6cF124283';

const { assert, addSnapshotBeforeRestoreAfterEach } = require('../../utils/common');
const {
	fastForward,
	toUnit,
	currentTime,
	multiplyDecimalRound,
	divideDecimalRound,
} = require('../../utils')();
const { toBytes32 } = require('../../../index');
const { setupContract, setupAllContracts } = require('../../utils/setup');

const {
	ensureOnlyExpectedMutativeFunctions,
	onlyGivenAddressCanInvoke,
	getEventByName,
	getDecodedLogs,
	decodedEventEqual,
} = require('../../utils/helpers');

let PositionalMarketFactory, factory, PositionalMarketManager, manager, addressResolver;
let PositionalMarket, sUSDSynth, PositionalMarketMastercopy, PositionMastercopy;
let market, up, down, Position, Synth;
let customMarket;
let customOracle;

const ZERO_ADDRESS = '0x' + '0'.repeat(40);

const Phase = {
	Trading: toBN(0),
	Maturity: toBN(1),
	Expiry: toBN(2),
};

async function transactionEvent(tx, eventName) {
	let receipt = await tx.wait();
	return receipt.events.find(event => event['event'] && event['event'] === eventName);
}

contract('Position', accounts => {
	const [initialCreator, managerOwner, minter, dummy, exersicer, secondCreator] = accounts;
	let creator, owner;

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

	let timeToMaturity = 200;
	let totalDepositedAfterFees;

	const Side = {
		Up: toBN(0),
		Down: toBN(1),
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
			SynthsUSD: sUSDSynth,
		} = await setupAllContracts({
			accounts,
			synths: ['sUSD'],
			contracts: [
				'FeePool',
				'PositionalMarketMastercopy',
				'PositionMastercopy',
				'PositionalMarketFactory',
			],
		}));

		[creator, owner] = await ethers.getSigners();

		await manager.connect(creator).setPositionalMarketFactory(factory.address);

		await factory.connect(owner).setPositionalMarketManager(manager.address);
		await factory.connect(owner).setPositionalMarketMastercopy(PositionalMarketMastercopy.address);
		await factory.connect(owner).setPositionMastercopy(PositionMastercopy.address);

		await Promise.all([
			sUSDSynth.issue(initialCreator, sUSDQty),
			sUSDSynth.approve(manager.address, sUSDQty, { from: initialCreator }),
			sUSDSynth.issue(managerOwner, sUSDQty),
			sUSDSynth.approve(manager.address, sUSDQty, { from: managerOwner }),
			sUSDSynth.issue(minter, sUSDQty),
			sUSDSynth.approve(manager.address, sUSDQty, { from: minter }),
			sUSDSynth.issue(dummy, sUSDQty),
			sUSDSynth.approve(manager.address, sUSDQty, { from: dummy }),
		]);
	});

	describe('Integration test', () => {
		it('Can create a custom market', async () => {
			let FlippeningRatioOracleContract = artifacts.require('TestFlippeningRatioOracle');
			let feed = await FlippeningRatioOracleContract.new(
				managerOwner,
				ETH_TOTAL_MARKETCAP,
				BTC_TOTAL_MARKETCAP
			);

			// await feed.setResult('0x5b22555341222c2243484e222c22474252225d00000000000000000000000000', {
			// 	from: managerOwner,
			// });

			let FlippeningRatioOracleInstanceContract = artifacts.require(
				'FlippeningRatioOracleInstance'
			);

			customOracle = await FlippeningRatioOracleInstanceContract.new(
				managerOwner,
				feed.address,
				'BTC/ETH Flippening Market',
				toUnit(0.3),
				'flippening markets'
			);

			const now = await currentTime();

			const result = await manager.connect(creator).createMarket(
				toBytes32(''),
				0,
				now + timeToMaturity,
				toUnit(2).toString(),
				true,
				customOracle.address
			);

			const event = await transactionEvent(result, 'MarketCreated');

			customMarket = await PositionalMarket.at(
				event.args.market
			);
			const options = await customMarket.options();
			up = await Position.at(options.up);
			down = await Position.at(options.down);
			let upAddress = up.address;
			let downAddress = down.address;

			assert.eventEqual(event, 'MarketCreated', {
				creator: initialCreator,
				oracleKey: toBytes32(''),
				strikePrice: 0,
				maturityDate: toBN(now + timeToMaturity),
				expiryDate: toBN(now + timeToMaturity).add(expiryDuration),
				up: upAddress,
				down: downAddress,
				customMarket: true,
				customOracle: customOracle.address,
			});
		});

		it('Current side', async () => {
			assert.bnEqual(await customMarket.result(), Side.Up);
		});

		it('Can resolve a custom market', async () => {
			assert.isTrue(await customOracle.resolvable());
			assert.isFalse(await customMarket.canResolve());

			await fastForward(timeToMaturity + 100);

			assert.isTrue(await customOracle.resolvable());
			assert.isTrue(await customMarket.canResolve());

			await customOracle.setResolvable(true, {
				from: managerOwner,
			});

			assert.isFalse(await customMarket.resolved());
			assert.isTrue(await customOracle.resolvable());

			assert.bnEqual(await customMarket.phase(), Phase.Maturity);

			assert.isTrue(await customMarket.customMarket());

			assert.isTrue(await customMarket.canResolve());

			await manager.resolveMarket(customMarket.address);

			assert.isTrue(await customMarket.resolved());
			assert.bnEqual(await customMarket.result(), Side.Up);
		});

		it('Exercising options on custom market', async () => {
			assert.bnEqual(await up.balanceOf(initialCreator), toBN('2000000000000000000'));
			const tx1 = await customMarket.exerciseOptions({ from: initialCreator });
			// options no longer in the wallet
			assert.bnEqual(await up.balanceOf(initialCreator), toBN(0));
		});
	});
});
