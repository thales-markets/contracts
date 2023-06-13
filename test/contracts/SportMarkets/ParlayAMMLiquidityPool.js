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
const { expect } = require('chai');
const { current } = require('@openzeppelin/test-helpers/src/balance');

contract('ParlayAMM', (accounts) => {
	const [
		manager,
		first,
		owner,
		second,
		third,
		fourth,
		safeBox,
		wrapper,
		firstLiquidityProvider,
		defaultLiquidityProvider,
		firstParlayAMMLiquidityProvider,
		defaultParlayAMMLiquidityProvider,
		secondParlayAMMLiquidityProvider,
	] = accounts;

	const ZERO_ADDRESS = '0x' + '0'.repeat(40);
	const MAX_NUMBER =
		'115792089237316195423570985008687907853269984665640564039457584007913129639935';

	const SportAMMLiquidityPoolRoundMastercopy = artifacts.require(
		'SportAMMLiquidityPoolRoundMastercopy'
	);
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
	const ParlayAMMContract = artifacts.require('ParlayMarketsAMM');
	const ParlayMarketContract = artifacts.require('ParlayMarketMastercopy');
	const ParlayMarketDataContract = artifacts.require('ParlayMarketData');
	const ParlayVerifierContract = artifacts.require('ParlayVerifier');

	const ParlayAMMLiquidityPoolContract = artifacts.require('ParlayAMMLiquidityPool');
	const ParlayAMMLiquidityPoolRoundMastercopy = artifacts.require(
		'ParlayAMMLiquidityPoolRoundMastercopy'
	);
	const ParlayAMMLiquidityPoolDataContract = artifacts.require('ParlayAMMLiquidityPoolData');

	const SportsAMMUtils = artifacts.require('SportsAMMUtils');

	let ParlayAMM;
	let ParlayMarket;
	let ParlayMarketData;

	let Thales;
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
	let GamesOddsObtainerDeployed;

	let nba_create_array,
		gamesCreated_single,
		nba_game_create,
		oddsid_create_all,
		oddsid_create_result_1,
		oddsid_create_result_array_1,
		oddsid_create_result_array_football,
		reqIdOdds_create_1,
		oddsid_create_result_2,
		oddsid_create_result_array_2,
		reqIdOdds_create_2,
		game_1_resolve_spread_total_1,
		gamesResolved_single_1,
		gamesResolved_single_2,
		game_1_resolve_spread_total_2;

	let oddsid_2;
	let oddsResult_2;
	let oddsResultArray_2;
	let reqIdOdds_2;
	let oddsid_1;
	let oddsResult_1;
	let oddsResultArray_1;
	let reqIdOdds_1;
	let oddsid_total;
	let oddsResult_total;
	let oddsResultArray_total;
	let reqIdOdds_total;
	let oddsid_total_update;
	let oddsResult_total_update;
	let oddsResultArray_total_update;
	let reqIdOdds_total_update;
	let oddsid_total_update_line;
	let oddsResult_total_update_line;
	let oddsResultArray_total_update_line;
	let reqIdOdds_total_update_line;
	let oddsid_spread;
	let oddsResult_spread;
	let oddsResultArray_spread;
	let reqIdOdds_spread;
	let oddsid_spread_update;
	let oddsResult_spread_update;
	let oddsResultArray_spread_update;
	let reqIdOdds_spread_update;
	let oddsid_spread_update_line;
	let oddsResult_spread_update_line;
	let oddsResultArray_spread_update_line;
	let reqIdOdds_spread_update_line;

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
		SportsAMM,
		SportAMMLiquidityPool,
		ParlayAMMLiquidityPool,
		ParlayAMMLiquidityPoolData;

	let verifier;

	const game1NBATime = 1646958600;
	const gameFootballTime = 1649876400;
	const fightTime = 1660089600;

	const sportId_4 = 4; // NBA
	const sportId_16 = 16; // CHL
	const sportId_7 = 7; // UFC

	let gameMarket;

	let parlayAMMfee = toUnit('0.05');
	let safeBoxImpact = toUnit('0.02');
	let minUSDAmount = '10';
	let maxSupportedAmount = '20000';
	let maxSupportedOdd = '0.05';

	const usdcQuantity = toBN(10000 * 1e6); //100 USDC
	let parlayMarkets = [];
	let parlayMarkets2 = [];
	let parlayMarkets3 = [];
	let parlayMarkets4 = [];
	let parlayMarkets5 = [];

	let parlayTwoMarkets = [];
	let parlayTwoMarketDifferentRound = [];
	let parlayThreeMarkets = [];

	let equalParlayMarkets = [];
	let parlayPositions = [];
	let parlaySingleMarketAddress;
	let parlaySingleMarket;
	let parlaySingleMarket2;
	let voucher;
	let maturityTimes = [];

	let sportsAMMUtils;

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
		let GamesQueue = artifacts.require('GamesQueue');
		gamesQueue = await GamesQueue.new({ from: owner });
		await gamesQueue.initialize(owner, { from: owner });

		await SportPositionalMarketManager.initialize(manager, Thales.address, { from: manager });
		await SportPositionalMarketFactory.initialize(manager, { from: manager });

		await SportPositionalMarketManager.setExpiryDuration(290 * DAY, { from: manager });

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
			toUnit('0.04'), //_minSpread
			toUnit('0.2'),
			toUnit('0.001'),
			toUnit('0.9'),
			toUnit('5000'),
			toUnit('0.01'),
			toUnit('0.005'),
			toUnit('5000'),
			{ from: owner }
		);

		sportsAMMUtils = await SportsAMMUtils.new(SportsAMM.address);
		await SportsAMM.setAmmUtils(sportsAMMUtils.address, {
			from: owner,
		});
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
		fightId = '0x3234376564326334663865313462396538343833353636353361373863393962';

		// create game props
		// game_1_create =
		// 	'0x0000000000000000000000000000000000000000000000000000000000000020653630636661373830383436616636383937386234393537396535636633393600000000000000000000000000000000000000000000000000000000625755f0ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffaf240000000000000000000000000000000000000000000000000000000000004524ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffaf2400000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000120000000000000000000000000000000000000000000000000000000000000000d41746c616e7461204861776b73000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000011436861726c6f74746520486f726e657473000000000000000000000000000000';
		game_1_create =
			'0x0000000000000000000000000000000000000000000000000000000000000020653630636661373830383436616636383937386234393537396535636633393600000000000000000000000000000000000000000000000000000000625755f0ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffaf240000000000000000000000000000000000000000000000000000000000004524000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000120000000000000000000000000000000000000000000000000000000000000000d41746c616e7461204861776b73000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000011436861726c6f74746520486f726e657473000000000000000000000000000000';
		game_2_create =
			'0x0000000000000000000000000000000000000000000000000000000000000020393734653366303638623333376431323965643563313364663237613332666200000000000000000000000000000000000000000000000000000000625755f0ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffaf240000000000000000000000000000000000000000000000000000000000004524ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffaf2400000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000120000000000000000000000000000000000000000000000000000000000000000d41746c616e7461204861776b73000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000011436861726c6f74746520486f726e657473000000000000000000000000000000';
		gamesCreated = [game_1_create, game_2_create];
		gamesCreated_single = [
			'0x0000000000000000000000000000000000000000000000000000000000000020653630636661373830383436616636383937386234393537396535636633393600000000000000000000000000000000000000000000000000000000625755f0ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffaf240000000000000000000000000000000000000000000000000000000000004524000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000120000000000000000000000000000000000000000000000000000000000000000d41746c616e7461204861776b73000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000011436861726c6f74746520486f726e657473000000000000000000000000000000',
		];
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
			'0x0000000000000000000000000000000000000000000000000000000000000020653630636661373830383436616636383937386234393537396535636633393600000000000000000000000000000000000000000000000000000000625755f0ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffaf240000000000000000000000000000000000000000000000000000000000004524000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000120000000000000000000000000000000000000000000000000000000000000000d41746c616e7461204861776b73000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000011436861726c6f74746520486f726e657473000000000000000000000000000000';
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

		// gameOdds = {
		// 	gameId: "0x3163626162623163303138373465363263313661316462333164363164353333",
		// 	homeOdds: "40000",
		// 	awayOdds: "-12500",
		// 	drawOdds: "27200",
		// 	spreadHome: "150",
		// 	spreadHomeOdds: "-12000",
		// 	spreadAway: "-150",
		// 	spreadAwayOdds: "-12000",
		// 	totalOver: "250",
		// 	totalOverOdds: "-12000",
		// 	totalUnder: "250",
		// 	totalUnderOdds: "12000"
		//   }

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

		oddsid_total = '0x6536306366613738303834366166363839373862343935373965356366333936';
		oddsResult_total =
			'0x6536306366613738303834366166363839373862343935373965356366333936000000000000000000000000000000000000000000000000000000000000283cffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffd3dc0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c8ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffd50800000000000000000000000000000000000000000000000000000000000000c8ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffd508';
		oddsResultArray_total = [oddsResult_total];
		reqIdOdds_total = '0x5bf0ea636f9515e1e1060e5a21e11ef8a628fa99b1effb8aa18624b02c6f36ed';

		oddsid_spread = '0x6536306366613738303834366166363839373862343935373965356366333936';
		oddsResult_spread =
			'0x6536306366613738303834366166363839373862343935373965356366333936000000000000000000000000000000000000000000000000000000000000283cffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffd3dc000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001c2ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffd508fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe3e0000000000000000000000000000000000000000000000000000000000002af80000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';
		oddsResultArray_spread = [oddsResult_spread];
		reqIdOdds_spread = '0x5bf0ea636f9515e1e1060e5a21e11ef8a628fa99b1effb8aa18624b02c6f36ed';

		oddsid_spread_update = '0x6536306366613738303834366166363839373862343935373965356366333936';
		oddsResult_spread_update =
			'0x6536306366613738303834366166363839373862343935373965356366333936000000000000000000000000000000000000000000000000000000000000283cffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffd3dc000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001c2ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffd120fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe3e0000000000000000000000000000000000000000000000000000000000002ee00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';
		oddsResultArray_spread_update = [oddsResult_spread_update];
		reqIdOdds_spread_update = '0x5bf0ea636f9515e1e1060e5a21e11ef8a628fa99b1effb8aa18624b02c6f36ed';

		oddsid_total_update = '0x6536306366613738303834366166363839373862343935373965356366333936';
		oddsResult_total_update =
			'0x6536306366613738303834366166363839373862343935373965356366333936000000000000000000000000000000000000000000000000000000000000283cffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffd3dc0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c8ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffd12000000000000000000000000000000000000000000000000000000000000000c8ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffd120';
		oddsResultArray_total_update = [oddsResult_total_update];
		reqIdOdds_total_update = '0x5bf0ea636f9515e1e1060e5a21e11ef8a628fa99b1effb8aa18624b02c6f36ed';

		oddsid_spread_update_line =
			'0x6536306366613738303834366166363839373862343935373965356366333936';
		oddsResult_spread_update_line =
			'0x6536306366613738303834366166363839373862343935373965356366333936000000000000000000000000000000000000000000000000000000000000283cffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffd3dc00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000226ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffd120fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffdda0000000000000000000000000000000000000000000000000000000000002ee00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';
		oddsResultArray_spread_update_line = [oddsResult_spread_update_line];
		reqIdOdds_spread_update_line =
			'0x5bf0ea636f9515e1e1060e5a21e11ef8a628fa99b1effb8aa18624b02c6f36ed';

		oddsid_total_update_line = '0x6536306366613738303834366166363839373862343935373965356366333936';
		oddsResult_total_update_line =
			'0x6536306366613738303834366166363839373862343935373965356366333936000000000000000000000000000000000000000000000000000000000000283cffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffd3dc0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000d2ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffd12000000000000000000000000000000000000000000000000000000000000000d2ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffd120';
		oddsResultArray_total_update_line = [oddsResult_total_update_line];
		reqIdOdds_total_update_line =
			'0x5bf0ea636f9515e1e1060e5a21e11ef8a628fa99b1effb8aa18624b02c6f36ed';

		oddsid_create_all = '0x6536306366613738303834366166363839373862343935373965356366333936';
		oddsid_create_result_array_football = [
			'0x31636261626231633031383734653632633136613164623331643631643533330000000000000000000000000000000000000000000000000000000000009c40ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffcf2c0000000000000000000000000000000000000000000000000000000000006a400000000000000000000000000000000000000000000000000000000000000096ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffd120ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff6affffffffffffffffffffffffffffffffffffffffffffffffffffffffffffd12000000000000000000000000000000000000000000000000000000000000000faffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffd12000000000000000000000000000000000000000000000000000000000000000fa0000000000000000000000000000000000000000000000000000000000002ee0',
		];
		oddsid_create_result_1 =
			'0x6536306366613738303834366166363839373862343935373965356366333936ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffaf24000000000000000000000000000000000000000000000000000000000000452400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000226ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffd120fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffddaffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffd1200000000000000000000000000000000000000000000000000000000000004e20ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffd1200000000000000000000000000000000000000000000000000000000000004e200000000000000000000000000000000000000000000000000000000000002ee0';
		oddsid_create_result_array_1 = [oddsid_create_result_1];
		reqIdOdds_create_1 = '0x5bf0ea636f9515e1e1060e5a21e11ef8a628fa99b1effb8aa18624b02c6f36ed';
		oddsid_create_result_2 =
			'0x6536306366613738303834366166363839373862343935373965356366333936ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffaf2400000000000000000000000000000000000000000000000000000000000045240000000000000000000000000000000000000000000000000000000000000000fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffddaffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffd1200000000000000000000000000000000000000000000000000000000000000226ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffd1200000000000000000000000000000000000000000000000000000000000004e20ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffd1200000000000000000000000000000000000000000000000000000000000004e20ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffd120';
		oddsid_create_result_array_2 = [oddsid_create_result_2];
		reqIdOdds_create_2 = '0x5bf0ea636f9515e1e1060e5a21e11ef8a628fa99b1effb8aa18624b02c6f36ed';

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

		await SportPositionalMarketManager.setTherundownConsumer(TherundownConsumerDeployed.address, {
			from: manager,
		});
		await SportPositionalMarketManager.setOddsObtainer(GamesOddsObtainerDeployed.address, {
			from: manager,
		});
		await SportPositionalMarketManager.setSupportedSportForDoubleChance(
			[10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
			true,
			{
				from: manager,
			}
		);
		await SportPositionalMarketManager.setIsDoubleChanceSupported(true, { from: manager });
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
			toUnit(minUSDAmount),
			toUnit(maxSupportedAmount),
			toUnit(maxSupportedOdd),
			parlayAMMfee,
			safeBoxImpact,
			toUnit(0.05),
			toUnit(20000000),
			{
				from: owner,
			}
		);
		let nba_sgp_fee = toUnit(0.95);
		let soccer_sgp_fee = toUnit(0.7);
		let nfl_sgp_fee = toUnit(0.9);
		let nhl_sgp_fee = toUnit(0.85);

		await ParlayAMM.setSgpFeePerCombination(9004, 0, 10002, nba_sgp_fee, { from: owner });
		await ParlayAMM.setSgpFeePerCombination(9004, 10002, 10001, nba_sgp_fee, { from: owner });
		await ParlayAMM.setSgpFeePerCombination(9016, 0, 10002, soccer_sgp_fee, { from: owner });
		await ParlayAMM.setSgpFeePerCombination(9016, 10001, 10002, soccer_sgp_fee, { from: owner });
		await ParlayAMM.setSgpFeePerCombination(9002, 0, 10002, nfl_sgp_fee, { from: owner });
		await ParlayAMM.setSgpFeePerCombination(9002, 10001, 10002, nfl_sgp_fee, { from: owner });
		await ParlayAMM.setSgpFeePerCombination(9007, 0, 10002, nhl_sgp_fee, { from: owner });
		await ParlayAMM.setSgpFeePerCombination(9007, 10001, 10002, nhl_sgp_fee, { from: owner });

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

		let SportAMMLiquidityPoolContract = artifacts.require('SportAMMLiquidityPool');
		SportAMMLiquidityPool = await SportAMMLiquidityPoolContract.new();

		await SportAMMLiquidityPool.initialize(
			{
				_owner: owner,
				_sportsAmm: SportsAMM.address,
				_sUSD: Thales.address,
				_roundLength: WEEK,
				_maxAllowedDeposit: toUnit(100000).toString(),
				_minDepositAmount: toUnit(100).toString(),
				_maxAllowedUsers: 100,
			},
			{ from: owner }
		);

		await SportsAMM.setAddresses(
			owner,
			Thales.address,
			TherundownConsumerDeployed.address,
			StakingThales.address,
			Referrals.address,
			ParlayAMM.address,
			wrapper,
			SportAMMLiquidityPool.address,
			{ from: owner }
		);

		let aMMLiquidityPoolRoundMastercopy = await SportAMMLiquidityPoolRoundMastercopy.new();
		await SportAMMLiquidityPool.setPoolRoundMastercopy(aMMLiquidityPoolRoundMastercopy.address, {
			from: owner,
		});

		await Thales.transfer(firstLiquidityProvider, toUnit('10000000'), { from: owner });
		await Thales.approve(SportAMMLiquidityPool.address, toUnit('10000000'), {
			from: firstLiquidityProvider,
		});
		await SportAMMLiquidityPool.setWhitelistedAddresses([firstLiquidityProvider], true, {
			from: owner,
		});
		await SportAMMLiquidityPool.deposit(toUnit(100000), { from: firstLiquidityProvider });
		await SportAMMLiquidityPool.start({ from: owner });
		await SportAMMLiquidityPool.setDefaultLiquidityProvider(defaultLiquidityProvider, {
			from: owner,
		});
		await Thales.transfer(defaultLiquidityProvider, toUnit('10000000'), { from: owner });
		await Thales.approve(SportAMMLiquidityPool.address, toUnit('10000000'), {
			from: defaultLiquidityProvider,
		});

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

		// Parlay LP initializers:

		ParlayAMMLiquidityPool = await ParlayAMMLiquidityPoolContract.new({ from: manager });

		await ParlayAMMLiquidityPool.initialize(
			{
				_owner: owner,
				_parlayAMM: ParlayAMM.address,
				_sUSD: Thales.address,
				_roundLength: WEEK,
				_maxAllowedDeposit: toUnit(1000000).toString(),
				_minDepositAmount: toUnit(100).toString(),
				_maxAllowedUsers: 100,
			},
			{ from: owner }
		);
		await ParlayAMM.setParlayLP(ParlayAMMLiquidityPool.address, { from: owner });

		let parlayAMMLiquidityPoolRoundMastercopy = await ParlayAMMLiquidityPoolRoundMastercopy.new();
		await ParlayAMMLiquidityPool.setPoolRoundMastercopy(
			parlayAMMLiquidityPoolRoundMastercopy.address,
			{
				from: owner,
			}
		);
		await Thales.transfer(firstParlayAMMLiquidityProvider, toUnit('10000000'), { from: owner });
		await Thales.approve(ParlayAMMLiquidityPool.address, toUnit('10000000'), {
			from: firstParlayAMMLiquidityProvider,
		});
		await ParlayAMMLiquidityPool.setWhitelistedAddresses([firstParlayAMMLiquidityProvider], true, {
			from: owner,
		});
		await ParlayAMMLiquidityPool.deposit(toUnit(100000), { from: firstParlayAMMLiquidityProvider });
		// await ParlayAMMLiquidityPool.start({ from: owner });
		await ParlayAMMLiquidityPool.setDefaultLiquidityProvider(defaultParlayAMMLiquidityProvider, {
			from: owner,
		});
		await Thales.transfer(defaultParlayAMMLiquidityProvider, toUnit('10000000'), { from: owner });
		await Thales.approve(ParlayAMMLiquidityPool.address, toUnit('10000000'), {
			from: defaultParlayAMMLiquidityProvider,
		});

		ParlayAMMLiquidityPoolData = await ParlayAMMLiquidityPoolDataContract.new({ from: manager });
	});

	describe('Parlay AMM setters', () => {
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

			assert.equal(false, await deployedMarket_1.paused());

			const tx_odds = await TherundownConsumerDeployed.fulfillGamesOdds(
				reqIdOdds_spread,
				oddsid_create_result_array_1,
				{
					from: wrapper,
				}
			);
			assert.bnEqual(2, await GamesOddsObtainerDeployed.numberOfChildMarkets(marketAdd));
			let mainMarketSpreadChildMarket = await GamesOddsObtainerDeployed.mainMarketSpreadChildMarket(
				marketAdd,
				550
			);
			let mainMarketTotalChildMarket = await GamesOddsObtainerDeployed.mainMarketTotalChildMarket(
				marketAdd,
				20000
			);
			assert.bnEqual(
				mainMarketSpreadChildMarket,
				await GamesOddsObtainerDeployed.currentActiveSpreadChildMarket(marketAdd)
			);
			assert.bnEqual(
				mainMarketTotalChildMarket,
				await GamesOddsObtainerDeployed.currentActiveTotalChildMarket(marketAdd)
			);
			assert.equal(false, await deployedMarket_1.paused());

			answer = await SportPositionalMarketManager.getActiveMarketAddress('2');
			let deployedMarket_6 = await SportPositionalMarketContract.at(answer);
			answer = await SportPositionalMarketManager.getActiveMarketAddress('3');
			let deployedMarket_7 = await SportPositionalMarketContract.at(answer);
			assert.equal(deployedMarket_6.address, mainMarketTotalChildMarket);
			assert.equal(deployedMarket_7.address, mainMarketSpreadChildMarket);

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

			console.log('4. game:');
			console.log('==> home: ', game_4.homeTeam);
			console.log('==> away: ', game_4.awayTeam);

			console.log('5. game:');
			console.log('==> home: ', game_5.homeTeam);
			console.log('==> away: ', game_5.awayTeam);

			// create markets
			const tx_create_4 = await TherundownConsumerDeployed.createMarketForGame(gameFootballid1);
			await TherundownConsumerDeployed.createMarketForGame(gameFootballid2);

			let marketAdd_4 = await TherundownConsumerDeployed.marketPerGameId(gameFootballid1);
			let marketAdd_5 = await TherundownConsumerDeployed.marketPerGameId(gameFootballid2);

			const tx_odds_2 = await TherundownConsumerDeployed.fulfillGamesOdds(
				reqIdOdds_spread,
				oddsid_create_result_array_football,
				{
					from: wrapper,
				}
			);
			// answer = await SportPositionalMarketManager.getActiveMarketAddress('3');
			answer = await SportPositionalMarketManager.getActiveMarketAddress('5');
			let deployedMarket_4 = await SportPositionalMarketContract.at(answer);
			// answer = await SportPositionalMarketManager.getActiveMarketAddress('7');
			answer = await SportPositionalMarketManager.getActiveMarketAddress('9');
			let deployedMarket_5 = await SportPositionalMarketContract.at(answer);

			// check if event is emited

			assert.eventEqual(tx_create_4.logs[4], 'CreateSportsMarket', {
				_marketAddress: marketAdd_4,
				_id: gameFootballid1,
				_game: game_4,
			});

			let allMarkets = await SportPositionalMarketManager.activeMarkets('0', '100');
			console.log(allMarkets);
			for (let i = 0; i < allMarkets.length; i++) {
				let market = await SportPositionalMarketContract.at(allMarkets[i]);
				let tags = await market.getTags();
				let gameDetails = await market.getGameDetails();
				// console.log('market ', i, ' : ', market.address);
				// console.log('  tag1: ', parseInt(tags[0]));
				// console.log('  tag2: ', parseInt(tags[1]));
				// console.log('  gameDetails: ', gameDetails[1].toString());
				// console.log('  \n');
			}

			assert.equal(deployedMarket_4.address, marketAdd_4);
			assert.equal(deployedMarket_5.address, marketAdd_5);

			answer = await SportPositionalMarketManager.numActiveMarkets();
			// assert.equal(answer.toString(), '11');
			assert.equal(answer.toString(), '15');
			await fastForward(await currentTime());

			assert.equal(true, await deployedMarket_1.canResolve());
			assert.equal(true, await deployedMarket_2.canResolve());
			assert.equal(true, await deployedMarket_3.canResolve());
			assert.equal(true, await deployedMarket_4.canResolve());
			assert.equal(true, await deployedMarket_5.canResolve());

			// Atalanta vs Charlotte
			let market_1 = await SportPositionalMarketContract.at(allMarkets[0]);

			//  Clayton Carpenter vs Edgar Chairez
			let market_2 = await SportPositionalMarketContract.at(allMarkets[4]);

			// Atletico Madrid vs Manchester City
			let market_3 = await SportPositionalMarketContract.at(allMarkets[5]);

			// Liverpool vs Benfica
			let market_4 = await SportPositionalMarketContract.at(allMarkets[9]);

			// Atalanta vs Charlotte totals
			let market_5 = await SportPositionalMarketContract.at(allMarkets[2]);
			// Atalanta vs Charlotte spreads
			let market_6 = await SportPositionalMarketContract.at(allMarkets[3]);

			// Atletico Madrid vs Manchester City - totals
			let market_7 = await SportPositionalMarketContract.at(allMarkets[13]);
			// Atletico Madrid vs Manchester City - spreads
			let market_8 = await SportPositionalMarketContract.at(allMarkets[14]);
			// console.log('parlay 1: ', deployedMarket_1.address);
			// console.log('parlay 2: ', deployedMarket_2.address);
			// console.log('parlay 3: ', deployedMarket_3.address);
			// console.log('parlay 4: ', deployedMarket_4.address);

			parlayMarkets = [market_1, market_2, market_3, market_4, market_5];
			parlayMarkets2 = [market_6, market_2, market_3, market_4, market_5];
			parlayMarkets3 = [market_6, market_1, market_3, market_4, market_5];
			parlayMarkets4 = [market_6, market_7, market_8, market_4, market_5];
			parlayMarkets5 = [market_1, market_2, market_3, market_4, market_6];

			parlayTwoMarkets = [market_1, market_5];
			parlayTwoMarketDifferentRound = [market_3, market_7];
			parlayThreeMarkets = [market_1, market_2, market_5];
			// console.log(market_1.address);
			// console.log(market_2.address);
			// console.log(market_3.address);
			// console.log(market_4.address);
			// console.log(market_5.address);
			// console.log(deployedMarket_5.address);
		});

		it('Get times between games', async () => {
			let timeCurrent = await currentTime();
			let max = timeCurrent;
			let minTime = timeCurrent;
			if (max < game1NBATime) {
				max = game1NBATime;
			}
			if (max < gameFootballTime) {
				max = gameFootballTime;
			}
			if (max < fightTime) {
				max = fightTime;
			}

			if (minTime > game1NBATime) {
				minTime = game1NBATime;
			}
			if (minTime > gameFootballTime) {
				minTime = gameFootballTime;
			}
			if (minTime > fightTime) {
				minTime = fightTime;
			}

			console.log('currentTime: ', timeCurrent.toString());
			console.log('nba time: ', game1NBATime.toString());
			console.log('nba time + WEEK: ', parseInt(game1NBATime.toString() + WEEK));
			console.log('football time: ', gameFootballTime.toString());
			console.log('fight time: ', fightTime.toString());
			console.log('MAX time: ', max.toString());
			console.log('MIN time: ', minTime.toString());
			let maturity;
			for (let i = 0; i < parlayTwoMarkets.length; i++) {
				maturity = await parlayTwoMarkets[i].times();
				console.log(parlayTwoMarkets[i].address, ' maturity at: ', maturity[0].toString());
			}

			let roundPool_2_Address = await ParlayAMMLiquidityPool.roundPools(2);
			let roundPool_3_Address = await ParlayAMMLiquidityPool.roundPools(3);
			let roundPool_4_Address = await ParlayAMMLiquidityPool.roundPools(4);
			let roundPool_5_Address = await ParlayAMMLiquidityPool.roundPools(5);
			let roundPool_6_Address = await ParlayAMMLiquidityPool.roundPools(6);
			console.log('RoundPool 2: ', roundPool_2_Address);
			console.log('RoundPool 3: ', roundPool_3_Address);
			console.log('RoundPool 4: ', roundPool_4_Address);
			console.log('RoundPool 5: ', roundPool_5_Address);
			console.log('RoundPool 6: ', roundPool_6_Address);

			let roundTwo = await ParlayAMMLiquidityPoolRoundMastercopy.at(roundPool_2_Address);
			console.log('RoundPool 2 startTime: ', (await roundTwo.roundStartTime()).toString());
			console.log('RoundPool 2 endTime: ', (await roundTwo.roundEndTime()).toString());
		});
		it('Create/Buy Parlay', async () => {
			let fastForwardTime = game1NBATime - (await currentTime()) - SECOND;
			await fastForward(game1NBATime - (await currentTime()) - SECOND);
			let maturity;
			for (let i = 0; i < parlayTwoMarkets.length; i++) {
				maturity = await parlayTwoMarkets[i].times();
				console.log(parlayTwoMarkets[i].address, ' maturity at: ', maturity[0].toString());
				maturityTimes[i] = parseInt(maturity[0].toString());
			}
			await fastForward(maturityTimes[0] - (await currentTime()) - 10 * 60 * SECOND);
			await ParlayAMMLiquidityPool.start({ from: owner });
			// await fastForward((await currentTime()) - SECOND);
			answer = await SportPositionalMarketManager.numActiveMarkets();
			assert.equal(answer.toString(), '15');
			let totalSUSDToPay = toUnit('10');
			parlayPositions = ['1', '1'];
			// parlayPositions = ['1', '1', '1', '1'];
			let parlayPositions2 = ['1', '1', '1', '1', '0'];
			let parlayMarketsAddress = [];
			for (let i = 0; i < parlayTwoMarkets.length; i++) {
				parlayMarketsAddress[i] = parlayTwoMarkets[i].address.toString().toUpperCase();
				parlayMarketsAddress[i] = parlayTwoMarkets[i].address.toString().replace('0X', '0x');
			}
			console.log('parlayAddr: ', parlayMarketsAddress);
			let slippage = toUnit('0.01');
			let result = await ParlayAMM.buyQuoteFromParlay(
				parlayMarketsAddress,
				parlayPositions,
				totalSUSDToPay
			);
			console.log('result quote: ', fromUnit(result.totalBuyAmount));
			let buyParlayTX = await ParlayAMM.buyFromParlay(
				parlayMarketsAddress,
				parlayPositions,
				totalSUSDToPay,
				slippage,
				result[1],
				ZERO_ADDRESS,
				{ from: first }
			);
			// console.log('event: \n', buyParlayTX.logs[2]);

			assert.eventEqual(buyParlayTX.logs[2], 'ParlayMarketCreated', {
				account: first,
				sUSDPaid: totalSUSDToPay,
			});
			// console.log(buyParlayTX.logs[2].market);
			console.log(buyParlayTX.logs[2].args.market);
			let parlayMarketCreated = buyParlayTX.logs[2].args.market;

			let roundPool_2_Address = await ParlayAMMLiquidityPool.roundPools(2);
			let roundPool_3_Address = await ParlayAMMLiquidityPool.roundPools(3);
			let roundPool_4_Address = await ParlayAMMLiquidityPool.roundPools(4);
			let roundPool_5_Address = await ParlayAMMLiquidityPool.roundPools(5);
			let roundPool_6_Address = await ParlayAMMLiquidityPool.roundPools(6);
			console.log('RoundPool 2: ', roundPool_2_Address);
			console.log('RoundPool 3: ', roundPool_3_Address);
			console.log('RoundPool 4: ', roundPool_4_Address);
			console.log('RoundPool 5: ', roundPool_5_Address);
			console.log('RoundPool 6: ', roundPool_6_Address);

			let roundTwo = await ParlayAMMLiquidityPoolRoundMastercopy.at(roundPool_2_Address);
			console.log('fastForwardTime: ', fastForwardTime.toString());
			console.log('currentTime: ', (await currentTime()).toString());
			console.log('RoundPool 2 startTime: ', (await roundTwo.roundStartTime()).toString());
			console.log('RoundPool 2 endTime: ', (await roundTwo.roundEndTime()).toString());
			let marketRound = await ParlayAMMLiquidityPool.getMarketRound(parlayMarketCreated);
			console.log(parlayMarketCreated, ' market in round: ', marketRound.toString());
			assert.equal(marketRound.toString(), '2');
		});

		it('Stake and deposit', async () => {
			let fastForwardTime = game1NBATime - (await currentTime()) - SECOND;
			await fastForward(game1NBATime - (await currentTime()) - SECOND);
			let maturity;
			for (let i = 0; i < parlayTwoMarkets.length; i++) {
				maturity = await parlayTwoMarkets[i].times();
				console.log(parlayTwoMarkets[i].address, ' maturity at: ', maturity[0].toString());
				maturityTimes[i] = parseInt(maturity[0].toString());
			}
			await fastForward(maturityTimes[0] - (await currentTime()) - 10 * 60 * SECOND);
			await ParlayAMMLiquidityPool.start({ from: owner });
			await Thales.transfer(secondParlayAMMLiquidityProvider, toUnit('1000'), { from: owner });
			const MockStakingThales = artifacts.require('MockStakingThales');
			let mockStakingThales = await MockStakingThales.new({ from: owner });

			await Thales.approve(mockStakingThales.address, toUnit(1000), {
				from: secondParlayAMMLiquidityProvider,
			});

			await Thales.approve(ParlayAMMLiquidityPool.address, toUnit(1000), {
				from: secondParlayAMMLiquidityProvider,
			});
			await mockStakingThales.stake(toUnit(100), { from: secondParlayAMMLiquidityProvider });

			await ParlayAMMLiquidityPool.setStakedThalesMultiplier(toUnit(1), {
				from: owner,
			});

			await ParlayAMMLiquidityPool.setStakingThales(mockStakingThales.address, {
				from: owner,
			});

			await expect(
				ParlayAMMLiquidityPool.deposit(toUnit(100000000), {
					from: secondParlayAMMLiquidityProvider,
				})
			).to.be.revertedWith('Deposit amount exceeds AMM LP cap');
			let totalDeposited = await ParlayAMMLiquidityPool.totalDeposited();
			console.log('Total deposited', fromUnit(totalDeposited));
			await expect(
				ParlayAMMLiquidityPool.deposit(toUnit(101), { from: secondParlayAMMLiquidityProvider })
			).to.be.revertedWith('Not enough staked THALES');

			await expect(
				ParlayAMMLiquidityPool.deposit(toUnit(1), { from: secondParlayAMMLiquidityProvider })
			).to.be.revertedWith('Amount less than minDepositAmount');

			await ParlayAMMLiquidityPool.setOnlyWhitelistedStakersAllowed(true, {
				from: owner,
			});
			await expect(
				ParlayAMMLiquidityPool.deposit(toUnit(101), { from: secondParlayAMMLiquidityProvider })
			).to.be.revertedWith('Only whitelisted stakers allowed');

			let getMaxAvailableDepositForUser =
				await ParlayAMMLiquidityPool.getMaxAvailableDepositForUser(
					secondParlayAMMLiquidityProvider
				);
			console.log('getMaxAvailableDepositForUser  ' + getMaxAvailableDepositForUser[1] / 1e18);

			let getNeededStakedThalesToWithdrawForUser =
				await ParlayAMMLiquidityPool.getNeededStakedThalesToWithdrawForUser(
					secondParlayAMMLiquidityProvider
				);
			console.log(
				'getNeededStakedThalesToWithdrawForUser  ' + getNeededStakedThalesToWithdrawForUser / 1e18
			);
		});

		describe('Exercise whole parlay cancellation of totals market', () => {
			beforeEach(async () => {
				let fastForwardTime = game1NBATime - (await currentTime()) - SECOND;
				await fastForward(game1NBATime - (await currentTime()) - SECOND);
				let maturity;
				for (let i = 0; i < parlayTwoMarkets.length; i++) {
					maturity = await parlayTwoMarkets[i].times();
					// console.log(parlayTwoMarkets[i].address, ' maturity at: ', maturity[0].toString());
					maturityTimes[i] = parseInt(maturity[0].toString());
				}
				await fastForward(maturityTimes[0] - (await currentTime()) - 10 * 60 * SECOND);
				await ParlayAMMLiquidityPool.start({ from: owner });
				// await fastForward((await currentTime()) - SECOND);
				answer = await SportPositionalMarketManager.numActiveMarkets();
				assert.equal(answer.toString(), '15');
				let totalSUSDToPay = toUnit('10');
				parlayPositions = ['1', '1'];
				// parlayPositions = ['1', '1', '1', '1'];
				let parlayPositions2 = ['1', '1', '1', '1', '0'];
				let parlayMarketsAddress = [];
				for (let i = 0; i < parlayTwoMarkets.length; i++) {
					parlayMarketsAddress[i] = parlayTwoMarkets[i].address.toString().toUpperCase();
					parlayMarketsAddress[i] = parlayTwoMarkets[i].address.toString().replace('0X', '0x');
				}
				// console.log('parlayAddr: ', parlayMarketsAddress);
				let slippage = toUnit('0.01');
				let result = await ParlayAMM.buyQuoteFromParlay(
					parlayMarketsAddress,
					parlayPositions,
					totalSUSDToPay
				);
				// console.log('result quote: ', fromUnit(result.totalBuyAmount));
				let roundPool_2_Address = await ParlayAMMLiquidityPool.roundPools(2);
				let roundBalanceBefore = await Thales.balanceOf(roundPool_2_Address);
				let buyParlayTX = await ParlayAMM.buyFromParlay(
					parlayMarketsAddress,
					parlayPositions,
					totalSUSDToPay,
					slippage,
					result[1],
					ZERO_ADDRESS,
					{ from: first }
				);
				let roundBalanceAfter = await Thales.balanceOf(roundPool_2_Address);
				// console.log(
				// 	'\n\nRound Balance before: ',
				// 	fromUnit(roundBalanceBefore),
				// 	'\nRound Balance after: ',
				// 	fromUnit(roundBalanceAfter),
				// 	'\nRound change: ',
				// 	fromUnit(roundBalanceAfter.sub(roundBalanceBefore))
				// );

				// adding the round 3 market

				let activeParlays = await ParlayAMM.activeParlayMarkets('0', '100');
				parlaySingleMarketAddress = activeParlays[0];
				parlaySingleMarket = await ParlayMarketContract.at(activeParlays[0].toString());
				await fastForward(fightTime - (await currentTime()) + 3 * HOUR);
				let resolveMatrix = ['2', '2'];
				console.log('Games resolved: ', resolveMatrix, '\n');
				// parlayPositions = ['0', '0', '0', '0'];
				let gameId;
				let homeResult = '0';
				let awayResult = '0';
				let checkResult;
				for (let i = 0; i < parlayTwoMarkets.length; i++) {
					homeResult = '0';
					awayResult = '0';
					gameId = await TherundownConsumerDeployed.gameIdPerMarket(parlayTwoMarkets[i].address);
					if (resolveMatrix[i] == '1') {
						homeResult = '1';
					} else if (resolveMatrix[i] == '2') {
						awayResult = '1';
					} else if (resolveMatrix[i] == '3') {
						homeResult = '1';
						awayResult = '1';
					}
					if (i == 0) {
						homeResult = '95';
						awayResult = '105';
					}
					if (i != parlayMarkets.length - 1) {
						const tx_resolve_4 = await TherundownConsumerDeployed.resolveMarketManually(
							parlayMarkets[i].address,
							resolveMatrix[i],
							homeResult,
							awayResult,
							false,
							{ from: owner }
						);
						checkResult = await parlayTwoMarkets[i].result();
						console.log(
							i,
							' outcome for market ',
							parlayTwoMarkets[i].address,
							': ',
							checkResult.toString()
						);
					}
				}
			});
			it('Parlay exercised, amounts per round checked', async () => {
				let roundPool_2_Address = await ParlayAMMLiquidityPool.roundPools(2);
				let userBalanceBefore = toUnit('1000');
				let roundBalanceBefore = await Thales.balanceOf(roundPool_2_Address);
				let balanceBefore = await Thales.balanceOf(ParlayAMM.address);
				await ParlayAMM.exerciseParlay(parlaySingleMarket.address);
				let roundBalanceAfter = await Thales.balanceOf(roundPool_2_Address);
				let balanceAfter = await Thales.balanceOf(ParlayAMM.address);
				let userBalanceAfter = await Thales.balanceOf(first);
				console.log(
					'\n\nRound Balance before: ',
					fromUnit(roundBalanceBefore),
					'\nRound Balance after: ',
					fromUnit(roundBalanceAfter),
					'\nRound change: ',
					fromUnit(roundBalanceAfter.sub(roundBalanceBefore))
				);
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

				let parlayData = await ParlayMarketData.getParlayDetails(parlaySingleMarket.address);

				console.log('Quote: ', fromUnit(parlayData.totalResultQuote));
				console.log('quotes: ', parlayData.oddsOnCreation.toString());

				let sportMarket = [];
				let calculatedQuote = 1.0;
				let totalSUSDToPay = toUnit('10');
				let feesApplied = parseFloat(5) + parseFloat(2);
				feesApplied = parseFloat(fromUnit(totalSUSDToPay)) * ((100.0 - feesApplied) / 100.0);

				let parlayAmount = await parlaySingleMarket.amount();
				for (let i = 0; i < parlayData.oddsOnCreation.length; i++) {
					console.log('odd ', i, ' :', fromUnit(parlayData.oddsOnCreation[i]));
					calculatedQuote = calculatedQuote * parseFloat(fromUnit(parlayData.oddsOnCreation[i]));
				}
				calculatedQuote = calculatedQuote / 0.95;
				console.log('calculatedQuote: ', calculatedQuote);
				let calculatedAmount = feesApplied / calculatedQuote;
			});

			it('Close round', async () => {
				let thisRound = await ParlayAMMLiquidityPool.round();
				let roundClosure = await ParlayAMMLiquidityPool.getRoundEndTime(thisRound);
				console.log('Current round:', thisRound.toString());
				console.log('Closing time:', roundClosure.toString());
				console.log('Current time:', await currentTime());
				let canClose = await ParlayAMMLiquidityPool.canCloseCurrentRound();
				console.log('Can close round: ', canClose);
				assert.equal(canClose, false);
				await ParlayAMM.exerciseParlay(parlaySingleMarket.address);
				await fastForward(await currentTime());
				console.log('Current time:', await currentTime());
				canClose = await ParlayAMMLiquidityPool.canCloseCurrentRound();
				console.log('Can close round: ', canClose);
				assert.equal(canClose, true);

				await ParlayAMMLiquidityPool.prepareRoundClosing();
				let roundClosingPrepared = await ParlayAMMLiquidityPool.roundClosingPrepared();
				console.log('Round closing prepared: ', roundClosingPrepared);
				assert.equal(roundClosingPrepared, true);

				await ParlayAMMLiquidityPool.processRoundClosingBatch(20);
				let usersProcessedInRound = await ParlayAMMLiquidityPool.usersProcessedInRound();
				console.log('UsersProcessed: ', usersProcessedInRound.toString());
				assert.equal(usersProcessedInRound.toString(), '1');

				await ParlayAMMLiquidityPool.closeRound();
				thisRound = await ParlayAMMLiquidityPool.round();
				console.log('Current round:', thisRound.toString());
				assert.equal(thisRound.toString(), '3');
			});
		});

		describe('Mixed rounds markets -> default round (1)', () => {
			beforeEach(async () => {
				let fastForwardTime = game1NBATime - (await currentTime()) - SECOND;
				await fastForward(game1NBATime - (await currentTime()) - SECOND);
				let maturity;
				for (let i = 0; i < parlayThreeMarkets.length; i++) {
					maturity = await parlayThreeMarkets[i].times();
					// console.log(parlayThreeMarkets[i].address, ' maturity at: ', maturity[0].toString());
					maturityTimes[i] = parseInt(maturity[0].toString());
				}
				await fastForward(maturityTimes[0] - (await currentTime()) - 10 * 60 * SECOND);
				await ParlayAMMLiquidityPool.start({ from: owner });
				// await fastForward((await currentTime()) - SECOND);
				answer = await SportPositionalMarketManager.numActiveMarkets();
				assert.equal(answer.toString(), '15');
				let totalSUSDToPay = toUnit('10');
				parlayPositions = ['1', '1', '1'];
				// parlayPositions = ['1', '1', '1', '1'];
				let parlayPositions2 = ['1', '1', '1', '1', '0'];
				let parlayMarketsAddress = [];
				for (let i = 0; i < parlayThreeMarkets.length; i++) {
					parlayMarketsAddress[i] = parlayThreeMarkets[i].address.toString().toUpperCase();
					parlayMarketsAddress[i] = parlayThreeMarkets[i].address.toString().replace('0X', '0x');
				}
				// console.log('parlayAddr: ', parlayMarketsAddress);
				let slippage = toUnit('0.01');
				let result = await ParlayAMM.buyQuoteFromParlay(
					parlayMarketsAddress,
					parlayPositions,
					totalSUSDToPay
				);
				// console.log('result quote: ', fromUnit(result.totalBuyAmount));
				let roundPool_2_Address = await ParlayAMMLiquidityPool.roundPools(2);
				let roundBalanceBefore = await Thales.balanceOf(roundPool_2_Address);
				let buyParlayTX = await ParlayAMM.buyFromParlay(
					parlayMarketsAddress,
					parlayPositions,
					totalSUSDToPay,
					slippage,
					result[1],
					ZERO_ADDRESS,
					{ from: first }
				);
				let roundBalanceAfter = await Thales.balanceOf(roundPool_2_Address);
				// console.log(
				// 	'\n\nRound Balance before: ',
				// 	fromUnit(roundBalanceBefore),
				// 	'\nRound Balance after: ',
				// 	fromUnit(roundBalanceAfter),
				// 	'\nRound change: ',
				// 	fromUnit(roundBalanceAfter.sub(roundBalanceBefore))
				// );

				let activeParlays = await ParlayAMM.activeParlayMarkets('0', '100');
				parlaySingleMarketAddress = activeParlays[0];
				parlaySingleMarket = await ParlayMarketContract.at(activeParlays[0].toString());
				await fastForward(fightTime - (await currentTime()) + 3 * HOUR);
				let resolveMatrix = ['2', '2', '2'];
				console.log('Games resolved: ', resolveMatrix, '\n');
				// parlayPositions = ['0', '0', '0', '0'];
				let gameId;
				let homeResult = '0';
				let awayResult = '0';
				let checkResult;
				for (let i = 0; i < parlayThreeMarkets.length; i++) {
					homeResult = '0';
					awayResult = '0';
					gameId = await TherundownConsumerDeployed.gameIdPerMarket(parlayThreeMarkets[i].address);
					if (resolveMatrix[i] == '1') {
						homeResult = '1';
					} else if (resolveMatrix[i] == '2') {
						awayResult = '1';
					} else if (resolveMatrix[i] == '3') {
						homeResult = '1';
						awayResult = '1';
					}
					if (i == 0) {
						homeResult = '95';
						awayResult = '105';
					}
					if (i != parlayMarkets.length - 1) {
						const tx_resolve_4 = await TherundownConsumerDeployed.resolveMarketManually(
							parlayMarkets[i].address,
							resolveMatrix[i],
							homeResult,
							awayResult,
							false,
							{ from: owner }
						);
						checkResult = await parlayThreeMarkets[i].result();
						console.log(
							i,
							' outcome for market ',
							parlayThreeMarkets[i].address,
							': ',
							checkResult.toString()
						);
					}
				}
			});
			it('Parlay exercised, amounts per round checked', async () => {
				let roundPool_2_Address = await ParlayAMMLiquidityPool.roundPools(2);
				let userBalanceBefore = toUnit('1000');
				let roundBalanceBefore = await Thales.balanceOf(roundPool_2_Address);
				let balanceBefore = await Thales.balanceOf(ParlayAMM.address);
				await ParlayAMM.exerciseParlay(parlaySingleMarket.address);
				let roundBalanceAfter = await Thales.balanceOf(roundPool_2_Address);
				let balanceAfter = await Thales.balanceOf(ParlayAMM.address);
				let userBalanceAfter = await Thales.balanceOf(first);
				console.log(
					'\n\nRound Balance before: ',
					fromUnit(roundBalanceBefore),
					'\nRound Balance after: ',
					fromUnit(roundBalanceAfter),
					'\nRound change: ',
					fromUnit(roundBalanceAfter.sub(roundBalanceBefore))
				);
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

				assert.equal(balanceAfter, 0);

				let parlayData = await ParlayMarketData.getParlayDetails(parlaySingleMarket.address);

				console.log('Quote: ', fromUnit(parlayData.totalResultQuote));
				console.log('quotes: ', parlayData.oddsOnCreation.toString());

				let sportMarket = [];
				let calculatedQuote = 1.0;
				let totalSUSDToPay = toUnit('10');
				let feesApplied = parseFloat(5) + parseFloat(2);
				feesApplied = parseFloat(fromUnit(totalSUSDToPay)) * ((100.0 - feesApplied) / 100.0);

				let parlayAmount = await parlaySingleMarket.amount();
				for (let i = 0; i < parlayData.oddsOnCreation.length; i++) {
					console.log('odd ', i, ' :', fromUnit(parlayData.oddsOnCreation[i]));
					calculatedQuote = calculatedQuote * parseFloat(fromUnit(parlayData.oddsOnCreation[i]));
				}
				calculatedQuote = calculatedQuote / 0.95;
				console.log('calculatedQuote: ', calculatedQuote);
				let calculatedAmount = feesApplied / calculatedQuote;
			});

			it('Close round', async () => {
				let thisRound = await ParlayAMMLiquidityPool.round();
				let roundClosure = await ParlayAMMLiquidityPool.getRoundEndTime(thisRound);
				console.log('Current round:', thisRound.toString());
				console.log('Closing time:', roundClosure.toString());
				console.log('Current time:', await currentTime());
				let canClose = await ParlayAMMLiquidityPool.canCloseCurrentRound();
				let roundPool_2_Address = await ParlayAMMLiquidityPool.roundPools(2);
				let roundBalanceBefore = await Thales.balanceOf(roundPool_2_Address);

				let tradingMarketsPerRound = await ParlayAMMLiquidityPool.getTradingMarketsPerRound(2);
				console.log('Trading Markets: ', tradingMarketsPerRound.toString());
				console.log('Can close round: ', canClose);
				assert.equal(canClose, true);

				await ParlayAMMLiquidityPool.prepareRoundClosing();
				let roundClosingPrepared = await ParlayAMMLiquidityPool.roundClosingPrepared();
				console.log('Round closing prepared: ', roundClosingPrepared);
				assert.equal(roundClosingPrepared, true);

				await ParlayAMMLiquidityPool.processRoundClosingBatch(20);
				let usersProcessedInRound = await ParlayAMMLiquidityPool.usersProcessedInRound();
				console.log('UsersProcessed: ', usersProcessedInRound.toString());
				assert.equal(usersProcessedInRound.toString(), '1');

				await ParlayAMMLiquidityPool.closeRound();
				thisRound = await ParlayAMMLiquidityPool.round();
				console.log('Current round:', thisRound.toString());

				assert.equal(thisRound.toString(), '3');
				let profitPerRound = await ParlayAMMLiquidityPool.profitAndLossPerRound(2);
				let cummulativeBetweenRounds = await ParlayAMMLiquidityPool.cumulativePnLBetweenRounds(
					2,
					3
				);
				console.log('PnL in Round 2: ', fromUnit(profitPerRound));
				console.log('cummulative PnL between Round 2 & 3: ', fromUnit(cummulativeBetweenRounds));
				assert.equal(fromUnit(cummulativeBetweenRounds), '0');
				roundBalanceBefore = await Thales.balanceOf(roundPool_2_Address);
				console.log('Previous Round 2 balance: ', fromUnit(roundBalanceBefore));
				assert.equal(fromUnit(profitPerRound), '1');
			});
		});

		describe('Round 2, and round 3 market', () => {
			beforeEach(async () => {
				let fastForwardTime = game1NBATime - (await currentTime()) - SECOND;
				await fastForward(game1NBATime - (await currentTime()) - SECOND);
				let maturity;
				for (let i = 0; i < parlayTwoMarketDifferentRound.length; i++) {
					maturity = await parlayTwoMarketDifferentRound[i].times();
					// console.log(
					// 	parlayTwoMarketDifferentRound[i].address,
					// 	' maturity at: ',
					// 	maturity[0].toString()
					// );
					maturityTimes[i] = parseInt(maturity[0].toString());
				}
				let maturity1 = maturityTimes[0];
				await fastForward(maturityTimes[0] - (await currentTime()) - 10 * 60 * SECOND);
				await ParlayAMMLiquidityPool.start({ from: owner });
				// await fastForward((await currentTime()) - SECOND);
				answer = await SportPositionalMarketManager.numActiveMarkets();
				assert.equal(answer.toString(), '15');
				let totalSUSDToPay = toUnit('10');
				parlayPositions = ['1', '1'];
				// parlayPositions = ['1', '1', '1', '1'];
				let parlayPositions2 = ['1', '1', '1', '1', '0'];
				let parlayMarketsAddress = [];
				for (let i = 0; i < parlayTwoMarketDifferentRound.length; i++) {
					parlayMarketsAddress[i] = parlayTwoMarketDifferentRound[i].address
						.toString()
						.toUpperCase();
					parlayMarketsAddress[i] = parlayTwoMarketDifferentRound[i].address
						.toString()
						.replace('0X', '0x');
				}
				// console.log('parlayAddr: ', parlayMarketsAddress);
				let slippage = toUnit('0.01');
				let result = await ParlayAMM.buyQuoteFromParlay(
					parlayMarketsAddress,
					parlayPositions,
					totalSUSDToPay
				);
				console.log('result quote: ', fromUnit(result.totalBuyAmount));
				let roundPool_2_Address = await ParlayAMMLiquidityPool.roundPools(2);
				let roundBalanceBefore = await Thales.balanceOf(roundPool_2_Address);
				let buyParlayTX = await ParlayAMM.buyFromParlay(
					parlayMarketsAddress,
					parlayPositions,
					totalSUSDToPay,
					slippage,
					result[1],
					ZERO_ADDRESS,
					{ from: first }
				);
				let roundBalanceAfter = await Thales.balanceOf(roundPool_2_Address);
				// console.log(
				// 	'\n\nRound Balance before: ',
				// 	fromUnit(roundBalanceBefore),
				// 	'\nRound Balance after: ',
				// 	fromUnit(roundBalanceAfter),
				// 	'\nRound change: ',
				// 	fromUnit(roundBalanceAfter.sub(roundBalanceBefore))
				// );

				for (let i = 0; i < parlayTwoMarkets.length; i++) {
					maturity = await parlayTwoMarkets[i].times();
					console.log(parlayTwoMarkets[i].address, ' maturity at: ', maturity[0].toString());
					maturityTimes[i] = parseInt(maturity[0].toString());
				}
				// await fastForward((await currentTime()) - SECOND);
				answer = await SportPositionalMarketManager.numActiveMarkets();
				assert.equal(answer.toString(), '15');
				totalSUSDToPay = toUnit('10');
				parlayPositions = ['1', '1'];
				// parlayPositions = ['1', '1', '1', '1'];
				parlayPositions2 = ['1', '1', '1', '1', '0'];
				parlayMarketsAddress = [];
				for (let i = 0; i < parlayTwoMarkets.length; i++) {
					parlayMarketsAddress[i] = parlayTwoMarkets[i].address.toString().toUpperCase();
					parlayMarketsAddress[i] = parlayTwoMarkets[i].address.toString().replace('0X', '0x');
				}
				// console.log('parlayAddr: ', parlayMarketsAddress);
				slippage = toUnit('0.01');
				result = await ParlayAMM.buyQuoteFromParlay(
					parlayMarketsAddress,
					parlayPositions,
					totalSUSDToPay
				);
				console.log('result quote: ', fromUnit(result.totalBuyAmount));
				roundPool_2_Address = await ParlayAMMLiquidityPool.roundPools(3);
				console.log('round pool address: ', roundPool_2_Address);
				roundBalanceBefore = await Thales.balanceOf(roundPool_2_Address);
				buyParlayTX = await ParlayAMM.buyFromParlay(
					parlayMarketsAddress,
					parlayPositions,
					totalSUSDToPay,
					slippage,
					result[1],
					ZERO_ADDRESS,
					{ from: first }
				);
				roundBalanceAfter = await Thales.balanceOf(roundPool_2_Address);
				console.log(
					'\n\nRound Balance before: ',
					fromUnit(roundBalanceBefore),
					'\nRound Balance after: ',
					fromUnit(roundBalanceAfter),
					'\nRound change: ',
					fromUnit(roundBalanceAfter.sub(roundBalanceBefore))
				);

				let activeParlays = await ParlayAMM.activeParlayMarkets('0', '100');
				console.log('Active parlays: ', activeParlays);
				parlaySingleMarketAddress = activeParlays[0];
				parlaySingleMarket = await ParlayMarketContract.at(activeParlays[0].toString());
				await fastForward(fightTime - (await currentTime()) + 3 * HOUR);
				console.log('previous time: ', fightTime - (await currentTime()) + 3 * HOUR);
				console.log('other time: ', maturity1 - (await currentTime()) + 5 * HOUR);
				// await fastForward(maturity1 - (await currentTime()) + 5*HOUR);
				const tx_from_manager = await SportPositionalMarketManager.resolveMarket(
					parlayTwoMarketDifferentRound[1].address,
					0,
					{ from: manager }
				);
				const tx_from_manager2 = await SportPositionalMarketManager.resolveMarket(
					parlayTwoMarketDifferentRound[0].address,
					2,
					{ from: manager }
				);
				let resolveMatrix = ['2', '2'];
				console.log('Games resolved: ', resolveMatrix, '\n');
				// parlayPositions = ['0', '0', '0', '0'];
				let gameId;
				let homeResult = '0';
				let awayResult = '0';
				let checkResult;
				let gameOfParlay;

				for (let i = 0; i < parlayTwoMarketDifferentRound.length; i++) {
					homeResult = '0';
					awayResult = '0';
					gameOfParlay = await parlaySingleMarket.sportMarket(i);
					gameId = await TherundownConsumerDeployed.gameIdPerMarket(gameOfParlay.sportAddress);
					if (resolveMatrix[i] == '1') {
						homeResult = '1';
					} else if (resolveMatrix[i] == '2') {
						awayResult = '1';
					} else if (resolveMatrix[i] == '3') {
						homeResult = '1';
						awayResult = '1';
					}
					if (i == 0) {
						homeResult = '2';
						awayResult = '3';
					}
					checkResult = await parlayTwoMarketDifferentRound[i].result();
					console.log(
						i,
						' outcome for market ',
						parlayTwoMarketDifferentRound[i].address,
						': ',
						checkResult.toString()
					);
				}
				parlaySingleMarketAddress = activeParlays[1];
				parlaySingleMarket2 = await ParlayMarketContract.at(activeParlays[1].toString());
				resolveMatrix = ['2', '2'];
				console.log('Games resolved: ', resolveMatrix, '\n');
				// parlayPositions = ['0', '0', '0', '0'];
				gameId;
				homeResult = '0';
				awayResult = '0';
				checkResult;
				for (let i = 0; i < parlayTwoMarkets.length; i++) {
					homeResult = '0';
					awayResult = '0';
					gameId = await TherundownConsumerDeployed.gameIdPerMarket(parlayTwoMarkets[i].address);
					if (resolveMatrix[i] == '1') {
						homeResult = '1';
					} else if (resolveMatrix[i] == '2') {
						awayResult = '1';
					} else if (resolveMatrix[i] == '3') {
						homeResult = '1';
						awayResult = '1';
					}
					if (i == 0) {
						homeResult = '95';
						awayResult = '105';
					}
					if (i != parlayTwoMarkets.length - 1) {
						const tx_resolve_4 = await TherundownConsumerDeployed.resolveMarketManually(
							parlayTwoMarkets[i].address,
							resolveMatrix[i],
							homeResult,
							awayResult,
							false,
							{ from: owner }
						);
					}
					checkResult = await parlayTwoMarkets[i].result();
					console.log(
						i,
						' outcome for market ',
						parlayTwoMarkets[i].address,
						': ',
						checkResult.toString()
					);
				}
			});
			it('Balances', async () => {
				let roundPool_2_Address = await ParlayAMMLiquidityPool.roundPools(2);
				let roundPool_3_Address = await ParlayAMMLiquidityPool.roundPools(3);
				let userBalanceBefore = toUnit('1000');
				let roundBalanceBefore = await Thales.balanceOf(roundPool_2_Address);
				let roundBalanceBefore3 = await Thales.balanceOf(roundPool_3_Address);
				let balanceBefore = await Thales.balanceOf(ParlayAMM.address);
				await ParlayAMM.exerciseParlay(parlaySingleMarket.address);
				await ParlayAMM.exerciseParlay(parlaySingleMarket2.address);
				let roundBalanceAfter = await Thales.balanceOf(roundPool_2_Address);
				let roundBalanceAfter3 = await Thales.balanceOf(roundPool_3_Address);
				let balanceAfter = await Thales.balanceOf(ParlayAMM.address);
				let userBalanceAfter = await Thales.balanceOf(first);
				console.log(
					'\n\nRound 2 Balance before: ',
					fromUnit(roundBalanceBefore),
					'\nRound 2 Balance after: ',
					fromUnit(roundBalanceAfter),
					'\nRound 2 change: ',
					fromUnit(roundBalanceAfter.sub(roundBalanceBefore))
				);
				console.log(
					'\n\nRound 3 Balance before: ',
					fromUnit(roundBalanceBefore3),
					'\nRound 3 Balance after: ',
					fromUnit(roundBalanceAfter3),
					'\nRound 3 change: ',
					fromUnit(roundBalanceAfter3.sub(roundBalanceBefore3))
				);
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
			});

			it('Close round', async () => {
				let thisRound = await ParlayAMMLiquidityPool.round();
				let roundClosure = await ParlayAMMLiquidityPool.getRoundEndTime(thisRound);
				console.log('Current round:', thisRound.toString());
				console.log('Closing time:', roundClosure.toString());
				console.log('Current time:', await currentTime());
				let canClose = await ParlayAMMLiquidityPool.canCloseCurrentRound();
				let roundPool_2_Address = await ParlayAMMLiquidityPool.roundPools(2);
				let roundBalanceBefore = await Thales.balanceOf(roundPool_2_Address);

				let tradingMarketsPerRound = await ParlayAMMLiquidityPool.getTradingMarketsPerRound(2);
				console.log('Trading Markets: ', tradingMarketsPerRound.toString());
				console.log('Can close round: ', canClose);
				assert.equal(canClose, false);
				console.log('Exercising: ', parlaySingleMarket.address);
				console.log('Exercising: ', parlaySingleMarket2.address);
				let readyToBeExercised = await ParlayAMMLiquidityPool.hasMarketsReadyToBeExercised();
				console.log('Markets ready for exercise in current round:', readyToBeExercised);
				await ParlayAMMLiquidityPool.exerciseMarketsReadyToExercised();
				await ParlayAMM.exerciseParlay(parlaySingleMarket.address);
				await ParlayAMM.exerciseParlay(parlaySingleMarket2.address);
				console.log('-> both markets exercised');

				canClose = await ParlayAMMLiquidityPool.canCloseCurrentRound();
				console.log('Can close round: ', canClose);
				assert.equal(canClose, true);

				await ParlayAMMLiquidityPool.prepareRoundClosing();
				let roundClosingPrepared = await ParlayAMMLiquidityPool.roundClosingPrepared();
				console.log('Round closing prepared: ', roundClosingPrepared);
				assert.equal(roundClosingPrepared, true);

				await ParlayAMMLiquidityPool.processRoundClosingBatch(20);
				let usersProcessedInRound = await ParlayAMMLiquidityPool.usersProcessedInRound();
				console.log('UsersProcessed: ', usersProcessedInRound.toString());
				assert.equal(usersProcessedInRound.toString(), '1');

				await ParlayAMMLiquidityPool.closeRound();
				thisRound = await ParlayAMMLiquidityPool.round();
				console.log('Current round:', thisRound.toString());

				assert.equal(thisRound.toString(), '3');
				let profitPerRound = await ParlayAMMLiquidityPool.profitAndLossPerRound(2);
				let cummulativeBetweenRounds = await ParlayAMMLiquidityPool.cumulativePnLBetweenRounds(
					2,
					3
				);
				console.log('PnL in Round 2: ', fromUnit(profitPerRound));
				console.log('cummulative PnL between Round 2 & 3: ', fromUnit(cummulativeBetweenRounds));
				assert.equal(fromUnit(cummulativeBetweenRounds), '0');
				console.log('Previous balance Round 2: ', fromUnit(roundBalanceBefore));

				console.log('Round 2 closed, closing Round 3 ===> ');
				// assert.equal(fromUnit(profitPerRound), '1');
				thisRound = await ParlayAMMLiquidityPool.round();
				roundClosure = await ParlayAMMLiquidityPool.getRoundEndTime(thisRound);
				console.log('Current round:', thisRound.toString());
				console.log('Closing time:', roundClosure.toString());
				console.log('Current time:', await currentTime());
				canClose = await ParlayAMMLiquidityPool.canCloseCurrentRound();
				roundPool_2_Address = await ParlayAMMLiquidityPool.roundPools(2);
				roundBalanceBefore = await Thales.balanceOf(roundPool_2_Address);

				tradingMarketsPerRound = await ParlayAMMLiquidityPool.getTradingMarketsPerRound(2);
				console.log('Trading Markets: ', tradingMarketsPerRound.toString());
				console.log('Can close round: ', canClose);
				assert.equal(canClose, true);

				await ParlayAMMLiquidityPool.prepareRoundClosing();
				roundClosingPrepared = await ParlayAMMLiquidityPool.roundClosingPrepared();
				console.log('Round closing prepared: ', roundClosingPrepared);
				assert.equal(roundClosingPrepared, true);

				await ParlayAMMLiquidityPool.processRoundClosingBatch(20);
				usersProcessedInRound = await ParlayAMMLiquidityPool.usersProcessedInRound();
				console.log('UsersProcessed: ', usersProcessedInRound.toString());
				assert.equal(usersProcessedInRound.toString(), '1');

				await ParlayAMMLiquidityPool.closeRound();
				thisRound = await ParlayAMMLiquidityPool.round();
				console.log('Current round:', thisRound.toString());

				assert.equal(thisRound.toString(), '4');
				profitPerRound = await ParlayAMMLiquidityPool.profitAndLossPerRound(3);
				cummulativeBetweenRounds = await ParlayAMMLiquidityPool.cumulativePnLBetweenRounds(3, 4);
				console.log('PnL in Round 3: ', fromUnit(profitPerRound));
				console.log('cummulative PnL between Round 3 & 4: ', fromUnit(cummulativeBetweenRounds));
				// assert.equal(fromUnit(cummulativeBetweenRounds), '0');
				console.log('Previous balance Round 2: ', fromUnit(roundBalanceBefore));
			});

			it('Read from data contract', async () => {
				await Thales.transfer(secondParlayAMMLiquidityProvider, toUnit('1000'), { from: owner });
				const MockStakingThales = artifacts.require('MockStakingThales');
				let mockStakingThales = await MockStakingThales.new({ from: owner });

				await Thales.approve(mockStakingThales.address, toUnit(1000), {
					from: secondParlayAMMLiquidityProvider,
				});

				await Thales.approve(ParlayAMMLiquidityPool.address, toUnit(1000), {
					from: secondParlayAMMLiquidityProvider,
				});
				await mockStakingThales.stake(toUnit(100), { from: secondParlayAMMLiquidityProvider });

				await ParlayAMMLiquidityPool.setStakedThalesMultiplier(toUnit(1), {
					from: owner,
				});

				await ParlayAMMLiquidityPool.setStakingThales(mockStakingThales.address, {
					from: owner,
				});

				let thisRound = await ParlayAMMLiquidityPool.round();
				let roundClosure = await ParlayAMMLiquidityPool.getRoundEndTime(thisRound);
				let canClose = await ParlayAMMLiquidityPool.canCloseCurrentRound();
				let roundPool_2_Address = await ParlayAMMLiquidityPool.roundPools(2);
				let roundBalanceBefore = await Thales.balanceOf(roundPool_2_Address);

				let tradingMarketsPerRound = await ParlayAMMLiquidityPool.getTradingMarketsPerRound(2);
				assert.equal(canClose, false);
				let readyToBeExercised = await ParlayAMMLiquidityPool.hasMarketsReadyToBeExercised();
				await ParlayAMMLiquidityPool.exerciseMarketsReadyToExercised();
				await ParlayAMM.exerciseParlay(parlaySingleMarket.address);
				await ParlayAMM.exerciseParlay(parlaySingleMarket2.address);

				canClose = await ParlayAMMLiquidityPool.canCloseCurrentRound();
				assert.equal(canClose, true);

				await ParlayAMMLiquidityPool.prepareRoundClosing();
				let roundClosingPrepared = await ParlayAMMLiquidityPool.roundClosingPrepared();
				assert.equal(roundClosingPrepared, true);

				await ParlayAMMLiquidityPool.processRoundClosingBatch(20);
				let usersProcessedInRound = await ParlayAMMLiquidityPool.usersProcessedInRound();
				assert.equal(usersProcessedInRound.toString(), '1');

				await ParlayAMMLiquidityPool.closeRound();
				thisRound = await ParlayAMMLiquidityPool.round();
				console.log('Current round:', thisRound.toString());

				assert.equal(thisRound.toString(), '3');
				let profitPerRound = await ParlayAMMLiquidityPool.profitAndLossPerRound(2);
				let cummulativeBetweenRounds = await ParlayAMMLiquidityPool.cumulativePnLBetweenRounds(
					2,
					3
				);

				let LPData = await ParlayAMMLiquidityPoolData.getLiquidityPoolData(
					ParlayAMMLiquidityPool.address
				);
				console.log('LP DATA:\n', LPData);
				let userLPData = await ParlayAMMLiquidityPoolData.getUserLiquidityPoolData(
					ParlayAMMLiquidityPool.address,
					secondParlayAMMLiquidityProvider
				);
				console.log('User LP DATA:\n', userLPData);
			});
		});
	});
});
