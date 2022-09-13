'use strict';

const { artifacts, contract, web3 } = require('hardhat');
const { toBN } = web3.utils;

const w3utils = require('web3-utils');

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

contract('ApexConsumer', (accounts) => {
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
	let ApexConsumer;
	let ApexImplementation;
	let ApexConsumerDeployed;
	let MockExoticMarket;
	let MockApexConsumerWrapper;
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
	let game_fight_canceled;
	let gamesFightCanceled;
	let reqIdFightCanceled;

	let SportPositionalMarketManager,
		SportPositionalMarketFactory,
		SportPositionalMarketData,
		SportPositionalMarket,
		SportPositionalMarketMastercopy,
		SportPositionMastercopy,
		SportsAMM;

	let reqIdCreateRace;
	let reqIdCreateGame;
	let reqIdResolveGame;

	const eventId = 'f1r_16_22';
	const betType = 'outright_head_to_head_1';
	const eventName = 'Formula 1 race';

	const game1qualifyingStartTime = 1663094759;
	const game1raceStartTime = 1663181159;
	const game1homeOdds = 5380;
	const game1awayOdds = 4620;
	const invalidOdds = 0;
	const game1homeNormalizedOdds = 0.538;
	const game1awayNormalizedOdds = 0.462;
	const game1homeTeam = 'lance stroll';
	const game1awayTeam = 'daniel ricciardo';

	const homeWinResult = 'win/lose';
	const homeWinResultDetails = '4.0/6.0';

	const awayWinResult = 'lose/win';
	const awayWinResultDetails = '15.0/1.0';

	const cancelResult = 'null';
	const cancelResultDetails = 'DNF/DNF';

	const sportFormula1 = 'formula1';
	const sportMotoGP = 'motogp';
	const sportFootball = 'football';

	const tagFormula1 = 9100;
	const tagMotoGP = 9101;

	const statusCancelled = 0;
	const statusResolved = 1;

	const outcomeCancelled = 0;
	const outcomeHomeWin = 1;
	const outcomeAwayWin = 2;

	const cancelScore = 0;
	const loseScore = 0;
	const winScore = 1;

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
		gameid1 = '0x6631725f31365f32325f6832685f310000000000000000000000000000000000';
		gameid2 = '0x6631725f31365f32325f6832685f320000000000000000000000000000000000';

		// create race props
		reqIdCreateRace = '0x1b294afd4adcabc9aac0b0d430f25314b78fb81b8f9142fdab9c9bfa835ba10d';

		// create game props
		reqIdCreateGame = '0x2b7e6e95a1516d366d0e4b3504a2e399f7422556d5e03843be07e74e8de01db1';

		// resolve game props
		reqIdResolveGame = '0x386e5fbffec077b65c383c01bfb76072410848edf787dab58d0bfec003916df3';

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

		ApexConsumer = artifacts.require('ApexConsumer');
		ApexConsumerDeployed = await ApexConsumer.new();

		await ApexConsumerDeployed.initialize(
			owner,
			[sportFormula1, sportMotoGP],
			SportPositionalMarketManager.address,
			{ from: owner }
		);
		await Thales.transfer(ApexConsumerDeployed.address, toUnit('1000'), { from: owner });

		await ApexConsumerDeployed.setSportContracts(wrapper, SportPositionalMarketManager.address, {
			from: owner,
		});
		await ApexConsumerDeployed.addToWhitelist(third, true, { from: owner });
		await SportPositionalMarketManager.setApexConsumer(ApexConsumerDeployed.address, {
			from: manager,
		});
	});

	describe('Init', () => {
		it('Check init', async () => {
			assert.equal(true, await ApexConsumerDeployed.isSupportedSport('formula1'));
			assert.equal(true, await ApexConsumerDeployed.isSupportedSport('motogp'));
			assert.equal(false, await ApexConsumerDeployed.isSupportedSport('football'));
			assert.equal(false, await ApexConsumerDeployed.isSupportedSport('basketball'));
		});
	});

	describe('Fulfill Game Created', () => {
		it('Fulfill Game Created - Formula 1, create market, check results', async () => {
			await fastForward(game1qualifyingStartTime - (await currentTime()) - SECOND);

			await expect(
				ApexConsumerDeployed.fulfillMetaData(
					reqIdCreateRace,
					eventId,
					betType,
					eventName,
					game1qualifyingStartTime,
					game1raceStartTime,
					sportFormula1,
					{ from: first }
				)
			).to.be.revertedWith('Only wrapper can call this function');

			// req. create race
			const txCreateRace = await ApexConsumerDeployed.fulfillMetaData(
				reqIdCreateRace,
				eventId,
				betType,
				eventName,
				game1qualifyingStartTime,
				game1raceStartTime,
				sportFormula1,
				{ from: wrapper }
			);

			assert.equal(true, await ApexConsumerDeployed.raceFulfilledCreated(eventId));
			assert.equal(eventId, await ApexConsumerDeployed.latestRaceIdPerSport(sportFormula1));

			let race = await ApexConsumerDeployed.raceCreated(eventId);
			assert.bnEqual(game1qualifyingStartTime, race.qualifyingStartTime);
			assert.bnEqual(game1raceStartTime, race.startTime);
			assert.equal(eventName, race.eventName);

			const sportId = await ApexConsumerDeployed.supportedSportId(sportFormula1);

			// check if event is emited
			assert.eventEqual(txCreateRace.logs[0], 'RaceCreated', {
				_requestId: reqIdCreateRace,
				_sportId: sportId,
				_id: eventId,
				_race: race,
			});

			await expect(
				ApexConsumerDeployed.createMarketForGame(gameid1, {
					from: owner,
				})
			).to.be.revertedWith('No such game fulfilled, created');
			assert.equal(false, await ApexConsumerDeployed.isApexGame(gameid1));

			await expect(
				ApexConsumerDeployed.fulfillMatchup(
					reqIdCreateGame,
					game1homeTeam,
					game1awayTeam,
					game1homeOdds,
					game1awayOdds,
					gameid1,
					sportFormula1,
					eventId,
					{ from: first }
				)
			).to.be.revertedWith('Only wrapper can call this function');

			// req. create game
			const txCreateGame = await ApexConsumerDeployed.fulfillMatchup(
				reqIdCreateGame,
				game1homeTeam,
				game1awayTeam,
				game1homeOdds,
				game1awayOdds,
				gameid1,
				sportFormula1,
				eventId,
				{ from: wrapper }
			);

			assert.bnEqual(sportId, await ApexConsumerDeployed.sportsIdPerGame(gameid1));
			assert.equal(true, await ApexConsumerDeployed.isSupportedSport(sportFormula1));
			assert.equal(true, await ApexConsumerDeployed.gameFulfilledCreated(gameid1));
			assert.equal(true, await ApexConsumerDeployed.isApexGame(gameid1));

			let odds = await ApexConsumerDeployed.getOddsForGame(gameid1);
			assert.bnEqual(game1homeOdds, odds[0]);
			assert.bnEqual(game1awayOdds, odds[1]);
			assert.bnEqual(0, odds[2]);

			let game = await ApexConsumerDeployed.gameCreated(gameid1);
			assert.bnEqual(game1qualifyingStartTime, game.startTime);
			assert.equal(game1homeTeam, game.homeTeam);
			assert.equal(game1awayTeam, game.awayTeam);

			// check if event is emited
			assert.eventEqual(txCreateGame.logs[0], 'GameCreated', {
				_requestId: reqIdCreateGame,
				_sportId: sportId,
				_id: gameid1,
				_game: game,
			});

			await expect(
				ApexConsumerDeployed.createMarketForGame(gameid1, {
					from: first,
				})
			).to.be.revertedWith('Invalid caller');

			// create market
			const txCreateMarket = await ApexConsumerDeployed.createMarketForGame(gameid1, {
				from: owner,
			});

			let marketAddress = await ApexConsumerDeployed.marketPerGameId(gameid1);
			assert.equal(true, await ApexConsumerDeployed.marketCreated(marketAddress));
			assert.equal(gameid1, await ApexConsumerDeployed.gameIdPerMarket(marketAddress));

			// check if event is emited
			assert.eventEqual(txCreateMarket.logs[1], 'CreateSportsMarket', {
				_marketAddress: marketAddress,
				_id: gameid1,
				_game: game,
			});

			let answer = await SportPositionalMarketManager.getActiveMarketAddress('0');
			deployedMarket = await SportPositionalMarketContract.at(answer);

			assert.equal(false, await deployedMarket.canResolve());
			assert.equal(tagFormula1, await deployedMarket.tags(0));

			await expect(
				ApexConsumerDeployed.createMarketForGame(gameid1, {
					from: owner,
				})
			).to.be.revertedWith('Market for game already exists');
		});
	});

	describe('Fulfill Game Resolved', () => {
		it('Fulfill Game Resolved - Formula 1, resolve market (HOME WIN), check results', async () => {
			await fastForward(game1qualifyingStartTime - (await currentTime()) - SECOND);

			// req. create race
			await ApexConsumerDeployed.fulfillMetaData(
				reqIdCreateRace,
				eventId,
				betType,
				eventName,
				game1qualifyingStartTime,
				game1raceStartTime,
				sportFormula1,
				{ from: wrapper }
			);
			assert.equal(true, await ApexConsumerDeployed.raceFulfilledCreated(eventId));

			// req. create game
			await ApexConsumerDeployed.fulfillMatchup(
				reqIdCreateGame,
				game1homeTeam,
				game1awayTeam,
				game1homeOdds,
				game1awayOdds,
				gameid1,
				sportFormula1,
				eventId,
				{ from: wrapper }
			);
			assert.equal(true, await ApexConsumerDeployed.gameFulfilledCreated(gameid1));

			// create market
			await ApexConsumerDeployed.createMarketForGame(gameid1, {
				from: owner,
			});
			let marketAddress = await ApexConsumerDeployed.marketPerGameId(gameid1);
			assert.equal(true, await ApexConsumerDeployed.marketCreated(marketAddress));

			let answer = await SportPositionalMarketManager.getActiveMarketAddress('0');
			deployedMarket = await SportPositionalMarketContract.at(answer);

			assert.equal(false, await deployedMarket.canResolve());

			await fastForward(await currentTime());

			assert.equal(true, await deployedMarket.canResolve());
			assert.equal(false, await ApexConsumerDeployed.isGameInResolvedStatus(gameid1));

			await expect(
				ApexConsumerDeployed.fulfillResults(
					reqIdResolveGame,
					homeWinResult,
					homeWinResultDetails,
					gameid1,
					sportFormula1,
					{ from: first }
				)
			).to.be.revertedWith('Only wrapper can call this function');

			const txResolveGame = await ApexConsumerDeployed.fulfillResults(
				reqIdResolveGame,
				homeWinResult,
				homeWinResultDetails,
				gameid1,
				sportFormula1,
				{ from: wrapper }
			);
			assert.equal(true, await ApexConsumerDeployed.gameFulfilledResolved(gameid1));
			assert.equal(true, await ApexConsumerDeployed.isGameInResolvedStatus(gameid1));

			let gameResolved = await ApexConsumerDeployed.gameResolved(gameid1);
			assert.equal(winScore, gameResolved.homeScore);
			assert.equal(loseScore, gameResolved.awayScore);
			assert.equal(statusResolved, gameResolved.statusId);

			const sportId = await ApexConsumerDeployed.supportedSportId(sportFormula1);

			assert.eventEqual(txResolveGame.logs[0], 'GameResolved', {
				_requestId: reqIdResolveGame,
				_sportId: sportId,
				_id: gameid1,
				_game: gameResolved,
			});

			await expect(
				ApexConsumerDeployed.resolveMarketForGame(gameid1, {
					from: first,
				})
			).to.be.revertedWith('Invalid caller');

			// resolve markets
			const txResolveMarket = await ApexConsumerDeployed.resolveMarketForGame(gameid1, {
				from: owner,
			});
			assert.equal(true, await ApexConsumerDeployed.marketResolved(marketAddress));

			// check if event is emited
			assert.eventEqual(txResolveMarket.logs[0], 'ResolveSportsMarket', {
				_marketAddress: marketAddress,
				_id: gameid1,
				_outcome: outcomeHomeWin,
			});
		});

		it('Fulfill Game Resolved - Formula 1, resolve market (AWAY WIN), check results', async () => {
			await fastForward(game1qualifyingStartTime - (await currentTime()) - SECOND);

			// req. create race
			await ApexConsumerDeployed.fulfillMetaData(
				reqIdCreateRace,
				eventId,
				betType,
				eventName,
				game1qualifyingStartTime,
				game1raceStartTime,
				sportFormula1,
				{ from: wrapper }
			);
			assert.equal(true, await ApexConsumerDeployed.raceFulfilledCreated(eventId));

			// req. create game
			await ApexConsumerDeployed.fulfillMatchup(
				reqIdCreateGame,
				game1homeTeam,
				game1awayTeam,
				game1homeOdds,
				game1awayOdds,
				gameid1,
				sportFormula1,
				eventId,
				{ from: wrapper }
			);
			assert.equal(true, await ApexConsumerDeployed.gameFulfilledCreated(gameid1));

			// create market
			await ApexConsumerDeployed.createMarketForGame(gameid1, {
				from: owner,
			});
			let marketAddress = await ApexConsumerDeployed.marketPerGameId(gameid1);
			assert.equal(true, await ApexConsumerDeployed.marketCreated(marketAddress));

			let answer = await SportPositionalMarketManager.getActiveMarketAddress('0');
			deployedMarket = await SportPositionalMarketContract.at(answer);

			assert.equal(false, await deployedMarket.canResolve());

			await fastForward(await currentTime());

			assert.equal(true, await deployedMarket.canResolve());
			assert.equal(false, await ApexConsumerDeployed.isGameInResolvedStatus(gameid1));

			await expect(
				ApexConsumerDeployed.resolveMarketForGame(gameid1, {
					from: owner,
				})
			).to.be.revertedWith('No such game fulfilled, resolved');

			const txResolveGame = await ApexConsumerDeployed.fulfillResults(
				reqIdResolveGame,
				awayWinResult,
				awayWinResultDetails,
				gameid1,
				sportFormula1,
				{ from: wrapper }
			);
			assert.equal(true, await ApexConsumerDeployed.gameFulfilledResolved(gameid1));
			assert.equal(true, await ApexConsumerDeployed.isGameInResolvedStatus(gameid1));

			let gameResolved = await ApexConsumerDeployed.gameResolved(gameid1);
			assert.equal(loseScore, gameResolved.homeScore);
			assert.equal(winScore, gameResolved.awayScore);
			assert.equal(statusResolved, gameResolved.statusId);

			const sportId = await ApexConsumerDeployed.supportedSportId(sportFormula1);

			assert.eventEqual(txResolveGame.logs[0], 'GameResolved', {
				_requestId: reqIdResolveGame,
				_sportId: sportId,
				_id: gameid1,
				_game: gameResolved,
			});

			// resolve markets
			const txResolveMarket = await ApexConsumerDeployed.resolveMarketForGame(gameid1, {
				from: owner,
			});
			assert.equal(true, await ApexConsumerDeployed.marketResolved(marketAddress));

			// check if event is emited
			assert.eventEqual(txResolveMarket.logs[0], 'ResolveSportsMarket', {
				_marketAddress: marketAddress,
				_id: gameid1,
				_outcome: outcomeAwayWin,
			});

			await expect(
				ApexConsumerDeployed.resolveMarketForGame(gameid1, {
					from: owner,
				})
			).to.be.revertedWith('Market resolved or canceled');
		});

		it('Fulfill Game Resolved - Formula 1, resolve market (CANCEL), game time has passed, cancel market, automatically', async () => {
			await fastForward(game1qualifyingStartTime - (await currentTime()) - SECOND);

			// req. create race
			await ApexConsumerDeployed.fulfillMetaData(
				reqIdCreateRace,
				eventId,
				betType,
				eventName,
				game1qualifyingStartTime,
				game1raceStartTime,
				sportFormula1,
				{ from: wrapper }
			);
			assert.equal(true, await ApexConsumerDeployed.raceFulfilledCreated(eventId));

			// req. create game
			await ApexConsumerDeployed.fulfillMatchup(
				reqIdCreateGame,
				game1homeTeam,
				game1awayTeam,
				game1homeOdds,
				game1awayOdds,
				gameid1,
				sportFormula1,
				eventId,
				{ from: wrapper }
			);
			assert.equal(true, await ApexConsumerDeployed.gameFulfilledCreated(gameid1));

			// create market
			await ApexConsumerDeployed.createMarketForGame(gameid1, {
				from: owner,
			});
			let marketAddress = await ApexConsumerDeployed.marketPerGameId(gameid1);
			assert.equal(true, await ApexConsumerDeployed.marketCreated(marketAddress));

			let answer = await SportPositionalMarketManager.getActiveMarketAddress('0');
			deployedMarket = await SportPositionalMarketContract.at(answer);

			assert.equal(false, await deployedMarket.canResolve());

			await fastForward(game1qualifyingStartTime - (await currentTime()) + 3 * HOUR);

			assert.equal(true, await deployedMarket.canResolve());
			assert.equal(false, await ApexConsumerDeployed.isGameInResolvedStatus(gameid1));

			const txResolveGame = await ApexConsumerDeployed.fulfillResults(
				reqIdResolveGame,
				cancelResult,
				cancelResultDetails,
				gameid1,
				sportFormula1,
				{ from: wrapper }
			);
			assert.equal(true, await ApexConsumerDeployed.gameFulfilledResolved(gameid1));
			assert.equal(false, await ApexConsumerDeployed.isGameInResolvedStatus(gameid1));

			let gameResolved = await ApexConsumerDeployed.gameResolved(gameid1);
			assert.equal(cancelScore, gameResolved.homeScore);
			assert.equal(cancelScore, gameResolved.awayScore);
			assert.equal(statusCancelled, gameResolved.statusId);

			const sportId = await ApexConsumerDeployed.supportedSportId(sportFormula1);

			assert.eventEqual(txResolveGame.logs[0], 'GameResolved', {
				_requestId: reqIdResolveGame,
				_sportId: sportId,
				_id: gameid1,
				_game: gameResolved,
			});

			// resolve markets
			const txCancelMarket = await ApexConsumerDeployed.resolveMarketForGame(gameid1, {
				from: owner,
			});
			assert.equal(false, await ApexConsumerDeployed.marketResolved(marketAddress));
			assert.equal(true, await ApexConsumerDeployed.marketCanceled(marketAddress));

			// check if event is emited
			assert.eventEqual(txCancelMarket.logs[0], 'CancelSportsMarket', {
				_marketAddress: marketAddress,
				_id: gameid1,
			});

			await expect(
				ApexConsumerDeployed.resolveMarketForGame(gameid1, {
					from: owner,
				})
			).to.be.revertedWith('Market resolved or canceled');
		});

		it('Fulfill Game Resolved - Formula 1, resolve market (CANCEL), game time has not passed, first pause, then cancel automatically after it is passed', async () => {
			await fastForward(game1qualifyingStartTime - (await currentTime()) - SECOND);

			// req. create race
			await ApexConsumerDeployed.fulfillMetaData(
				reqIdCreateRace,
				eventId,
				betType,
				eventName,
				game1qualifyingStartTime,
				game1raceStartTime,
				sportFormula1,
				{ from: wrapper }
			);
			assert.equal(true, await ApexConsumerDeployed.raceFulfilledCreated(eventId));

			// req. create game
			await ApexConsumerDeployed.fulfillMatchup(
				reqIdCreateGame,
				game1homeTeam,
				game1awayTeam,
				game1homeOdds,
				game1awayOdds,
				gameid1,
				sportFormula1,
				eventId,
				{ from: wrapper }
			);
			assert.equal(true, await ApexConsumerDeployed.gameFulfilledCreated(gameid1));

			// create market
			await ApexConsumerDeployed.createMarketForGame(gameid1, {
				from: owner,
			});
			let marketAddress = await ApexConsumerDeployed.marketPerGameId(gameid1);
			assert.equal(true, await ApexConsumerDeployed.marketCreated(marketAddress));

			let answer = await SportPositionalMarketManager.getActiveMarketAddress('0');
			deployedMarket = await SportPositionalMarketContract.at(answer);

			assert.equal(false, await deployedMarket.canResolve());
			assert.equal(false, await deployedMarket.paused());
			assert.equal(false, await ApexConsumerDeployed.isGameInResolvedStatus(gameid1));

			const txResolveGame = await ApexConsumerDeployed.fulfillResults(
				reqIdResolveGame,
				cancelResult,
				cancelResultDetails,
				gameid1,
				sportFormula1,
				{ from: wrapper }
			);
			// not canceled part only paused
			assert.equal(false, await ApexConsumerDeployed.gameFulfilledResolved(gameid1));
			assert.equal(false, await ApexConsumerDeployed.isGameInResolvedStatus(gameid1));

			// there is no result yet
			let gameResolved = await ApexConsumerDeployed.gameResolved(gameid1);
			assert.equal(0, gameResolved.homeScore);
			assert.equal(0, gameResolved.awayScore);
			assert.equal(0, gameResolved.statusId);

			assert.eventEqual(txResolveGame.logs[0], 'PauseSportsMarket', {
				_marketAddress: marketAddress,
				_pause: true,
			});

			assert.equal(true, await deployedMarket.paused());

			// canceling part when time has arrived
			await fastForward(game1qualifyingStartTime - (await currentTime()) + 3 * HOUR);

			// paused
			assert.equal(true, await deployedMarket.paused());
			// paused can not be resolved
			assert.equal(false, await deployedMarket.canResolve());
			// stil not canceled
			assert.equal(false, await deployedMarket.cancelled());

			const txSecondResolveGame = await ApexConsumerDeployed.fulfillResults(
				reqIdResolveGame,
				cancelResult,
				cancelResultDetails,
				gameid1,
				sportFormula1,
				{ from: wrapper }
			);
			assert.equal(true, await ApexConsumerDeployed.gameFulfilledResolved(gameid1));

			gameResolved = await ApexConsumerDeployed.gameResolved(gameid1);
			assert.equal(cancelScore, gameResolved.homeScore);
			assert.equal(cancelScore, gameResolved.awayScore);
			assert.equal(statusCancelled, gameResolved.statusId);

			const sportId = await ApexConsumerDeployed.supportedSportId(sportFormula1);

			assert.eventEqual(txSecondResolveGame.logs[0], 'GameResolved', {
				_requestId: reqIdResolveGame,
				_sportId: sportId,
				_id: gameid1,
				_game: gameResolved,
			});

			// resolve markets
			const txCancelMarket = await ApexConsumerDeployed.resolveMarketForGame(gameid1, {
				from: owner,
			});
			assert.equal(false, await ApexConsumerDeployed.marketResolved(marketAddress));
			assert.equal(true, await ApexConsumerDeployed.marketCanceled(marketAddress));

			// check if event is emited
			assert.eventEqual(txCancelMarket.logs[0], 'CancelSportsMarket', {
				_marketAddress: marketAddress,
				_id: gameid1,
			});

			assert.equal(false, await deployedMarket.paused());
			assert.equal(true, await deployedMarket.cancelled());

			await expect(
				ApexConsumerDeployed.resolveMarketForGame(gameid1, {
					from: owner,
				})
			).to.be.revertedWith('Market resolved or canceled');
		});
	});

	describe('Game resolve/cancel manually', () => {
		it('Resolve market manually (AWAY WIN), check results', async () => {
			await fastForward(game1qualifyingStartTime - (await currentTime()) - SECOND);

			// req. create race
			await ApexConsumerDeployed.fulfillMetaData(
				reqIdCreateRace,
				eventId,
				betType,
				eventName,
				game1qualifyingStartTime,
				game1raceStartTime,
				sportFormula1,
				{ from: wrapper }
			);
			assert.equal(true, await ApexConsumerDeployed.raceFulfilledCreated(eventId));

			// req. create game
			await ApexConsumerDeployed.fulfillMatchup(
				reqIdCreateGame,
				game1homeTeam,
				game1awayTeam,
				game1homeOdds,
				game1awayOdds,
				gameid1,
				sportFormula1,
				eventId,
				{ from: wrapper }
			);
			assert.equal(true, await ApexConsumerDeployed.gameFulfilledCreated(gameid1));

			// create market
			await ApexConsumerDeployed.createMarketForGame(gameid1, {
				from: owner,
			});
			let marketAddress = await ApexConsumerDeployed.marketPerGameId(gameid1);
			assert.equal(true, await ApexConsumerDeployed.marketCreated(marketAddress));

			let answer = await SportPositionalMarketManager.getActiveMarketAddress('0');
			deployedMarket = await SportPositionalMarketContract.at(answer);

			assert.equal(false, await deployedMarket.canResolve());

			await fastForward(game1qualifyingStartTime - (await currentTime()) + 3 * HOUR);

			assert.equal(true, await deployedMarket.canResolve());

			await expect(
				ApexConsumerDeployed.resolveMarketManually(marketAddress, 2, 1, 1, { from: second })
			).to.be.revertedWith('Invalid caller');
			await expect(
				ApexConsumerDeployed.resolveMarketManually(marketAddress, 4, 1, 1, { from: third })
			).to.be.revertedWith('Bad result or outcome');
			await expect(
				ApexConsumerDeployed.resolveMarketManually(marketAddress, 2, 2, 1, { from: third })
			).to.be.revertedWith('Bad result or outcome');
			await expect(
				ApexConsumerDeployed.resolveMarketManually(marketAddress, 2, 1, 1, { from: third })
			).to.be.revertedWith('Bad result or outcome');
			await expect(
				ApexConsumerDeployed.resolveMarketManually(marketAddress, 1, 1, 1, { from: third })
			).to.be.revertedWith('Bad result or outcome');
			await expect(
				ApexConsumerDeployed.resolveMarketManually(marketAddress, 1, 1, 2, { from: third })
			).to.be.revertedWith('Bad result or outcome');
			await expect(
				ApexConsumerDeployed.resolveMarketManually(marketAddress, 0, 1, 1, { from: third })
			).to.be.revertedWith('Bad result or outcome');
			await expect(
				ApexConsumerDeployed.resolveMarketManually(second, outcomeAwayWin, loseScore, winScore, {
					from: third,
				})
			).to.be.revertedWith('No market created for game');

			const txResolveGame = await ApexConsumerDeployed.resolveMarketManually(
				marketAddress,
				outcomeAwayWin,
				loseScore,
				winScore,
				{
					from: third,
				}
			);

			const sportId = await ApexConsumerDeployed.supportedSportId(sportFormula1);

			// check if event is emited
			assert.eventEqual(txResolveGame.logs[0], 'GameResolved', {
				_requestId: gameid1,
				_sportId: sportId,
				_id: gameid1,
			});

			// check if event is emited
			assert.eventEqual(txResolveGame.logs[1], 'ResolveSportsMarket', {
				_marketAddress: marketAddress,
				_id: gameid1,
				_outcome: outcomeAwayWin,
			});

			await expect(
				ApexConsumerDeployed.resolveMarketManually(
					marketAddress,
					outcomeAwayWin,
					loseScore,
					winScore,
					{
						from: third,
					}
				)
			).to.be.revertedWith('Market resolved or canceled');
		});

		it('Resolve market manually (HOME WIN), check results', async () => {
			await fastForward(game1qualifyingStartTime - (await currentTime()) - SECOND);

			// req. create race
			await ApexConsumerDeployed.fulfillMetaData(
				reqIdCreateRace,
				eventId,
				betType,
				eventName,
				game1qualifyingStartTime,
				game1raceStartTime,
				sportFormula1,
				{ from: wrapper }
			);
			assert.equal(true, await ApexConsumerDeployed.raceFulfilledCreated(eventId));

			// req. create game
			await ApexConsumerDeployed.fulfillMatchup(
				reqIdCreateGame,
				game1homeTeam,
				game1awayTeam,
				game1homeOdds,
				game1awayOdds,
				gameid1,
				sportFormula1,
				eventId,
				{ from: wrapper }
			);
			assert.equal(true, await ApexConsumerDeployed.gameFulfilledCreated(gameid1));

			// create market
			await ApexConsumerDeployed.createMarketForGame(gameid1, {
				from: owner,
			});
			let marketAddress = await ApexConsumerDeployed.marketPerGameId(gameid1);
			assert.equal(true, await ApexConsumerDeployed.marketCreated(marketAddress));

			let answer = await SportPositionalMarketManager.getActiveMarketAddress('0');
			deployedMarket = await SportPositionalMarketContract.at(answer);

			assert.equal(false, await deployedMarket.canResolve());

			await fastForward(game1qualifyingStartTime - (await currentTime()) + 3 * HOUR);

			assert.equal(true, await deployedMarket.canResolve());
			await expect(
				ApexConsumerDeployed.resolveMarketManually(marketAddress, 2, 1, 2, { from: second })
			).to.be.revertedWith('Invalid caller');
			await expect(
				ApexConsumerDeployed.resolveMarketManually(marketAddress, 4, 0, 0, { from: third })
			).to.be.revertedWith('Bad result or outcome');
			await expect(
				ApexConsumerDeployed.resolveMarketManually(second, outcomeHomeWin, winScore, loseScore, {
					from: third,
				})
			).to.be.revertedWith('No market created for game');

			const txResolveMarket = await ApexConsumerDeployed.resolveMarketManually(
				marketAddress,
				outcomeHomeWin,
				winScore,
				loseScore,
				{
					from: third,
				}
			);

			const sportId = await ApexConsumerDeployed.supportedSportId(sportFormula1);

			// check if event is emited
			assert.eventEqual(txResolveMarket.logs[0], 'GameResolved', {
				_requestId: gameid1,
				_sportId: sportId,
				_id: gameid1,
			});

			// check if event is emited
			assert.eventEqual(txResolveMarket.logs[1], 'ResolveSportsMarket', {
				_marketAddress: marketAddress,
				_id: gameid1,
				_outcome: outcomeHomeWin,
			});

			await expect(
				ApexConsumerDeployed.resolveMarketManually(
					marketAddress,
					outcomeHomeWin,
					winScore,
					loseScore,
					{ from: third }
				)
			).to.be.revertedWith('Market resolved or canceled');
		});

		it('Cancel market manually, check results', async () => {
			await fastForward(game1qualifyingStartTime - (await currentTime()) - SECOND);

			// req. create race
			await ApexConsumerDeployed.fulfillMetaData(
				reqIdCreateRace,
				eventId,
				betType,
				eventName,
				game1qualifyingStartTime,
				game1raceStartTime,
				sportFormula1,
				{ from: wrapper }
			);
			assert.equal(true, await ApexConsumerDeployed.raceFulfilledCreated(eventId));

			// req. create game
			await ApexConsumerDeployed.fulfillMatchup(
				reqIdCreateGame,
				game1homeTeam,
				game1awayTeam,
				game1homeOdds,
				game1awayOdds,
				gameid1,
				sportFormula1,
				eventId,
				{ from: wrapper }
			);
			assert.equal(true, await ApexConsumerDeployed.gameFulfilledCreated(gameid1));

			// create market
			await ApexConsumerDeployed.createMarketForGame(gameid1, {
				from: owner,
			});
			let marketAddress = await ApexConsumerDeployed.marketPerGameId(gameid1);
			assert.equal(true, await ApexConsumerDeployed.marketCreated(marketAddress));

			let answer = await SportPositionalMarketManager.getActiveMarketAddress('0');
			deployedMarket = await SportPositionalMarketContract.at(answer);

			assert.equal(false, await deployedMarket.canResolve());

			await fastForward(await currentTime());

			await expect(
				ApexConsumerDeployed.cancelMarketManually(marketAddress, { from: second })
			).to.be.revertedWith('Invalid caller');
			await expect(
				ApexConsumerDeployed.cancelMarketManually(second, { from: third })
			).to.be.revertedWith('No market created for game');
			await expect(
				ApexConsumerDeployed.resolveMarketManually(marketAddress, 3, 0, 0, { from: third })
			).to.be.revertedWith('Bad result or outcome');

			const txCancelMarket = await ApexConsumerDeployed.cancelMarketManually(marketAddress, {
				from: third,
			});

			// check if event is emited
			assert.eventEqual(txCancelMarket.logs[0], 'CancelSportsMarket', {
				_marketAddress: marketAddress,
				_id: gameid1,
			});

			await expect(
				ApexConsumerDeployed.resolveMarketManually(
					marketAddress,
					outcomeHomeWin,
					winScore,
					loseScore,
					{
						from: third,
					}
				)
			).to.be.revertedWith('Market resolved or canceled');
			await expect(
				ApexConsumerDeployed.cancelMarketManually(marketAddress, { from: third })
			).to.be.revertedWith('Market resolved or canceled');
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

		it('Get odds per game, check results, valid odds', async () => {
			await fastForward(game1qualifyingStartTime - (await currentTime()) - SECOND);

			// req. create race
			await ApexConsumerDeployed.fulfillMetaData(
				reqIdCreateRace,
				eventId,
				betType,
				eventName,
				game1qualifyingStartTime,
				game1raceStartTime,
				sportFormula1,
				{ from: wrapper }
			);
			assert.equal(true, await ApexConsumerDeployed.raceFulfilledCreated(eventId));

			// req. create game
			const txCreateGame = await ApexConsumerDeployed.fulfillMatchup(
				reqIdCreateGame,
				game1homeTeam,
				game1awayTeam,
				game1homeOdds,
				game1awayOdds,
				gameid1,
				sportFormula1,
				eventId,
				{ from: wrapper }
			);
			assert.equal(true, await ApexConsumerDeployed.gameFulfilledCreated(gameid1));

			// create market
			await ApexConsumerDeployed.createMarketForGame(gameid1, {
				from: owner,
			});
			let marketAddress = await ApexConsumerDeployed.marketPerGameId(gameid1);
			assert.equal(true, await ApexConsumerDeployed.marketCreated(marketAddress));

			let answer = await SportPositionalMarketManager.getActiveMarketAddress('0');
			deployedMarket = await SportPositionalMarketContract.at(answer);

			let odds = await ApexConsumerDeployed.getOddsForGame(gameid1);
			assert.bnEqual(game1homeOdds, odds[0]);
			assert.bnEqual(game1awayOdds, odds[1]);
			assert.bnEqual(0, odds[2]);

			const parsedHomeNormalizedOdds = w3utils.toWei(game1homeNormalizedOdds.toString());
			const parsedAwayNormalizedOdds = w3utils.toWei(game1awayNormalizedOdds.toString());

			let normalizedOdds = await ApexConsumerDeployed.getNormalizedOdds(gameid1);
			assert.bnEqual(parsedHomeNormalizedOdds, normalizedOdds[0]);
			assert.bnEqual(parsedAwayNormalizedOdds, normalizedOdds[1]);
			assert.bnEqual(0, normalizedOdds[2]);

			let gameOdds = await ApexConsumerDeployed.gameOdds(gameid1);

			// check if event is emited
			assert.eventEqual(txCreateGame.logs[1], 'GameOddsAdded', {
				_requestId: reqIdCreateGame,
				_id: gameid1,
				_game: gameOdds,
			});
		});

		it('Get odds per game, check results, invalid odds, pause market, unpause once odds are valid', async () => {
			await fastForward(game1qualifyingStartTime - (await currentTime()) - SECOND);

			// req. create race
			await ApexConsumerDeployed.fulfillMetaData(
				reqIdCreateRace,
				eventId,
				betType,
				eventName,
				game1qualifyingStartTime,
				game1raceStartTime,
				sportFormula1,
				{ from: wrapper }
			);
			assert.equal(true, await ApexConsumerDeployed.raceFulfilledCreated(eventId));

			// req. create game.
			await ApexConsumerDeployed.fulfillMatchup(
				reqIdCreateGame,
				game1homeTeam,
				game1awayTeam,
				game1homeOdds,
				game1awayOdds,
				gameid1,
				sportFormula1,
				eventId,
				{ from: wrapper }
			);
			assert.equal(true, await ApexConsumerDeployed.gameFulfilledCreated(gameid1));

			let odds = await ApexConsumerDeployed.getOddsForGame(gameid1);
			assert.bnEqual(game1homeOdds, odds[0]);
			assert.bnEqual(game1awayOdds, odds[1]);
			assert.bnEqual(0, odds[2]);

			// create market
			await ApexConsumerDeployed.createMarketForGame(gameid1, {
				from: owner,
			});
			let marketAddress = await ApexConsumerDeployed.marketPerGameId(gameid1);
			assert.equal(true, await ApexConsumerDeployed.marketCreated(marketAddress));

			let answer = await SportPositionalMarketManager.getActiveMarketAddress('0');
			deployedMarket = await SportPositionalMarketContract.at(answer);

			assert.equal(false, await deployedMarket.paused());

			// invalid odds - zero as homeOdds
			const txGetInvalidOdds = await ApexConsumerDeployed.fulfillMatchup(
				reqIdCreateGame,
				game1homeTeam,
				game1awayTeam,
				invalidOdds,
				game1awayOdds,
				gameid1,
				sportFormula1,
				eventId,
				{ from: wrapper }
			);

			assert.equal(true, await deployedMarket.paused());
			assert.equal(true, await ApexConsumerDeployed.invalidOdds(marketAddress));

			let gameOdds = await ApexConsumerDeployed.gameOdds(gameid1);
			let newOdds = {
				gameId: gameOdds.gameId,
				homeOdds: toBN(invalidOdds),
				awayOdds: gameOdds.awayOdds,
				drawOdds: gameOdds.drawOdds,
			};

			// check if event is emited
			assert.eventEqual(txGetInvalidOdds.logs[1], 'InvalidOddsForMarket', {
				_requestId: reqIdCreateGame,
				_id: gameid1,
				_game: newOdds,
			});

			// valid odds
			const txGetValidOdds = await ApexConsumerDeployed.fulfillMatchup(
				reqIdCreateGame,
				game1homeTeam,
				game1awayTeam,
				game1homeOdds,
				game1awayOdds,
				gameid1,
				sportFormula1,
				eventId,
				{ from: wrapper }
			);

			assert.equal(false, await deployedMarket.paused());
			assert.equal(false, await ApexConsumerDeployed.invalidOdds(marketAddress));

			let validGameOdds = await ApexConsumerDeployed.gameOdds(gameid1);

			// check if event is emited
			assert.eventEqual(txGetValidOdds.logs[1], 'GameOddsAdded', {
				_requestId: reqIdCreateGame,
				_id: gameid1,
				_game: validGameOdds,
			});
		});
	});

	describe('Consumer management', () => {
		it('Test owner functions', async () => {
			// ====== setSupportedSport ======
			await expect(
				ApexConsumerDeployed.setSupportedSport(sportFootball, false, { from: wrapper })
			).to.be.revertedWith('Only the contract owner may perform this action');
			await expect(
				ApexConsumerDeployed.setSupportedSport(sportFormula1, true, { from: owner })
			).to.be.revertedWith('Already set');

			const txSupportedSport = await ApexConsumerDeployed.setSupportedSport(sportFootball, true, {
				from: owner,
			});
			// check if event is emited
			assert.eventEqual(txSupportedSport.logs[0], 'SupportedSportsChanged', {
				_sport: sportFootball,
				_isSupported: true,
			});
			assert.equal(true, await ApexConsumerDeployed.isSupportedSport(sportFootball));

			// ====== setSportContracts ======
			await expect(
				ApexConsumerDeployed.setSportContracts(first, second, { from: wrapper })
			).to.be.revertedWith('Only the contract owner may perform this action');
			await expect(
				ApexConsumerDeployed.setSportContracts(ZERO_ADDRESS, ZERO_ADDRESS, {
					from: owner,
				})
			).to.be.revertedWith('Invalid addreses');

			const txSportsManager = await ApexConsumerDeployed.setSportContracts(first, second, {
				from: owner,
			});
			// check if event is emited
			assert.eventEqual(txSportsManager.logs[0], 'NewSportContracts', {
				_wrapperAddress: first,
				_sportsManager: second,
			});
			assert.equal(first, await ApexConsumerDeployed.wrapperAddress());
			assert.equal(second, await ApexConsumerDeployed.sportsManager());

			// ====== addToWhitelist ======
			await expect(
				ApexConsumerDeployed.addToWhitelist(first, false, { from: wrapper })
			).to.be.revertedWith('Only the contract owner may perform this action');
			await expect(
				ApexConsumerDeployed.addToWhitelist(owner, true, { from: owner })
			).to.be.revertedWith('Already set to that flag');
			await expect(
				ApexConsumerDeployed.addToWhitelist(ZERO_ADDRESS, true, { from: owner })
			).to.be.revertedWith('Invalid address');

			const txAddToWhitelist = await ApexConsumerDeployed.addToWhitelist(first, true, {
				from: owner,
			});
			// check if event is emited
			assert.eventEqual(txAddToWhitelist.logs[0], 'AddedIntoWhitelist', {
				_whitelistAddress: first,
				_flag: true,
			});
			assert.equal(true, await ApexConsumerDeployed.whitelistedAddresses(first));
		});
	});
});
