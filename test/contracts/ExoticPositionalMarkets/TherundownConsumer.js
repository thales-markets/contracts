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

	const ExoticPositionalMarketContract = artifacts.require('ExoticPositionalOpenBidMarket');
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
	let gamesQueue;
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
	const gameFootballTime = 1649876400;

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
		let GamesQueue = artifacts.require('GamesQueue');
		gamesQueue = await GamesQueue.new({from:owner});
		await gamesQueue.initialize(owner, { from: owner });

		await ExoticPositionalMarketManager.initialize(
			manager,
			{ from: manager }
		);

		fixedBondAmount = toUnit(100);
		await ExoticPositionalMarketManager.setPaymentToken(Thales.address);
		await ExoticPositionalMarketManager.setMaxNumberOfTags('5', { from: manager });
		await ExoticPositionalMarketManager.setSafeBoxPercentage('1', { from: manager });
		await ExoticPositionalMarketManager.setCreatorPercentage('1', { from: manager });
		await ExoticPositionalMarketManager.setResolverPercentage('1', { from: manager });
		await ExoticPositionalMarketManager.setPDAOResolveTimePeriod('172800', { from: manager });
		await ExoticPositionalMarketManager.setMaxOracleCouncilMembers('5', { from: manager });
		await ExoticPositionalMarketManager.setDefaultBackstopTimeout('14400', { from: manager });
		await ExoticPositionalMarketManager.setWithdrawalPercentage('6', { from: manager });
		await ExoticPositionalMarketManager.setWithdrawalTimePeriod("28800", { from: manager });
		await ExoticPositionalMarketManager.setClaimTimeoutDefaultPeriod('86400', { from: manager });
		let maxOpenBidPositon = toUnit(1000);
		let maxPercentage = "10";
		await ExoticPositionalMarketManager.setMaxAmountForOpenBidPosition(maxOpenBidPositon,maxPercentage, { from: manager });
		await ExoticPositionalMarketManager.setExoticMarketMastercopy(ExoticPositionalMarket.address);
		await ExoticPositionalMarketManager.setExoticMarketOpenBidMastercopy(
			ExoticPositionalMarket.address
		);
		await ExoticPositionalMarketManager.setOracleCouncilAddress(ThalesOracleCouncil.address);
		await ExoticPositionalMarketManager.setThalesBonds(ThalesBonds.address);
		await ExoticPositionalMarketManager.setTagsAddress(ExoticPositionalTags.address);
		await ThalesBonds.setMarketManager(ExoticPositionalMarketManager.address, { from: manager });
		await ExoticPositionalMarketManager.setFixedBondAmount(fixedBondAmount, { from: manager });
		await ExoticPositionalMarketManager.setSafeBoxAddress(safeBox, { from: manager });
		await ExoticPositionalMarketManager.setMaximumPositionsAllowed('5', { from: manager });
		await ExoticPositionalMarketManager.setMarketQuestionStringLimit('1000', { from: manager });
		await ExoticPositionalMarketManager.setMarketSourceStringLimit('1000', { from: manager });
		await ExoticPositionalMarketManager.setMarketPositionStringLimit('60', { from: manager });

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

		TherundownConsumer = artifacts.require('TherundownConsumer');
		TherundownConsumerDeployed = await TherundownConsumer.new();

		await TherundownConsumerDeployed.initialize(
			owner,
			[sportId_4, sportId_16],
			ExoticPositionalMarketManager.address,
			[sportId_4],
			toUnit(0),
			true,
			toUnit(100),
			gamesQueue.address,
			{ from: owner }
		);
		await Thales.transfer(TherundownConsumerDeployed.address, toUnit('1000'), { from: owner });
		await ExoticPositionalMarketManager.setTheRundownConsumerAddress(
			TherundownConsumerDeployed.address
		);
		await TherundownConsumerDeployed.setWrapperAddress(wrapper, { from: owner });
		await TherundownConsumerDeployed.addToWhitelist(third, { from: owner });

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

			assert.equal(true, await TherundownConsumerDeployed.isSameTeamOrTBD('Real Madrid', 'Real Madrid'));
			assert.equal(true, await TherundownConsumerDeployed.isSameTeamOrTBD('Real Madrid', 'TBD TBD'));
			assert.equal(true, await TherundownConsumerDeployed.isSameTeamOrTBD('TBD TBD', 'Liverpool FC'));
			assert.equal(false, await TherundownConsumerDeployed.isSameTeamOrTBD('Real Madrid', 'Liverpool FC'));
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

			assert.equal(gameid1, await gamesQueue.gamesCreateQueue(1));
			assert.equal(gameid2, await gamesQueue.gamesCreateQueue(2));

			assert.equal(2, await gamesQueue.getLengthUnproccessedGames());
			assert.equal(0, await gamesQueue.unproccessedGamesIndex(gameid1));
			assert.equal(1, await gamesQueue.unproccessedGamesIndex(gameid2));
			assert.equal(sportId_4, await gamesQueue.sportPerGameId(gameid1));
			assert.equal(sportId_4, await gamesQueue.sportPerGameId(gameid2));
			assert.bnEqual(1649890800, await gamesQueue.gameStartPerGameId(gameid1));
			assert.bnEqual(1649890800, await gamesQueue.gameStartPerGameId(gameid2));

			assert.equal(true, await TherundownConsumerDeployed.isSportTwoPositionsSport(sportId_4));
			assert.equal(true, await TherundownConsumerDeployed.isSupportedSport(sportId_4));

			assert.bnEqual(-20700, await TherundownConsumerDeployed.getOddsHomeTeam(gameid1));
			assert.bnEqual(17700, await TherundownConsumerDeployed.getOddsAwayTeam(gameid1));

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

			assert.equal('Atlanta Hawks vs Charlotte Hornets', await deployedMarket.marketQuestion());
			assert.equal(2, await deployedMarket.positionCount());

			assert.bnEqual(gameTime, await deployedMarket.endOfPositioning());
			assert.notEqual(0, await deployedMarket.creationTime());
			assert.equal(false, await deployedMarket.disputed());
			assert.equal(false, await deployedMarket.resolved());
			assert.equal(false, await deployedMarket.canMarketBeResolved());
			assert.equal('Atlanta Hawks', await deployedMarket.positionPhrase(1));
			assert.equal('Charlotte Hornets', await deployedMarket.positionPhrase(2));
			assert.equal(9004, await deployedMarket.tags(0));

		});

		it('Fulfill Games Created - Champions League Game 1, create market, check results', async () => {
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

			assert.bnEqual(40000, await TherundownConsumerDeployed.getOddsHomeTeam(gameFootballid1));
			assert.bnEqual(-12500, await TherundownConsumerDeployed.getOddsAwayTeam(gameFootballid1));
			assert.bnEqual(27200, await TherundownConsumerDeployed.getOddsDraw(gameFootballid1));

			let game = await TherundownConsumerDeployed.gameCreated(gameFootballid1);
			assert.equal('Atletico Madrid Atletico Madrid', game.homeTeam);
			assert.equal('Manchester City Manchester City', game.awayTeam);

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
			assert.equal('Atletico Madrid Atletico Madrid', await deployedMarket.positionPhrase(1));
			assert.equal('Manchester City Manchester City', await deployedMarket.positionPhrase(2));
			assert.equal('It will be a draw', await deployedMarket.positionPhrase(3));
			assert.equal(9016, await deployedMarket.tags(0));
		});

		it('Fulfill Games Created - Champions League Game 2, create market, check results', async () => {
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
			assert.equal('Liverpool Liverpool', game.homeTeam);
			assert.equal('Benfica Benfica', game.awayTeam);

			// check if event is emited
			assert.eventEqual(tx.logs[1], 'GameCreted', {
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

			let answer = await ExoticPositionalMarketManager.getActiveMarketAddress('1');
			deployedMarket = await ExoticPositionalMarketContract.at(answer);

			assert.bnEqual(gameFootballTime, await deployedMarket.endOfPositioning());
			assert.notEqual(0, await deployedMarket.creationTime());
			assert.equal(false, await deployedMarket.disputed());
			assert.equal(false, await deployedMarket.resolved());
			assert.equal(false, await deployedMarket.canMarketBeResolved());
			assert.equal('Liverpool Liverpool', await deployedMarket.positionPhrase(1));
			assert.equal('Benfica Benfica', await deployedMarket.positionPhrase(2));
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

			assert.equal(2, await gamesQueue.getLengthUnproccessedGames());
			assert.equal(0, await gamesQueue.unproccessedGamesIndex(gameid1));
			assert.equal(1, await gamesQueue.unproccessedGamesIndex(gameid2));
			assert.equal(sportId_4, await gamesQueue.sportPerGameId(gameid1));
			assert.equal(sportId_4, await gamesQueue.sportPerGameId(gameid2));
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
			assert.eventEqual(tx.logs[0], 'GameCreted', {
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

			let answer = await ExoticPositionalMarketManager.getActiveMarketAddress('0');
			deployedMarket = await ExoticPositionalMarketContract.at(answer);

			assert.equal('Atlanta Hawks vs Charlotte Hornets', await deployedMarket.marketQuestion());
			assert.equal(2, await deployedMarket.positionCount());

			assert.bnEqual(gameTime, await deployedMarket.endOfPositioning());
			assert.notEqual(0, await deployedMarket.creationTime());
			assert.equal(false, await deployedMarket.disputed());
			assert.equal(false, await deployedMarket.resolved());
			assert.equal(false, await deployedMarket.canMarketBeResolved());
			assert.equal('Atlanta Hawks', await deployedMarket.positionPhrase(1));
			assert.equal('Charlotte Hornets', await deployedMarket.positionPhrase(2));
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
			assert.equal('Atletico Madrid Atletico Madrid', await deployedMarket.positionPhrase(1));
			assert.equal('Manchester City Manchester City', await deployedMarket.positionPhrase(2));
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
			assert.eventEqual(tx.logs[1], 'GameCreted', {
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

			let answer = await ExoticPositionalMarketManager.getActiveMarketAddress('1');
			deployedMarket = await ExoticPositionalMarketContract.at(answer);

			assert.bnEqual(gameFootballTime, await deployedMarket.endOfPositioning());
			assert.notEqual(0, await deployedMarket.creationTime());
			assert.equal(false, await deployedMarket.disputed());
			assert.equal(false, await deployedMarket.resolved());
			assert.equal(false, await deployedMarket.canMarketBeResolved());
			assert.equal('Liverpool Liverpool', await deployedMarket.positionPhrase(1));
			assert.equal('Benfica Benfica', await deployedMarket.positionPhrase(2));
			assert.equal('It will be a draw', await deployedMarket.positionPhrase(3));
			assert.equal(9016, await deployedMarket.tags(0));

			await expect(
				TherundownConsumerDeployed.createMarketForGame(gameFootballid2, { from: owner })
			).to.be.revertedWith('Market for game already exists');

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
			assert.equal('Atletico Madrid Atletico Madrid', await deployedMarket.positionPhrase(1));
			assert.equal('Manchester City Manchester City', await deployedMarket.positionPhrase(2));
			assert.equal('It will be a draw', await deployedMarket.positionPhrase(3));
			assert.equal(9016, await deployedMarket.tags(0));

			await fastForward(gameFootballTime - (await currentTime()) + 3 * HOUR);

			await expect(TherundownConsumerDeployed.resolveGameManually(gameFootballid1, 2, { from: second })).to.be.revertedWith('Address not supported');
			await expect(TherundownConsumerDeployed.resolveGameManually(gameFootballid1, 0, { from: third })).to.be.revertedWith('Bad outcome for three position game');
			await expect(TherundownConsumerDeployed.resolveGameManually(gameFootballid1, 4, { from: third })).to.be.revertedWith('Bad outcome for three position game');
			await expect(TherundownConsumerDeployed.resolveMarketManually(marketAdd, 2, { from: second })).to.be.revertedWith('Address not supported');
			await expect(TherundownConsumerDeployed.resolveMarketManually(marketAdd, 0, { from: third })).to.be.revertedWith('Bad outcome for three position game');
			await expect(TherundownConsumerDeployed.resolveMarketManually(marketAdd, 4, { from: third })).to.be.revertedWith('Bad outcome for three position game');

			const tx_2 = await TherundownConsumerDeployed.resolveGameManually(
				gameFootballid1, 2, { from: third }
			);

			// check if event is emited
			assert.eventEqual(tx_2.logs[0], 'ResolveSportsMarket', {
				_marketAddress: marketAdd,
				_id: gameFootballid1,
				_outcome: 2,
			});

			await expect(TherundownConsumerDeployed.resolveGameManually(gameFootballid1, 2, { from: third })).to.be.revertedWith('Market resoved or canceled');

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
			assert.eventEqual(tx.logs[1], 'GameCreted', {
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

			let answer = await ExoticPositionalMarketManager.getActiveMarketAddress('1');
			deployedMarket = await ExoticPositionalMarketContract.at(answer);

			assert.bnEqual(gameFootballTime, await deployedMarket.endOfPositioning());
			assert.notEqual(0, await deployedMarket.creationTime());
			assert.equal(false, await deployedMarket.disputed());
			assert.equal(false, await deployedMarket.resolved());
			assert.equal(false, await deployedMarket.canMarketBeResolved());
			assert.equal('Liverpool Liverpool', await deployedMarket.positionPhrase(1));
			assert.equal('Benfica Benfica', await deployedMarket.positionPhrase(2));
			assert.equal('It will be a draw', await deployedMarket.positionPhrase(3));
			assert.equal(9016, await deployedMarket.tags(0));

			await fastForward(gameFootballTime - (await currentTime()) + 3 * HOUR);

			await expect(TherundownConsumerDeployed.resolveMarketManually(marketAdd, 2, { from: second })).to.be.revertedWith('Address not supported');
			await expect(TherundownConsumerDeployed.resolveMarketManually(marketAdd, 0, { from: third })).to.be.revertedWith('Bad outcome for three position game');
			await expect(TherundownConsumerDeployed.resolveMarketManually(marketAdd, 4, { from: third })).to.be.revertedWith('Bad outcome for three position game');

			const tx_2 = await TherundownConsumerDeployed.resolveMarketManually(
				marketAdd, 1, { from: third }
			);

			// check if event is emited
			assert.eventEqual(tx_2.logs[0], 'ResolveSportsMarket', {
				_marketAddress: marketAdd,
				_id: gameFootballid2,
				_outcome: 1,
			});

			await expect(TherundownConsumerDeployed.resolveGameManually(gameFootballid2, 2, { from: third })).to.be.revertedWith('Market resoved or canceled');
			await expect(TherundownConsumerDeployed.resolveMarketManually(marketAdd, 2, { from: third })).to.be.revertedWith('Market resoved or canceled');

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
				{ from: wrapper }
			);

			assert.equal(2, await gamesQueue.getLengthUnproccessedGames());
			assert.equal(0, await gamesQueue.unproccessedGamesIndex(gameid1));
			assert.equal(1, await gamesQueue.unproccessedGamesIndex(gameid2));
			assert.equal(sportId_4, await gamesQueue.sportPerGameId(gameid1));
			assert.equal(sportId_4, await gamesQueue.sportPerGameId(gameid2));
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
			assert.eventEqual(tx.logs[0], 'GameCreted', {
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

			let answer = await ExoticPositionalMarketManager.getActiveMarketAddress('0');
			deployedMarket = await ExoticPositionalMarketContract.at(answer);

			assert.equal('Atlanta Hawks vs Charlotte Hornets', await deployedMarket.marketQuestion());
			assert.equal(2, await deployedMarket.positionCount());

			assert.bnEqual(gameTime, await deployedMarket.endOfPositioning());
			assert.notEqual(0, await deployedMarket.creationTime());
			assert.equal(false, await deployedMarket.disputed());
			assert.equal(false, await deployedMarket.resolved());
			assert.equal(false, await deployedMarket.canMarketBeResolved());
			assert.equal('Atlanta Hawks', await deployedMarket.positionPhrase(1));
			assert.equal('Charlotte Hornets', await deployedMarket.positionPhrase(2));
			assert.equal(9004, await deployedMarket.tags(0));

			//await fastForward(await currentTime());

			await expect(TherundownConsumerDeployed.cancelMarketManually(marketAdd, { from: second })).to.be.revertedWith('Address not supported');
			await expect(TherundownConsumerDeployed.cancelMarketManually(second, { from: third })).to.be.revertedWith('No market created for game');
			await expect(TherundownConsumerDeployed.cancelGameManually(gameFootballid1, { from: third })).to.be.revertedWith('No market created for game');

			await expect(TherundownConsumerDeployed.resolveMarketManually(marketAdd, 0, { from: third })).to.be.revertedWith('Bad outcome for two position game');
			await expect(TherundownConsumerDeployed.resolveMarketManually(marketAdd, 3, { from: third })).to.be.revertedWith('Bad outcome for two position game');

			const tx_2 = await TherundownConsumerDeployed.cancelMarketManually(
				marketAdd, { from: third }
			);

			// check if event is emited
			assert.eventEqual(tx_2.logs[0], 'CancelSportsMarket', {
				_marketAddress: marketAdd,
				_id: gameid1
			});

			await expect(TherundownConsumerDeployed.resolveGameManually(gameid1, 2, { from: third })).to.be.revertedWith('Market resoved or canceled');
			await expect(TherundownConsumerDeployed.resolveMarketManually(marketAdd, 2, { from: third })).to.be.revertedWith('Market resoved or canceled');
			await expect(TherundownConsumerDeployed.cancelMarketManually(marketAdd, { from: third })).to.be.revertedWith('Market resoved or canceled');

			assert.equal(1, await gamesQueue.getLengthUnproccessedGames());
			assert.equal(0, await gamesQueue.unproccessedGamesIndex(gameid1));
			assert.equal(0, await gamesQueue.unproccessedGamesIndex(gameid2));
		});
	});
});
