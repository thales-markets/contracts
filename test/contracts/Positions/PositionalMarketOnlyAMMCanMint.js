'use strict';

const { artifacts, contract, web3 } = require('hardhat');
const { toBN } = web3.utils;

const { assert } = require('../../utils/common');
const { fastForward, toUnit, currentTime, multiplyDecimalRound } = require('../../utils')();
const { toBytes32 } = require('../../../index');
const { setupAllContracts } = require('../../utils/setup');

const {
	onlyGivenAddressCanInvoke,
	getDecodedLogs,
	decodedEventEqual,
	convertToDecimals,
} = require('../../utils/helpers');

let factory, manager;
let PositionalMarket,
	priceFeed,
	sUSDSynth,
	positionalMarketMastercopy,
	PositionMastercopy,
	thalesAMM;
let market, up, down, Position, Synth, addressResolver;

let aggregator_sAUD, aggregator_iAUD, aggregator_sUSD, aggregator_nonRate;

const ZERO_ADDRESS = '0x' + '0'.repeat(40);

const MockAggregator = artifacts.require('MockAggregatorV2V3');

const Phase = {
	Trading: toBN(0),
	Maturity: toBN(1),
	Expiry: toBN(2),
};

async function transactionEvent(tx, eventName) {
	let receipt = await tx.wait();
	return receipt.events.find((event) => event['event'] && event['event'] === eventName);
}

async function createMarketAndMintMore(
	sAUDKey,
	initialStrikePrice,
	now,
	initialCreator,
	timeToMaturityParam
) {
	const result = await manager
		.connect(initialCreator)
		.createMarket(
			sAUDKey,
			initialStrikePrice.toString(),
			now + timeToMaturityParam,
			toUnit(2).toString()
		);

	let receipt = await result.wait();
	const marketEvent = receipt.events.find(
		(event) => event['event'] && event['event'] === 'MarketCreated'
	);
	market = await PositionalMarket.at(marketEvent.args.market);
	await market.mint(toUnit(1), {
		from: initialCreator.address,
	});
}

contract('Position', (accounts) => {
	const [initialCreator, managerOwner, minter, dummy, exersicer, secondCreator] = accounts;
	let creator, owner, minterSigner, secondCreatorSigner, dummySigner, exerciserSigner;

	const sUSDQty = toUnit(10000);
	const maxOraclePriceAge = toBN(60 * 61);
	const expiryDuration = toBN(26 * 7 * 24 * 60 * 60);
	const maxTimeToMaturity = toBN(365 * 24 * 60 * 60);

	const initialStrikePrice = toUnit(100);
	const initialStrikePriceValue = 100;

	const sAUDKey = toBytes32('sAUD');
	const iAUDKey = toBytes32('iAUD');
	const sUSDKey = toBytes32('sUSD');
	const nonRate = toBytes32('nonExistent');

	let timeToMaturity = 200;
	let totalDeposited;

	const Side = {
		Up: toBN(0),
		Down: toBN(1),
	};

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
			PositionalMarketMastercopy: positionalMarketMastercopy,
			PositionMastercopy: PositionMastercopy,
			AddressResolver: addressResolver,
			PriceFeed: priceFeed,
			SynthsUSD: sUSDSynth,
		} = await setupAllContracts({
			accounts,
			synths: ['sUSD'],
			contracts: [
				'FeePool',
				'PriceFeed',
				'PositionalMarketMastercopy',
				'PositionMastercopy',
				'PositionalMarketFactory',
			],
		}));
		[creator, owner, minterSigner, dummySigner, exerciserSigner, secondCreatorSigner] =
			await ethers.getSigners();

		await manager.connect(creator).setPositionalMarketFactory(factory.address);

		await manager.connect(creator).setTimeframeBuffer(1);
		await manager.connect(creator).setPriceBuffer(toUnit(0.05).toString());

		await factory.connect(owner).setPositionalMarketManager(manager.address);
		await factory.connect(owner).setPositionalMarketMastercopy(positionalMarketMastercopy.address);
		await factory.connect(owner).setPositionMastercopy(PositionMastercopy.address);

		const hour = 60 * 60;
		let ThalesAMM = artifacts.require('ThalesAMM');
		thalesAMM = await ThalesAMM.new();
		await thalesAMM.initialize(
			owner.address,
			priceFeed.address,
			sUSDSynth.address,
			toUnit(1000),
			owner.address,
			toUnit(0.01),
			toUnit(0.05),
			hour * 2
		);

		await factory.connect(owner).setThalesAMM(thalesAMM.address);

		aggregator_sAUD = await MockAggregator.new({ from: managerOwner });
		aggregator_iAUD = await MockAggregator.new({ from: managerOwner });
		aggregator_sUSD = await MockAggregator.new({ from: managerOwner });
		aggregator_nonRate = await MockAggregator.new({ from: managerOwner });
		aggregator_sAUD.setDecimals('8');
		aggregator_iAUD.setDecimals('8');
		aggregator_sUSD.setDecimals('8');
		const timestamp = await currentTime();

		await aggregator_sAUD.setLatestAnswer(convertToDecimals(100, 8), timestamp);
		await aggregator_iAUD.setLatestAnswer(convertToDecimals(100, 8), timestamp);
		await aggregator_sUSD.setLatestAnswer(convertToDecimals(100, 8), timestamp);

		await priceFeed.connect(owner).addAggregator(sAUDKey, aggregator_sAUD.address);

		await priceFeed.connect(owner).addAggregator(iAUDKey, aggregator_iAUD.address);

		await priceFeed.connect(owner).addAggregator(sUSDKey, aggregator_sUSD.address);

		await priceFeed.connect(owner).addAggregator(nonRate, aggregator_nonRate.address);

		await thalesAMM.setImpliedVolatilityPerAsset(sAUDKey, toUnit(100), { from: owner.address });

		await Promise.all([
			sUSDSynth.issue(initialCreator, sUSDQty),
			sUSDSynth.approve(manager.address, sUSDQty, { from: initialCreator }),
			sUSDSynth.issue(minter, sUSDQty),
			sUSDSynth.approve(manager.address, sUSDQty, { from: minter }),
			sUSDSynth.issue(dummy, sUSDQty),
			sUSDSynth.approve(manager.address, sUSDQty, { from: dummy }),
		]);
	});

	describe('Minting only for AMM', () => {
		it('Cannot mint if not AMM', async () => {
			console.log('Setting market property');

			await manager.connect(creator).setOnlyAMMMintingAndBurning(true);

			console.log('Set market property');

			let now = await currentTime();

			const result = await manager
				.connect(creator)
				.createMarket(sAUDKey, toUnit(4).toString(), now + timeToMaturity, toUnit(0).toString());

			console.log('Created market');

			let receipt = await result.wait();
			const marketEvent = receipt.events.find(
				(event) => event['event'] && event['event'] === 'MarketCreated'
			);
			market = await PositionalMarket.at(marketEvent.args.market);
			await assert.revert(
				market.mint(toUnit(1), {
					from: minter,
				}),
				'Only allowed from ThalesAMM'
			);
		});
	});
});
