'use strict';

const { artifacts, contract, web3 } = require('hardhat');
const { toBN } = web3.utils;

const { assert, addSnapshotBeforeRestoreAfterEach } = require('../../utils/common');

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
const { BN } = require('bn.js');

contract('ParlayAMM', (accounts) => {
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
	const ThalesBondsContract = artifacts.require('ThalesBonds');
	const ExoticPositionalTagsContract = artifacts.require('ExoticPositionalTags');
	const SNXRewardsContract = artifacts.require('SNXRewards');
	const AddressResolverContract = artifacts.require('AddressResolverHelper');
	const TestOddsContract = artifacts.require('TestOdds');
	const ReferralsContract = artifacts.require('Referrals');
	const ParlayAMMContract = artifacts.require('ParlayMarketsAMM');
	const ParlayMarketContract = artifacts.require('ParlayMarketMastercopy');
	const ParlayMarketDataContract = artifacts.require('ParlayMarketData');
	const ParlayVerifierContract = artifacts.require('ParlayVerifier');

	let ParlayAMM;
	let ParlayMarket;
	let ParlayMarketData;

	let ExoticPositionalMarket;
	let ExoticPositionalOpenBidMarket;
	let ExoticPositionalMarketManager;
	let ExoticPositionalTags;
	let ThalesOracleCouncil;
	let Thales;
	let ThalesBonds;
	let answer;
	let minimumPositioningDuration = 0;
	let minimumMarketMaturityDuration = 0;

	let marketQuestion,
		marketSource,
		endOfPositioning,
		fixedTicketPrice,
		positionAmount1,
		positionAmount2,
		positionAmount3,
		withdrawalAllowed,
		tag,
		paymentToken,
		phrases = [],
		deployedMarket,
		fixedBondAmount,
		outcomePosition,
		outcomePosition2;

	let consumer;
	let TherundownConsumer;
	let TherundownConsumerImplementation;
	let TherundownConsumerDeployed;
	let MockExoticMarket;
	let MockTherundownConsumerWrapper;
	let initializeConsumerData;
	let gamesQueue;
	let game_1_create;
	let game_1_resolve;
	let fightId;
	let fight_create;
	let fightCreated;
	let game_fight_resolve;
	let gamesFightResolved;
	let game_fight_resolve_draw;
	let gamesFightResolvedDraw;
	let reqIdFightCreate;
	let reqIdFightResolve;
	let reqIdFightResolveDraw;
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

	let oddsid_1;
	let oddsResult_1;
	let oddsResultArray_1;
	let reqIdOdds_1;
	let oddsid_2;
	let oddsResult_2;
	let oddsResultArray_2;
	let reqIdOdds_2;
	let verifier;

	let SportPositionalMarketManager,
		SportPositionalMarketFactory,
		SportPositionalMarketData,
		SportPositionalMarket,
		SportPositionalMarketMastercopy,
		SportPositionMastercopy,
		ParlayMarketMastercopy,
		StakingThales,
		SNXRewards,
		AddressResolver,
		TestOdds,
		curveSUSD,
		testUSDC,
		testUSDT,
		testDAI,
		Referrals,
		ParlayVerifier,
		SportsAMM;

	const game1NBATime = 1646958600;
	const gameFootballTime = 1649876400;
	const fightTime = 1660089600;

	const sportId_4 = 4; // NBA
	const sportId_16 = 16; // CHL
	const sportId_7 = 7; // UFC

	let gameMarket;

	let parlayAMMfee = '5';
	let safeBoxImpact = '2';
	let maxSupportedAmount = '20000';
	let maxSupportedOdd = '0.005';

	const usdcQuantity = toBN(10000 * 1e6); //100 USDC
	let parlayMarkets = [];
	let parlayPositions = [];
	let parlaySingleMarketAddress;
	let parlaySingleMarket;
	let voucher;

	beforeEach(async () => {
		SportPositionalMarketManager = await SportPositionalMarketManagerContract.new({
			from: manager,
		});
		SportPositionalMarketFactory = await SportPositionalMarketFactoryContract.new({
			from: manager,
		});
		SportPositionalMarketMastercopy = await SportPositionalMarketContract.new({ from: manager });
		SportPositionMastercopy = await SportPositionContract.new({ from: manager });
		ParlayMarketMastercopy = await ParlayMarketContract.new({ from: manager });
		SportPositionalMarketData = await SportPositionalMarketDataContract.new({ from: manager });
		StakingThales = await StakingThalesContract.new({ from: manager });
		SportsAMM = await SportsAMMContract.new({ from: manager });
		SNXRewards = await SNXRewardsContract.new({ from: manager });
		AddressResolver = await AddressResolverContract.new();
		// TestOdds = await TestOddsContract.new();
		await AddressResolver.setSNXRewardsAddress(SNXRewards.address);

		Thales = await ThalesContract.new({ from: owner });
		ExoticPositionalTags = await ExoticPositionalTagsContract.new();
		await ExoticPositionalTags.initialize(manager, { from: manager });
		let GamesQueue = artifacts.require('GamesQueue');
		gamesQueue = await GamesQueue.new({ from: owner });
		await gamesQueue.initialize(owner, { from: owner });

		await SportPositionalMarketManager.initialize(manager, Thales.address, { from: manager });
		await SportPositionalMarketFactory.initialize(manager, { from: manager });

		await SportPositionalMarketManager.setExpiryDuration(5 * DAY, { from: manager });

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

		await ExoticPositionalTags.addTag('Sport', '1');
		await ExoticPositionalTags.addTag('Football', '101');
		await ExoticPositionalTags.addTag('Basketball', '102');

		// ids
		gameid1 = '0x6536306366613738303834366166363839373862343935373965356366333936';
		gameid2 = '0x3937346533663036386233333764313239656435633133646632376133326662';
		fightId = '0x3234376564326334663865313462396538343833353636353361373863393962';

		// create game props
		game_1_create =
			'0x0000000000000000000000000000000000000000000000000000000000000020653630636661373830383436616636383937386234393537396535636633393600000000000000000000000000000000000000000000000000000000625755f0ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffaf240000000000000000000000000000000000000000000000000000000000004524ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffaf2400000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000120000000000000000000000000000000000000000000000000000000000000000d41746c616e7461204861776b73000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000011436861726c6f74746520486f726e657473000000000000000000000000000000';
		game_2_create =
			'0x0000000000000000000000000000000000000000000000000000000000000020393734653366303638623333376431323965643563313364663237613332666200000000000000000000000000000000000000000000000000000000625755f0ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffaf240000000000000000000000000000000000000000000000000000000000004524ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffaf2400000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000120000000000000000000000000000000000000000000000000000000000000000d41746c616e7461204861776b73000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000011436861726c6f74746520486f726e657473000000000000000000000000000000';
		gamesCreated = [game_1_create, game_2_create];
		reqIdCreate = '0x65da2443ccd66b09d4e2693933e8fb9aab9addf46fb93300bd7c1d70c5e21666';

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
		// create game props
		game_1_create =
			'0x0000000000000000000000000000000000000000000000000000000000000020653630636661373830383436616636383937386234393537396535636633393600000000000000000000000000000000000000000000000000000000625755f0ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffaf240000000000000000000000000000000000000000000000000000000000004524ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffaf2400000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000120000000000000000000000000000000000000000000000000000000000000000d41746c616e7461204861776b73000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000011436861726c6f74746520486f726e657473000000000000000000000000000000';
		game_2_create =
			'0x0000000000000000000000000000000000000000000000000000000000000020393734653366303638623333376431323965643563313364663237613332666200000000000000000000000000000000000000000000000000000000625755f0ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffaf240000000000000000000000000000000000000000000000000000000000004524ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffaf2400000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000120000000000000000000000000000000000000000000000000000000000000000d41746c616e7461204861776b73000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000011436861726c6f74746520486f726e657473000000000000000000000000000000';
		gamesCreated = [game_1_create, game_2_create];
		reqIdCreate = '0x65da2443ccd66b09d4e2693933e8fb9aab9addf46fb93300bd7c1d70c5e21666';

		// resolve game props
		reqIdResolve = '0x30250573c4b099aeaf06273ef9fbdfe32ab2d6b8e33420de988be5d6886c92a7';
		game_1_resolve =
			'0x6536306366613738303834366166363839373862343935373965356366333936000000000000000000000000000000000000000000000000000000000000006400000000000000000000000000000000000000000000000000000000000000810000000000000000000000000000000000000000000000000000000000000008';
		game_2_resolve =
			'0x3937346533663036386233333764313239656435633133646632376133326662000000000000000000000000000000000000000000000000000000000000006600000000000000000000000000000000000000000000000000000000000000710000000000000000000000000000000000000000000000000000000000000008';
		gamesResolved = [game_1_resolve, game_2_resolve];

		// football matches
		// football matches
		reqIdFootballCreate = '0x61d7dd698383c58c7217cf366764a1e92a1f059b1b6ea799dce4030a942302f4';
		gameFootballid1 = '0x3163626162623163303138373465363263313661316462333164363164353333';
		gameFootballid2 = '0x3662646437313731316337393837643336643465333538643937393237356234';
		game_1_football_create =
			'0x000000000000000000000000000000000000000000000000000000000000002031636261626231633031383734653632633136613164623331643631643533330000000000000000000000000000000000000000000000000000000062571db00000000000000000000000000000000000000000000000000000000000009c40ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffcf2c0000000000000000000000000000000000000000000000000000000000006a4000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000120000000000000000000000000000000000000000000000000000000000000001f41746c657469636f204d61647269642041746c657469636f204d616472696400000000000000000000000000000000000000000000000000000000000000001f4d616e636865737465722043697479204d616e63686573746572204369747900';
		game_2_football_create =
			'0x000000000000000000000000000000000000000000000000000000000000002036626464373137313163373938376433366434653335386439373932373562340000000000000000000000000000000000000000000000000000000062571db0ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff76800000000000000000000000000000000000000000000000000000000000018c18000000000000000000000000000000000000000000000000000000000000cb2000000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000012000000000000000000000000000000000000000000000000000000000000000134c69766572706f6f6c204c69766572706f6f6c00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000f42656e666963612042656e666963610000000000000000000000000000000000';
		gamesFootballCreated = [game_1_football_create, game_2_football_create];
		game_1_football_resolve =
			'0x316362616262316330313837346536326331366131646233316436316435333300000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000b';
		game_2_football_resolve =
			'0x366264643731373131633739383764333664346533353864393739323735623400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000b';
		reqIdResolveFoodball = '0xff8887a8535b7a8030962e6f6b1eba61c0f1cb82f706e77d834f15c781e47697';
		gamesResolvedFootball = [game_1_football_resolve, game_2_football_resolve];

		oddsid = '0x6135363061373861363135353239363137366237393232353866616336613532';
		oddsResult =
			'0x6135363061373861363135353239363137366237393232353866616336613532000000000000000000000000000000000000000000000000000000000000283cffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffd3dc0000000000000000000000000000000000000000000000000000000000000000';
		oddsResultArray = [oddsResult];
		reqIdOdds = '0x5bf0ea636f9515e1e1060e5a21e11ef8a628fa99b1effb8aa18624b02c6f36de';

		oddsid_1 = '0x3163626162623163303138373465363263313661316462333164363164353333';
		oddsResult_1 =
			'0x3163626162623163303138373465363263313661316462333164363164353333000000000000000000000000000000000000000000000000000000000000283cffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffd3dc0000000000000000000000000000000000000000000000000000000000000000';
		oddsResultArray_1 = [oddsResult_1];
		reqIdOdds_1 = '0x5bf0ea636f9515e1e1060e5a21e11ef8a628fa99b1effb8aa18624b02c6f36de';

		oddsid_2 = '0x6536306366613738303834366166363839373862343935373965356366333936';
		oddsResult_2 =
			'0x6536306366613738303834366166363839373862343935373965356366333936000000000000000000000000000000000000000000000000000000000000283cffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffd3dc0000000000000000000000000000000000000000000000000000000000000000';
		oddsResultArray_2 = [oddsResult_2];
		reqIdOdds_2 = '0x5bf0ea636f9515e1e1060e5a21e11ef8a628fa99b1effb8aa18624b02c6f36de';

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

		await Thales.transfer(TherundownConsumerDeployed.address, toUnit('1000'), { from: owner });
		// await ExoticPositionalMarketManager.setTheRundownConsumerAddress(
		// 	TherundownConsumerDeployed.address
		// );
		await TherundownConsumerDeployed.setSportContracts(
			wrapper,
			gamesQueue.address,
			SportPositionalMarketManager.address,
			verifier.address,
			{
				from: owner,
			}
		);
		await TherundownConsumerDeployed.addToWhitelist(third, true, { from: owner });

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

		await testUSDC.mint(first, toUnit(1000));
		await testUSDC.mint(curveSUSD.address, toUnit(1000));
		await testUSDC.approve(SportsAMM.address, toUnit(1000), { from: first });

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
			toUnit(maxSupportedAmount),
			toUnit(maxSupportedOdd),
			parlayAMMfee,
			safeBoxImpact,
			toUnit(0.05),
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
			owner,
			safeBox,
			Referrals.address,
			ParlayMarketData.address,
			ParlayVerifier.address,
			{ from: owner }
		);

		await ParlayAMM.setParlayMarketMastercopies(ParlayMarketMastercopy.address, { from: owner });
		await Thales.transfer(ParlayAMM.address, toUnit('20000'), { from: owner });

		await ParlayAMM.setParameters(true, { from: owner });

		await SportsAMM.setAddresses(
			owner,
			Thales.address,
			TherundownConsumerDeployed.address,
			ZERO_ADDRESS,
			StakingThales.address,
			Referrals.address,
			ParlayAMM.address,
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
	});

	describe('Parlay AMM setters', () => {
		it('SetAmounts', async () => {
			await ParlayAMM.setAmounts(toUnit(0.1), toUnit(0.1), toUnit(0.1), toUnit(0.1), toUnit(0.1), {
				from: owner,
			});
		});
		it('set Addresses', async () => {
			await ParlayAMM.setAddresses(SportsAMM.address, owner, owner, owner, owner, owner, {
				from: owner,
			});
		});
		it('ParlayMarketData', async () => {
			await ParlayMarketData.setParlayMarketsAMM(third, { from: owner });
			await ParlayMarketData.addParlayForGamePosition(first, '1', second, second, { from: third });
			let hasData = await ParlayMarketData.isGamePositionInParlay(first, '1', second);
			assert.equal(hasData, true);
			hasData = await ParlayMarketData.isGameInParlay(first, second);
			assert.equal(hasData[0], true);
			assert.equal(hasData[1].toString(), '1');
			await ParlayMarketData.removeParlayForGamePosition(first, '1', second, { from: third });
			hasData = await ParlayMarketData.isGamePositionInParlay(first, '1', second);
			assert.equal(hasData, false);
		});
	});

	describe('Check ParlayAMM data', () => {
		beforeEach(async () => {
			await fastForward(game1NBATime - (await currentTime()) - SECOND);
			let answer;
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

			answer = await SportPositionalMarketManager.getActiveMarketAddress('0');
			let deployedMarket_1 = await SportPositionalMarketContract.at(answer);
			answer = await SportPositionalMarketManager.getActiveMarketAddress('1');
			let deployedMarket_2 = await SportPositionalMarketContract.at(answer);

			assert.equal(deployedMarket_1.address, marketAdd);
			assert.equal(deployedMarket_2.address, marketAdd_2);
			await fastForward(fightTime - (await currentTime()) - SECOND);

			// req games
			const tx_3 = await TherundownConsumerDeployed.fulfillGamesCreated(
				reqIdFightCreate,
				fightCreated,
				sportId_7,
				fightTime,
				{ from: wrapper }
			);

			assert.equal(true, await TherundownConsumerDeployed.isSportTwoPositionsSport(sportId_7));
			assert.equal(true, await TherundownConsumerDeployed.isSupportedSport(sportId_7));

			assert.equal(
				fight_create,
				await TherundownConsumerDeployed.requestIdGamesCreated(reqIdFightCreate, 0)
			);

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
			assert.equal(true, await TherundownConsumerDeployed.isSupportedSport(sportId_16));

			assert.equal(
				game_1_football_create,
				await TherundownConsumerDeployed.requestIdGamesCreated(reqIdFootballCreate, 0)
			);
			assert.equal(
				game_2_football_create,
				await TherundownConsumerDeployed.requestIdGamesCreated(reqIdFootballCreate, 1)
			);

			let result = await TherundownConsumerDeployed.getOddsForGame(gameFootballid1);
			assert.bnEqual(40000, result[0]);
			assert.bnEqual(-12500, result[1]);
			assert.bnEqual(27200, result[2]);

			let game_4 = await TherundownConsumerDeployed.gameCreated(gameFootballid1);
			assert.equal('Atletico Madrid Atletico Madrid', game_4.homeTeam);
			assert.equal('Manchester City Manchester City', game_4.awayTeam);

			// check if event is emited
			assert.eventEqual(tx_4.logs[0], 'GameCreated', {
				_requestId: reqIdFootballCreate,
				_sportId: sportId_16,
				_id: gameFootballid1,
				_game: game_4,
			});

			// create markets
			const tx_create_4 = await TherundownConsumerDeployed.createMarketForGame(gameFootballid1);
			await TherundownConsumerDeployed.createMarketForGame(gameFootballid2);

			let marketAdd_4 = await TherundownConsumerDeployed.marketPerGameId(gameFootballid1);

			answer = await SportPositionalMarketManager.getActiveMarketAddress('3');
			let deployedMarket_4 = await SportPositionalMarketContract.at(answer);

			// check if event is emited
			assert.eventEqual(tx_create_4.logs[1], 'CreateSportsMarket', {
				_marketAddress: marketAdd_4,
				_id: gameFootballid1,
				_game: game_4,
			});

			assert.equal(deployedMarket_4.address, marketAdd_4);

			answer = await SportPositionalMarketManager.numActiveMarkets();
			assert.equal(answer.toString(), '5');
			await fastForward(await currentTime());

			assert.equal(true, await deployedMarket_1.canResolve());
			assert.equal(true, await deployedMarket_2.canResolve());
			assert.equal(true, await deployedMarket_3.canResolve());
			assert.equal(true, await deployedMarket_4.canResolve());

			// console.log('parlay 1: ', deployedMarket_1.address);
			// console.log('parlay 2: ', deployedMarket_2.address);
			// console.log('parlay 3: ', deployedMarket_3.address);
			// console.log('parlay 4: ', deployedMarket_4.address);

			parlayMarkets = [deployedMarket_1, deployedMarket_2, deployedMarket_3, deployedMarket_4];
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

		it('BuyQuote for Parlay', async () => {
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
			let result = await ParlayAMM.buyQuoteFromParlay(
				parlayMarketsAddress,
				parlayPositions,
				totalSUSDToPay
			);
		});

		it('BuyQuote Multicollateral for Parlay', async () => {
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
			let result = await ParlayAMM.buyQuoteFromParlayWithDifferentCollateral(
				parlayMarketsAddress,
				parlayPositions,
				totalSUSDToPay,
				testUSDC.address
			);
			console.log('USDC: ', result[0].toString());
		});

		it('Create/Buy Parlay', async () => {
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
			let result = await ParlayAMM.buyQuoteFromParlay(
				parlayMarketsAddress,
				parlayPositions,
				totalSUSDToPay
			);
			let buyParlayTX = await ParlayAMM.buyFromParlay(
				parlayMarketsAddress,
				parlayPositions,
				totalSUSDToPay,
				slippage,
				result[1],
				ZERO_ADDRESS,
				{ from: first }
			);
			// console.log("event: \n", buyParlayTX.logs[0]);

			assert.eventEqual(buyParlayTX.logs[2], 'ParlayMarketCreated', {
				account: first,
				sUSDPaid: totalSUSDToPay,
			});
		});

		it('Create/Buy Parlay with different slippage', async () => {
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
			let result = await ParlayAMM.buyQuoteFromParlay(
				parlayMarketsAddress,
				parlayPositions,
				totalSUSDToPay
			);
			let differentSlippage =
				parseInt(fromUnit(result[1])) + (parseInt(fromUnit(result[1])) * 1.5) / 100;
			console.log('different expected: ', differentSlippage);
			await expect(
				ParlayAMM.buyFromParlay(
					parlayMarketsAddress,
					parlayPositions,
					totalSUSDToPay,
					slippage,
					toUnit(differentSlippage),
					ZERO_ADDRESS,
					{ from: first }
				)
			).to.be.revertedWith('Slippage too high');
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

		it('Multi-collateral buy with referrals from amm', async () => {
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
			let balanceOfReferrer = await Thales.balanceOf(second);
			let buyParlayTX = await ParlayAMM.buyFromParlayWithDifferentCollateralAndReferrer(
				parlayMarketsAddress,
				parlayPositions,
				totalSUSDToPay,
				slippage,
				result[2],
				testUSDC.address,
				second,
				{ from: first }
			);
			// console.log("event: \n", buyParlayTX.logs[0]);
			answer = await Thales.balanceOf(second);

			assert.bnGt(answer, balanceOfReferrer);
			console.log('Referrer change: ', fromUnit(balanceOfReferrer), fromUnit(answer));

			assert.eventEqual(buyParlayTX.logs[2], 'ParlayMarketCreated', {
				account: first,
				sUSDPaid: totalSUSDToPay,
				amount: result[2],
			});
		});

		it('Read from Parlay after buy', async () => {
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
			let result = await ParlayAMM.buyQuoteFromParlay(
				parlayMarketsAddress,
				parlayPositions,
				totalSUSDToPay
			);
			let buyParlayTX = await ParlayAMM.buyFromParlay(
				parlayMarketsAddress,
				parlayPositions,
				totalSUSDToPay,
				slippage,
				result[1],
				ZERO_ADDRESS,
				{ from: first }
			);
			// console.log("event: \n", buyParlayTX.logs[0]);

			assert.eventEqual(buyParlayTX.logs[2], 'ParlayMarketCreated', {
				account: first,
				sUSDPaid: totalSUSDToPay,
			});
			let activeParlays = await ParlayAMM.activeParlayMarkets('0', '100');
			parlaySingleMarketAddress = activeParlays[0];
			parlaySingleMarket = await ParlayMarketContract.at(activeParlays[0].toString());

			let parlayAmount = await parlaySingleMarket.amount();
			console.log('\n parlayAmount: ', fromUnit(parlayAmount));
			let parlaysUSDPaid = await parlaySingleMarket.sUSDPaid();
			console.log('parlaysUSDPaid: ', fromUnit(parlaysUSDPaid));
			let feesApplied = parseFloat(parlayAMMfee) + parseFloat(safeBoxImpact);
			feesApplied = parseFloat(fromUnit(totalSUSDToPay)) * ((100.0 - feesApplied) / 100.0);
			console.log('feesApplied: ', feesApplied);
			assert.equal(fromUnit(parlaysUSDPaid), feesApplied);
			let totalResultQuote = await parlaySingleMarket.totalResultQuote();
			console.log('totalResultQuote: ', fromUnit(totalResultQuote));
			let numOfSportMarkets = await parlaySingleMarket.numOfSportMarkets();
			console.log('numOfSportMarkets: ', numOfSportMarkets.toString());
			let sportMarket = [];
			let calculatedQuote = 1.0;
			for (let i = 0; i < numOfSportMarkets; i++) {
				sportMarket[i] = await parlaySingleMarket.sportMarket(i);
				console.log('odd ', i, ' :', fromUnit(sportMarket[i].odd));
				calculatedQuote = calculatedQuote * parseFloat(fromUnit(sportMarket[i].odd));
			}
			console.log('calculatedQuote: ', calculatedQuote);
			assert.approximately(parseFloat(fromUnit(totalResultQuote)), calculatedQuote, 0.00000000001);
			let calculatedAmount = feesApplied / calculatedQuote;
			assert.approximately(parseFloat(fromUnit(parlayAmount)), calculatedAmount, 0.00000000001);
		});

		it('Mint voucher', async () => {
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
			let OvertimeVoucher = artifacts.require('OvertimeVoucher');

			voucher = await OvertimeVoucher.new(
				Thales.address,
				'',
				'',
				'',
				'',
				'',
				'',
				SportsAMM.address,
				ParlayAMM.address,
				{ from: owner }
			);

			await voucher.setSportsAMM(SportsAMM.address, { from: owner });
			await voucher.setParlayAMM(ParlayAMM.address, { from: owner });
			await voucher.setPause(false, { from: owner });
			await voucher.setTokenUris('', '', '', '', '', '', { from: owner });

			Thales.approve(voucher.address, toUnit(20), { from: third });

			let balanceOfMinter = await Thales.balanceOf(third);
			console.log('sUSD balance of third = ' + balanceOfMinter);
			const id = 1;

			const tenSUSD = toUnit(10);
			await expect(voucher.mint(first, tenSUSD, { from: third })).to.be.revertedWith(
				'Invalid amount'
			);

			const twentysUSD = toUnit(20);
			await voucher.mint(first, twentysUSD, { from: third });
			balanceOfMinter = await Thales.balanceOf(third);
			console.log('sUSD balance of third = ' + balanceOfMinter);

			let balanceOfVoucher = await Thales.balanceOf(voucher.address);
			console.log('sUSD balance of voucher = ' + balanceOfVoucher);

			assert.bnEqual(1, await voucher.balanceOf(first));
			assert.equal(first, await voucher.ownerOf(id));
			assert.bnEqual(toUnit(20), await voucher.amountInVoucher(id));

			await voucher.safeTransferFrom(first, second, id, { from: first });
			assert.equal(second, await voucher.ownerOf(id));

			let result = await ParlayAMM.buyQuoteFromParlay(
				parlayMarketsAddress,
				parlayPositions,
				toUnit(10)
			);
			console.log('Quote is ' + result[1] / 1e18);

			let buyParlayTX = await voucher.buyFromParlayAMMWithVoucher(
				parlayMarketsAddress,
				parlayPositions,
				toUnit(10),
				slippage,
				result[1],
				id,
				{ from: second }
			);

			assert.eventEqual(buyParlayTX.logs[0], 'BoughtFromParlayWithVoucher', {
				buyer: second,
				_sUSDPaid: toUnit(10),
				_expectedPayout: result[1],
			});

			balanceOfVoucher = await Thales.balanceOf(voucher.address);
			console.log('sUSD balance of voucher = ' + balanceOfVoucher);

			let amountInVoucher = await voucher.amountInVoucher(id);
			console.log('Amount in voucher is ' + amountInVoucher / 1e18);

			result = await ParlayAMM.buyQuoteFromParlay(
				parlayMarketsAddress,
				parlayPositions,
				toUnit(100)
			);
			await expect(
				voucher.buyFromParlayAMMWithVoucher(
					parlayMarketsAddress,
					parlayPositions,
					toUnit(100),
					slippage,
					result[1],
					id,
					{ from: second }
				)
			).to.be.revertedWith('Insufficient amount in voucher');
			await expect(
				voucher.buyFromParlayAMMWithVoucher(
					parlayMarketsAddress,
					parlayPositions,
					toUnit(100),
					slippage,
					result[1],
					id,
					{ from: first }
				)
			).to.be.revertedWith('You are not the voucher owner!');

			let secondBalanceBeforeBurn = await voucher.balanceOf(second);
			console.log('Second balance before burn is ' + secondBalanceBeforeBurn);

			result = await ParlayAMM.buyQuoteFromParlay(
				parlayMarketsAddress,
				parlayPositions,
				toUnit(10)
			);
			buyParlayTX = await voucher.buyFromParlayAMMWithVoucher(
				parlayMarketsAddress,
				parlayPositions,
				toUnit(10),
				slippage,
				result[1],
				id,
				{ from: second }
			);

			balanceOfVoucher = await Thales.balanceOf(voucher.address);
			console.log('sUSD balance of voucher = ' + balanceOfVoucher);

			let secondBalanceAfterBurn = await voucher.balanceOf(second);
			console.log('Second balance after burn is ' + secondBalanceAfterBurn);

			assert.bnEqual(0, secondBalanceAfterBurn);
		});

		describe('Exercise Parlay', () => {
			beforeEach(async () => {
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
				//
				let result = await ParlayAMM.buyQuoteFromParlay(
					parlayMarketsAddress,
					parlayPositions,
					totalSUSDToPay
				);
				let buyParlayTX = await ParlayAMM.buyFromParlay(
					parlayMarketsAddress,
					parlayPositions,
					totalSUSDToPay,
					slippage,
					result[1],
					ZERO_ADDRESS,
					{ from: first }
				);
				let activeParlays = await ParlayAMM.activeParlayMarkets('0', '100');
				parlaySingleMarketAddress = activeParlays[0];
				parlaySingleMarket = await ParlayMarketContract.at(activeParlays[0].toString());
			});
			it('Get active parlay address', async () => {
				let activeParlays = await ParlayAMM.activeParlayMarkets('0', '100');
				let result = await ParlayAMM.isActiveParlay(activeParlays[0]);
				assert.equal(result, true);
			});
			it('Read from Parlay market', async () => {
				let activeParlays = await ParlayAMM.activeParlayMarkets('0', '100');
				let result = await ParlayAMM.isActiveParlay(activeParlays[0]);
				parlaySingleMarketAddress = activeParlays[0];
				parlaySingleMarket = await ParlayMarketContract.at(activeParlays[0].toString());
				let phase = await parlaySingleMarket.phase();
				assert.equal(phase, 0);
				let userWon = await parlaySingleMarket.isUserTheWinner();
				assert.equal(userWon, false);
				await ParlayAMM.setPausedMarkets([parlaySingleMarket.address], true, { from: owner });
			});
			it('Can exercise any SportPosition', async () => {
				let answer = await parlaySingleMarket.isAnySportMarketResolved();
				let result = await ParlayAMM.exercisableSportPositionsInParlay(parlaySingleMarket.address);
				assert.equal(result.isExercisable, answer.isResolved);
			});

			it('All games resolved', async () => {
				await fastForward(fightTime - (await currentTime()) + 3 * HOUR);
				let resolveMatrix = ['2', '2', '2', '2'];
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
					const tx_resolve_4 = await TherundownConsumerDeployed.resolveMarketManually(
						parlayMarkets[i].address,
						resolveMatrix[i],
						homeResult,
						awayResult,
						{ from: owner }
					);
				}
				let resolved;
				for (let i = 0; i < parlayMarkets.length; i++) {
					deployedMarket = await SportPositionalMarketContract.at(parlayMarkets[i].address);
					resolved = await deployedMarket.resolved();
					assert.equal(true, resolved);
				}

				let answer = await parlaySingleMarket.isAnySportMarketResolved();
				let result = await ParlayAMM.resolvableSportPositionsInParlay(parlaySingleMarket.address);
				assert.equal(answer.isResolved, true);
				assert.equal(result.isAnyResolvable, true);
			});

			describe('Exercise single market of the parlay', () => {
				beforeEach(async () => {
					await fastForward(fightTime - (await currentTime()) + 3 * HOUR);
					let resolveMatrix = ['2'];
					// parlayPositions = ['0', '0', '0', '0']
					let gameId;
					let homeResult = '0';
					let awayResult = '0';
					for (let i = 0; i < resolveMatrix.length; i++) {
						deployedMarket = await SportPositionalMarketContract.at(parlayMarkets[i].address);
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
				it('Excercise specific parlay', async () => {
					let result = await ParlayAMM.resolvableSportPositionsInParlay(parlaySingleMarket.address);
					assert.equal(result.isAnyResolvable, true);
					result = await parlaySingleMarket.isAnySportMarketExercisable();
					assert.equal(result.isExercisable, true);
					await ParlayAMM.exerciseSportMarketInParlay(
						parlaySingleMarket.address,
						parlayMarkets[0].address
					);

					result = await parlaySingleMarket.isAnySportMarketExercisable();
					assert.equal(result.isExercisable, false);
				});
			});

			describe('Exercise whole parlay', () => {
				beforeEach(async () => {
					await fastForward(fightTime - (await currentTime()) + 3 * HOUR);
					let resolveMatrix = ['2', '2', '2', '2'];
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
					assert.bnEqual(sum, await parlaySingleMarket.amount());
				});
				it('Parlay exercised', async () => {
					await ParlayAMM.exerciseParlay(parlaySingleMarket.address);
					assert.equal(await ParlayAMM.resolvedParlay(parlaySingleMarket.address), true);
				});
				it('Parlay exercised (balances checked)', async () => {
					let userBalanceBefore = toUnit('1000');
					let balanceBefore = await Thales.balanceOf(ParlayAMM.address);
					await ParlayAMM.exerciseParlay(parlaySingleMarket.address);
					let balanceAfter = await Thales.balanceOf(ParlayAMM.address);
					let userBalanceAfter = await Thales.balanceOf(first);
					console.log(
						'\n\nAMM Balance before: ',
						fromUnit(balanceBefore),
						'\nAMM Balance after: ',
						fromUnit(balanceAfter),
						'\nAMM change: ',
						fromUnit(balanceAfter.sub(toUnit(20000)))
					);
					console.log(
						'User balance before: ',
						fromUnit(userBalanceBefore),
						'\nUser balance after: ',
						fromUnit(userBalanceAfter),
						'\nUser won: ',
						fromUnit(userBalanceAfter.sub(userBalanceBefore))
					);

					// assert.bnGt(balanceAfter.sub(balanceBefore), toUnit(0));
				});
			});

			describe('Exercise whole parlay with single cancellation', () => {
				beforeEach(async () => {
					await fastForward(fightTime - (await currentTime()) + 3 * HOUR);
					let resolveMatrix = ['2', '2', '0', '2'];
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
				it('Parlay exercised (balances checked)', async () => {
					let userBalanceBefore = toUnit('1000');
					let balanceBefore = await Thales.balanceOf(ParlayAMM.address);
					await ParlayAMM.exerciseParlay(parlaySingleMarket.address);
					let balanceAfter = await Thales.balanceOf(ParlayAMM.address);
					let userBalanceAfter = await Thales.balanceOf(first);
					console.log(
						'\n\nAMM Balance before: ',
						fromUnit(balanceBefore),
						'\nAMM Balance after: ',
						fromUnit(balanceAfter),
						'\nAMM change: ',
						fromUnit(balanceAfter.sub(toUnit(20000)))
					);
					console.log(
						'User balance before: ',
						fromUnit(userBalanceBefore),
						'\nUser balance after: ',
						fromUnit(userBalanceAfter),
						'\nUser won: ',
						fromUnit(userBalanceAfter.sub(userBalanceBefore))
					);

					// assert.bnGt(balanceAfter.sub(balanceBefore), toUnit(0));
				});
			});
			describe('Exercise whole parlay with double cancellation', () => {
				beforeEach(async () => {
					await fastForward(fightTime - (await currentTime()) + 3 * HOUR);
					let resolveMatrix = ['0', '2', '0', '2'];
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
				it('Parlay exercised (balances checked)', async () => {
					let userBalanceBefore = toUnit('1000');
					let balanceBefore = await Thales.balanceOf(ParlayAMM.address);
					await ParlayAMM.exerciseParlay(parlaySingleMarket.address);
					let balanceAfter = await Thales.balanceOf(ParlayAMM.address);
					let userBalanceAfter = await Thales.balanceOf(first);
					console.log(
						'\n\nAMM Balance before: ',
						fromUnit(balanceBefore),
						'\nAMM Balance after: ',
						fromUnit(balanceAfter),
						'\nAMM change: ',
						fromUnit(balanceAfter.sub(toUnit(20000)))
					);
					console.log(
						'User balance before: ',
						fromUnit(userBalanceBefore),
						'\nUser balance after: ',
						fromUnit(userBalanceAfter),
						'\nUser won: ',
						fromUnit(userBalanceAfter.sub(userBalanceBefore))
					);

					// assert.bnGt(balanceAfter.sub(balanceBefore), toUnit(0));
				});
			});
			describe('Exercise whole parlay with 4 cancellations', () => {
				beforeEach(async () => {
					await fastForward(fightTime - (await currentTime()) + 3 * HOUR);
					let resolveMatrix = ['0', '0', '0', '0'];
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
				it('Parlay exercised (balances checked)', async () => {
					let userBalanceBefore = toUnit('1000');
					let balanceBefore = await Thales.balanceOf(ParlayAMM.address);
					await ParlayAMM.exerciseParlay(parlaySingleMarket.address);
					let balanceAfter = await Thales.balanceOf(ParlayAMM.address);
					let userBalanceAfter = await Thales.balanceOf(first);
					console.log(
						'\n\nAMM Balance before: ',
						fromUnit(balanceBefore),
						'\nAMM Balance after: ',
						fromUnit(balanceAfter),
						'\nAMM change: ',
						fromUnit(balanceAfter.sub(toUnit(20000)))
					);
					console.log(
						'User balance before: ',
						fromUnit(userBalanceBefore),
						'\nUser balance after: ',
						fromUnit(userBalanceAfter),
						'\nUser won: ',
						fromUnit(userBalanceAfter.sub(userBalanceBefore))
					);

					// assert.bnGt(balanceAfter.sub(balanceBefore), toUnit(0));
				});
			});
			describe('Exercise whole parlay with 1 wrong result', () => {
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
				it('Parlay exercised (balances checked)', async () => {
					let userBalanceBefore = toUnit('1000');
					let balanceBefore = await Thales.balanceOf(ParlayAMM.address);
					await ParlayAMM.exerciseParlay(parlaySingleMarket.address);
					let balanceAfter = await Thales.balanceOf(ParlayAMM.address);
					let userBalanceAfter = await Thales.balanceOf(first);
					console.log(
						'\n\nAMM Balance before: ',
						fromUnit(balanceBefore),
						'\nAMM Balance after: ',
						fromUnit(balanceAfter),
						'\nAMM change: ',
						fromUnit(balanceAfter.sub(toUnit(20000)))
					);
					console.log(
						'User balance before: ',
						fromUnit(userBalanceBefore),
						'\nUser balance after: ',
						fromUnit(userBalanceAfter),
						'\nUser won: ',
						fromUnit(userBalanceAfter.sub(userBalanceBefore))
					);

					// assert.bnGt(balanceAfter.sub(balanceBefore), toUnit(0));
				});
			});
			describe('Exercise whole parlay with 2 wrong result', () => {
				beforeEach(async () => {
					await fastForward(fightTime - (await currentTime()) + 3 * HOUR);
					let resolveMatrix = ['2', '1', '1', '2'];
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
				it('Parlay exercised (balances checked)', async () => {
					let userBalanceBefore = toUnit('1000');
					let balanceBefore = await Thales.balanceOf(ParlayAMM.address);
					await ParlayAMM.exerciseParlay(parlaySingleMarket.address);
					let balanceAfter = await Thales.balanceOf(ParlayAMM.address);
					let userBalanceAfter = await Thales.balanceOf(first);
					console.log(
						'\n\nAMM Balance before: ',
						fromUnit(balanceBefore),
						'\nAMM Balance after: ',
						fromUnit(balanceAfter),
						'\nAMM change: ',
						fromUnit(balanceAfter.sub(toUnit(20000)))
					);
					console.log(
						'User balance before: ',
						fromUnit(userBalanceBefore),
						'\nUser balance after: ',
						fromUnit(userBalanceAfter),
						'\nUser won: ',
						fromUnit(userBalanceAfter.sub(userBalanceBefore))
					);

					// assert.bnGt(balanceAfter.sub(balanceBefore), toUnit(0));
				});
			});
			describe('Exercise whole parlay with 3 wrong result', () => {
				beforeEach(async () => {
					await fastForward(fightTime - (await currentTime()) + 3 * HOUR);
					let resolveMatrix = ['1', '1', '1', '2'];
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
				it('Parlay exercised (balances checked)', async () => {
					let userBalanceBefore = toUnit('1000');
					let balanceBefore = await Thales.balanceOf(ParlayAMM.address);
					await ParlayAMM.exerciseParlay(parlaySingleMarket.address);
					let balanceAfter = await Thales.balanceOf(ParlayAMM.address);
					let userBalanceAfter = await Thales.balanceOf(first);
					console.log(
						'\n\nAMM Balance before: ',
						fromUnit(balanceBefore),
						'\nAMM Balance after: ',
						fromUnit(balanceAfter),
						'\nAMM change: ',
						fromUnit(balanceAfter.sub(toUnit(20000)))
					);
					console.log(
						'User balance before: ',
						fromUnit(userBalanceBefore),
						'\nUser balance after: ',
						fromUnit(userBalanceAfter),
						'\nUser won: ',
						fromUnit(userBalanceAfter.sub(userBalanceBefore))
					);

					// assert.bnGt(balanceAfter.sub(balanceBefore), toUnit(0));
				});
			});

			describe('Exercise step by step all winning parlay', () => {
				let balances = [];
				beforeEach(async () => {
					await fastForward(fightTime - (await currentTime()) + 3 * HOUR);
					balances = await parlaySingleMarket.getSportMarketBalances();
				});
				it('Exercise first sport Market', async () => {
					let userBalanceBefore = toUnit('1000');
					let balanceBefore = await Thales.balanceOf(ParlayAMM.address);
					let gameId = await TherundownConsumerDeployed.gameIdPerMarket(parlayMarkets[0].address);
					const tx_resolve_1 = await TherundownConsumerDeployed.resolveMarketManually(
						parlayMarkets[0].address,
						'2',
						'1',
						'2',
						{ from: owner }
					);
					await ParlayAMM.exerciseParlay(parlaySingleMarket.address);
					let balanceAfter = await Thales.balanceOf(ParlayAMM.address);
					let userBalanceAfter = await Thales.balanceOf(first);
					console.log(
						'\n\nAMM Balance before: ',
						fromUnit(balanceBefore),
						'\nAMM Balance after: ',
						fromUnit(balanceAfter),
						'\nAMM change: ',
						fromUnit(balanceAfter.sub(toUnit(20000)))
					);
					console.log(
						'User balance before: ',
						fromUnit(userBalanceBefore),
						'\nUser balance after: ',
						fromUnit(userBalanceAfter),
						'\nUser won: ',
						fromUnit(userBalanceAfter.sub(userBalanceBefore))
					);

					// assert.bnGt(balanceAfter.sub(balanceBefore), toUnit(0));
				});

				it('Exercise first,second sport Market', async () => {
					let userBalanceBefore = toUnit('1000');
					let balanceBefore = await Thales.balanceOf(ParlayAMM.address);
					let gameId = await TherundownConsumerDeployed.gameIdPerMarket(parlayMarkets[0].address);
					const tx_resolve_1 = await TherundownConsumerDeployed.resolveMarketManually(
						parlayMarkets[0].address,
						'2',
						'1',
						'2',
						{ from: owner }
					);
					await ParlayAMM.exerciseParlay(parlaySingleMarket.address);

					let gameId2 = await TherundownConsumerDeployed.gameIdPerMarket(parlayMarkets[1].address);
					const tx_resolve_2 = await TherundownConsumerDeployed.resolveMarketManually(
						parlayMarkets[1].address,
						'2',
						'1',
						'2',
						{ from: owner }
					);
					await ParlayAMM.exerciseParlay(parlaySingleMarket.address);
					let balanceAfter = await Thales.balanceOf(ParlayAMM.address);
					let userBalanceAfter = await Thales.balanceOf(first);
					console.log(
						'\n\nAMM Balance before: ',
						fromUnit(balanceBefore),
						'\nAMM Balance after: ',
						fromUnit(balanceAfter),
						'\nAMM change: ',
						fromUnit(balanceAfter.sub(toUnit(20000)))
					);
					console.log(
						'User balance before: ',
						fromUnit(userBalanceBefore),
						'\nUser balance after: ',
						fromUnit(userBalanceAfter),
						'\nUser won: ',
						fromUnit(userBalanceAfter.sub(userBalanceBefore))
					);

					// assert.bnGt(balanceAfter.sub(balanceBefore), toUnit(0));
				});
				it('Exercise first,second,third sport Market', async () => {
					let userBalanceBefore = toUnit('1000');
					let balanceBefore = await Thales.balanceOf(ParlayAMM.address);
					let gameId = await TherundownConsumerDeployed.gameIdPerMarket(parlayMarkets[0].address);
					const tx_resolve_1 = await TherundownConsumerDeployed.resolveMarketManually(
						parlayMarkets[0].address,
						'2',
						'1',
						'2',
						{ from: owner }
					);
					await ParlayAMM.exerciseParlay(parlaySingleMarket.address);

					let gameId2 = await TherundownConsumerDeployed.gameIdPerMarket(parlayMarkets[1].address);
					const tx_resolve_2 = await TherundownConsumerDeployed.resolveMarketManually(
						parlayMarkets[1].address,
						'2',
						'1',
						'2',
						{ from: owner }
					);
					await ParlayAMM.exerciseParlay(parlaySingleMarket.address);
					let gameId3 = await TherundownConsumerDeployed.gameIdPerMarket(parlayMarkets[2].address);
					const tx_resolve_3 = await TherundownConsumerDeployed.resolveMarketManually(
						parlayMarkets[2].address,
						'2',
						'1',
						'2',
						{ from: owner }
					);
					await ParlayAMM.exerciseParlay(parlaySingleMarket.address);
					let balanceAfter = await Thales.balanceOf(ParlayAMM.address);
					let userBalanceAfter = await Thales.balanceOf(first);
					console.log(
						'\n\nAMM Balance before: ',
						fromUnit(balanceBefore),
						'\nAMM Balance after: ',
						fromUnit(balanceAfter),
						'\nAMM change: ',
						fromUnit(balanceAfter.sub(toUnit(20000)))
					);
					console.log(
						'User balance before: ',
						fromUnit(userBalanceBefore),
						'\nUser balance after: ',
						fromUnit(userBalanceAfter),
						'\nUser won: ',
						fromUnit(userBalanceAfter.sub(userBalanceBefore))
					);

					// assert.bnGt(balanceAfter.sub(balanceBefore), toUnit(0));
				});
				it('Exercise first, second, third, forth sport Market', async () => {
					let previousBalances = balances;
					let userBalanceBefore = toUnit('1000');
					let balanceBefore = await Thales.balanceOf(ParlayAMM.address);
					console.log('[before] balance of 0:', fromUnit(balances[0]));
					let gameId = await TherundownConsumerDeployed.gameIdPerMarket(parlayMarkets[0].address);
					const tx_resolve_1 = await TherundownConsumerDeployed.resolveMarketManually(
						parlayMarkets[0].address,
						'2',
						'1',
						'2',
						{ from: owner }
					);
					balances = await parlaySingleMarket.getSportMarketBalances();
					assert.bnEqual(previousBalances[0], balances[0]);
					await ParlayAMM.exerciseParlay(parlaySingleMarket.address);
					balances = await parlaySingleMarket.getSportMarketBalances();
					assert.bnEqual(toBN(0), balances[0]);
					console.log('[after] balance of 0:', fromUnit(balances[0]));
					console.log('\n[before] balance of 1:', fromUnit(balances[1]));
					let gameId2 = await TherundownConsumerDeployed.gameIdPerMarket(parlayMarkets[1].address);
					const tx_resolve_2 = await TherundownConsumerDeployed.resolveMarketManually(
						parlayMarkets[1].address,
						'2',
						'1',
						'2',
						{ from: owner }
					);
					balances = await parlaySingleMarket.getSportMarketBalances();
					assert.bnEqual(previousBalances[1], balances[1]);
					await ParlayAMM.exerciseParlay(parlaySingleMarket.address);
					balances = await parlaySingleMarket.getSportMarketBalances();
					assert.bnEqual(toBN(0), balances[1]);
					console.log('[after] balance of 1:', fromUnit(balances[1]));
					console.log('\n[before] balance of 2:', fromUnit(balances[2]));
					let gameId3 = await TherundownConsumerDeployed.gameIdPerMarket(parlayMarkets[2].address);
					const tx_resolve_3 = await TherundownConsumerDeployed.resolveMarketManually(
						parlayMarkets[2].address,
						'2',
						'1',
						'2',
						{ from: owner }
					);
					balances = await parlaySingleMarket.getSportMarketBalances();
					assert.bnEqual(previousBalances[2], balances[2]);
					await ParlayAMM.exerciseParlay(parlaySingleMarket.address);
					balances = await parlaySingleMarket.getSportMarketBalances();
					assert.bnEqual(toBN(0), balances[2]);
					console.log('[after] balance of 2:', fromUnit(balances[2]));
					console.log('\n[before] balance of 3:', fromUnit(balances[3]));
					let gameId4 = await TherundownConsumerDeployed.gameIdPerMarket(parlayMarkets[3].address);
					const tx_resolve_4 = await TherundownConsumerDeployed.resolveMarketManually(
						parlayMarkets[3].address,
						'2',
						'1',
						'2',
						{ from: owner }
					);
					balances = await parlaySingleMarket.getSportMarketBalances();
					assert.bnEqual(previousBalances[3], balances[3]);
					await ParlayAMM.exerciseParlay(parlaySingleMarket.address);
					balances = await parlaySingleMarket.getSportMarketBalances();
					assert.bnEqual(toBN(0), balances[3]);
					console.log('[after] balance of 3:', fromUnit(balances[3]));
					let balanceAfter = await Thales.balanceOf(ParlayAMM.address);
					let userBalanceAfter = await Thales.balanceOf(first);
					console.log(
						'\n\nAMM Balance before: ',
						fromUnit(balanceBefore),
						'\nAMM Balance after: ',
						fromUnit(balanceAfter),
						'\nAMM change: ',
						fromUnit(balanceAfter.sub(toUnit(20000)))
					);
					console.log(
						'User balance before: ',
						fromUnit(userBalanceBefore),
						'\nUser balance after: ',
						fromUnit(userBalanceAfter),
						'\nUser won: ',
						fromUnit(userBalanceAfter.sub(userBalanceBefore))
					);

					// assert.bnGt(balanceAfter.sub(balanceBefore), toUnit(0));
				});

				it('Exercise using specific Sport Market', async () => {
					let previousBalances = balances;
					let userBalanceBefore = toUnit('1000');
					let balanceBefore = await Thales.balanceOf(ParlayAMM.address);
					console.log('[before] balance of 0:', fromUnit(balances[0]));
					let gameId = await TherundownConsumerDeployed.gameIdPerMarket(parlayMarkets[0].address);
					const tx_resolve_1 = await TherundownConsumerDeployed.resolveMarketManually(
						parlayMarkets[0].address,
						'2',
						'1',
						'2',
						{ from: owner }
					);
					balances = await parlaySingleMarket.getSportMarketBalances();
					assert.bnEqual(previousBalances[0], balances[0]);
					await ParlayAMM.exerciseSportMarketInParlay(
						parlaySingleMarket.address,
						parlayMarkets[0].address
					);
					balances = await parlaySingleMarket.getSportMarketBalances();
					assert.bnEqual(toBN(0), balances[0]);
					console.log('[after] balance of 0:', fromUnit(balances[0]));
					console.log('\n[before] balance of 1:', fromUnit(balances[1]));
					let gameId2 = await TherundownConsumerDeployed.gameIdPerMarket(parlayMarkets[1].address);
					const tx_resolve_2 = await TherundownConsumerDeployed.resolveMarketManually(
						parlayMarkets[1].address,
						'2',
						'1',
						'2',
						{ from: owner }
					);
					balances = await parlaySingleMarket.getSportMarketBalances();
					assert.bnEqual(previousBalances[1], balances[1]);
					await ParlayAMM.exerciseSportMarketInParlay(
						parlaySingleMarket.address,
						parlayMarkets[1].address
					);
					balances = await parlaySingleMarket.getSportMarketBalances();
					assert.bnEqual(toBN(0), balances[1]);
					console.log('[after] balance of 1:', fromUnit(balances[1]));
					console.log('\n[before] balance of 2:', fromUnit(balances[2]));
					let gameId3 = await TherundownConsumerDeployed.gameIdPerMarket(parlayMarkets[2].address);
					const tx_resolve_3 = await TherundownConsumerDeployed.resolveMarketManually(
						parlayMarkets[2].address,
						'2',
						'1',
						'2',
						{ from: owner }
					);
					balances = await parlaySingleMarket.getSportMarketBalances();
					assert.bnEqual(previousBalances[2], balances[2]);
					await ParlayAMM.exerciseSportMarketInParlay(
						parlaySingleMarket.address,
						parlayMarkets[2].address
					);
					balances = await parlaySingleMarket.getSportMarketBalances();
					assert.bnEqual(toBN(0), balances[2]);
					console.log('[after] balance of 2:', fromUnit(balances[2]));
					console.log('\n[before] balance of 3:', fromUnit(balances[3]));
					let gameId4 = await TherundownConsumerDeployed.gameIdPerMarket(parlayMarkets[3].address);
					const tx_resolve_4 = await TherundownConsumerDeployed.resolveMarketManually(
						parlayMarkets[3].address,
						'2',
						'1',
						'2',
						{ from: owner }
					);
					balances = await parlaySingleMarket.getSportMarketBalances();
					assert.bnEqual(previousBalances[3], balances[3]);
					await ParlayAMM.exerciseSportMarketInParlay(
						parlaySingleMarket.address,
						parlayMarkets[3].address
					);
					balances = await parlaySingleMarket.getSportMarketBalances();
					assert.bnEqual(toBN(0), balances[3]);
					console.log('[after] balance of 3:', fromUnit(balances[3]));
					let balanceAfter = await Thales.balanceOf(ParlayAMM.address);
					let userBalanceAfter = await Thales.balanceOf(first);
					console.log(
						'\n\nAMM Balance before: ',
						fromUnit(balanceBefore),
						'\nAMM Balance after: ',
						fromUnit(balanceAfter),
						'\nAMM change: ',
						fromUnit(balanceAfter.sub(toUnit(20000)))
					);
					console.log(
						'User balance before: ',
						fromUnit(userBalanceBefore),
						'\nUser balance after: ',
						fromUnit(userBalanceAfter),
						'\nUser won: ',
						fromUnit(userBalanceAfter.sub(userBalanceBefore))
					);

					// assert.bnGt(balanceAfter.sub(balanceBefore), toUnit(0));
				});
				it('Exercise using one losing Sport Market', async () => {
					let previousBalances = balances;
					let userBalanceBefore = toUnit('1000');
					let balanceBefore = await Thales.balanceOf(ParlayAMM.address);
					console.log('[before] balance of 0:', fromUnit(balances[0]));
					let gameId = await TherundownConsumerDeployed.gameIdPerMarket(parlayMarkets[0].address);
					const tx_resolve_1 = await TherundownConsumerDeployed.resolveMarketManually(
						parlayMarkets[0].address,
						'1',
						'3',
						'2',
						{ from: owner }
					);
					balances = await parlaySingleMarket.getSportMarketBalances();
					assert.bnEqual(previousBalances[0], balances[0]);
					await ParlayAMM.exerciseSportMarketInParlay(
						parlaySingleMarket.address,
						parlayMarkets[0].address
					);
					balances = await parlaySingleMarket.getSportMarketBalances();
					assert.bnEqual(previousBalances[0], balances[0]);
					console.log('[after] balance of 0:', fromUnit(balances[0]));
					console.log('\n[before] balance of 1:', fromUnit(balances[1]));
					let gameId2 = await TherundownConsumerDeployed.gameIdPerMarket(parlayMarkets[1].address);
					const tx_resolve_2 = await TherundownConsumerDeployed.resolveMarketManually(
						parlayMarkets[1].address,
						'2',
						'1',
						'2',
						{ from: owner }
					);
					balances = await parlaySingleMarket.getSportMarketBalances();
					assert.bnEqual(previousBalances[1], balances[1]);
					await ParlayAMM.exerciseSportMarketInParlay(
						parlaySingleMarket.address,
						parlayMarkets[1].address
					);
					balances = await parlaySingleMarket.getSportMarketBalances();
					assert.bnEqual(toBN(0), balances[1]);
					console.log('[after] balance of 1:', fromUnit(balances[1]));
					console.log('\n[before] balance of 2:', fromUnit(balances[2]));
					let gameId3 = await TherundownConsumerDeployed.gameIdPerMarket(parlayMarkets[2].address);
					const tx_resolve_3 = await TherundownConsumerDeployed.resolveMarketManually(
						parlayMarkets[2].address,
						'2',
						'1',
						'2',
						{ from: owner }
					);
					balances = await parlaySingleMarket.getSportMarketBalances();
					assert.bnEqual(previousBalances[2], balances[2]);
					await ParlayAMM.exerciseSportMarketInParlay(
						parlaySingleMarket.address,
						parlayMarkets[2].address
					);
					balances = await parlaySingleMarket.getSportMarketBalances();
					assert.bnEqual(toBN(0), balances[2]);
					console.log('[after] balance of 2:', fromUnit(balances[2]));
					console.log('\n[before] balance of 3:', fromUnit(balances[3]));
					let gameId4 = await TherundownConsumerDeployed.gameIdPerMarket(parlayMarkets[3].address);
					const tx_resolve_4 = await TherundownConsumerDeployed.resolveMarketManually(
						parlayMarkets[3].address,
						'2',
						'1',
						'2',
						{ from: owner }
					);
					balances = await parlaySingleMarket.getSportMarketBalances();
					assert.bnEqual(previousBalances[3], balances[3]);
					await ParlayAMM.exerciseSportMarketInParlay(
						parlaySingleMarket.address,
						parlayMarkets[3].address
					);
					balances = await parlaySingleMarket.getSportMarketBalances();
					assert.bnEqual(toBN(0), balances[3]);
					console.log('[after] balance of 3:', fromUnit(balances[3]));
					let balanceAfter = await Thales.balanceOf(ParlayAMM.address);
					let userBalanceAfter = await Thales.balanceOf(first);
					console.log(
						'\n\nAMM Balance before: ',
						fromUnit(balanceBefore),
						'\nAMM Balance after: ',
						fromUnit(balanceAfter),
						'\nAMM change: ',
						fromUnit(balanceAfter.sub(toUnit(20000)))
					);
					console.log(
						'User balance before: ',
						fromUnit(userBalanceBefore),
						'\nUser balance after: ',
						fromUnit(userBalanceAfter),
						'\nUser won: ',
						fromUnit(userBalanceAfter.sub(userBalanceBefore))
					);

					// assert.bnGt(balanceAfter.sub(balanceBefore), toUnit(0));
				});
				it('Exercise using the least positions of Sport Market', async () => {
					let previousBalances = balances;
					let userBalanceBefore = toUnit('1000');
					let balanceBefore = await Thales.balanceOf(ParlayAMM.address);
					console.log('[before] balance of 0:', fromUnit(balances[0]));
					let gameId = await TherundownConsumerDeployed.gameIdPerMarket(parlayMarkets[0].address);
					const tx_resolve_1 = await TherundownConsumerDeployed.resolveMarketManually(
						parlayMarkets[0].address,
						'2',
						'1',
						'2',
						{ from: owner }
					);
					balances = await parlaySingleMarket.getSportMarketBalances();
					assert.bnEqual(previousBalances[0], balances[0]);
					await ParlayAMM.exerciseSportMarketInParlay(
						parlaySingleMarket.address,
						parlayMarkets[0].address
					);
					balances = await parlaySingleMarket.getSportMarketBalances();
					assert.bnEqual(toBN(0), balances[0]);
					console.log('[after] balance of 0:', fromUnit(balances[0]));
					console.log('\n[before] balance of 1:', fromUnit(balances[1]));
					let gameId2 = await TherundownConsumerDeployed.gameIdPerMarket(parlayMarkets[1].address);
					const tx_resolve_2 = await TherundownConsumerDeployed.resolveMarketManually(
						parlayMarkets[1].address,
						'2',
						'1',
						'2',
						{ from: owner }
					);
					balances = await parlaySingleMarket.getSportMarketBalances();
					assert.bnEqual(previousBalances[1], balances[1]);
					await ParlayAMM.exerciseSportMarketInParlay(
						parlaySingleMarket.address,
						parlayMarkets[1].address
					);
					balances = await parlaySingleMarket.getSportMarketBalances();
					assert.bnEqual(toBN(0), balances[1]);
					console.log('[after] balance of 1:', fromUnit(balances[1]));
					console.log('\n[before] balance of 2:', fromUnit(balances[2]));
					let gameId3 = await TherundownConsumerDeployed.gameIdPerMarket(parlayMarkets[2].address);
					const tx_resolve_3 = await TherundownConsumerDeployed.resolveMarketManually(
						parlayMarkets[2].address,
						'2',
						'1',
						'2',
						{ from: owner }
					);
					balances = await parlaySingleMarket.getSportMarketBalances();
					assert.bnEqual(previousBalances[2], balances[2]);
					await ParlayAMM.exerciseSportMarketInParlay(
						parlaySingleMarket.address,
						parlayMarkets[2].address
					);
					balances = await parlaySingleMarket.getSportMarketBalances();
					assert.bnEqual(toBN(0), balances[2]);
					console.log('[after] balance of 2:', fromUnit(balances[2]));
					console.log('\n[before] balance of 3:', fromUnit(balances[3]));
					let gameId4 = await TherundownConsumerDeployed.gameIdPerMarket(parlayMarkets[3].address);
					const tx_resolve_4 = await TherundownConsumerDeployed.resolveMarketManually(
						parlayMarkets[3].address,
						'1',
						'3',
						'2',
						{ from: owner }
					);
					balances = await parlaySingleMarket.getSportMarketBalances();
					assert.bnEqual(previousBalances[3], balances[3]);
					await ParlayAMM.exerciseSportMarketInParlay(
						parlaySingleMarket.address,
						parlayMarkets[3].address
					);
					balances = await parlaySingleMarket.getSportMarketBalances();
					assert.bnEqual(previousBalances[3], balances[3]);
					console.log('[after] balance of 3:', fromUnit(balances[3]));
					let balanceAfter = await Thales.balanceOf(ParlayAMM.address);
					let userBalanceAfter = await Thales.balanceOf(first);
					console.log(
						'\n\nAMM Balance before: ',
						fromUnit(balanceBefore),
						'\nAMM Balance after: ',
						fromUnit(balanceAfter),
						'\nAMM change: ',
						fromUnit(balanceAfter.sub(toUnit(20000)))
					);
					console.log(
						'User balance before: ',
						fromUnit(userBalanceBefore),
						'\nUser balance after: ',
						fromUnit(userBalanceAfter),
						'\nUser won: ',
						fromUnit(userBalanceAfter.sub(userBalanceBefore))
					);

					// assert.bnGt(balanceAfter.sub(balanceBefore), toUnit(0));
				});
			});
		});
	});
});
