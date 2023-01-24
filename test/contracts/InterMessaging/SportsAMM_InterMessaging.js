'use strict';

const { artifacts, contract, web3 } = require('hardhat');
const { toBN } = web3.utils;

const { assert, addSnapshotBeforeRestoreAfterEach } = require('../../utils/common');
const { setupAllContracts } = require('../../utils/setup');
const { toBytes32 } = require('../../../index');

var ethers2 = require('ethers');
var crypto = require('crypto');

const SECOND = 1000;
const HOUR = 3600;
const DAY = 86400;
const WEEK = 604800;
const YEAR = 31556926;

const {
	fastForward,
	toUnit,
	fromUnit,
	currentTime,
	bytesToString,
	multiplyDecimalRound,
	divideDecimalRound,
} = require('../../utils')();

const {
	onlyGivenAddressCanInvoke,
	convertToDecimals,
	encodeCall,
	assertRevert,
} = require('../../utils/helpers');

contract('SportsAMM', (accounts) => {
	const [manager, first, owner, second, third, fourth, safeBox, wrapper] = accounts;

	const ZERO_ADDRESS = '0x' + '0'.repeat(40);
	const MAX_NUMBER =
		'115792089237316195423570985008687907853269984665640564039457584007913129639935';

	const SportPositionContract = artifacts.require('SportPosition');
	const SportPositionalMarketContract = artifacts.require('SportPositionalMarket');
	const SportPositionalMarketDataContract = artifacts.require('SportPositionalMarketData');
	const SportPositionalMarketManagerContract = artifacts.require('SportPositionalMarketManager');
	const SportPositionalMarketFactoryContract = artifacts.require('SportPositionalMarketFactory');
	const SportPositionalMarketMasterCopyContract = artifacts.require(
		'SportPositionalMarketMastercopy'
	);
	const SportPositionMasterCopyContract = artifacts.require('SportPositionMastercopy');
	const StakingThalesContract = artifacts.require('StakingThales');
	const SportsAMMContract = artifacts.require('SportsAMM');
	const ThalesContract = artifacts.require('contracts/Token/OpThales_L1.sol:OpThales');
	const SNXRewardsContract = artifacts.require('SNXRewards');
	const AddressResolverContract = artifacts.require('AddressResolverHelper');
	const TestOddsContract = artifacts.require('TestOdds');
	const ReferralsContract = artifacts.require('Referrals');
	const SportsAMMUtils = artifacts.require('SportsAMMUtils');

	const ParlayAMMContract = artifacts.require('ParlayMarketsAMM');
	const ParlayMarketContract = artifacts.require('ParlayMarketMastercopy');
	const ParlayMarketDataContract = artifacts.require('ParlayMarketData');
	const ParlayVerifierContract = artifacts.require('ParlayVerifier');

	const CrossChainAdapterContract = artifacts.require('CrossChainAdapter');
	let CrossChainAdapter;

	let ThalesOracleCouncil;
	let Thales;
	let answer;
	let verifier;
	let minimumPositioningDuration = 0;
	let minimumMarketMaturityDuration = 0;
	let sportsAMMUtils;

	let marketQuestion,
		marketSource,
		endOfPositioning,
		positionAmount1,
		positionAmount2,
		positionAmount3,
		withdrawalAllowed,
		tag,
		paymentToken,
		phrases = [],
		deployedMarket,
		outcomePosition,
		outcomePosition2;

	let consumer;
	let TherundownConsumer;
	let TherundownConsumerImplementation;
	let TherundownConsumerDeployed;
	let MockTherundownConsumerWrapper;
	let initializeConsumerData;
	let gamesQueue;
	let game_1_create;
	let game_1_resolve;
	let gameid1;
	let oddsid;
	let oddsResult;
	let oddsResultArray;
	let reqIdOdds;
	let gameid2;
	let gameid3;
	let game_2_create;
	let game_2_resolve;
	let gamesCreated;
	let gamesResolved;
	let reqIdCreate;
	let reqIdResolve;
	let reqIdFootballCreate;
	let reqIdFootballCreate2;
	let gameFootballid1;
	let gameFootballid2;
	let gameFootballid3;
	let game_1_football_create;
	let game_2_football_create;
	let game_3_football_create;
	let gamesFootballCreated;
	let game_1_football_resolve;
	let game_2_football_resolve;
	let reqIdResolveFoodball;
	let gamesResolvedFootball;
	let GamesOddsObtainerDeployed;

	let SportPositionalMarketManager,
		SportPositionalMarketFactory,
		SportPositionalMarketData,
		SportPositionalMarket,
		SportPositionalMarketMastercopy,
		SportPositionMastercopy,
		StakingThales,
		SNXRewards,
		AddressResolver,
		TestOdds,
		curveSUSD,
		testUSDC,
		testUSDT,
		testDAI,
		Referrals,
		ParlayAMM,
		ParlayMarketData,
		ParlayVerifier,
		ParlayMarketMastercopy,
		SportsAMM;

	const game1NBATime = 1646958600;
	const gameFootballTime = 1649876400;

	const sportId_4 = 4; // NBA
	const sportId_16 = 16; // CHL
	const sportId_7 = 7; // UFC

	const tagID_4 = 9000 + sportId_4;
	const tagID_16 = 9000 + sportId_16;

	let gameMarket;

	const usdcQuantity = toBN(10000 * 1e6); //100 USDC

	const sAUDKey = toBytes32('sAUD');
	const sUSDKey = toBytes32('sUSD');
	const sETHKey = toBytes32('sETH');
	const nonRate = toBytes32('nonExistent');

	let PositionalMarket, Synth, PositionContract, managerContract, factory, addressResolver;
	let priceFeed, oracle, sUSDSynth, PositionalMarketMastercopy, PositionMastercopy;
	let creatorSigner, ownerSigner;
	const MockAggregator = artifacts.require('MockAggregatorV2V3');
	let aggregator_sAUD, aggregator_sETH, aggregator_sUSD, aggregator_nonRate;

	const sUSDQty = toUnit(1000);
	const sUSDQtyAmm = toUnit(10000);

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
	const Position = {
		UP: toBN(0),
		DOWN: toBN(1),
	};
	const hour = 60 * 60;
	const day = 24 * 60 * 60;

	let ThalesAMM, thalesAMM, ThalesAMMUtils, thalesAmmUtils;
	let priceFeedAddress, MockPriceFeedDeployed;
	let rewardTokenAddress;

	let parlayMarkets = [];
	let equalParlayMarkets = [];
	let parlayPositions = [];
	let parlaySingleMarketAddress;
	let parlaySingleMarket;
	let voucher;

	let parlayAMMfee = toUnit('0.05');
	let safeBoxImpact = toUnit('0.02');
	let minUSDAmount = '10';
	let maxSupportedAmount = '20000';
	let maxSupportedOdd = '0.005';

	let fightId,
		fight_create,
		fightCreated,
		game_fight_resolve_draw,
		reqIdFightCreate,
		reqIdFightResolve,
		game_fight_resolve,
		gamesFightResolved,
		reqIdFightResolveDraw,
		gamesFightResolvedDraw;
	const fightTime = 1660089600;

	before(async () => {
		fastForward(await currentTime());
		PositionalMarket = artifacts.require('PositionalMarket');
		Synth = artifacts.require('Synth');
		PositionContract = artifacts.require('Position');

		({
			PositionalMarketManager: managerContract,
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
				'FeePool',
				'PriceFeed',
				'PositionalMarketMastercopy',
				'PositionMastercopy',
				'PositionalMarketFactory',
			],
		}));

		[creatorSigner, ownerSigner] = await ethers.getSigners();

		await managerContract.setPositionalMarketFactory(factory.address);

		await factory.connect(ownerSigner).setPositionalMarketManager(managerContract.address);
		await factory
			.connect(ownerSigner)
			.setPositionalMarketMastercopy(PositionalMarketMastercopy.address);
		await factory.connect(ownerSigner).setPositionMastercopy(PositionMastercopy.address);

		await managerContract.connect(creatorSigner).setTimeframeBuffer(0);
		await managerContract.connect(creatorSigner).setPriceBuffer(toUnit(0.01).toString());
		await managerContract.connect(creatorSigner).setMaxTimeToMaturity(50 * day);

		aggregator_sAUD = await MockAggregator.new({ from: manager });
		aggregator_sETH = await MockAggregator.new({ from: manager });
		aggregator_sUSD = await MockAggregator.new({ from: manager });
		aggregator_nonRate = await MockAggregator.new({ from: manager });
		aggregator_sAUD.setDecimals('8');
		aggregator_sETH.setDecimals('8');
		aggregator_sUSD.setDecimals('8');
		const timestamp = await currentTime();

		await aggregator_sAUD.setLatestAnswer(convertToDecimals(100, 8), timestamp);
		await aggregator_sETH.setLatestAnswer(convertToDecimals(10000, 8), timestamp);
		await aggregator_sUSD.setLatestAnswer(convertToDecimals(100, 8), timestamp);

		await priceFeed.connect(ownerSigner).addAggregator(sAUDKey, aggregator_sAUD.address);

		await priceFeed.connect(ownerSigner).addAggregator(sETHKey, aggregator_sETH.address);

		await priceFeed.connect(ownerSigner).addAggregator(sUSDKey, aggregator_sUSD.address);

		await priceFeed.connect(ownerSigner).addAggregator(nonRate, aggregator_nonRate.address);

		await Promise.all([
			sUSDSynth.issue(first, sUSDQty),
			sUSDSynth.approve(managerContract.address, sUSDQty, { from: first }),
			sUSDSynth.issue(second, sUSDQty),
			sUSDSynth.approve(managerContract.address, sUSDQty, { from: second }),
			sUSDSynth.issue(third, sUSDQty),
			sUSDSynth.approve(managerContract.address, sUSDQty, { from: third }),
		]);

		priceFeedAddress = owner;
		rewardTokenAddress = owner;

		let MockPriceFeed = artifacts.require('MockPriceFeed');
		MockPriceFeedDeployed = await MockPriceFeed.new(owner);
		await MockPriceFeedDeployed.setPricetoReturn(10000);

		priceFeedAddress = MockPriceFeedDeployed.address;

		ThalesAMM = artifacts.require('ThalesAMM');
		thalesAMM = await ThalesAMM.new();
		await thalesAMM.initialize(
			owner,
			priceFeedAddress,
			sUSDSynth.address,
			toUnit(1000),
			owner,
			toUnit(0.01),
			toUnit(0.05),
			hour * 2
		);
		await thalesAMM.setPositionalMarketManager(managerContract.address, { from: owner });
		await thalesAMM.setImpliedVolatilityPerAsset(sETHKey, toUnit(120), { from: owner });
		await thalesAMM.setSafeBoxData(safeBox, toUnit(0.01), { from: owner });
		await thalesAMM.setMinMaxSupportedPriceAndCap(toUnit(0.05), toUnit(0.95), toUnit(20000), {
			from: owner,
		});

		ThalesAMMUtils = artifacts.require('ThalesAMMUtils');
		thalesAmmUtils = await ThalesAMMUtils.new();
		await thalesAMM.setAmmUtils(thalesAmmUtils.address, {
			from: owner,
		});

		sUSDSynth.issue(thalesAMM.address, sUSDQtyAmm);

		await factory.connect(ownerSigner).setThalesAMM(thalesAMM.address);
	});

	beforeEach(async () => {
		SportPositionalMarketManager = await SportPositionalMarketManagerContract.new({
			from: manager,
		});
		SportPositionalMarketFactory = await SportPositionalMarketFactoryContract.new({
			from: manager,
		});
		SportPositionalMarketMastercopy = await SportPositionalMarketContract.new({ from: manager });
		SportPositionMastercopy = await SportPositionContract.new({ from: manager });
		SportPositionalMarketData = await SportPositionalMarketDataContract.new({ from: manager });
		StakingThales = await StakingThalesContract.new({ from: manager });
		SportsAMM = await SportsAMMContract.new({ from: manager });
		SNXRewards = await SNXRewardsContract.new({ from: manager });
		AddressResolver = await AddressResolverContract.new();
		CrossChainAdapter = await CrossChainAdapterContract.new({ from: manager });
		await CrossChainAdapter.initialize(owner, owner, { from: owner });
		// TestOdds = await TestOddsContract.new();
		Thales = await ThalesContract.new({ from: owner });
		let GamesQueue = artifacts.require('GamesQueue');
		gamesQueue = await GamesQueue.new({ from: owner });
		await gamesQueue.initialize(owner, { from: owner });

		await SportPositionalMarketManager.initialize(manager, Thales.address, { from: manager });
		await SportPositionalMarketFactory.initialize(manager, { from: manager });

		await SportPositionalMarketManager.setExpiryDuration(5 * DAY, { from: manager });
		// await SportPositionalMarketManager.setCancelTimeout(2 * HOUR, { from: manager });

		await SportPositionalMarketFactory.setSportPositionalMarketManager(
			SportPositionalMarketManager.address,
			{ from: manager }
		);
		await SportPositionalMarketFactory.setSportPositionalMarketMastercopy(
			SportPositionalMarketMastercopy.address,
			{ from: manager }
		);
		await SportPositionalMarketFactory.setSportPositionMastercopy(SportPositionMastercopy.address, {
			from: manager,
		});
		// await SportPositionalMarketFactory.setLimitOrderProvider(SportsAMM.address, { from: manager });
		await SportPositionalMarketFactory.setSportsAMM(SportsAMM.address, { from: manager });
		await SportPositionalMarketManager.setSportPositionalMarketFactory(
			SportPositionalMarketFactory.address,
			{ from: manager }
		);
		await SportPositionalMarketManager.setWhitelistedAddresses([first, third], true, 1, {
			from: manager,
		});
		await SportPositionalMarketManager.setWhitelistedAddresses([first, second], true, 2, {
			from: manager,
		});

		Referrals = await ReferralsContract.new();
		await Referrals.initialize(owner, ZERO_ADDRESS, ZERO_ADDRESS, { from: owner });

		await SportsAMM.initialize(
			owner,
			Thales.address,
			toUnit('5000'),
			toUnit('0.02'),
			toUnit('0.2'),
			DAY,
			{ from: owner }
		);

		await SportsAMM.setParameters(
			DAY,
			toUnit('0.02'),
			toUnit('0.2'),
			toUnit('0.001'),
			toUnit('0.9'),
			toUnit('5000'),
			toUnit('0.01'),
			toUnit('0.005'),
			{ from: owner }
		);

		await SportsAMM.setSportsPositionalMarketManager(SportPositionalMarketManager.address, {
			from: owner,
		});

		sportsAMMUtils = await SportsAMMUtils.new();
		await SportsAMM.setAmmUtils(sportsAMMUtils.address, {
			from: owner,
		});

		await SportPositionalMarketData.initialize(owner, { from: owner });
		await StakingThales.initialize(
			owner,
			Thales.address,
			Thales.address,
			Thales.address,
			WEEK,
			WEEK,
			SNXRewards.address,
			{ from: owner }
		);
		await StakingThales.setAddresses(
			SNXRewards.address,
			second,
			second,
			second,
			second,
			SportsAMM.address,
			second,
			second,
			second,
			{ from: owner }
		);

		await Thales.transfer(first, toUnit('1000'), { from: owner });
		await Thales.transfer(second, toUnit('1000'), { from: owner });
		await Thales.transfer(third, toUnit('1000'), { from: owner });
		await Thales.transfer(SportsAMM.address, toUnit('100000'), { from: owner });

		await Thales.approve(SportsAMM.address, toUnit('1000'), { from: first });
		await Thales.approve(SportsAMM.address, toUnit('1000'), { from: second });
		await Thales.approve(SportsAMM.address, toUnit('1000'), { from: third });

		// ids
		gameid1 = '0x6536306366613738303834366166363839373862343935373965356366333936';
		gameid2 = '0x3937346533663036386233333764313239656435633133646632376133326662';

		// await TestOdds.addOddsForGameId(gameid1, [toUnit(0.8), toUnit(0.1899999), toUnit(0)]);

		// create game props
		game_1_create =
			'0x0000000000000000000000000000000000000000000000000000000000000020653630636661373830383436616636383937386234393537396535636633393600000000000000000000000000000000000000000000000000000000625755f0ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffaf240000000000000000000000000000000000000000000000000000000000004524ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffaf2400000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000120000000000000000000000000000000000000000000000000000000000000000d41746c616e7461204861776b73000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000011436861726c6f74746520486f726e657473000000000000000000000000000000';
		game_2_create =
			'0x0000000000000000000000000000000000000000000000000000000000000020393734653366303638623333376431323965643563313364663237613332666200000000000000000000000000000000000000000000000000000000625755f0ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffaf240000000000000000000000000000000000000000000000000000000000004524ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffaf2400000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000120000000000000000000000000000000000000000000000000000000000000000d41746c616e7461204861776b73000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000011436861726c6f74746520486f726e657473000000000000000000000000000000';
		gamesCreated = [game_1_create, game_2_create];
		reqIdCreate = '0x65da2443ccd66b09d4e2693933e8fb9aab9addf46fb93300bd7c1d70c5e21666';

		fightId = '0x3234376564326334663865313462396538343833353636353361373863393962';
		// create fight props
		fight_create =
			'0x000000000000000000000000000000000000000000000000000000000000002032343765643263346638653134623965383438333536363533613738633939620000000000000000000000000000000000000000000000000000000062f2f500ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff5f100000000000000000000000000000000000000000000000000000000000007c9c000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000001200000000000000000000000000000000000000000000000000000000000000011436c6179746f6e2043617270656e746572000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000d4564676172204368616972657a00000000000000000000000000000000000000';
		fightCreated = [fight_create];
		reqIdFightCreate = '0x1e4ef9996d321a4445068689e63fe393a5860cc98a0df22da1ac877d8cfd37d3';

		// resolve game props
		reqIdFightResolve = '0x6b5d983afa1e2da68d49e1e1e5d963cb7d93e971329e4dac36a9697234584c68';
		game_fight_resolve =
			'0x3234376564326334663865313462396538343833353636353361373863393962000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008';
		gamesFightResolved = [game_fight_resolve];

		reqIdFightResolveDraw = '0x6b5d983afa1e2da68d49e1e1e5d963cb7d93e971329e4dac36a9697234584c68';
		game_fight_resolve_draw =
			'0x3234376564326334663865313462396538343833353636353361373863393962000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008';
		gamesFightResolvedDraw = [game_fight_resolve_draw];

		// resolve game props
		reqIdResolve = '0x30250573c4b099aeaf06273ef9fbdfe32ab2d6b8e33420de988be5d6886c92a7';
		game_1_resolve =
			'0x653630636661373830383436616636383937386234393537396535636633393600000000000000000000000000000000000000000000000000000000000000640000000000000000000000000000000000000000000000000000000000000081000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000622a9808';
		game_2_resolve =
			'0x393734653366303638623333376431323965643563313364663237613332666200000000000000000000000000000000000000000000000000000000000000660000000000000000000000000000000000000000000000000000000000000071000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000622a9808';
		gamesResolved = [game_1_resolve, game_2_resolve];

		// football matches
		reqIdFootballCreate = '0x61d7dd698383c58c7217cf366764a1e92a1f059b1b6ea799dce4030a942302f4';
		reqIdFootballCreate2 = '0x47e3535f7d3c146606fa6bcc06d95eb74f0bf8eac7d0d9c352814ee4c726d194';
		gameFootballid1 = '0x3163626162623163303138373465363263313661316462333164363164353333';
		gameFootballid2 = '0x3662646437313731316337393837643336643465333538643937393237356234';
		gameFootballid3 = '0x6535303439326161636538313035666362316531366364373664383963643361';
		// await TestOdds.addOddsForGameId(gameFootballid1, [toUnit(0.55), toUnit(0.1), toUnit(0.35)]);
		game_1_football_create =
			'0x000000000000000000000000000000000000000000000000000000000000002031636261626231633031383734653632633136613164623331643631643533330000000000000000000000000000000000000000000000000000000062571db00000000000000000000000000000000000000000000000000000000000009c40ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffcf2c0000000000000000000000000000000000000000000000000000000000006a4000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000120000000000000000000000000000000000000000000000000000000000000001f41746c657469636f204d61647269642041746c657469636f204d616472696400000000000000000000000000000000000000000000000000000000000000001f4d616e636865737465722043697479204d616e63686573746572204369747900';
		game_2_football_create =
			'0x000000000000000000000000000000000000000000000000000000000000002036626464373137313163373938376433366434653335386439373932373562340000000000000000000000000000000000000000000000000000000062571db0ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff76800000000000000000000000000000000000000000000000000000000000018c18000000000000000000000000000000000000000000000000000000000000cb2000000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000012000000000000000000000000000000000000000000000000000000000000000134c69766572706f6f6c204c69766572706f6f6c00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000f42656e666963612042656e666963610000000000000000000000000000000000';
		game_3_football_create =
			'0x0000000000000000000000000000000000000000000000000000000000000020653530343932616163653831303566636231653136636437366438396364336100000000000000000000000000000000000000000000000000000000629271300000000000000000000000000000000000000000000000000000000000002a3000000000000000000000000000000000000000000000000000000000000064c800000000000000000000000000000000000000000000000000000000000067e800000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000012000000000000000000000000000000000000000000000000000000000000000134c69766572706f6f6c204c69766572706f6f6c0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000175265616c204d6164726964205265616c204d6164726964000000000000000000';
		gamesFootballCreated = [game_1_football_create, game_2_football_create, game_3_football_create];
		game_1_football_resolve =
			'0x316362616262316330313837346536326331366131646233316436316435333300000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000b0000000000000000000000000000000000000000000000000000000062571db0';
		game_2_football_resolve =
			'0x366264643731373131633739383764333664346533353864393739323735623400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000b0000000000000000000000000000000000000000000000000000000062571db0';
		reqIdResolveFoodball = '0xff8887a8535b7a8030962e6f6b1eba61c0f1cb82f706e77d834f15c781e47697';
		gamesResolvedFootball = [game_1_football_resolve, game_2_football_resolve];

		oddsid = '0x6135363061373861363135353239363137366237393232353866616336613532';
		oddsResult =
			'0x6135363061373861363135353239363137366237393232353866616336613532000000000000000000000000000000000000000000000000000000000000283cffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffd3dc0000000000000000000000000000000000000000000000000000000000000000';
		oddsResultArray = [oddsResult];
		reqIdOdds = '0x5bf0ea636f9515e1e1060e5a21e11ef8a628fa99b1effb8aa18624b02c6f36de';
		// reqIdOdds2 = '';

		TherundownConsumer = artifacts.require('TherundownConsumer');
		TherundownConsumerDeployed = await TherundownConsumer.new();

		await TherundownConsumerDeployed.initialize(
			owner,
			[sportId_4, sportId_16, sportId_7],
			SportPositionalMarketManager.address,
			[sportId_4, sportId_7],
			gamesQueue.address,
			[8, 12], // resolved statuses
			[1, 2], // cancel statuses
			{ from: owner }
		);

		let ConsumerVerifier = artifacts.require('TherundownConsumerVerifier');
		verifier = await ConsumerVerifier.new({ from: owner });

		await verifier.initialize(
			owner,
			TherundownConsumerDeployed.address,
			['TDB TDB', 'TBA TBA'],
			['create', 'resolve'],
			20,
			{
				from: owner,
			}
		);

		let GamesOddsObtainer = artifacts.require('GamesOddsObtainer');
		GamesOddsObtainerDeployed = await GamesOddsObtainer.new({ from: owner });

		await GamesOddsObtainerDeployed.initialize(
			owner,
			TherundownConsumerDeployed.address,
			verifier.address,
			SportPositionalMarketManager.address,
			[4, 16],
			{ from: owner }
		);

		await Thales.transfer(TherundownConsumerDeployed.address, toUnit('1000'), { from: owner });
		await TherundownConsumerDeployed.setSportContracts(
			wrapper,
			gamesQueue.address,
			SportPositionalMarketManager.address,
			verifier.address,
			GamesOddsObtainerDeployed.address,
			{
				from: owner,
			}
		);
		await TherundownConsumerDeployed.addToWhitelist(third, true, { from: owner });
		await TherundownConsumerDeployed.addToWhitelist(SportPositionalMarketManager.address, true, {
			from: owner,
		});

		await SportPositionalMarketManager.setTherundownConsumer(TherundownConsumerDeployed.address, {
			from: manager,
		});
		await gamesQueue.setConsumerAddress(TherundownConsumerDeployed.address, { from: owner });

		await SportPositionalMarketData.setSportPositionalMarketManager(
			SportPositionalMarketManager.address,
			{ from: owner }
		);
		await SportPositionalMarketData.setSportsAMM(SportsAMM.address, { from: owner });

		let TestUSDC = artifacts.require('TestUSDC');
		testUSDC = await TestUSDC.new();
		testUSDT = await TestUSDC.new();

		let ERC20token = artifacts.require('Thales');
		testDAI = await ERC20token.new();

		let CurveSUSD = artifacts.require('MockCurveSUSD');
		curveSUSD = await CurveSUSD.new(
			Thales.address,
			testUSDC.address,
			testUSDT.address,
			testDAI.address
		);

		await SportsAMM.setCurveSUSD(
			curveSUSD.address,
			testDAI.address,
			testUSDC.address,
			testUSDT.address,
			true,
			toUnit(0.02),
			{ from: owner }
		);

		await SportsAMM.setAddresses(
			owner,
			Thales.address,
			TherundownConsumerDeployed.address,
			StakingThales.address,
			Referrals.address,
			ZERO_ADDRESS,
			wrapper,
			{ from: owner }
		);

		await testUSDC.mint(first, toUnit(1000));
		await testUSDC.mint(curveSUSD.address, toUnit(1000));
		await testUSDC.approve(SportsAMM.address, toUnit(1000), { from: first });
		await SportsAMM.setCapPerSport(tagID_4, toUnit('50000'), { from: owner });

		ParlayMarketMastercopy = await ParlayMarketContract.new({ from: manager });

		ParlayAMM = await ParlayAMMContract.new({ from: manager });

		await ParlayAMM.initialize(
			owner,
			SportsAMM.address,
			SportPositionalMarketManager.address,
			parlayAMMfee,
			toUnit(maxSupportedAmount),
			toUnit(maxSupportedOdd),
			Thales.address,
			safeBox,
			safeBoxImpact,
			{ from: owner }
		);

		await ParlayAMM.setAmounts(
			toUnit(minUSDAmount),
			toUnit(maxSupportedAmount),
			toUnit(maxSupportedOdd),
			parlayAMMfee,
			safeBoxImpact,
			toUnit(0.05),
			toUnit(1860),
			{
				from: owner,
			}
		);

		await Thales.approve(ParlayAMM.address, toUnit('1000'), { from: first });
		await Thales.approve(ParlayAMM.address, toUnit('1000'), { from: second });
		await Thales.approve(ParlayAMM.address, toUnit('1000'), { from: third });

		ParlayMarketData = await ParlayMarketDataContract.new({ from: manager });
		ParlayVerifier = await ParlayVerifierContract.new({ from: manager });

		await ParlayMarketData.initialize(owner, ParlayAMM.address);

		await ParlayAMM.setAddresses(
			SportsAMM.address,
			safeBox,
			Referrals.address,
			ParlayMarketData.address,
			ParlayVerifier.address,
			{ from: owner }
		);

		await ParlayAMM.setParlayMarketMastercopies(ParlayMarketMastercopy.address, { from: owner });
		await Thales.transfer(ParlayAMM.address, toUnit('20000'), { from: owner });

		await ParlayAMM.setParameters(5, { from: owner });

		await SportsAMM.setAddresses(
			owner,
			Thales.address,
			TherundownConsumerDeployed.address,
			StakingThales.address,
			Referrals.address,
			ParlayAMM.address,
			wrapper,
			{ from: owner }
		);

		await ParlayAMM.setCurveSUSD(
			curveSUSD.address,
			testDAI.address,
			testUSDC.address,
			testUSDT.address,
			true,
			toUnit(0.02),
			{ from: owner }
		);

		Referrals.setSportsAMM(SportsAMM.address, ParlayAMM.address, { from: owner });

		await testUSDC.mint(first, toUnit(1000));
		await testUSDC.mint(curveSUSD.address, toUnit(1000));
		await testUSDC.approve(ParlayAMM.address, toUnit(1000), { from: first });
		await testUSDC.approve(CrossChainAdapter.address, toUnit(1000), { from: first });

		await thalesAMM.setCurveSUSD(
			curveSUSD.address,
			testDAI.address,
			testUSDC.address,
			testUSDT.address,
			true,
			toUnit(0.02),
			{ from: owner }
		);

		await testUSDC.approve(thalesAMM.address, usdcQuantity, { from: first });

		await CrossChainAdapter.setWhitelistedOperator(owner, true, { from: owner });
		await CrossChainAdapter.setWhitelistedAddress(second, true, { from: owner });
		await CrossChainAdapter.setPaymentToken(Thales.address, { from: owner });
		await CrossChainAdapter.setParameters(
			CrossChainAdapter.address,
			111,
			ParlayAMM.address,
			'1000000',
			'40000000000000000',
			toUnit(0.02),
			{
				from: owner,
			}
		);
		await Thales.transfer(CrossChainAdapter.address, toUnit('1000'), { from: owner });
		await CrossChainAdapter.setSelectorAddress(
			'buyFromSportAMM(address,uint8,uint256,uint256,address)',
			SportsAMM.address,
			{ from: owner }
		);
		await CrossChainAdapter.setSelectorAddress(
			'buyFromParlayWithDifferentCollateralAndReferrer(address[],uint256[],uint256,uint256,uint256,address,address)',
			ParlayAMM.address,
			{ from: owner }
		);
		await CrossChainAdapter.setSelectorAddress(
			'buyFromCryptoAMM(address,uint8,uint256,uint256,address)',
			thalesAMM.address,
			{ from: owner }
		);
		await CrossChainAdapter.setSelectorAddress(
			'exerciseSportPosition(address,uint8)',
			CrossChainAdapter.address,
			{ from: owner }
		);
		await CrossChainAdapter.setSelectorAddress('exerciseParlay(address)', ParlayAMM.address, {
			from: owner,
		});
	});

	describe('Test SportsAMM', () => {
		let deployedMarket;
		let answer;
		beforeEach(async () => {
			await fastForward(game1NBATime - (await currentTime()) - SECOND);
			// req. games
			const tx = await TherundownConsumerDeployed.fulfillGamesCreated(
				reqIdCreate,
				gamesCreated,
				sportId_4,
				game1NBATime,
				{ from: wrapper }
			);

			let game = await TherundownConsumerDeployed.gameCreated(gameid1);
			let gameTime = game.startTime;
			await TherundownConsumerDeployed.createMarketForGame(gameid1);
			await TherundownConsumerDeployed.marketPerGameId(gameid1);
			answer = await SportPositionalMarketManager.getActiveMarketAddress('0');
			deployedMarket = await SportPositionalMarketContract.at(answer.toString());
		});
		let position = 0;
		let value = 100;

		it('Multi-collateral buy from amm', async () => {
			position = 1;
			value = 100;
			let odds = [];
			odds[0] = await SportsAMM.obtainOdds(deployedMarket.address, 0);
			odds[1] = await SportsAMM.obtainOdds(deployedMarket.address, 1);
			odds[2] = await SportsAMM.obtainOdds(deployedMarket.address, 2);
			console.log('Game odds: 0=', fromUnit(odds[0]), ', 1=', fromUnit(odds[1]));
			let optionsCount = await deployedMarket.optionsCount();
			console.log('Positions count: ', optionsCount.toString());
			let availableToBuy = await SportsAMM.availableToBuyFromAMM(deployedMarket.address, position);
			let additionalSlippage = toUnit(0.5);
			let buyFromAmmQuote = await SportsAMM.buyFromAmmQuote(
				deployedMarket.address,
				position,
				toUnit(value)
			);
			await Thales.approve(SportsAMM.address, toUnit(100000), { from: first });
			console.log('buyFromAmmQuote decimal is: ', fromUnit(buyFromAmmQuote));

			let buyFromAmmQuoteUSDCCollateralObject =
				await SportsAMM.buyFromAmmQuoteWithDifferentCollateral(
					deployedMarket.address,
					position,
					toUnit(value),
					testUSDC.address
				);
			let buyFromAmmQuoteUSDCCollateral = buyFromAmmQuoteUSDCCollateralObject[0];
			console.log(
				'buyFromAmmQuoteWithDifferentCollateral USDC: ',
				buyFromAmmQuoteUSDCCollateral / 1e6
			);

			assert.equal(buyFromAmmQuoteUSDCCollateral / 1e6 > fromUnit(buyFromAmmQuote), true);

			let buyFromAmmQuoteDAICollateralObject =
				await SportsAMM.buyFromAmmQuoteWithDifferentCollateral(
					deployedMarket.address,
					position,
					toUnit(value),
					testDAI.address
				);
			let buyFromAmmQuoteDAICollateral = buyFromAmmQuoteDAICollateralObject[0];
			console.log(
				'buyFromAmmQuoteWithDifferentCollateral DAI: ',
				buyFromAmmQuoteDAICollateral / 1e18
			);

			assert.equal(fromUnit(buyFromAmmQuoteDAICollateral) > fromUnit(buyFromAmmQuote), true);

			answer = await Thales.balanceOf(first);
			let initial_balance = answer;
			console.log('acc sUSD balance before buy: ', fromUnit(answer));
			console.log('buyQuote: ', fromUnit(buyFromAmmQuote));
			answer = await SportsAMM.buyFromAMM(
				deployedMarket.address,
				position,
				toUnit(value),
				buyFromAmmQuote,
				additionalSlippage,
				{ from: first }
			);

			let userBalance = await testUSDC.balanceOf(first);
			let sportsAMMBalanceUSDC = await testUSDC.balanceOf(SportsAMM.address);
			let sportsAMMBalance = await Thales.balanceOf(SportsAMM.address);
			console.log('Balance of USDC for user: ', fromUnit(userBalance));
			console.log('Balance of USDC for sportsAMM: ', fromUnit(sportsAMMBalanceUSDC));
			console.log('Balance of sUSD for sportsAMM: ', fromUnit(sportsAMMBalance));

			await SportsAMM.buyFromAMMWithDifferentCollateral(
				deployedMarket.address,
				position,
				toUnit(value),
				buyFromAmmQuoteUSDCCollateral,
				additionalSlippage,
				testUSDC.address,
				{ from: first }
			);

			userBalance = await testUSDC.balanceOf(first);
			sportsAMMBalanceUSDC = await testUSDC.balanceOf(SportsAMM.address);
			sportsAMMBalance = await Thales.balanceOf(SportsAMM.address);
			console.log('after buy user balance: ', fromUnit(userBalance));
			console.log('after buy sportsAMM USDC balance: ', fromUnit(sportsAMMBalanceUSDC));
			console.log('after buy sportsAMM sUSD balance: ', fromUnit(sportsAMMBalance));
		});

		it('CrossChain Buy from SportsAMM, position 1, value: 100', async () => {
			position = 1;
			value = 100;
			let availableToBuy = await SportsAMM.availableToBuyFromAMM(deployedMarket.address, 1);
			let additionalSlippage = toUnit(0.01);
			let buyFromAmmQuoteUSDCCollateral = await SportsAMM.buyFromAmmQuoteWithDifferentCollateral(
				deployedMarket.address,
				position,
				toUnit(value),
				testUSDC.address
			);
			let buyFromAmmQuote = buyFromAmmQuoteUSDCCollateral[0];
			console.log(buyFromAmmQuote);
			answer = await Thales.balanceOf(first);
			let before_balance = answer;
			console.log('acc balance: ', fromUnit(answer));
			console.log('buyQuote: ', fromUnit(buyFromAmmQuote));

			console.log('SPORTS AMM addres: ', SportsAMM.address);
			console.log('Market addres: ', deployedMarket.address);
			await Thales.approve(CrossChainAdapter.address, toUnit(101), { from: first });

			let tx = await CrossChainAdapter.buyFromSportAMM(
				testUSDC.address,
				deployedMarket.address,
				1,
				toUnit(100),
				buyFromAmmQuote,
				111,
				{ from: first }
			);
			console.log(tx.logs[0].args);

			let tx2 = await CrossChainAdapter.executeSportBuyMessage(
				second,
				testUSDC.address,
				buyFromAmmQuote,
				111,
				tx.logs[0].args.message,
				third,
				{ from: owner, value: 10000 }
			);
			// let tx2 = await CrossChainAdapter.executeBuyMessage(tx.logs[0].args.message, { from: owner });
			console.log('\n\nTX2');
			console.log(tx2.logs[0].args);
		});

		describe('Exercise market', () => {
			let newMarket;
			before(async () => {
				await fastForward(await currentTime());
				let now = await currentTime();
				newMarket = await createMarket(
					managerContract,
					sETHKey,
					toUnit(12000),
					now + day * 12,
					0,
					creatorSigner,
					{ from: first }
				);
			});
			beforeEach(async () => {
				let availableToBuy = await SportsAMM.availableToBuyFromAMM(deployedMarket.address, 1);
				let additionalSlippage = toUnit(0.01);
				let buyFromAmmQuoteUSDCCollateral = await SportsAMM.buyFromAmmQuoteWithDifferentCollateral(
					deployedMarket.address,
					1,
					toUnit(100),
					testUSDC.address
				);
				let buyFromAmmQuote = buyFromAmmQuoteUSDCCollateral[0];
				console.log(buyFromAmmQuote);
				answer = await Thales.balanceOf(first);
				let before_balance = answer;
				await Thales.approve(CrossChainAdapter.address, toUnit(101), { from: first });

				let tx = await CrossChainAdapter.buyFromSportAMM(
					testUSDC.address,
					deployedMarket.address,
					1,
					toUnit(100),
					buyFromAmmQuote,
					111,
					{ from: first }
				);

				let tx2 = await CrossChainAdapter.executeSportBuyMessage(
					second,
					testUSDC.address,
					buyFromAmmQuote,
					111,
					tx.logs[0].args.message,
					third,
					{ from: owner, value: 10000 }
				);
				await fastForward(await currentTime());
				let position = 0;
				let resolveResult = '2';
				let gameId = await TherundownConsumerDeployed.gameIdPerMarket(deployedMarket.address);
				let homeResult = '0';
				let awayResult = '0';
				if (resolveResult == '1') {
					homeResult = '1';
				} else if (resolveResult == '2') {
					awayResult = '1';
				} else if (resolveResult == '3') {
					homeResult = '1';
					awayResult = '1';
				}
				const tx_resolve_4 = await TherundownConsumerDeployed.resolveMarketManually(
					deployedMarket.address,
					resolveResult,
					homeResult,
					awayResult,
					{ from: owner }
				);
			});
			it('Exercise position', async () => {
				let position = 1;
				answer = await Thales.balanceOf(first);
				let initialBalance = fromUnit(answer);
				let tx = await CrossChainAdapter.exerciseSportPosition(
					deployedMarket.address,
					position,
					111,
					{ from: first }
				);
				console.log(tx.logs[0].args);
				let tx2 = await CrossChainAdapter.executeBuyMessage(tx.logs[0].args.message, {
					from: owner,
				});
				console.log('\n\nTX2');
				console.log(tx2.logs[0].args);
				answer = await Thales.balanceOf(first);
				console.log('\n\nInitial balance: ', initialBalance);
				console.log('Final balance: ', fromUnit(answer));
			});
			it('buying test using regular contract call', async () => {
				let priceUp = await thalesAMM.price(newMarket.address, Position.UP);
				//console.log('priceUp decimal is:' + priceUp / 1e18);

				let availableToBuyFromAMM = await thalesAMM.availableToBuyFromAMM(
					newMarket.address,
					Position.UP
				);
				//console.log('availableToBuyFromAMM decimal is:' + availableToBuyFromAMM / 1e18);

				let buyPriceImpactMax = await thalesAMM.buyPriceImpact(
					newMarket.address,
					Position.UP,
					toUnit(availableToBuyFromAMM / 1e18)
				);
				//console.log('buyPriceImpactMax decimal is:' + buyPriceImpactMax / 1e18);

				let buyFromAmmQuote = await thalesAMM.buyFromAmmQuote(
					newMarket.address,
					Position.UP,
					toUnit(availableToBuyFromAMM / 1e18)
				);
				//console.log('buyFromAmmQuote decimal is:' + buyFromAmmQuote / 1e18);

				await sUSDSynth.approve(thalesAMM.address, sUSDQty, { from: second });
				let additionalSlippage = toUnit(0.01);
				buyFromAmmQuote = await thalesAMM.buyFromAmmQuote(
					newMarket.address,
					Position.UP,
					toUnit(500)
				);
				await thalesAMM.buyFromAMM(
					newMarket.address,
					Position.UP,
					toUnit(500),
					buyFromAmmQuote,
					additionalSlippage,
					{ from: second }
				);

				//console.log('availableToBuyFromAMM post buy max decimal is:' + availableToBuyFromAMM / 1e18);
			});

			it('buying test using Cross-Chain logic', async () => {
				await CrossChainAdapter.setPaymentToken(sUSDSynth.address, { from: owner });
				await CrossChainAdapter.setSelectorAddress(
					'buyFromCryptoAMM(address,uint8,uint256,uint256,uint256)',
					thalesAMM.address,
					{ from: owner }
				);
				await CrossChainAdapter.setSelectorAddress(
					'exerciseCryptoPosition(address,uint8)',
					thalesAMM.address,
					{ from: owner }
				);
				sUSDSynth.issue(thalesAMM.address, sUSDQtyAmm);
				let priceUp = await thalesAMM.price(newMarket.address, Position.UP);
				//console.log('priceUp decimal is:' + priceUp / 1e18);

				let availableToBuyFromAMM = await thalesAMM.availableToBuyFromAMM(
					newMarket.address,
					Position.UP
				);
				console.log('availableToBuyFromAMM decimal is:' + availableToBuyFromAMM / 1e18);

				let buyPriceImpactMax = await thalesAMM.buyPriceImpact(
					newMarket.address,
					Position.UP,
					toUnit(availableToBuyFromAMM / 1e18)
				);
				//console.log('buyPriceImpactMax decimal is:' + buyPriceImpactMax / 1e18);

				let buyFromAmmQuoteArray = await thalesAMM.buyFromAmmQuoteWithDifferentCollateral(
					newMarket.address,
					Position.UP,
					toUnit(500),
					testUSDC.address
				);
				console.log(
					'buyQuote array: ',
					fromUnit(buyFromAmmQuoteArray[0]),
					fromUnit(buyFromAmmQuoteArray[1])
				);
				let buyFromAmmQuote = buyFromAmmQuoteArray[1];
				console.log('buyFromAmmQuote decimal is:' + buyFromAmmQuote / 1e18);

				await sUSDSynth.approve(thalesAMM.address, sUSDQty, { from: second });
				let additionalSlippage = toUnit(0.01);

				console.log('buyFromAmmQuote decimal is:' + buyFromAmmQuote / 1e18);

				await sUSDSynth.approve(CrossChainAdapter.address, buyFromAmmQuote + 1, { from: second });
				await sUSDSynth.issue(CrossChainAdapter.address, toUnit(100));
				let tx = await CrossChainAdapter.buyFromCryptoAMM(
					testUSDC.address,
					newMarket.address,
					'0',
					toUnit(500),
					buyFromAmmQuote,
					111,
					{ from: first }
				);

				console.log(tx.logs[0].args);
				let sUSD_adapter_balance = await testUSDC.balanceOf(CrossChainAdapter.address);
				console.log('Adapter sUSD balance:', fromUnit(sUSD_adapter_balance));

				let tx2 = await CrossChainAdapter.executeSportBuyMessage(
					second,
					sUSDSynth.address,
					toUnit(500),
					111,
					tx.logs[0].args.message,
					third,
					{ from: owner }
				);
				console.log('\n\nTX2');
				console.log(tx2.logs[0].args);

				let userTokenAmount = await CrossChainAdapter.userOwningToken(first, newMarket.address);
				let userMarketPositionBalance = await CrossChainAdapter.userMarketBalances(
					first,
					newMarket.address,
					0
				);
				console.log('USER OWNING tokens: ', fromUnit(userTokenAmount));
				assert.equal(fromUnit(userTokenAmount), 500);
				assert.equal(fromUnit(userMarketPositionBalance), 500);
				buyFromAmmQuoteArray = await thalesAMM.buyFromAmmQuoteWithDifferentCollateral(
					newMarket.address,
					Position.DOWN,
					toUnit(100),
					testUSDC.address
				);

				buyFromAmmQuote = buyFromAmmQuoteArray[1];

				tx = await CrossChainAdapter.buyFromCryptoAMM(
					testUSDC.address,
					newMarket.address,
					'1',
					toUnit(100),
					buyFromAmmQuote,
					111,
					{ from: first }
				);

				// console.log(tx.logs[0].args);
				sUSD_adapter_balance = await testUSDC.balanceOf(CrossChainAdapter.address);
				console.log('Adapter sUSD balance:', fromUnit(sUSD_adapter_balance));

				tx2 = await CrossChainAdapter.executeSportBuyMessage(
					second,
					sUSDSynth.address,
					toUnit(100),
					111,
					tx.logs[0].args.message,
					third,
					{ from: owner }
				);
				console.log('\n\nTX2');
				console.log(tx2.logs[0].args);

				await expect(thalesAMM.exerciseMaturedMarket(newMarket.address), {
					from: first,
				}).to.be.revertedWith("Can't exercise that market");
				await fastForward((await currentTime()) + day * 20);
				let phase = await newMarket.phase();
				console.log('PHASE: ', phase.toString());
				let canExerciseMaturedMarket = await thalesAMM.canExerciseMaturedMarket(newMarket.address);
				console.log('canExerciseMaturedMarket ' + canExerciseMaturedMarket);

				await thalesAMM.exerciseMaturedMarket(newMarket.address);

				let marketResult = await newMarket.result();
				console.log('Result market:', marketResult.toString());
				answer = await testUSDC.balanceOf(first);
				let initialBalance = fromUnit(answer);

				tx = await CrossChainAdapter.exerciseCryptoPosition(newMarket.address, 1, 111, {
					from: first,
				});
				console.log(tx.logs[0].args);
				tx2 = await CrossChainAdapter.executeBuyMessage(tx.logs[0].args.message, {
					from: owner,
				});
				console.log('\n\nTX2');
				console.log(tx2.logs[0].args);
				answer = await testUSDC.balanceOf(first);
				console.log('\n\nInitial balance: ', initialBalance);
				console.log('Final balance: ', fromUnit(answer));
			});
		});
	});

	describe('Check ParlayAMM data', () => {
		beforeEach(async () => {
			await fastForward(game1NBATime - (await currentTime()) - SECOND);
			let answer;
			parlayMarkets = [];
			// req. games
			const tx = await TherundownConsumerDeployed.fulfillGamesCreated(
				reqIdCreate,
				gamesCreated,
				sportId_4,
				game1NBATime,
				{ from: wrapper }
			);

			assert.equal(gameid1, await gamesQueue.gamesCreateQueue(1));
			assert.equal(gameid2, await gamesQueue.gamesCreateQueue(2));

			assert.equal(2, await gamesQueue.getLengthUnproccessedGames());
			assert.equal(0, await gamesQueue.unproccessedGamesIndex(gameid1));
			assert.equal(1, await gamesQueue.unproccessedGamesIndex(gameid2));

			let game = await TherundownConsumerDeployed.gameCreated(gameid1);
			let game_2 = await TherundownConsumerDeployed.gameCreated(gameid2);

			// create markets
			const tx_create_1 = await TherundownConsumerDeployed.createMarketForGame(gameid1);
			const tx_create_2 = await TherundownConsumerDeployed.createMarketForGame(gameid2);

			let marketAdd = await TherundownConsumerDeployed.marketPerGameId(gameid1);
			let marketAdd_2 = await TherundownConsumerDeployed.marketPerGameId(gameid2);

			// check if event is emited
			assert.eventEqual(tx_create_1.logs[1], 'CreateSportsMarket', {
				_marketAddress: marketAdd,
				_id: gameid1,
				_game: game,
			});
			assert.eventEqual(tx_create_2.logs[1], 'CreateSportsMarket', {
				_marketAddress: marketAdd_2,
				_id: gameid2,
				_game: game_2,
			});

			// console.log("1. game:");
			// console.log("==> home: ", game.homeTeam);
			// console.log("==> away: ", game.awayTeam);

			// console.log("2. game:");
			// console.log("==> home: ", game_2.homeTeam);
			// console.log("==> away: ", game_2.awayTeam);

			answer = await SportPositionalMarketManager.getActiveMarketAddress('0');
			let deployedMarket_1 = await SportPositionalMarketContract.at(answer);
			answer = await SportPositionalMarketManager.getActiveMarketAddress('1');
			let deployedMarket_2 = await SportPositionalMarketContract.at(answer);

			assert.equal(deployedMarket_1.address, marketAdd);
			assert.equal(deployedMarket_2.address, marketAdd_2);
			await fastForward(fightTime - (await currentTime()) - SECOND);
			fightCreated = [fight_create];

			// req games
			const tx_3 = await TherundownConsumerDeployed.fulfillGamesCreated(
				reqIdFightCreate,
				[fight_create],
				sportId_7,
				fightTime,
				{ from: wrapper }
			);

			assert.equal(true, await TherundownConsumerDeployed.isSportTwoPositionsSport(sportId_7));
			assert.equal(true, await TherundownConsumerDeployed.supportedSport(sportId_7));

			let fight = await TherundownConsumerDeployed.gameCreated(fightId);
			assert.equal('Clayton Carpenter', fight.homeTeam);
			assert.equal('Edgar Chairez', fight.awayTeam);

			// check if event is emited
			assert.eventEqual(tx_3.logs[0], 'GameCreated', {
				_requestId: reqIdFightCreate,
				_sportId: sportId_7,
				_id: fightId,
				_game: fight,
			});

			const tx_create_3 = await TherundownConsumerDeployed.createMarketForGame(fightId);

			marketAdd = await TherundownConsumerDeployed.marketPerGameId(fightId);

			// check if event is emited
			assert.eventEqual(tx_create_3.logs[1], 'CreateSportsMarket', {
				_marketAddress: marketAdd,
				_id: fightId,
				_game: fight,
			});

			// console.log("3. game:");
			// console.log("==> home: ", fight.homeTeam);
			// console.log("==> away: ", fight.awayTeam);

			answer = await SportPositionalMarketManager.getActiveMarketAddress('2');
			let deployedMarket_3 = await SportPositionalMarketContract.at(answer);

			await fastForward(gameFootballTime - (await currentTime()) - SECOND);

			// req. games
			const tx_4 = await TherundownConsumerDeployed.fulfillGamesCreated(
				reqIdFootballCreate,
				gamesFootballCreated,
				sportId_16,
				gameFootballTime,
				{ from: wrapper }
			);

			assert.equal(false, await TherundownConsumerDeployed.isSportTwoPositionsSport(sportId_16));
			assert.equal(true, await TherundownConsumerDeployed.supportedSport(sportId_16));

			let result = await GamesOddsObtainerDeployed.getOddsForGame(gameFootballid1);
			assert.bnEqual(40000, result[0]);
			assert.bnEqual(-12500, result[1]);
			assert.bnEqual(27200, result[2]);

			let game_4 = await TherundownConsumerDeployed.gameCreated(gameFootballid1);
			let game_5 = await TherundownConsumerDeployed.gameCreated(gameFootballid2);
			assert.equal('Atletico Madrid Atletico Madrid', game_4.homeTeam);
			assert.equal('Manchester City Manchester City', game_4.awayTeam);

			// check if event is emited
			assert.eventEqual(tx_4.logs[0], 'GameCreated', {
				_requestId: reqIdFootballCreate,
				_sportId: sportId_16,
				_id: gameFootballid1,
				_game: game_4,
			});

			// console.log("4. game:");
			// console.log("==> home: ", game_4.homeTeam);
			// console.log("==> away: ", game_4.awayTeam);

			// console.log("5. game:");
			// console.log("==> home: ", game_5.homeTeam);
			// console.log("==> away: ", game_5.awayTeam);

			// create markets
			const tx_create_4 = await TherundownConsumerDeployed.createMarketForGame(gameFootballid1);
			await TherundownConsumerDeployed.createMarketForGame(gameFootballid2);

			let marketAdd_4 = await TherundownConsumerDeployed.marketPerGameId(gameFootballid1);
			let marketAdd_5 = await TherundownConsumerDeployed.marketPerGameId(gameFootballid2);

			answer = await SportPositionalMarketManager.getActiveMarketAddress('3');
			let deployedMarket_4 = await SportPositionalMarketContract.at(answer);
			answer = await SportPositionalMarketManager.getActiveMarketAddress('4');
			let deployedMarket_5 = await SportPositionalMarketContract.at(answer);

			// check if event is emited
			assert.eventEqual(tx_create_4.logs[1], 'CreateSportsMarket', {
				_marketAddress: marketAdd_4,
				_id: gameFootballid1,
				_game: game_4,
			});

			assert.equal(deployedMarket_4.address, marketAdd_4);
			assert.equal(deployedMarket_5.address, marketAdd_5);

			answer = await SportPositionalMarketManager.numActiveMarkets();
			assert.equal(answer.toString(), '5');
			await fastForward(await currentTime());

			assert.equal(true, await deployedMarket_1.canResolve());
			assert.equal(true, await deployedMarket_2.canResolve());
			assert.equal(true, await deployedMarket_3.canResolve());
			assert.equal(true, await deployedMarket_4.canResolve());
			assert.equal(true, await deployedMarket_5.canResolve());

			// console.log('parlay 1: ', deployedMarket_1.address);
			// console.log('parlay 2: ', deployedMarket_2.address);
			// console.log('parlay 3: ', deployedMarket_3.address);
			// console.log('parlay 4: ', deployedMarket_4.address);

			parlayMarkets = [deployedMarket_1, deployedMarket_5, deployedMarket_3, deployedMarket_4];
			equalParlayMarkets = [deployedMarket_1, deployedMarket_2, deployedMarket_3, deployedMarket_4];
			await Thales.approve(CrossChainAdapter.address, toUnit(101), { from: first });
		});

		it('Can create Parlay: YES', async () => {
			await fastForward(game1NBATime - (await currentTime()) - SECOND);
			// await fastForward((await currentTime()) - SECOND);
			answer = await SportPositionalMarketManager.numActiveMarkets();
			assert.equal(answer.toString(), '5');
			let totalSUSDToPay = toUnit('10');
			parlayPositions = ['1', '1', '1', '1'];
			let parlayMarketsAddress = [];
			for (let i = 0; i < parlayMarkets.length; i++) {
				parlayMarketsAddress[i] = parlayMarkets[i].address;
			}
			let canCreateParlay = await ParlayAMM.canCreateParlayMarket(
				parlayMarketsAddress,
				parlayPositions,
				totalSUSDToPay
			);
			assert.equal(canCreateParlay, true);
		});

		it('Multi-collateral buy from amm', async () => {
			await fastForward(game1NBATime - (await currentTime()) - SECOND);
			// await fastForward((await currentTime()) - SECOND);
			answer = await SportPositionalMarketManager.numActiveMarkets();
			assert.equal(answer.toString(), '5');
			let totalSUSDToPay = toUnit('10');
			parlayPositions = ['1', '1', '1', '1'];
			let parlayMarketsAddress = [];
			for (let i = 0; i < parlayMarkets.length; i++) {
				parlayMarketsAddress[i] = parlayMarkets[i].address;
			}
			let slippage = toUnit('0.01');
			let result = await ParlayAMM.buyQuoteFromParlayWithDifferentCollateral(
				parlayMarketsAddress,
				parlayPositions,
				totalSUSDToPay,
				testUSDC.address
			);
			let buyParlayTX = await ParlayAMM.buyFromParlayWithDifferentCollateralAndReferrer(
				parlayMarketsAddress,
				parlayPositions,
				totalSUSDToPay,
				slippage,
				result[2],
				testUSDC.address,
				ZERO_ADDRESS,
				{ from: first }
			);
			// console.log("event: \n", buyParlayTX.logs[0]);

			assert.eventEqual(buyParlayTX.logs[2], 'ParlayMarketCreated', {
				account: first,
				sUSDPaid: totalSUSDToPay,
				amount: result[2],
			});
		});

		it('Create Cross chain Parlay', async () => {
			await fastForward(game1NBATime - (await currentTime()) - SECOND);
			// await fastForward((await currentTime()) - SECOND);
			answer = await SportPositionalMarketManager.numActiveMarkets();
			assert.equal(answer.toString(), '5');
			let totalSUSDToPay = toUnit('10');
			parlayPositions = ['1', '1', '1', '1'];
			let parlayMarketsAddress = [];
			for (let i = 0; i < parlayMarkets.length; i++) {
				parlayMarketsAddress[i] = parlayMarkets[i].address.toString().toUpperCase();
				parlayMarketsAddress[i] = parlayMarkets[i].address.toString().replace('0X', '0x');
			}
			let slippage = toUnit('0.01');
			let result = await ParlayAMM.buyQuoteFromParlayWithDifferentCollateral(
				parlayMarketsAddress,
				parlayPositions,
				totalSUSDToPay,
				testUSDC.address
			);

			let initialBalance = await Thales.balanceOf(CrossChainAdapter.address);
			console.log('CrossChain init balance: ', fromUnit(initialBalance));

			let tx = await CrossChainAdapter.buyFromParlay(
				testUSDC.address,
				parlayMarketsAddress,
				parlayPositions,
				totalSUSDToPay,
				result[2],
				111,
				{ from: first }
			);
			console.log(tx.logs[0].args);
			let balance = await Thales.balanceOf(CrossChainAdapter.address);
			console.log('CrossChain balance: ', fromUnit(balance));
			console.log('Sent tokens: ', fromUnit(totalSUSDToPay));

			let tx2 = await CrossChainAdapter.executeSportBuyMessage(
				second,
				testUSDC.address,
				totalSUSDToPay,
				111,
				tx.logs[0].args.message,
				third,
				{ from: owner, value: 10000 }
			);

			console.log('\n\nTX2');
			console.log(tx2.logs[0].args);
		});
		describe('Exercise Parlay', () => {
			beforeEach(async () => {
				await fastForward(game1NBATime - (await currentTime()) - SECOND);
				// await fastForward((await currentTime()) - SECOND);
				answer = await SportPositionalMarketManager.numActiveMarkets();
				assert.equal(answer.toString(), '5');
				let totalSUSDToPay = toUnit('10');
				parlayPositions = ['1', '0', '1', '1'];
				let parlayMarketsAddress = [];
				for (let i = 0; i < parlayMarkets.length; i++) {
					parlayMarketsAddress[i] = parlayMarkets[i].address;
				}
				let slippage = toUnit('0.01');
				//
				let result = await ParlayAMM.buyQuoteFromParlayWithDifferentCollateral(
					parlayMarketsAddress,
					parlayPositions,
					totalSUSDToPay,
					testUSDC.address
				);
				console.log('expected payout: ', fromUnit(result[1]));
				let tx = await CrossChainAdapter.buyFromParlay(
					testUSDC.address,
					parlayMarketsAddress,
					parlayPositions,
					totalSUSDToPay,
					result[2],
					111,
					{ from: first }
				);
				let balance = await Thales.balanceOf(CrossChainAdapter.address);

				let tx2 = await CrossChainAdapter.executeBuyMessage(tx.logs[0].args.message, {
					from: owner,
				});
				let activeParlays = await ParlayAMM.activeParlayMarkets('0', '100');

				parlaySingleMarketAddress = activeParlays[0];
				console.log('Parlay address: ', parlaySingleMarketAddress);
				parlaySingleMarket = await ParlayMarketContract.at(activeParlays[0].toString());
			});
			it('Get num of active parlays', async () => {
				let activeParlays = await ParlayAMM.numActiveParlayMarkets();
				assert.equal(activeParlays, 1);
			});
			it('Get active parlay address', async () => {
				let activeParlays = await ParlayAMM.activeParlayMarkets('0', '100');
				let result = await ParlayAMM.isActiveParlay(activeParlays[0]);
				assert.equal(result, true);
			});
			describe('Exercise whole parlay', () => {
				beforeEach(async () => {
					await fastForward(fightTime - (await currentTime()) + 3 * HOUR);
					let resolveMatrix = ['2', '1', '2', '2'];
					console.log('Games resolved: ', resolveMatrix, '\n');
					// parlayPositions = ['0', '0', '0', '0'];
					let gameId;
					let homeResult = '0';
					let awayResult = '0';
					for (let i = 0; i < parlayMarkets.length; i++) {
						homeResult = '0';
						awayResult = '0';
						gameId = await TherundownConsumerDeployed.gameIdPerMarket(parlayMarkets[i].address);
						if (resolveMatrix[i] == '1') {
							homeResult = '1';
						} else if (resolveMatrix[i] == '2') {
							awayResult = '1';
						} else if (resolveMatrix[i] == '3') {
							homeResult = '1';
							awayResult = '1';
						}
						// console.log(i, " outcome:", resolveMatrix[i], " home: ", homeResult, " away:", awayResult);
						const tx_resolve_4 = await TherundownConsumerDeployed.resolveMarketManually(
							parlayMarkets[i].address,
							resolveMatrix[i],
							homeResult,
							awayResult,
							{ from: owner }
						);
					}
				});
				it('Get Parlay balances', async () => {
					let balances = await parlaySingleMarket.getSportMarketBalances();
					let sum = toUnit(0);
					for (let i = 0; i < parlayMarkets.length; i++) {
						console.log(i, ' position: ', fromUnit(balances[i]));
						sum = sum.add(balances[i]);
					}
					console.log('total balance: ', fromUnit(sum));
					let result = await parlaySingleMarket.amount();

					console.log('Result balance: ', fromUnit(result));
					assert.approximately(parseFloat(fromUnit(result)), parseFloat(fromUnit(sum)), 0.000001);
					// assert.bnEqual(sum, await parlaySingleMarket.amount());
				});
				it('Parlay exercised', async () => {
					await ParlayAMM.exerciseParlay(parlaySingleMarket.address);
					assert.equal(await ParlayAMM.resolvedParlay(parlaySingleMarket.address), true);
				});
				it('IsUserTheWinner', async () => {
					let result = await parlaySingleMarket.isUserTheWinner();
					assert.equal(result, true);
				});
				it('Parlay Cross chain exercised', async () => {
					let balance = await Thales.balanceOf(first);
					let initialBalance = fromUnit(balance);
					let tx = await CrossChainAdapter.exerciseParlay(parlaySingleMarket.address, 111, {
						from: first,
					});
					console.log(tx.logs[0].args);
					let tx2 = await CrossChainAdapter.executeBuyMessage(tx.logs[0].args.message, {
						from: owner,
					});
					console.log('\n\nTX2');
					console.log(tx2.logs[0].args);
					balance = await Thales.balanceOf(first);
					console.log('\n\nInitial balance: ', initialBalance);
					console.log('Final balance: ', fromUnit(balance));
					assert.equal(await parlaySingleMarket.fundsIssued(), true);
					assert.equal(await parlaySingleMarket.resolved(), true);
					assert.equal(await parlaySingleMarket.parlayAlreadyLost(), false);
				});
			});
		});
	});
});
