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
const ZERO_ADDRESS = '0x' + '0'.repeat(40);

const {
	fastForward,
	toUnit,
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

contract('TheRundownConsumerVerifier', (accounts) => {
	const [manager, first, owner, second, third, fourth, safeBox, wrapper] = accounts;

	const ZERO_ADDRESS = '0x' + '0'.repeat(40);

	const SportPositionContract = artifacts.require('SportPosition');
	const SportPositionalMarketContract = artifacts.require('SportPositionalMarket');
	const SportPositionalMarketDataContract = artifacts.require('SportPositionalMarketData');
	const SportPositionalMarketManagerContract = artifacts.require('SportPositionalMarketManager');
	const SportPositionalMarketFactoryContract = artifacts.require('SportPositionalMarketFactory');
	const SportsAMMContract = artifacts.require('SportsAMM');
	const ThalesContract = artifacts.require('contracts/Token/OpThales_L1.sol:OpThales');
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
	let verifier;
	let TherundownConsumerVerifier;
	let TherundownConsumerVerifierDeployed;
	let TherundownConsumer;
	let TherundownConsumerImplementation;
	let TherundownConsumerDeployed;
	let MockTherundownConsumerWrapper;
	let initializeConsumerData;
	let gamesQueue;
	let game_1_create;
	let game_1_update_after;
	let game_1_update_before;
	let game_1_resolve;
	let fightId;
	let fight_create;
	let fightCreated;
	let fight_update;
	let fightUpdated;
	let game_fight_resolve;
	let gamesFightResolved;
	let game_fight_resolve_draw;
	let gamesFightResolvedDraw;
	let reqIdFightCreate;
	let reqIdFightUpdate;
	let reqIdFightResolve;
	let reqIdFightResolveDraw;
	let gameid1;
	let oddsid;
	let oddsResult;
	let oddsid_1;
	let oddsResult_1;
	let oddsResultArray_1;
	let reqIdOdds_1;
	let oddsid_2;
	let oddsResult_2;
	let oddsResultArray_2;
	let reqIdOdds_2;
	let oddsResultArray;
	let reqIdOdds;
	let gameid2;
	let game_2_create;
	let game_2_resolve;
	let gamesCreated;
	let game1UpdatedAfter;
	let game1UpdatedBefore;
	let gamesResolved;
	let reqIdCreate;
	let reqId1UpdateAfter;
	let reqId1UpdateBefore;
	let reqIdResolve;
	let reqIdFootballCreate;
	let gameFootballid1;
	let gameFootballid2;
	let game_1_football_create;
	let game_2_football_create;
	let gamesFootballCreated;
	let game_1_football_resolve;
	let game_2_football_resolve;
	let reqIdResolveFoodball;
	let gamesResolvedFootball;
	let dummyAddress;
	let game_fight_canceled;
	let gamesFightCanceled;
	let reqIdFightCanceled;
	let GamesOddsObtainerDeployed;

	let SportPositionalMarketManager,
		SportPositionalMarketFactory,
		SportPositionalMarketData,
		SportPositionalMarket,
		SportPositionalMarketMastercopy,
		SportPositionMastercopy,
		SportsAMM;

	const game1NBATime = 1646958600;
	const gameFootballTime = 1649876400;
	const fightTime = 1660089600;

	const sportId_4 = 4; // NBA
	const sportId_16 = 16; // CHL
	const sportId_7 = 7; // UFC

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
		SportsAMM = await SportsAMMContract.new({ from: manager });

		Thales = await ThalesContract.new({ from: owner });
		let GamesQueue = artifacts.require('GamesQueue');
		gamesQueue = await GamesQueue.new({ from: owner });
		await gamesQueue.initialize(owner, { from: owner });

		await gamesQueue.addToWhitelist(third, true, {
			from: owner,
		});

		await SportPositionalMarketManager.initialize(manager, Thales.address, { from: manager });
		await SportPositionalMarketFactory.initialize(manager, { from: manager });

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

		await Thales.transfer(first, toUnit('1000'), { from: owner });
		await Thales.transfer(second, toUnit('1000'), { from: owner });
		await Thales.transfer(third, toUnit('1000'), { from: owner });

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

		// update fight props
		fight_update =
			'0x0000000000000000000000000000000000000000000000000000000000000020323437656432633466386531346239653834383335363635336137386339396200000000000000000000000000000000000000000000000000000000625755f0ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffaf240000000000000000000000000000000000000000000000000000000000004524ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffaf2400000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000120000000000000000000000000000000000000000000000000000000000000000d41746c616e7461204861776b73000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000011436861726c6f74746520486f726e657473000000000000000000000000000000';
		fightUpdated = [fight_update];
		reqIdFightUpdate = '0x1e4ef9996d321a4445068689e63fe393a5860cc98a0df22da1ac877d8cfd37d7';

		// resolve game props
		reqIdFightResolve = '0x6b5d983afa1e2da68d49e1e1e5d963cb7d93e971329e4dac36a9697234584c68';
		game_fight_resolve =
			'0x3234376564326334663865313462396538343833353636353361373863393962000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008';
		gamesFightResolved = [game_fight_resolve];

		reqIdFightCanceled = '0x6b5d983afa1e2da68d49e1e1e5d963cb7d93e971329e4dac36a9697234584c68';
		game_fight_canceled =
			'0x3234376564326334663865313462396538343833353636353361373863393962000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002';
		gamesFightCanceled = [game_fight_canceled];

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

		// update game props
		game_1_update_after =
			'0x000000000000000000000000000000000000000000000000000000000000002065363063666137383038343661663638393738623439353739653563663339360000000000000000000000000000000000000000000000000000000062577210ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffaf240000000000000000000000000000000000000000000000000000000000004524ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffaf2400000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000120000000000000000000000000000000000000000000000000000000000000000d41746c616e7461204861776b73000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000011436861726c6f74746520486f726e657473000000000000000000000000000000';
		game_1_update_before =
			'0x0000000000000000000000000000000000000000000000000000000000000020653630636661373830383436616636383937386234393537396535636633393600000000000000000000000000000000000000000000000000000000625739D0ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffaf240000000000000000000000000000000000000000000000000000000000004524ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffaf2400000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000120000000000000000000000000000000000000000000000000000000000000000d41746c616e7461204861776b73000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000011436861726c6f74746520486f726e657473000000000000000000000000000000';
		game1UpdatedAfter = [game_1_update_after];
		reqId1UpdateAfter = '0x65da2443ccd66b09d4e2693933e8fb9aab9addf46fb93300bd7c1d70c5e21667';

		game1UpdatedBefore = [game_1_update_before];
		reqId1UpdateBefore = '0x65da2443ccd66b09d4e2693933e8fb9aab9addf46fb93300bd7c1d70c5e21668';

		// resolve game props
		reqIdResolve = '0x30250573c4b099aeaf06273ef9fbdfe32ab2d6b8e33420de988be5d6886c92a7';
		game_1_resolve =
			'0x6536306366613738303834366166363839373862343935373965356366333936000000000000000000000000000000000000000000000000000000000000006400000000000000000000000000000000000000000000000000000000000000810000000000000000000000000000000000000000000000000000000000000008';
		game_2_resolve =
			'0x3937346533663036386233333764313239656435633133646632376133326662000000000000000000000000000000000000000000000000000000000000006600000000000000000000000000000000000000000000000000000000000000710000000000000000000000000000000000000000000000000000000000000008';
		gamesResolved = [game_1_resolve, game_2_resolve];

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

		dummyAddress = '0xb69e74324bc030f1b8889236efa461496d439226';

		TherundownConsumer = artifacts.require('TherundownConsumer');
		TherundownConsumerDeployed = await TherundownConsumer.new({ from: manager });

		consumer = await TherundownConsumer.at(TherundownConsumerDeployed.address);

		await consumer.initialize(
			manager,
			[sportId_4, sportId_16, sportId_7],
			SportPositionalMarketManager.address,
			[sportId_4, sportId_7],
			gamesQueue.address,
			[8, 11, 12], // resolved statuses
			[1, 2], // cancel statuses
			{ from: manager }
		);

		let ConsumerVerifier = artifacts.require('TherundownConsumerVerifier');
		TherundownConsumerVerifierDeployed = await ConsumerVerifier.new({ from: manager });

		verifier = await ConsumerVerifier.at(TherundownConsumerVerifierDeployed.address);

		await verifier.initialize(
			owner,
			consumer.address,
			['TBD TBD', 'TBA TBA'],
			['create', 'resolve'],
			20,
			{
				from: manager,
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

		await consumer.setSportContracts(
			wrapper,
			gamesQueue.address,
			SportPositionalMarketManager.address,
			verifier.address,
			GamesOddsObtainerDeployed.address,
			{ from: manager }
		);
		await TherundownConsumerDeployed.addToWhitelist(third, true, { from: manager });
		await SportPositionalMarketManager.setTherundownConsumer(TherundownConsumerDeployed.address, {
			from: manager,
		});
		await gamesQueue.setConsumerAddress(TherundownConsumerDeployed.address, { from: owner });
		await verifier.setCustomOddsThresholdForSport(sportId_16, 10, {
			from: owner,
		});

		await verifier.setDefaultBookmakerIds([11], {
			from: owner,
		});

		await verifier.setBookmakerIdsBySportId(4, [3, 11], {
			from: owner,
		});
	});

	describe('Init', () => {
		it('Check init', async () => {
			assert.equal(20, await verifier.defaultOddsThreshold());
			assert.equal(10, await verifier.oddsThresholdForSport(sportId_16));

			assert.equal(true, await verifier.isInvalidNames('Liverpool', 'Liverpool'));
			assert.equal(true, await verifier.areTeamsEqual('Liverpool', 'Liverpool'));

			assert.equal(true, await verifier.isInvalidNames('TBD TBD', 'Liverpool'));
			assert.equal(true, await verifier.isInvalidNames('Liverpool', 'TBA TBA'));

			assert.equal(false, await verifier.isInvalidNames('Liverpool', 'Arsenal'));

			assert.equal(true, await verifier.isSupportedMarketType('create'));
			assert.equal(true, await verifier.isSupportedMarketType('resolve'));
			assert.equal(false, await verifier.isSupportedMarketType('aaa'));
			assert.equal(true, await TherundownConsumerDeployed.supportedSport(sportId_4));

			let bookmakerIdsBySportId = await verifier.getBookmakerIdsBySportId(4);
			assert.bnEqual(2, bookmakerIdsBySportId.length);
			let defaultBooke = await verifier.defaultBookmakerIds(0);
			assert.bnEqual(11, defaultBooke);
			//failover to default
			let failoverBookmaker = await verifier.getBookmakerIdsBySportId(17);
			assert.bnEqual(1, failoverBookmaker.length);
		});
	});

	describe('Checking odds - compare', () => {
		it('Different odds checking', async () => {
			assert.equal(
				true,
				await verifier.areOddsInThreshold(sportId_16, 0, toUnit('0.321223930700518974'))
			);
			assert.equal(
				true,
				await verifier.areOddsInThreshold(
					sportId_16,
					toUnit('0.321223930700518974'),
					toUnit('0.321223930700518974')
				)
			);
			assert.equal(
				true,
				await verifier.areOddsInThreshold(
					sportId_16,
					toUnit('0.311223930700518974'),
					toUnit('0.321223930700518974')
				)
			);
			assert.equal(
				true,
				await verifier.areOddsInThreshold(
					sportId_16,
					toUnit('0.321223930700518974'),
					toUnit('0.311223930700518974')
				)
			);
			assert.equal(
				false,
				await verifier.areOddsInThreshold(
					sportId_16,
					toUnit('0.321223930700518974'),
					toUnit('0.121223930700518974')
				)
			);
			assert.equal(
				false,
				await verifier.areOddsInThreshold(
					sportId_16,
					toUnit('0.121223930700518974'),
					toUnit('0.321223930700518974')
				)
			);
			assert.equal(
				false,
				await verifier.areOddsInThreshold(sportId_16, toUnit('100'), toUnit('89'))
			);
			assert.equal(
				true,
				await verifier.areOddsInThreshold(sportId_16, toUnit('100'), toUnit('90'))
			);
			assert.equal(
				true,
				await verifier.areOddsInThreshold(sportId_16, toUnit('91'), toUnit('100'))
			);
			assert.equal(
				false,
				await verifier.areOddsInThreshold(sportId_16, toUnit('90'), toUnit('100'))
			);
			assert.equal(
				false,
				await verifier.areOddsInThreshold(sportId_16, toUnit('100'), toUnit('89'))
			);
			assert.equal(
				false,
				await verifier.areOddsInThreshold(sportId_16, toUnit('89'), toUnit('100'))
			);

			assert.equal(
				true,
				await verifier.areOddsArrayInThreshold(
					sportId_16,
					[toUnit('91'), toUnit('91'), toUnit('0')],
					[toUnit('100'), toUnit('100'), toUnit('0')],
					true
				)
			);

			assert.equal(
				false,
				await verifier.areOddsArrayInThreshold(
					sportId_16,
					[toUnit('89'), toUnit('91'), toUnit('0')],
					[toUnit('100'), toUnit('100'), toUnit('0')],
					true
				)
			);

			assert.equal(
				false,
				await verifier.areOddsArrayInThreshold(
					sportId_16,
					[toUnit('91'), toUnit('89'), toUnit('0')],
					[toUnit('100'), toUnit('100'), toUnit('0')],
					true
				)
			);

			assert.equal(
				false,
				await verifier.areOddsArrayInThreshold(
					sportId_16,
					[toUnit('91'), toUnit('91'), toUnit('89')],
					[toUnit('100'), toUnit('100'), toUnit('100')],
					false
				)
			);

			assert.equal(
				true,
				await verifier.areOddsArrayInThreshold(
					sportId_16,
					[toUnit('91'), toUnit('91'), toUnit('91')],
					[toUnit('100'), toUnit('100'), toUnit('100')],
					false
				)
			);

			assert.equal(
				true,
				await verifier.areOddsArrayInThreshold(
					sportId_16,
					[toUnit('0.5'), toUnit('0.5'), toUnit('0.5')],
					[toUnit('0.45'), toUnit('0.45'), toUnit('0.45')],
					false
				)
			);

			assert.equal(
				false,
				await verifier.areOddsArrayInThreshold(
					sportId_16,
					[toUnit('0.5'), toUnit('0.5'), toUnit('0.5')],
					[toUnit('0.449'), toUnit('0.449'), toUnit('0.449')],
					false
				)
			);

			assert.equal(
				false,
				await verifier.areOddsArrayInThreshold(
					sportId_16,
					[toUnit('0.5'), toUnit('0.5'), toUnit('0.5')],
					[toUnit('0.551'), toUnit('0.551'), toUnit('0.551')],
					false
				)
			);

			assert.equal(
				true,
				await verifier.areOddsArrayInThreshold(
					sportId_16,
					[toUnit('0.5'), toUnit('0.5'), toUnit('0.5')],
					[toUnit('0.55'), toUnit('0.55'), toUnit('0.55')],
					false
				)
			);

			assert.equal(
				false,
				await verifier.areOddsArrayInThreshold(
					sportId_16,
					[toUnit('0.5'), toUnit('0.5'), toUnit('0.5')],
					[toUnit('0.601'), toUnit('0.601'), toUnit('0.601')],
					false
				)
			);

			assert.equal(
				false,
				await verifier.areOddsArrayInThreshold(
					sportId_16,
					[toUnit('0.5'), toUnit('0.5'), toUnit('0.5')],
					[toUnit('0.3999'), toUnit('0.3999'), toUnit('0.3999')],
					false
				)
			);

			assert.equal(
				false,
				await verifier.areOddsArrayInThreshold(
					sportId_16,
					[toUnit('0.5'), toUnit('0.5'), toUnit('0')],
					[toUnit('0.551'), toUnit('0.551'), toUnit('0')],
					true
				)
			);

			assert.equal(
				true,
				await verifier.areOddsArrayInThreshold(
					sportId_16,
					[toUnit('0.5'), toUnit('0.5'), toUnit('0')],
					[toUnit('0.55'), toUnit('0.55'), toUnit('0')],
					true
				)
			);
		});
	});

	describe('Verifier methods', () => {
		it('Getting ids', async () => {
			let empty = [];
			let s_gameid1 = '4e8312cc6e67eb5b346319ad2ff06b5f';
			let s_gameid2 = 'a988f618889d8c1d56cee0f66d4d23f4';

			let b_gameid1 = '0x3465383331326363366536376562356233343633313961643266663036623566';
			let b_gameid2 = '0x6139383866363138383839643863316435366365653066363664346432336634';

			let gameIDs = await verifier.getStringIDsFromBytesArrayIDs(empty);
			assert.equal(0, gameIDs.length);

			gameIDs = await verifier.getStringIDsFromBytesArrayIDs([b_gameid1]);
			assert.equal(1, gameIDs.length);
			assert.equal(s_gameid1, gameIDs[0]);

			gameIDs = await verifier.getStringIDsFromBytesArrayIDs([b_gameid1, b_gameid2]);
			assert.equal(2, gameIDs.length);
			assert.equal(s_gameid1, gameIDs[0]);
			assert.equal(s_gameid2, gameIDs[1]);
		});
	});
	describe('Consumer Verifier Management', () => {
		it('Test owner functions', async () => {
			const tx_setWhitelistedAddresses = await verifier.setWhitelistedAddresses([fourth], true, {
				from: owner,
			});

			await expect(
				verifier.setWhitelistedAddresses([fourth], true, { from: first })
			).to.be.revertedWith('Only the contract owner may perform this action');

			// check if event is emited
			assert.eventEqual(tx_setWhitelistedAddresses.logs[0], 'AddedIntoWhitelist', {
				_whitelistAddress: fourth,
				_flag: true,
			});

			let bookee = [5];
			const tx_setBookmakerIdsBySportId = await verifier.setBookmakerIdsBySportId(4, bookee, {
				from: owner,
			});

			await expect(
				verifier.setBookmakerIdsBySportId(4, bookee, { from: first })
			).to.be.revertedWith('Only owner or whitelisted address may perform this action');

			// check if event is emited
			assert.eventEqual(tx_setBookmakerIdsBySportId.logs[0], 'NewBookmakerIdsBySportId', {
				_sportId: 4,
				_ids: bookee,
			});

			const tx_setdefault = await verifier.setDefaultBookmakerIds(bookee, {
				from: owner,
			});

			await expect(verifier.setDefaultBookmakerIds(bookee, { from: first })).to.be.revertedWith(
				'Only the contract owner may perform this action'
			);

			// check if event is emited
			assert.eventEqual(tx_setdefault.logs[0], 'NewDefaultBookmakerIds', {
				_ids: bookee,
			});

			const tx_setConsumerAddress = await verifier.setConsumerAddress(wrapper, {
				from: owner,
			});

			await expect(verifier.setConsumerAddress(wrapper, { from: wrapper })).to.be.revertedWith(
				'Only the contract owner may perform this action'
			);

			await expect(verifier.setConsumerAddress(ZERO_ADDRESS, { from: owner })).to.be.revertedWith(
				'Invalid address'
			);

			// check if event is emited
			assert.eventEqual(tx_setConsumerAddress.logs[0], 'NewConsumerAddress', {
				_consumer: wrapper,
			});
			const tx_setInvalidNames = await verifier.setInvalidNames(['aaa'], true, {
				from: owner,
			});

			await expect(verifier.setInvalidNames(['aaa'], false, { from: wrapper })).to.be.revertedWith(
				'Only the contract owner may perform this action'
			);

			await expect(verifier.setInvalidNames([], false, { from: owner })).to.be.revertedWith(
				'Invalid input'
			);

			// check if event is emited
			assert.eventEqual(tx_setInvalidNames.logs[0], 'SetInvalidName', {
				_invalidName: '0xb9a5dc0048db9a7d13548781df3cd4b2334606391f75f40c14225a92f4cb3537',
				_isInvalid: true,
			});

			const tx_setSupportedMarketTypes = await verifier.setSupportedMarketTypes(['aaa'], true, {
				from: owner,
			});

			await expect(
				verifier.setSupportedMarketTypes(['aaa'], false, { from: wrapper })
			).to.be.revertedWith('Only the contract owner may perform this action');

			await expect(verifier.setSupportedMarketTypes([], false, { from: owner })).to.be.revertedWith(
				'Invalid input'
			);

			// check if event is emited
			assert.eventEqual(tx_setSupportedMarketTypes.logs[0], 'SetSupportedMarketType', {
				_supportedMarketType: '0xb9a5dc0048db9a7d13548781df3cd4b2334606391f75f40c14225a92f4cb3537',
				_isSupported: true,
			});

			const tx_setDefaultOddsThreshold = await verifier.setDefaultOddsThreshold(20, {
				from: owner,
			});

			await expect(verifier.setDefaultOddsThreshold(20, { from: wrapper })).to.be.revertedWith(
				'Only the contract owner may perform this action'
			);

			await expect(verifier.setDefaultOddsThreshold(0, { from: owner })).to.be.revertedWith(
				'Must be more then ZERO'
			);

			// check if event is emited
			assert.eventEqual(tx_setDefaultOddsThreshold.logs[0], 'NewDefaultOddsThreshold', {
				_defaultOddsThreshold: 20,
			});

			await expect(
				verifier.setCustomOddsThresholdForSport(sportId_4, 20, { from: owner })
			).to.be.revertedWith('Same value as default value');

			await verifier.setConsumerAddress(consumer.address, {
				from: owner,
			});

			const tx_setCustomOddsThresholdForSport = await verifier.setCustomOddsThresholdForSport(
				sportId_4,
				19,
				{
					from: owner,
				}
			);

			await expect(
				verifier.setCustomOddsThresholdForSport(sportId_4, 19, { from: wrapper })
			).to.be.revertedWith('Only the contract owner may perform this action');

			await expect(
				verifier.setCustomOddsThresholdForSport(sportId_4, 0, { from: owner })
			).to.be.revertedWith('Must be more then ZERO');
			await expect(
				verifier.setCustomOddsThresholdForSport(sportId_4, 19, { from: owner })
			).to.be.revertedWith('Same value as before');
			await expect(
				verifier.setCustomOddsThresholdForSport(5, 21, { from: owner })
			).to.be.revertedWith('SportId is not supported');
			// check if event is emited
			assert.eventEqual(
				tx_setCustomOddsThresholdForSport.logs[0],
				'NewCustomOddsThresholdForSport',
				{
					_sportId: sportId_4,
					_oddsThresholdForSport: 19,
				}
			);
		});
	});
});
