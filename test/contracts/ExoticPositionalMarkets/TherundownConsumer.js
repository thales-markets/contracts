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

contract('TherundownConsumer', accounts => {
	const [manager, first, owner, second, third, fourth, safeBox, wrapper] = accounts;

	const ZERO_ADDRESS = '0x' + '0'.repeat(40);
	const MAX_NUMBER =
		'115792089237316195423570985008687907853269984665640564039457584007913129639935';

	const ExoticPositionalMarketContract = artifacts.require('ExoticPositionalMarket');
	const ExoticPositionalMarketManagerContract = artifacts.require('ExoticPositionalMarketManager');
	const ThalesOracleCouncilContract = artifacts.require('ThalesOracleCouncil');
	const ThalesContract = artifacts.require('contracts/Token/OpThales_L1.sol:OpThales');
	const ThalesBondsContract = artifacts.require('ThalesBonds');
	const ExoticPositionalTagsContract = artifacts.require('ExoticPositionalTags');
	let ExoticPositionalMarket;
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
	let game_1_create;
	let game_1_resolve;
	let gameid1;
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

	const game1NBATime = 1646958600;
	const gameFootballTime = 1647374400;

	const sportId_4 = 4; // NBA
	const sportId_16 = 16; // CHL

	beforeEach(async () => {
		ExoticPositionalMarket = await ExoticPositionalMarketContract.new();
		ExoticPositionalMarketManager = await ExoticPositionalMarketManagerContract.new();
		ThalesOracleCouncil = await ThalesOracleCouncilContract.new({ from: owner });
		Thales = await ThalesContract.new({ from: owner });
		ThalesBonds = await ThalesBondsContract.new();
		ExoticPositionalTags = await ExoticPositionalTagsContract.new();
		await ExoticPositionalTags.initialize(manager, { from: manager });
		await ThalesBonds.initialize(manager, { from: manager });

		await ExoticPositionalMarketManager.initialize(
			manager,
			minimumPositioningDuration,
			Thales.address,
			{ from: manager }
		);

		fixedBondAmount = toUnit(100);

		await ExoticPositionalMarketManager.setExoticMarketMastercopy(ExoticPositionalMarket.address);
		await ExoticPositionalMarketManager.setOracleCouncilAddress(ThalesOracleCouncil.address);
		await ExoticPositionalMarketManager.setThalesBonds(ThalesBonds.address);
		await ExoticPositionalMarketManager.setTagsAddress(ExoticPositionalTags.address);
		await ThalesBonds.setMarketManager(ExoticPositionalMarketManager.address, { from: manager });
		await ExoticPositionalMarketManager.setFixedBondAmount(fixedBondAmount, { from: manager });
		await ExoticPositionalMarketManager.setSafeBoxAddress(safeBox, { from: manager });
		await ExoticPositionalMarketManager.setMaximumPositionsAllowed('5', { from: manager });
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
			'0x0000000000000000000000000000000000000000000000000000000000000020653630636661373830383436616636383937386234393537396535636633393600000000000000000000000000000000000000000000000000000000622a9808000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000125068696c6164656c706869612037366572730000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000d42726f6f6b6c796e204e65747300000000000000000000000000000000000000';
		game_2_create =
			'0x0000000000000000000000000000000000000000000000000000000000000020393734653366303638623333376431323965643563313364663237613332666200000000000000000000000000000000000000000000000000000000622abb30000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000000000000000000000000000000000000000000e44656e766572204e7567676574730000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000015476f6c64656e2053746174652057617272696f72730000000000000000000000';
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
			'0x00000000000000000000000000000000000000000000000000000000000000203163626162623163303138373465363263313661316462333164363164353333000000000000000000000000000000000000000000000000000000006230f040000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000000000000000000000000000000000000000001d416a617820416d7374657264616d20416a617820416d7374657264616d000000000000000000000000000000000000000000000000000000000000000000000f42656e666963612042656e666963610000000000000000000000000000000000';
		game_2_football_create =
			'0x00000000000000000000000000000000000000000000000000000000000000203662646437313731316337393837643336643465333538643937393237356234000000000000000000000000000000000000000000000000000000006230f040000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000234d616e6368657374657220556e69746564204d616e6368657374657220556e697465640000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001f41746c657469636f204d61647269642041746c657469636f204d616472696400';
		gamesFootballCreated = [game_1_football_create, game_2_football_create];
		game_1_football_resolve =
			'0x316362616262316330313837346536326331366131646233316436316435333300000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000b';
		game_2_football_resolve =
			'0x366264643731373131633739383764333664346533353864393739323735623400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000b';
		reqIdResolveFoodball = '0xff8887a8535b7a8030962e6f6b1eba61c0f1cb82f706e77d834f15c781e47697';
		gamesResolvedFootball = [game_1_football_resolve, game_2_football_resolve];

		TherundownConsumer = artifacts.require('TherundownConsumer');
		TherundownConsumerDeployed = await TherundownConsumer.new();

		await TherundownConsumerDeployed.initialize(
			owner,
			[sportId_4, sportId_16],
			ExoticPositionalMarketManager.address,
			[sportId_4],
			toUnit(10),
			true,
			{ from: owner }
		);
		await Thales.transfer(TherundownConsumerDeployed.address, toUnit('1000'), { from: owner });
		await ExoticPositionalMarketManager.setTheRundownConsumerAddress(
			TherundownConsumerDeployed.address
		);
		await TherundownConsumerDeployed.setWrapperAddress(wrapper, { from: owner });
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

			assert.equal(true, await TherundownConsumerDeployed.isSupportedMarket('create'));
			assert.equal(true, await TherundownConsumerDeployed.isSupportedMarket('resolve'));
			assert.equal(false, await TherundownConsumerDeployed.isSupportedMarket('aaa'));
		});
	});

	describe('Fulfill Games Created', () => {
		it('Fulfill Games Created - NBA, create market, check results', async () => {
			await fastForward(game1NBATime - (await currentTime()) - SECOND);

			// req. games
			const tx = await TherundownConsumerDeployed.fulfillGamesCreated(
				reqIdCreate,
				gamesCreated,
				sportId_4,
				{ from: wrapper }
			);

			assert.equal(gameid1, await TherundownConsumerDeployed.requestIdGameIds(reqIdCreate, 0));
			assert.equal(gameid2, await TherundownConsumerDeployed.requestIdGameIds(reqIdCreate, 1));

			assert.equal(true, await TherundownConsumerDeployed.isSportTwoPositionsSport(sportId_4));
			assert.equal(true, await TherundownConsumerDeployed.isSupportedSport(sportId_4));

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
			assert.equal('Philadelphia 76ers', game.homeTeam);
			assert.equal('Brooklyn Nets', game.awayTeam);

			// check if event is emited
			assert.eventEqual(tx.logs[0], 'GameCreted', {
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

			let answer = await ExoticPositionalMarketManager.getActiveMarketAddress('0');
			deployedMarket = await ExoticPositionalMarketContract.at(answer);

			assert.equal('Philadelphia 76ers vs Brooklyn Nets', await deployedMarket.marketQuestion());
			assert.equal(2, await deployedMarket.positionCount());

			assert.bnEqual(gameTime, await deployedMarket.endOfPositioning());
			assert.notEqual(0, await deployedMarket.creationTime());
			assert.equal(false, await deployedMarket.disputed());
			assert.equal(false, await deployedMarket.resolved());
			assert.equal(false, await deployedMarket.canMarketBeResolved());
			assert.equal('Philadelphia 76ers', await deployedMarket.positionPhrase(1));
			assert.equal('Brooklyn Nets', await deployedMarket.positionPhrase(2));
			assert.equal(9004, await deployedMarket.tags(0));
		});

		it('Fulfill Games Created - Champions League AJAX, create market, check results', async () => {
			await fastForward(gameFootballTime - (await currentTime()) - SECOND);

			// req. games
			const tx = await TherundownConsumerDeployed.fulfillGamesCreated(
				reqIdFootballCreate,
				gamesFootballCreated,
				sportId_16,
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
			assert.equal('Ajax Amsterdam Ajax Amsterdam', game.homeTeam);
			assert.equal('Benfica Benfica', game.awayTeam);

			// check if event is emited
			assert.eventEqual(tx.logs[0], 'GameCreted', {
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

			let answer = await ExoticPositionalMarketManager.getActiveMarketAddress('0');
			deployedMarket = await ExoticPositionalMarketContract.at(answer);

			assert.bnEqual(gameFootballTime, await deployedMarket.endOfPositioning());
			assert.notEqual(0, await deployedMarket.creationTime());
			assert.equal(false, await deployedMarket.disputed());
			assert.equal(false, await deployedMarket.resolved());
			assert.equal(false, await deployedMarket.canMarketBeResolved());
			assert.equal('Ajax Amsterdam Ajax Amsterdam', await deployedMarket.positionPhrase(1));
			assert.equal('Benfica Benfica', await deployedMarket.positionPhrase(2));
			assert.equal('It will be a draw', await deployedMarket.positionPhrase(3));
			assert.equal(9016, await deployedMarket.tags(0));
		});

		it('Fulfill Games Created - Champions League MUN UTD, create market, check results', async () => {
			await fastForward(gameFootballTime - (await currentTime()) - SECOND);

			// req games
			const tx = await TherundownConsumerDeployed.fulfillGamesCreated(
				reqIdFootballCreate,
				gamesFootballCreated,
				sportId_16,
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
			assert.equal('Manchester United Manchester United', game.homeTeam);
			assert.equal('Atletico Madrid Atletico Madrid', game.awayTeam);

			// check if event is emited
			assert.eventEqual(tx.logs[1], 'GameCreted', {
				_requestId: reqIdFootballCreate,
				_sportId: sportId_16,
				_id: gameFootballid2,
				_game: game,
			});

			// create markets
			const tx_create = await TherundownConsumerDeployed.createMarketForGame(gameFootballid2);

			let marketAdd = await TherundownConsumerDeployed.marketPerGameId(gameFootballid2);

			// check if event is emited
			assert.eventEqual(tx_create.logs[1], 'CreateSportsMarket', {
				_marketAddress: marketAdd,
				_id: gameFootballid2,
				_game: game,
			});

			let answer = await ExoticPositionalMarketManager.getActiveMarketAddress('0');
			deployedMarket = await ExoticPositionalMarketContract.at(answer);

			assert.bnEqual(gameFootballTime, await deployedMarket.endOfPositioning());
			assert.notEqual(0, await deployedMarket.creationTime());
			assert.equal(false, await deployedMarket.disputed());
			assert.equal(false, await deployedMarket.resolved());
			assert.equal(false, await deployedMarket.canMarketBeResolved());
			assert.equal('Manchester United Manchester United', await deployedMarket.positionPhrase(1));
			assert.equal('Atletico Madrid Atletico Madrid', await deployedMarket.positionPhrase(2));
			assert.equal('It will be a draw', await deployedMarket.positionPhrase(3));
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
				{ from: wrapper }
			);

			assert.equal(true, await TherundownConsumerDeployed.isSportTwoPositionsSport(sportId_4));
			assert.equal(true, await TherundownConsumerDeployed.isSupportedSport(sportId_4));

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
			assert.equal('Philadelphia 76ers', game.homeTeam);
			assert.equal('Brooklyn Nets', game.awayTeam);

			// check if event is emited
			assert.eventEqual(tx.logs[0], 'GameCreted', {
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

			let answer = await ExoticPositionalMarketManager.getActiveMarketAddress('0');
			deployedMarket = await ExoticPositionalMarketContract.at(answer);

			assert.equal('Philadelphia 76ers vs Brooklyn Nets', await deployedMarket.marketQuestion());
			assert.equal(2, await deployedMarket.positionCount());

			assert.bnEqual(gameTime, await deployedMarket.endOfPositioning());
			assert.notEqual(0, await deployedMarket.creationTime());
			assert.equal(false, await deployedMarket.disputed());
			assert.equal(false, await deployedMarket.resolved());
			assert.equal(false, await deployedMarket.canMarketBeResolved());
			assert.equal('Philadelphia 76ers', await deployedMarket.positionPhrase(1));
			assert.equal('Brooklyn Nets', await deployedMarket.positionPhrase(2));
			assert.equal(9004, await deployedMarket.tags(0));

			await fastForward(await currentTime());

			assert.equal(true, await deployedMarket.canMarketBeResolved());

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
			const tx_resolve = await TherundownConsumerDeployed.resolveMarketForGame(gameid1);

			// check if event is emited
			assert.eventEqual(tx_resolve.logs[0], 'ResolveSportsMarket', {
				_marketAddress: marketAdd,
				_id: gameid1,
				_game: gameR,
			});
		});

		it('Fulfill Games Resolved - Champions League AJAX, resolve market, check results', async () => {
			await fastForward(gameFootballTime - (await currentTime()) - SECOND);

			// req. games
			const tx = await TherundownConsumerDeployed.fulfillGamesCreated(
				reqIdFootballCreate,
				gamesFootballCreated,
				sportId_16,
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
			assert.equal('Ajax Amsterdam Ajax Amsterdam', game.homeTeam);
			assert.equal('Benfica Benfica', game.awayTeam);

			// check if event is emited
			assert.eventEqual(tx.logs[0], 'GameCreted', {
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

			let answer = await ExoticPositionalMarketManager.getActiveMarketAddress('0');
			deployedMarket = await ExoticPositionalMarketContract.at(answer);

			assert.bnEqual(gameFootballTime, await deployedMarket.endOfPositioning());
			assert.notEqual(0, await deployedMarket.creationTime());
			assert.equal(false, await deployedMarket.disputed());
			assert.equal(false, await deployedMarket.resolved());
			assert.equal(false, await deployedMarket.canMarketBeResolved());
			assert.equal('Ajax Amsterdam Ajax Amsterdam', await deployedMarket.positionPhrase(1));
			assert.equal('Benfica Benfica', await deployedMarket.positionPhrase(2));
			assert.equal('It will be a draw', await deployedMarket.positionPhrase(3));
			assert.equal(9016, await deployedMarket.tags(0));

			await fastForward(gameFootballTime - (await currentTime()) + 3 * HOUR);

			assert.equal(true, await deployedMarket.canMarketBeResolved());

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
				game_2_football_resolve,
				await TherundownConsumerDeployed.requestIdGamesResolved(reqIdResolveFoodball, 1)
			);

			let gameR = await TherundownConsumerDeployed.gameResolved(gameFootballid1);
			assert.equal(0, gameR.homeScore);
			assert.equal(1, gameR.awayScore);
			assert.equal(11, gameR.statusId);

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
				_game: gameR,
			});
		});

		it('Fulfill Games Resolved - Champions League MUN UTD, resolve market, check results', async () => {
			await fastForward(gameFootballTime - (await currentTime()) - SECOND);

			// req games
			const tx = await TherundownConsumerDeployed.fulfillGamesCreated(
				reqIdFootballCreate,
				gamesFootballCreated,
				sportId_16,
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
			assert.equal('Manchester United Manchester United', game.homeTeam);
			assert.equal('Atletico Madrid Atletico Madrid', game.awayTeam);

			// check if event is emited
			assert.eventEqual(tx.logs[1], 'GameCreted', {
				_requestId: reqIdFootballCreate,
				_sportId: sportId_16,
				_id: gameFootballid2,
				_game: game,
			});

			// create markets
			const tx_create = await TherundownConsumerDeployed.createMarketForGame(gameFootballid2);

			let marketAdd = await TherundownConsumerDeployed.marketPerGameId(gameFootballid2);

			// check if event is emited
			assert.eventEqual(tx_create.logs[1], 'CreateSportsMarket', {
				_marketAddress: marketAdd,
				_id: gameFootballid2,
				_game: game,
			});

			let answer = await ExoticPositionalMarketManager.getActiveMarketAddress('0');
			deployedMarket = await ExoticPositionalMarketContract.at(answer);

			assert.bnEqual(gameFootballTime, await deployedMarket.endOfPositioning());
			assert.notEqual(0, await deployedMarket.creationTime());
			assert.equal(false, await deployedMarket.disputed());
			assert.equal(false, await deployedMarket.resolved());
			assert.equal(false, await deployedMarket.canMarketBeResolved());
			assert.equal('Manchester United Manchester United', await deployedMarket.positionPhrase(1));
			assert.equal('Atletico Madrid Atletico Madrid', await deployedMarket.positionPhrase(2));
			assert.equal('It will be a draw', await deployedMarket.positionPhrase(3));
			assert.equal(9016, await deployedMarket.tags(0));

			await expect(TherundownConsumerDeployed.createMarketForGame(gameFootballid2, { from: owner })).to.be.revertedWith('Market for game already exists');

			await fastForward(gameFootballTime - (await currentTime()) + 3 * HOUR);

			assert.equal(true, await deployedMarket.canMarketBeResolved());

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
				_game: gameR,
			});

			await expect(TherundownConsumerDeployed.resolveMarketForGame(gameFootballid2, { from: owner })).to.be.revertedWith('Market resoved or canceled');
		});
	});
});
