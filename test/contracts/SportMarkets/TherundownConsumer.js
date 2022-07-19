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

contract('TheRundownConsumer', accounts => {
	const [manager, first, owner, second, third, fourth, safeBox, wrapper] = accounts;

	const ZERO_ADDRESS = '0x' + '0'.repeat(40);
	const MAX_NUMBER =
		'115792089237316195423570985008687907853269984665640564039457584007913129639935';

	const SportPositionContract = artifacts.require('SportPosition');
	const SportPositionalMarketContract = artifacts.require('SportPositionalMarket');
	const SportPositionalMarketDataContract = artifacts.require('SportPositionalMarketData');
	const SportPositionalMarketManagerContract = artifacts.require('SportPositionalMarketManager');
	const SportPositionalMarketFactoryContract = artifacts.require('SportPositionalMarketFactory');
	const SportsAMMContract = artifacts.require('SportsAMM');
	const ThalesContract = artifacts.require('contracts/Token/OpThales_L1.sol:OpThales');
	const ThalesBondsContract = artifacts.require('ThalesBonds');
	const ExoticPositionalTagsContract = artifacts.require('ExoticPositionalTags');
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
	let gamesResolved;
	let reqIdCreate;
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

	let SportPositionalMarketManager,
		SportPositionalMarketFactory,
		SportPositionalMarketData,
		SportPositionalMarket,
		SportPositionalMarketMastercopy,
		SportPositionMastercopy,
		SportsAMM;

	const game1NBATime = 1646958600;
	const gameFootballTime = 1649876400;

	const sportId_4 = 4; // NBA
	const sportId_16 = 16; // CHL

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
		ExoticPositionalTags = await ExoticPositionalTagsContract.new();
		await ExoticPositionalTags.initialize(manager, { from: manager });
		let GamesQueue = artifacts.require('GamesQueue');
		gamesQueue = await GamesQueue.new({ from: owner });
		await gamesQueue.initialize(owner, { from: owner });

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

		await ExoticPositionalTags.addTag('Sport', '1');
		await ExoticPositionalTags.addTag('Football', '101');
		await ExoticPositionalTags.addTag('Basketball', '102');

		// ids
		gameid1 = '0x6536306366613738303834366166363839373862343935373965356366333936';
		gameid2 = '0x3937346533663036386233333764313239656435633133646632376133326662';

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
		TherundownConsumerDeployed = await TherundownConsumer.new();

		await TherundownConsumerDeployed.initialize(
			owner,
			[sportId_4, sportId_16],
			SportPositionalMarketManager.address,
			[sportId_4],
			gamesQueue.address,
			[8, 11, 12], // resolved statuses
			[1, 2], // cancel statuses
			{ from: owner }
		);
		await Thales.transfer(TherundownConsumerDeployed.address, toUnit('1000'), { from: owner });

		await TherundownConsumerDeployed.setSportContracts(
			wrapper,
			gamesQueue.address,
			SportPositionalMarketManager.address,
			{ from: owner }
		);
		await TherundownConsumerDeployed.addToWhitelist(third, true, { from: owner });
		await SportPositionalMarketManager.setTherundownConsumer(TherundownConsumerDeployed.address, {
			from: manager,
		});
		await gamesQueue.setConsumerAddress(TherundownConsumerDeployed.address, { from: owner });
	});

	describe('Init', () => {
		it('Check init', async () => {
			assert.equal(true, await TherundownConsumerDeployed.isSupportedSport(sportId_4));
			assert.equal(true, await TherundownConsumerDeployed.isSupportedSport(sportId_16));
			assert.equal(false, await TherundownConsumerDeployed.isSupportedSport(0));
			assert.equal(false, await TherundownConsumerDeployed.isSupportedSport(1));

			assert.equal(true, await TherundownConsumerDeployed.isSportTwoPositionsSport(sportId_4));
			assert.equal(false, await TherundownConsumerDeployed.isSportTwoPositionsSport(sportId_16));
			assert.equal(false, await TherundownConsumerDeployed.isSportTwoPositionsSport(7));

			assert.equal(true, await TherundownConsumerDeployed.isSupportedMarketType('create'));
			assert.equal(true, await TherundownConsumerDeployed.isSupportedMarketType('resolve'));
			assert.equal(false, await TherundownConsumerDeployed.isSupportedMarketType('aaa'));

			assert.equal(
				true,
				await TherundownConsumerDeployed.isSameTeamOrTBD('Real Madrid', 'Real Madrid')
			);
			assert.equal(
				true,
				await TherundownConsumerDeployed.isSameTeamOrTBD('Real Madrid', 'TBD TBD')
			);
			assert.equal(
				true,
				await TherundownConsumerDeployed.isSameTeamOrTBD('TBD TBD', 'Liverpool FC')
			);
			assert.equal(
				false,
				await TherundownConsumerDeployed.isSameTeamOrTBD('Real Madrid', 'Liverpool FC')
			);

			assert.equal(true, await TherundownConsumerDeployed.supportResolveGameStatuses(8));
			assert.equal(false, await TherundownConsumerDeployed.supportResolveGameStatuses(1));

			assert.equal(false, await TherundownConsumerDeployed.cancelGameStatuses(8));
			assert.equal(true, await TherundownConsumerDeployed.cancelGameStatuses(1));
		});
	});

	describe('Fulfill Games Created', () => {
		it('Fulfill Games Created - NBA, create market, check results', async () => {
			await fastForward(game1NBATime - (await currentTime()) - SECOND);

			assert.bnEqual(false, await TherundownConsumerDeployed.isSportOnADate(game1NBATime, 4));
			assert.bnEqual(false, await TherundownConsumerDeployed.isSportOnADate(game1NBATime, 4));

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
			assert.equal(sportId_4, await TherundownConsumerDeployed.sportsIdPerGame(gameid1));
			assert.equal(sportId_4, await TherundownConsumerDeployed.sportsIdPerGame(gameid2));
			assert.bnEqual(1649890800, await gamesQueue.gameStartPerGameId(gameid1));
			assert.bnEqual(1649890800, await gamesQueue.gameStartPerGameId(gameid2));
			assert.bnEqual(true, await TherundownConsumerDeployed.isSportOnADate(game1NBATime, 4));
			assert.bnEqual(true, await TherundownConsumerDeployed.isSportOnADate(game1NBATime, 4));

			assert.bnEqual(gameid1, await TherundownConsumerDeployed.gamesPerDate(game1NBATime, 0));
			let getGamesPerdate = await TherundownConsumerDeployed.getGamesPerdate(game1NBATime);
			assert.bnEqual(2, getGamesPerdate.length);
			let getGamesPerdatepersport = await TherundownConsumerDeployed.getGamesPerDatePerSport(
				4,
				game1NBATime
			);
			assert.bnEqual(2, getGamesPerdatepersport.length);

			assert.equal(true, await TherundownConsumerDeployed.isSportTwoPositionsSport(sportId_4));
			assert.equal(true, await TherundownConsumerDeployed.isSupportedSport(sportId_4));

			let result = await TherundownConsumerDeployed.getOddsForGame(gameid1);
			assert.bnEqual(-20700, result[0]);
			//assert.bnEqual(17700, await TherundownConsumerDeployed.getOddsAwayTeam(gameid1));
			assert.notEqual(
				0,
				await TherundownConsumerDeployed.calculateNormalizedOddFromAmerican(-20700)
			);
			assert.notEqual(
				0,
				await TherundownConsumerDeployed.calculateNormalizedOddFromAmerican(17700)
			);
			assert.bnEqual(0, await TherundownConsumerDeployed.calculateNormalizedOddFromAmerican(0));

			assert.equal(
				game_1_create,
				await TherundownConsumerDeployed.requestIdGamesCreated(reqIdCreate, 0)
			);
			assert.equal(
				game_2_create,
				await TherundownConsumerDeployed.requestIdGamesCreated(reqIdCreate, 1)
			);

			let game = await TherundownConsumerDeployed.gameCreated(gameid1);
			let gameTime = game.startTime;
			assert.equal('Atlanta Hawks', game.homeTeam);
			assert.equal('Charlotte Hornets', game.awayTeam);

			let game_per_req = await TherundownConsumerDeployed.getGameCreatedByRequestId(reqIdCreate, 0);
			assert.equal('Atlanta Hawks', game_per_req.homeTeam);
			assert.equal('Charlotte Hornets', game_per_req.awayTeam);

			// check if event is emited
			assert.eventEqual(tx.logs[0], 'GameCreated', {
				_requestId: reqIdCreate,
				_sportId: sportId_4,
				_id: gameid1,
				_game: game,
			});

			// create markets
			const tx_create = await TherundownConsumerDeployed.createMarketForGame(gameid1);

			let marketAdd = await TherundownConsumerDeployed.marketPerGameId(gameid1);

			// check if event is emited
			assert.eventEqual(tx_create.logs[1], 'CreateSportsMarket', {
				_marketAddress: marketAdd,
				_id: gameid1,
				_game: game,
			});

			let answer = await SportPositionalMarketManager.getActiveMarketAddress('0');
			deployedMarket = await SportPositionalMarketContract.at(answer);

			assert.equal(false, await deployedMarket.canResolve());
			assert.equal(9004, await deployedMarket.tags(0));

			/*
			assert.equal('Atlanta Hawks vs Charlotte Hornets', await deployedMarket.getGameDetails());
			assert.equal(2, await deployedMarket.positionCount());
			*/
		});

		it('Fulfill Games Created - Champions League Game 1, create market, check results', async () => {
			await fastForward(gameFootballTime - (await currentTime()) - SECOND);

			// req. games
			const tx = await TherundownConsumerDeployed.fulfillGamesCreated(
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

			let game = await TherundownConsumerDeployed.gameCreated(gameFootballid1);
			assert.equal('Atletico Madrid Atletico Madrid', game.homeTeam);
			assert.equal('Manchester City Manchester City', game.awayTeam);

			// check if event is emited
			assert.eventEqual(tx.logs[0], 'GameCreated', {
				_requestId: reqIdFootballCreate,
				_sportId: sportId_16,
				_id: gameFootballid1,
				_game: game,
			});

			// create markets
			const tx_create = await TherundownConsumerDeployed.createMarketForGame(gameFootballid1);

			let marketAdd = await TherundownConsumerDeployed.marketPerGameId(gameFootballid1);

			// check if event is emited
			assert.eventEqual(tx_create.logs[1], 'CreateSportsMarket', {
				_marketAddress: marketAdd,
				_id: gameFootballid1,
				_game: game,
			});

			let answer = await SportPositionalMarketManager.getActiveMarketAddress('0');
			deployedMarket = await SportPositionalMarketContract.at(answer);

			assert.equal(false, await deployedMarket.canResolve());
			assert.equal(9016, await deployedMarket.tags(0));
		});

		it('Fulfill Games Created - Champions League Game 2, create market, check results', async () => {
			await fastForward(gameFootballTime - (await currentTime()) - SECOND);

			// req games
			const tx = await TherundownConsumerDeployed.fulfillGamesCreated(
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

			let game = await TherundownConsumerDeployed.gameCreated(gameFootballid2);
			assert.equal('Liverpool Liverpool', game.homeTeam);
			assert.equal('Benfica Benfica', game.awayTeam);

			// check if event is emited
			assert.eventEqual(tx.logs[1], 'GameCreated', {
				_requestId: reqIdFootballCreate,
				_sportId: sportId_16,
				_id: gameFootballid2,
				_game: game,
			});

			// clean first in queue
			await TherundownConsumerDeployed.createMarketForGame(gameFootballid1);

			// create markets
			const tx_create = await TherundownConsumerDeployed.createMarketForGame(gameFootballid2);

			let marketAdd = await TherundownConsumerDeployed.marketPerGameId(gameFootballid2);

			// check if event is emited
			assert.eventEqual(tx_create.logs[1], 'CreateSportsMarket', {
				_marketAddress: marketAdd,
				_id: gameFootballid2,
				_game: game,
			});

			let answer = await SportPositionalMarketManager.getActiveMarketAddress('1');
			deployedMarket = await SportPositionalMarketContract.at(answer);

			assert.equal(false, await deployedMarket.canResolve());
			assert.equal(9016, await deployedMarket.tags(0));
		});
	});

	describe('Fulfill Games Resolved', () => {
		it('Fulfill Games Resolved - NBA, resolve markets, check results', async () => {
			await fastForward(game1NBATime - (await currentTime()) - SECOND);

			// req. games
			const tx = await TherundownConsumerDeployed.fulfillGamesCreated(
				reqIdCreate,
				gamesCreated,
				sportId_4,
				game1NBATime,
				{ from: wrapper }
			);

			assert.equal(2, await gamesQueue.getLengthUnproccessedGames());
			assert.equal(0, await gamesQueue.unproccessedGamesIndex(gameid1));
			assert.equal(1, await gamesQueue.unproccessedGamesIndex(gameid2));
			assert.equal(sportId_4, await TherundownConsumerDeployed.sportsIdPerGame(gameid1));
			assert.equal(sportId_4, await TherundownConsumerDeployed.sportsIdPerGame(gameid2));
			assert.bnEqual(1649890800, await gamesQueue.gameStartPerGameId(gameid1));
			assert.bnEqual(1649890800, await gamesQueue.gameStartPerGameId(gameid2));

			assert.equal(true, await TherundownConsumerDeployed.isSportTwoPositionsSport(sportId_4));
			assert.equal(true, await TherundownConsumerDeployed.isSupportedSport(sportId_4));

			assert.equal(1, await gamesQueue.firstCreated());
			assert.equal(2, await gamesQueue.lastCreated());

			assert.equal(
				game_1_create,
				await TherundownConsumerDeployed.requestIdGamesCreated(reqIdCreate, 0)
			);
			assert.equal(
				game_2_create,
				await TherundownConsumerDeployed.requestIdGamesCreated(reqIdCreate, 1)
			);

			let game = await TherundownConsumerDeployed.gameCreated(gameid1);
			let gameTime = game.startTime;
			assert.equal('Atlanta Hawks', game.homeTeam);
			assert.equal('Charlotte Hornets', game.awayTeam);

			// check if event is emited
			assert.eventEqual(tx.logs[0], 'GameCreated', {
				_requestId: reqIdCreate,
				_sportId: sportId_4,
				_id: gameid1,
				_game: game,
			});

			// create markets
			const tx_create = await TherundownConsumerDeployed.createMarketForGame(gameid1);

			assert.equal(2, await gamesQueue.firstCreated());
			assert.equal(2, await gamesQueue.lastCreated());

			let marketAdd = await TherundownConsumerDeployed.marketPerGameId(gameid1);

			// check if event is emited
			assert.eventEqual(tx_create.logs[1], 'CreateSportsMarket', {
				_marketAddress: marketAdd,
				_id: gameid1,
				_game: game,
			});

			let answer = await SportPositionalMarketManager.getActiveMarketAddress('0');
			deployedMarket = await SportPositionalMarketContract.at(answer);

			assert.equal(false, await deployedMarket.canResolve());
			assert.equal(9004, await deployedMarket.tags(0));

			/*
			assert.equal('Atlanta Hawks vs Charlotte Hornets', await deployedMarket.marketQuestion());
			assert.equal(2, await deployedMarket.positionCount());
			*/

			await fastForward(await currentTime());

			assert.equal(true, await deployedMarket.canResolve());

			const tx_2 = await TherundownConsumerDeployed.fulfillGamesResolved(
				reqIdResolve,
				gamesResolved,
				sportId_4,
				{ from: wrapper }
			);

			assert.equal(
				game_1_resolve,
				await TherundownConsumerDeployed.requestIdGamesResolved(reqIdResolve, 0)
			);
			assert.equal(
				game_2_resolve,
				await TherundownConsumerDeployed.requestIdGamesResolved(reqIdResolve, 1)
			);

			let gameR = await TherundownConsumerDeployed.gameResolved(gameid1);
			assert.equal(100, gameR.homeScore);
			assert.equal(129, gameR.awayScore);
			assert.equal(8, gameR.statusId);

			assert.eventEqual(tx_2.logs[0], 'GameResolved', {
				_requestId: reqIdResolve,
				_sportId: sportId_4,
				_id: gameid1,
				_game: gameR,
			});

			// resolve markets
			const tx_resolve = await TherundownConsumerDeployed.resolveAllMarketsForGames([gameid1]);

			// check if event is emited
			assert.eventEqual(tx_resolve.logs[0], 'ResolveSportsMarket', {
				_marketAddress: marketAdd,
				_id: gameid1,
				_outcome: 2,
			});

			assert.equal(1, await gamesQueue.getLengthUnproccessedGames());
			assert.equal(0, await gamesQueue.unproccessedGamesIndex(gameid1));
			assert.equal(0, await gamesQueue.unproccessedGamesIndex(gameid2));
		});

		it('Fulfill Games Resolved - Champions League Game 1, resolve market, check results', async () => {
			await fastForward(gameFootballTime - (await currentTime()) - SECOND);

			// req. games
			const tx = await TherundownConsumerDeployed.fulfillGamesCreated(
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

			let game = await TherundownConsumerDeployed.gameCreated(gameFootballid1);
			assert.equal('Atletico Madrid Atletico Madrid', game.homeTeam);
			assert.equal('Manchester City Manchester City', game.awayTeam);

			let game_per_req = await TherundownConsumerDeployed.getGameCreatedByRequestId(
				reqIdFootballCreate,
				0
			);
			assert.equal('Atletico Madrid Atletico Madrid', game_per_req.homeTeam);
			assert.equal('Manchester City Manchester City', game_per_req.awayTeam);

			// check if event is emited
			assert.eventEqual(tx.logs[0], 'GameCreated', {
				_requestId: reqIdFootballCreate,
				_sportId: sportId_16,
				_id: gameFootballid1,
				_game: game,
			});

			// create markets
			const tx_create = await TherundownConsumerDeployed.createAllMarketsForGames([
				gameFootballid1,
			]);

			let marketAdd = await TherundownConsumerDeployed.marketPerGameId(gameFootballid1);

			// check if event is emited
			assert.eventEqual(tx_create.logs[1], 'CreateSportsMarket', {
				_marketAddress: marketAdd,
				_id: gameFootballid1,
				_game: game,
			});

			let answer = await SportPositionalMarketManager.getActiveMarketAddress('0');
			deployedMarket = await SportPositionalMarketContract.at(answer);

			assert.equal(false, await deployedMarket.canResolve());
			assert.equal(9016, await deployedMarket.tags(0));

			await fastForward(gameFootballTime - (await currentTime()) + 3 * HOUR);

			assert.equal(true, await deployedMarket.canResolve());

			const tx_2 = await TherundownConsumerDeployed.fulfillGamesResolved(
				reqIdResolveFoodball,
				gamesResolvedFootball,
				sportId_16,
				{ from: wrapper }
			);

			assert.equal(
				game_2_football_resolve,
				await TherundownConsumerDeployed.requestIdGamesResolved(reqIdResolveFoodball, 1)
			);

			let gameR = await TherundownConsumerDeployed.gameResolved(gameFootballid1);
			assert.bnEqual(0, gameR.homeScore);
			assert.bnEqual(1, gameR.awayScore);
			assert.bnEqual(11, gameR.statusId);

			assert.eventEqual(tx_2.logs[0], 'GameResolved', {
				_requestId: reqIdResolveFoodball,
				_sportId: sportId_16,
				_id: gameFootballid1,
				_game: gameR,
			});

			// resolve markets
			const tx_resolve = await TherundownConsumerDeployed.resolveMarketForGame(gameFootballid1);

			// check if event is emited
			assert.eventEqual(tx_resolve.logs[0], 'ResolveSportsMarket', {
				_marketAddress: marketAdd,
				_id: gameFootballid1,
				_outcome: 2,
			});
		});

		it('Fulfill Games Resolved - Champions League Game 2, resolve market, check results', async () => {
			await fastForward(gameFootballTime - (await currentTime()) - SECOND);

			// req games
			const tx = await TherundownConsumerDeployed.fulfillGamesCreated(
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

			let game = await TherundownConsumerDeployed.gameCreated(gameFootballid2);
			assert.equal('Liverpool Liverpool', game.homeTeam);
			assert.equal('Benfica Benfica', game.awayTeam);

			// check if event is emited
			assert.eventEqual(tx.logs[1], 'GameCreated', {
				_requestId: reqIdFootballCreate,
				_sportId: sportId_16,
				_id: gameFootballid2,
				_game: game,
			});

			await expect(
				TherundownConsumerDeployed.createMarketForGame(gameFootballid2, { from: owner })
			).to.be.revertedWith('Must be first in a queue');

			// clean first in queue
			await TherundownConsumerDeployed.createMarketForGame(gameFootballid1);

			// create markets
			const tx_create = await TherundownConsumerDeployed.createMarketForGame(gameFootballid2);

			let marketAdd = await TherundownConsumerDeployed.marketPerGameId(gameFootballid2);

			// check if event is emited
			assert.eventEqual(tx_create.logs[1], 'CreateSportsMarket', {
				_marketAddress: marketAdd,
				_id: gameFootballid2,
				_game: game,
			});

			let answer = await SportPositionalMarketManager.getActiveMarketAddress('1');
			deployedMarket = await SportPositionalMarketContract.at(answer);

			assert.equal(false, await deployedMarket.canResolve());
			assert.equal(9016, await deployedMarket.tags(0));

			await expect(
				TherundownConsumerDeployed.createMarketForGame(gameFootballid2, { from: owner })
			).to.be.revertedWith('Market for game already exists');

			await fastForward(gameFootballTime - (await currentTime()) + 3 * HOUR);

			assert.equal(true, await deployedMarket.canResolve());

			const tx_2 = await TherundownConsumerDeployed.fulfillGamesResolved(
				reqIdResolveFoodball,
				gamesResolvedFootball,
				sportId_16,
				{ from: wrapper }
			);

			assert.equal(
				game_1_football_resolve,
				await TherundownConsumerDeployed.requestIdGamesResolved(reqIdResolveFoodball, 0)
			);

			assert.equal(
				game_1_football_resolve,
				await TherundownConsumerDeployed.requestIdGamesResolved(reqIdResolveFoodball, 0)
			);
			assert.equal(
				game_2_football_resolve,
				await TherundownConsumerDeployed.requestIdGamesResolved(reqIdResolveFoodball, 1)
			);

			let gameR = await TherundownConsumerDeployed.gameResolved(gameFootballid2);
			assert.equal(0, gameR.homeScore);
			assert.equal(1, gameR.awayScore);
			assert.equal(11, gameR.statusId);

			assert.eventEqual(tx_2.logs[1], 'GameResolved', {
				_requestId: reqIdResolveFoodball,
				_sportId: sportId_16,
				_id: gameFootballid2,
				_game: gameR,
			});

			// resolve markets
			const tx_resolve = await TherundownConsumerDeployed.resolveMarketForGame(gameFootballid2);

			// check if event is emited
			assert.eventEqual(tx_resolve.logs[0], 'ResolveSportsMarket', {
				_marketAddress: marketAdd,
				_id: gameFootballid2,
				_outcome: 2,
			});

			await expect(
				TherundownConsumerDeployed.resolveMarketForGame(gameFootballid2, { from: owner })
			).to.be.revertedWith('Market resoved or canceled');

			assert.equal(1, await gamesQueue.getLengthUnproccessedGames());
			assert.equal(0, await gamesQueue.unproccessedGamesIndex(gameid1));
			assert.equal(0, await gamesQueue.unproccessedGamesIndex(gameid2));
		});
	});

	describe('Game resolve/clancel Manually', () => {
		it('Resolve game 1 Manually, check results', async () => {
			await fastForward(gameFootballTime - (await currentTime()) - SECOND);

			// req. games
			const tx = await TherundownConsumerDeployed.fulfillGamesCreated(
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

			let game = await TherundownConsumerDeployed.gameCreated(gameFootballid1);
			assert.equal('Atletico Madrid Atletico Madrid', game.homeTeam);
			assert.equal('Manchester City Manchester City', game.awayTeam);

			// check if event is emited
			assert.eventEqual(tx.logs[0], 'GameCreated', {
				_requestId: reqIdFootballCreate,
				_sportId: sportId_16,
				_id: gameFootballid1,
				_game: game,
			});

			// create markets
			const tx_create = await TherundownConsumerDeployed.createMarketForGame(gameFootballid1);

			let marketAdd = await TherundownConsumerDeployed.marketPerGameId(gameFootballid1);

			// check if event is emited
			assert.eventEqual(tx_create.logs[1], 'CreateSportsMarket', {
				_marketAddress: marketAdd,
				_id: gameFootballid1,
				_game: game,
			});

			let answer = await SportPositionalMarketManager.getActiveMarketAddress('0');
			deployedMarket = await SportPositionalMarketContract.at(answer);

			assert.equal(false, await deployedMarket.canResolve());
			assert.equal(9016, await deployedMarket.tags(0));

			await fastForward(gameFootballTime - (await currentTime()) + 3 * HOUR);

			await expect(
				TherundownConsumerDeployed.resolveGameManually(gameFootballid1, 2, 1, 1, { from: second })
			).to.be.revertedWith('Address not supported');
			await expect(
				TherundownConsumerDeployed.resolveGameManually(gameFootballid1, 4, 1, 1, { from: third })
			).to.be.revertedWith('Bad result or outcome');
			await expect(
				TherundownConsumerDeployed.resolveMarketManually(marketAdd, 2, 1, 1, { from: second })
			).to.be.revertedWith('Address not supported');
			await expect(
				TherundownConsumerDeployed.resolveMarketManually(marketAdd, 4, 1, 1, { from: third })
			).to.be.revertedWith('Bad result or outcome');
			await expect(
				TherundownConsumerDeployed.resolveMarketManually(marketAdd, 2, 2, 1, { from: third })
			).to.be.revertedWith('Bad result or outcome');
			await expect(
				TherundownConsumerDeployed.resolveMarketManually(marketAdd, 2, 1, 1, { from: third })
			).to.be.revertedWith('Bad result or outcome');
			await expect(
				TherundownConsumerDeployed.resolveMarketManually(marketAdd, 1, 1, 1, { from: third })
			).to.be.revertedWith('Bad result or outcome');
			await expect(
				TherundownConsumerDeployed.resolveMarketManually(marketAdd, 1, 1, 2, { from: third })
			).to.be.revertedWith('Bad result or outcome');
			await expect(
				TherundownConsumerDeployed.resolveMarketManually(marketAdd, 0, 1, 1, { from: third })
			).to.be.revertedWith('Bad result or outcome');
			await expect(
				TherundownConsumerDeployed.resolveMarketManually(marketAdd, 3, 2, 1, { from: third })
			).to.be.revertedWith('Bad result or outcome');
			await expect(
				TherundownConsumerDeployed.resolveMarketManually(marketAdd, 3, 1, 2, { from: third })
			).to.be.revertedWith('Bad result or outcome');

			const tx_2 = await TherundownConsumerDeployed.resolveGameManually(gameFootballid1, 2, 1, 2, {
				from: third,
			});

			// check if event is emited
			assert.eventEqual(tx_2.logs[1], 'ResolveSportsMarket', {
				_marketAddress: marketAdd,
				_id: gameFootballid1,
				_outcome: 2,
			});

			await expect(
				TherundownConsumerDeployed.resolveGameManually(gameFootballid1, 2, 1, 2, { from: third })
			).to.be.revertedWith('Market resoved or canceled');

			assert.equal(1, await gamesQueue.getLengthUnproccessedGames());
			assert.equal(0, await gamesQueue.unproccessedGamesIndex(gameid1));
			assert.equal(0, await gamesQueue.unproccessedGamesIndex(gameid2));
		});

		it('Resolve market address manually, check results', async () => {
			await fastForward(gameFootballTime - (await currentTime()) - SECOND);

			// req games
			const tx = await TherundownConsumerDeployed.fulfillGamesCreated(
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

			let game = await TherundownConsumerDeployed.gameCreated(gameFootballid2);
			assert.equal('Liverpool Liverpool', game.homeTeam);
			assert.equal('Benfica Benfica', game.awayTeam);

			// check if event is emited
			assert.eventEqual(tx.logs[1], 'GameCreated', {
				_requestId: reqIdFootballCreate,
				_sportId: sportId_16,
				_id: gameFootballid2,
				_game: game,
			});

			await expect(
				TherundownConsumerDeployed.createMarketForGame(gameFootballid2, { from: owner })
			).to.be.revertedWith('Must be first in a queue');

			// clean first in queue
			await TherundownConsumerDeployed.createMarketForGame(gameFootballid1);

			// create markets
			const tx_create = await TherundownConsumerDeployed.createMarketForGame(gameFootballid2);

			let marketAdd = await TherundownConsumerDeployed.marketPerGameId(gameFootballid2);

			// check if event is emited
			assert.eventEqual(tx_create.logs[1], 'CreateSportsMarket', {
				_marketAddress: marketAdd,
				_id: gameFootballid2,
				_game: game,
			});

			let answer = await SportPositionalMarketManager.getActiveMarketAddress('1');
			deployedMarket = await SportPositionalMarketContract.at(answer);

			assert.equal(false, await deployedMarket.canResolve());
			assert.equal(9016, await deployedMarket.tags(0));

			await fastForward(gameFootballTime - (await currentTime()) + 3 * HOUR);

			await expect(
				TherundownConsumerDeployed.resolveMarketManually(marketAdd, 2, 1, 2, { from: second })
			).to.be.revertedWith('Address not supported');
			await expect(
				TherundownConsumerDeployed.resolveMarketManually(marketAdd, 4, 0, 0, { from: third })
			).to.be.revertedWith('Bad result or outcome');

			const tx_2 = await TherundownConsumerDeployed.resolveMarketManually(marketAdd, 1, 2, 1, {
				from: third,
			});

			// check if event is emited
			assert.eventEqual(tx_2.logs[0], 'GameResolved', {
				_requestId: gameFootballid2,
				_sportId: 16,
				_id: gameFootballid2,
				_queueIndex: 0,
			});

			// check if event is emited
			assert.eventEqual(tx_2.logs[1], 'ResolveSportsMarket', {
				_marketAddress: marketAdd,
				_id: gameFootballid2,
				_outcome: 1,
			});

			await expect(
				TherundownConsumerDeployed.resolveGameManually(gameFootballid2, 2, 1, 2, { from: third })
			).to.be.revertedWith('Market resoved or canceled');
			await expect(
				TherundownConsumerDeployed.resolveMarketManually(marketAdd, 2, 1, 2, { from: third })
			).to.be.revertedWith('Market resoved or canceled');

			assert.equal(1, await gamesQueue.getLengthUnproccessedGames());
			assert.equal(0, await gamesQueue.unproccessedGamesIndex(gameid1));
			assert.equal(0, await gamesQueue.unproccessedGamesIndex(gameid2));
		});

		it('Cancel market Manually, check results', async () => {
			await fastForward(game1NBATime - (await currentTime()) - SECOND);

			// req. games
			const tx = await TherundownConsumerDeployed.fulfillGamesCreated(
				reqIdCreate,
				gamesCreated,
				sportId_4,
				game1NBATime,
				{ from: wrapper }
			);

			assert.equal(2, await gamesQueue.getLengthUnproccessedGames());
			assert.equal(0, await gamesQueue.unproccessedGamesIndex(gameid1));
			assert.equal(1, await gamesQueue.unproccessedGamesIndex(gameid2));
			assert.equal(sportId_4, await TherundownConsumerDeployed.sportsIdPerGame(gameid1));
			assert.equal(sportId_4, await TherundownConsumerDeployed.sportsIdPerGame(gameid2));
			assert.bnEqual(1649890800, await gamesQueue.gameStartPerGameId(gameid1));
			assert.bnEqual(1649890800, await gamesQueue.gameStartPerGameId(gameid2));

			assert.equal(true, await TherundownConsumerDeployed.isSportTwoPositionsSport(sportId_4));
			assert.equal(true, await TherundownConsumerDeployed.isSupportedSport(sportId_4));

			assert.equal(1, await gamesQueue.firstCreated());
			assert.equal(2, await gamesQueue.lastCreated());

			assert.equal(
				game_1_create,
				await TherundownConsumerDeployed.requestIdGamesCreated(reqIdCreate, 0)
			);
			assert.equal(
				game_2_create,
				await TherundownConsumerDeployed.requestIdGamesCreated(reqIdCreate, 1)
			);

			let game = await TherundownConsumerDeployed.gameCreated(gameid1);
			let gameTime = game.startTime;
			assert.equal('Atlanta Hawks', game.homeTeam);
			assert.equal('Charlotte Hornets', game.awayTeam);

			// check if event is emited
			assert.eventEqual(tx.logs[0], 'GameCreated', {
				_requestId: reqIdCreate,
				_sportId: sportId_4,
				_id: gameid1,
				_game: game,
			});

			// create markets
			const tx_create = await TherundownConsumerDeployed.createMarketForGame(gameid1);

			assert.equal(2, await gamesQueue.firstCreated());
			assert.equal(2, await gamesQueue.lastCreated());

			let marketAdd = await TherundownConsumerDeployed.marketPerGameId(gameid1);

			// check if event is emited
			assert.eventEqual(tx_create.logs[1], 'CreateSportsMarket', {
				_marketAddress: marketAdd,
				_id: gameid1,
				_game: game,
			});

			let answer = await SportPositionalMarketManager.getActiveMarketAddress('0');
			deployedMarket = await SportPositionalMarketContract.at(answer);

			assert.equal(false, await deployedMarket.canResolve());
			assert.equal(9004, await deployedMarket.tags(0));

			/*
			assert.equal('Atlanta Hawks vs Charlotte Hornets', await deployedMarket.marketQuestion());
			assert.equal(2, await deployedMarket.positionCount());
			*/

			await fastForward(await currentTime());

			await expect(
				TherundownConsumerDeployed.cancelMarketManually(marketAdd, { from: second })
			).to.be.revertedWith('Address not supported');
			await expect(
				TherundownConsumerDeployed.cancelMarketManually(second, { from: third })
			).to.be.revertedWith('No market created for game');
			await expect(
				TherundownConsumerDeployed.resolveMarketManually(marketAdd, 3, 0, 0, { from: third })
			).to.be.revertedWith('Bad result or outcome');

			const tx_2 = await TherundownConsumerDeployed.cancelMarketManually(marketAdd, {
				from: third,
			});

			// check if event is emited
			assert.eventEqual(tx_2.logs[0], 'CancelSportsMarket', {
				_marketAddress: marketAdd,
				_id: gameid1,
			});

			await expect(
				TherundownConsumerDeployed.resolveGameManually(gameid1, 2, 1, 2, { from: third })
			).to.be.revertedWith('Market resoved or canceled');
			await expect(
				TherundownConsumerDeployed.resolveMarketManually(marketAdd, 2, 1, 2, { from: third })
			).to.be.revertedWith('Market resoved or canceled');
			await expect(
				TherundownConsumerDeployed.cancelMarketManually(marketAdd, { from: third })
			).to.be.revertedWith('Market resoved or canceled');

			assert.equal(1, await gamesQueue.getLengthUnproccessedGames());
			assert.equal(0, await gamesQueue.unproccessedGamesIndex(gameid1));
			assert.equal(0, await gamesQueue.unproccessedGamesIndex(gameid2));
		});

		it('Pause-unpause market manually, check results', async () => {
			await fastForward(game1NBATime - (await currentTime()) - SECOND);

			await expect(
				TherundownConsumerDeployed.pauseOrUnpauseMarketManually(dummyAddress, true, { from: third })
			).to.be.revertedWith('Game not existing');

			// req. games
			const tx = await TherundownConsumerDeployed.fulfillGamesCreated(
				reqIdCreate,
				gamesCreated,
				sportId_4,
				game1NBATime,
				{ from: wrapper }
			);

			let marketAdd_wrong = await TherundownConsumerDeployed.marketPerGameId(gameid1);

			await expect(
				TherundownConsumerDeployed.pauseOrUnpauseMarketManually(marketAdd_wrong, true, {
					from: third,
				})
			).to.be.revertedWith('No market address');

			// create markets
			const tx_create = await TherundownConsumerDeployed.createMarketForGame(gameid1);

			let marketAdd = await TherundownConsumerDeployed.marketPerGameId(gameid1);

			await expect(
				TherundownConsumerDeployed.pauseOrUnpauseMarketManually(marketAdd, false, { from: third })
			).to.be.revertedWith('Already paused/unpaused');

			const tx_pause = await TherundownConsumerDeployed.pauseOrUnpauseMarketManually(
				marketAdd,
				true,
				{
					from: third,
				}
			);

			// check if event is emited
			assert.eventEqual(tx_pause.logs[0], 'PauseSportsMarket', {
				_marketAddress: marketAdd,
				_pause: true,
			});

			await expect(
				TherundownConsumerDeployed.pauseOrUnpauseMarketManually(marketAdd, true, { from: third })
			).to.be.revertedWith('Already paused/unpaused');

			const tx_unpause = await TherundownConsumerDeployed.pauseOrUnpauseMarketManually(
				marketAdd,
				false,
				{ from: third }
			);

			// check if event is emited
			assert.eventEqual(tx_unpause.logs[0], 'PauseSportsMarket', {
				_marketAddress: marketAdd,
				_pause: false,
			});

			await fastForward(await currentTime());

			const tx_2 = await TherundownConsumerDeployed.cancelMarketManually(marketAdd, {
				from: third,
			});

			await expect(
				TherundownConsumerDeployed.pauseOrUnpauseMarketManually(marketAdd, true, { from: third })
			).to.be.revertedWith('Market resoved or canceled');
		});
	});

	describe('Odds for game', () => {
		it('Get odds per game, check results, geme not created, no odds created', async () => {
			// req. games
			const tx = await TherundownConsumerDeployed.fulfillGamesOdds(
				reqIdOdds,
				oddsResultArray,
				game1NBATime,
				{
					from: wrapper,
				}
			);

			// game not created so zero odds
			let result = await TherundownConsumerDeployed.getOddsForGame(oddsid);
			assert.bnEqual(0, result[0]);
			assert.bnEqual(0, result[0]);
			assert.bnEqual(0, result[0]);
		});

		it('Get odds per game, check results, invalid odds', async () => {
			await fastForward(gameFootballTime - (await currentTime()) - SECOND);

			// req. games
			const tx = await TherundownConsumerDeployed.fulfillGamesCreated(
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

			let game = await TherundownConsumerDeployed.gameCreated(gameFootballid1);
			assert.equal('Atletico Madrid Atletico Madrid', game.homeTeam);
			assert.equal('Manchester City Manchester City', game.awayTeam);

			// check if event is emited
			assert.eventEqual(tx.logs[0], 'GameCreated', {
				_requestId: reqIdFootballCreate,
				_sportId: sportId_16,
				_id: gameFootballid1,
				_game: game,
			});

			// create markets
			const tx_create = await TherundownConsumerDeployed.createMarketForGame(gameFootballid1);

			let marketAdd = await TherundownConsumerDeployed.marketPerGameId(gameFootballid1);

			// check if event is emited
			assert.eventEqual(tx_create.logs[1], 'CreateSportsMarket', {
				_marketAddress: marketAdd,
				_id: gameFootballid1,
				_game: game,
			});

			let answer = await SportPositionalMarketManager.getActiveMarketAddress('0');
			deployedMarket = await SportPositionalMarketContract.at(answer);

			assert.equal(false, await deployedMarket.canResolve());
			assert.equal(9016, await deployedMarket.tags(0));

			// invalid odds zero as draw
			const tx_odds = await TherundownConsumerDeployed.fulfillGamesOdds(
				reqIdOdds_1,
				oddsResultArray_1,
				game1NBATime,
				{
					from: wrapper,
				}
			);

			let result_final = await TherundownConsumerDeployed.getOddsForGame(gameFootballid1);
			assert.bnEqual(40000, result_final[0]);
			assert.bnEqual(-12500, result_final[1]);
			assert.bnEqual(27200, result_final[2]);
		});

		it('Get odds per game, check results, valid odds', async () => {
			await fastForward(game1NBATime - (await currentTime()) - SECOND);

			assert.bnEqual(false, await TherundownConsumerDeployed.isSportOnADate(game1NBATime, 4));
			assert.bnEqual(false, await TherundownConsumerDeployed.isSportOnADate(game1NBATime, 4));

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
			assert.equal(sportId_4, await TherundownConsumerDeployed.sportsIdPerGame(gameid1));
			assert.equal(sportId_4, await TherundownConsumerDeployed.sportsIdPerGame(gameid2));
			assert.bnEqual(1649890800, await gamesQueue.gameStartPerGameId(gameid1));
			assert.bnEqual(1649890800, await gamesQueue.gameStartPerGameId(gameid2));
			assert.bnEqual(true, await TherundownConsumerDeployed.isSportOnADate(game1NBATime, 4));
			assert.bnEqual(true, await TherundownConsumerDeployed.isSportOnADate(game1NBATime, 4));

			assert.bnEqual(gameid1, await TherundownConsumerDeployed.gamesPerDate(game1NBATime, 0));
			let getGamesPerdate = await TherundownConsumerDeployed.getGamesPerdate(game1NBATime);
			assert.bnEqual(2, getGamesPerdate.length);

			assert.equal(true, await TherundownConsumerDeployed.isSportTwoPositionsSport(sportId_4));
			assert.equal(true, await TherundownConsumerDeployed.isSupportedSport(sportId_4));

			let result = await TherundownConsumerDeployed.getOddsForGame(gameid1);
			assert.bnEqual(-20700, result[0]);
			assert.notEqual(
				0,
				await TherundownConsumerDeployed.calculateNormalizedOddFromAmerican(-20700)
			);
			assert.notEqual(
				0,
				await TherundownConsumerDeployed.calculateNormalizedOddFromAmerican(17700)
			);
			assert.bnEqual(0, await TherundownConsumerDeployed.calculateNormalizedOddFromAmerican(0));

			assert.equal(
				game_1_create,
				await TherundownConsumerDeployed.requestIdGamesCreated(reqIdCreate, 0)
			);
			assert.equal(
				game_2_create,
				await TherundownConsumerDeployed.requestIdGamesCreated(reqIdCreate, 1)
			);

			let game = await TherundownConsumerDeployed.gameCreated(gameid1);
			let gameTime = game.startTime;
			assert.equal('Atlanta Hawks', game.homeTeam);
			assert.equal('Charlotte Hornets', game.awayTeam);

			let game_per_req = await TherundownConsumerDeployed.getGameCreatedByRequestId(reqIdCreate, 0);
			assert.equal('Atlanta Hawks', game_per_req.homeTeam);
			assert.equal('Charlotte Hornets', game_per_req.awayTeam);

			// check if event is emited
			assert.eventEqual(tx.logs[0], 'GameCreated', {
				_requestId: reqIdCreate,
				_sportId: sportId_4,
				_id: gameid1,
				_game: game,
			});

			// create markets
			const tx_create = await TherundownConsumerDeployed.createMarketForGame(gameid1);

			let marketAdd = await TherundownConsumerDeployed.marketPerGameId(gameid1);

			// check if event is emited
			assert.eventEqual(tx_create.logs[1], 'CreateSportsMarket', {
				_marketAddress: marketAdd,
				_id: gameid1,
				_game: game,
			});

			let answer = await SportPositionalMarketManager.getActiveMarketAddress('0');
			deployedMarket = await SportPositionalMarketContract.at(answer);

			assert.equal(false, await deployedMarket.canResolve());
			assert.equal(9004, await deployedMarket.tags(0));

			// invalid odds zero as draw
			const tx_odds = await TherundownConsumerDeployed.fulfillGamesOdds(
				reqIdOdds_2,
				oddsResultArray_2,
				game1NBATime,
				{
					from: wrapper,
				}
			);

			let result_final = await TherundownConsumerDeployed.getOddsForGame(gameid1);
			assert.bnEqual(10300, result_final[0]);
			assert.bnEqual(-11300, result_final[1]);
			assert.bnEqual(0, result_final[2]);
		});
	});

	describe('Consumer management', () => {
		it('Test owner functions', async () => {
			const tx_SupportedSport = await TherundownConsumerDeployed.setSupportedSport(15, true, {
				from: owner,
			});

			await expect(
				TherundownConsumerDeployed.setSupportedSport(15, false, { from: wrapper })
			).to.be.revertedWith('Only the contract owner may perform this action');

			// check if event is emited
			assert.eventEqual(tx_SupportedSport.logs[0], 'SupportedSportsChanged', {
				_sportId: 15,
				_isSupported: true,
			});

			const tx_SupportedResolvedStatuses = await TherundownConsumerDeployed.setSupportedResolvedStatuses(
				15,
				true,
				{
					from: owner,
				}
			);

			await expect(
				TherundownConsumerDeployed.setSupportedResolvedStatuses(15, false, { from: wrapper })
			).to.be.revertedWith('Only the contract owner may perform this action');

			await expect(
				TherundownConsumerDeployed.setSupportedResolvedStatuses(15, true, { from: owner })
			).to.be.revertedWith('Already set');

			// check if event is emited
			assert.eventEqual(tx_SupportedResolvedStatuses.logs[0], 'SupportedResolvedStatusChanged', {
				_status: 15,
				_isSupported: true,
			});

			const tx_SupportedCancelStatuses = await TherundownConsumerDeployed.setSupportedCancelStatuses(
				15,
				true,
				{
					from: owner,
				}
			);

			await expect(
				TherundownConsumerDeployed.setSupportedCancelStatuses(15, false, { from: wrapper })
			).to.be.revertedWith('Only the contract owner may perform this action');

			await expect(
				TherundownConsumerDeployed.setSupportedCancelStatuses(15, true, { from: owner })
			).to.be.revertedWith('Already set');

			// check if event is emited
			assert.eventEqual(tx_SupportedCancelStatuses.logs[0], 'SupportedCancelStatusChanged', {
				_status: 15,
				_isSupported: true,
			});

			const tx_twoPositionSport = await TherundownConsumerDeployed.setTwoPositionSport(15, true, {
				from: owner,
			});

			await expect(
				TherundownConsumerDeployed.setTwoPositionSport(15, false, { from: wrapper })
			).to.be.revertedWith('Only the contract owner may perform this action');

			await expect(
				TherundownConsumerDeployed.setTwoPositionSport(15, true, { from: owner })
			).to.be.revertedWith('Invalid input');

			// check if event is emited
			assert.eventEqual(tx_twoPositionSport.logs[0], 'TwoPositionSportChanged', {
				_sportId: 15,
				_isTwoPosition: true,
			});

			const tx_SportsManager = await TherundownConsumerDeployed.setSportContracts(
				wrapper,
				wrapper,
				wrapper,
				{
					from: owner,
				}
			);

			await expect(
				TherundownConsumerDeployed.setSportContracts(wrapper, wrapper, wrapper, { from: wrapper })
			).to.be.revertedWith('Only the contract owner may perform this action');

			await expect(
				TherundownConsumerDeployed.setSportContracts(ZERO_ADDRESS, ZERO_ADDRESS, ZERO_ADDRESS, {
					from: owner,
				})
			).to.be.revertedWith('Invalid addreses');

			// check if event is emited
			assert.eventEqual(tx_SportsManager.logs[0], 'NewSportContracts', {
				_wrapperAddress: wrapper,
				_queues: wrapper,
				_sportsManager: wrapper,
			});
		});
	});
	describe('Game management', () => {
		it('Test created queue', async () => {
			await fastForward(game1NBATime - (await currentTime()) - SECOND);

			assert.bnEqual(false, await TherundownConsumerDeployed.isSportOnADate(game1NBATime, 4));
			assert.bnEqual(false, await TherundownConsumerDeployed.isSportOnADate(game1NBATime, 4));

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
			assert.equal(1, await gamesQueue.firstCreated());
			assert.equal(2, await gamesQueue.lastCreated());

			assert.equal(2, await gamesQueue.getLengthUnproccessedGames());
			assert.equal(0, await gamesQueue.unproccessedGamesIndex(gameid1));
			assert.equal(1, await gamesQueue.unproccessedGamesIndex(gameid2));

			const tx_remove = await TherundownConsumerDeployed.removeFromCreatedQueue({ from: third });

			assert.equal(2, await gamesQueue.firstCreated());
			assert.equal(2, await gamesQueue.lastCreated());

			const tx_remove_2 = await TherundownConsumerDeployed.removeFromCreatedQueue({ from: third });

			assert.equal(3, await gamesQueue.firstCreated());
			assert.equal(2, await gamesQueue.lastCreated());
		});

		it('Unprocessed games', async () => {
			await fastForward(game1NBATime - (await currentTime()) - SECOND);

			assert.bnEqual(false, await TherundownConsumerDeployed.isSportOnADate(game1NBATime, 4));
			assert.bnEqual(false, await TherundownConsumerDeployed.isSportOnADate(game1NBATime, 4));

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

			const tx_remove = await TherundownConsumerDeployed.removeFromUnprocessedGamesArray(0, {
				from: third,
			});

			// changed from 1 -> 0
			assert.equal(0, await gamesQueue.unproccessedGamesIndex(gameid2));
			assert.equal(1, await gamesQueue.getLengthUnproccessedGames());
		});

		it('Test resolved queue', async () => {
			await fastForward(gameFootballTime - (await currentTime()) - SECOND);

			// req games
			const tx = await TherundownConsumerDeployed.fulfillGamesCreated(
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

			let game = await TherundownConsumerDeployed.gameCreated(gameFootballid2);
			assert.equal('Liverpool Liverpool', game.homeTeam);
			assert.equal('Benfica Benfica', game.awayTeam);

			// check if event is emited
			assert.eventEqual(tx.logs[1], 'GameCreated', {
				_requestId: reqIdFootballCreate,
				_sportId: sportId_16,
				_id: gameFootballid2,
				_game: game,
			});

			await expect(
				TherundownConsumerDeployed.createMarketForGame(gameFootballid2, { from: owner })
			).to.be.revertedWith('Must be first in a queue');

			// clean first in queue
			await TherundownConsumerDeployed.createMarketForGame(gameFootballid1);

			// create markets
			const tx_create = await TherundownConsumerDeployed.createMarketForGame(gameFootballid2);

			let marketAdd = await TherundownConsumerDeployed.marketPerGameId(gameFootballid2);

			// check if event is emited
			assert.eventEqual(tx_create.logs[1], 'CreateSportsMarket', {
				_marketAddress: marketAdd,
				_id: gameFootballid2,
				_game: game,
			});

			let answer = await SportPositionalMarketManager.getActiveMarketAddress('1');
			deployedMarket = await SportPositionalMarketContract.at(answer);

			assert.equal(false, await deployedMarket.canResolve());
			assert.equal(9016, await deployedMarket.tags(0));

			await expect(
				TherundownConsumerDeployed.createMarketForGame(gameFootballid2, { from: owner })
			).to.be.revertedWith('Market for game already exists');

			await fastForward(gameFootballTime - (await currentTime()) + 3 * HOUR);

			assert.equal(true, await deployedMarket.canResolve());

			const tx_2 = await TherundownConsumerDeployed.fulfillGamesResolved(
				reqIdResolveFoodball,
				gamesResolvedFootball,
				sportId_16,
				{ from: wrapper }
			);

			assert.equal(gameFootballid1, await gamesQueue.gamesResolvedQueue(1));
			assert.equal(gameFootballid2, await gamesQueue.gamesResolvedQueue(2));
			assert.equal(1, await gamesQueue.firstResolved());
			assert.equal(2, await gamesQueue.lastResolved());

			const tx_remove = await TherundownConsumerDeployed.removeFromResolvedQueue({ from: third });

			assert.equal(2, await gamesQueue.firstResolved());
			assert.equal(2, await gamesQueue.lastResolved());

			const tx_remove_2 = await TherundownConsumerDeployed.removeFromResolvedQueue({ from: third });

			assert.equal(3, await gamesQueue.firstResolved());
			assert.equal(2, await gamesQueue.lastResolved());
		});
	});
});
