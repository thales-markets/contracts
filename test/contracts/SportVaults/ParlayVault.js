'use strict';

const { artifacts, contract, web3 } = require('hardhat');
const { toBN } = web3.utils;

const { assert } = require('../../utils/common');

const SECOND = 1000;
const DAY = 86400;
const WEEK = 604800;

const hour = 60 * 60;
const day = 24 * 60 * 60;

const { fastForward, toUnit, fromUnit, currentTime } = require('../../utils')();

contract('Parlay Vault', (accounts) => {
	const [manager, first, owner, second, third, fourth, safeBox, wrapper] = accounts;

	const ZERO_ADDRESS = '0x' + '0'.repeat(40);

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

	let parlayAMMfee = toUnit('0.05');
	let safeBoxImpact = toUnit('0.02');
	let minUSDAmount = '10';
	let maxSupportedAmount = '20000';
	let maxSupportedOdd = '0.005';

	const usdcQuantity = toBN(10000 * 1e6); //100 USDC
	let parlayMarkets = [];
	let equalParlayMarkets = [];
	let parlayPositions = [];
	let parlayPositions2 = [];
	let parlaySingleMarketAddress;
	let parlaySingleMarket;
	let voucher;

	let sportsAMMUtils;

	let rewardTokenAddress;
	let Vault, vault;

	async function createMarkets() {
		await fastForward(game1NBATime - (await currentTime()) - SECOND);
		console.log('create markets', await currentTime());
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
		answer = await SportPositionalMarketManager.getActiveMarketAddress('7');
		let deployedMarket_5 = await SportPositionalMarketContract.at(answer);

		// check if event is emited

		assert.eventEqual(tx_create_4.logs[4], 'CreateSportsMarket', {
			_marketAddress: marketAdd_4,
			_id: gameFootballid1,
			_game: game_4,
		});

		assert.equal(deployedMarket_4.address, marketAdd_4);
		assert.equal(deployedMarket_5.address, marketAdd_5);

		answer = await SportPositionalMarketManager.numActiveMarkets();
		assert.equal(answer.toString(), '11');
		// await fastForward(await currentTime());

		// assert.equal(true, await deployedMarket_1.canResolve());
		// assert.equal(true, await deployedMarket_2.canResolve());
		// assert.equal(true, await deployedMarket_3.canResolve());
		// assert.equal(true, await deployedMarket_4.canResolve());
		// assert.equal(true, await deployedMarket_5.canResolve());

		// console.log('parlay 1: ', deployedMarket_1.address);
		// console.log('parlay 2: ', deployedMarket_2.address);
		// console.log('parlay 3: ', deployedMarket_3.address);
		// console.log('parlay 4: ', deployedMarket_4.address);

		parlayMarkets = [deployedMarket_1, deployedMarket_5, deployedMarket_4];
		equalParlayMarkets = [deployedMarket_1, deployedMarket_2, deployedMarket_4];
	}

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

		await SportPositionalMarketManager.setExpiryDuration(30 * DAY, { from: manager });

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
		await SportPositionalMarketManager.setIsDoubleChanceSupported(true, { from: manager });
		await SportPositionalMarketManager.setSupportedSportForDoubleChance([sportId_16], true, {
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

		rewardTokenAddress = owner;

		Vault = artifacts.require('ParlayVault');
		vault = await Vault.new();

		await vault.initialize({
			_owner: owner,
			_parlayAMM: ParlayAMM.address,
			_sUSD: Thales.address,
			_roundLength: day,
			_priceLowerLimit: toUnit(0).toString(),
			_priceUpperLimit: toUnit(1).toString(),
			_skewImpactLimit: toUnit(0.1).toString(), // 10%
			_maxAllowedDeposit: toUnit(1000).toString(), // 20%
			_utilizationRate: toUnit(0.5).toString(),
			_maxTradeRate: toUnit(0.02).toString(),
			_minDepositAmount: toUnit(100).toString(),
			_maxAllowedUsers: 100,
			_minTradeAmount: toUnit(10).toString(),
			_maxMarketUsedInRoundCount: 2,
		});

		await vault.setMaxAllowedUsers(100, { from: owner });
		await vault.setMinAllowedDeposit(toUnit(100), { from: owner });
		await vault.setMaxAllowedDeposit(toUnit(1000), { from: owner });
		await vault.setUtilizationRate(toUnit(0.5), { from: owner });
		await vault.setRoundLength(day, { from: owner });
		await vault.setParlayAMM(ParlayAMM.address, { from: owner });
		await vault.setSkewImpactLimit(toUnit(0.3), { from: owner });
		await vault.setMinTradeAmount(toUnit(10), { from: owner });
		await vault.setPriceLimits(toUnit(0), toUnit(1), { from: owner });

		await Thales.approve(vault.address, toUnit('100000'), { from: first });
		await Thales.approve(vault.address, toUnit('100000'), { from: second });
		await Thales.approve(vault.address, toUnit('100000'), { from: third });

		await StakingThales.setSupportedSportVault(vault.address, true, { from: owner });
		await StakingThales.startStakingPeriod({ from: owner });
		await vault.setStakingThales(StakingThales.address, { from: owner });

		await ParlayAMM.setSafeBoxFeePerAddress(vault.address, toUnit('0.005'), {
			from: owner,
		});

		await SportsAMM.setMinSpreadPerAddress(vault.address, toUnit('0.005'), {
			from: owner,
		});
	});

	describe('Test parlays vault', () => {
		it('BuyQuote for Parlay', async () => {
			await createMarkets();
			await fastForward(game1NBATime - (await currentTime()) - SECOND);
			answer = await SportPositionalMarketManager.numActiveMarkets();
			assert.equal(answer.toString(), '11');
			let totalSUSDToPay = toUnit('10');
			parlayPositions = ['1', '1', '1'];
			parlayPositions2 = ['1', '1'];
			let parlayMarketsAddress = [];
			let parlayMarketsAddress2 = [];
			for (let i = 0; i < parlayMarkets.length; i++) {
				parlayMarketsAddress[i] = parlayMarkets[i].address;
				parlayMarketsAddress2[i] = parlayMarkets[i].address;
			}

			parlayMarketsAddress2.pop();

			let result = await ParlayAMM.buyQuoteFromParlay(
				parlayMarketsAddress,
				parlayPositions,
				totalSUSDToPay
			);

			let result2 = await ParlayAMM.buyQuoteFromParlay(
				parlayMarketsAddress2,
				parlayPositions2,
				totalSUSDToPay
			);
			console.log('----------------------THREE PARLAY QUOTE-----------------------------');
			console.log('sUSDAfterFees: ', fromUnit(result.sUSDAfterFees));
			console.log('totalQuote: ', fromUnit(result.totalQuote));
			console.log('totalBuyAmount: ', fromUnit(result.totalBuyAmount));
			console.log('initialQuote: ', fromUnit(result.initialQuote));
			console.log('skewImpact: ', fromUnit(result.skewImpact));

			for (let i = 0; i < result.finalQuotes.length; i++) {
				console.log('finalQuote', i, fromUnit(result.finalQuotes[i]));
				console.log('amountToBuy', i, fromUnit(result.amountsToBuy[i]));
			}

			console.log('----------------------TWO PARLAY QUOTE-----------------------------');

			console.log('sUSDAfterFees: ', fromUnit(result2.sUSDAfterFees));
			console.log('totalQuote: ', fromUnit(result2.totalQuote));
			console.log('totalBuyAmount: ', fromUnit(result2.totalBuyAmount));
			console.log('initialQuote: ', fromUnit(result2.initialQuote));
			console.log('skewImpact: ', fromUnit(result2.skewImpact));

			for (let i = 0; i < result2.finalQuotes.length; i++) {
				console.log('finalQuote', i, fromUnit(result2.finalQuotes[i]));
				console.log('amountToBuy', i, fromUnit(result2.amountsToBuy[i]));
			}
		});

		it('Check init', async () => {
			let round = await vault.round();
			console.log('round is:' + round.toString());

			let maxAllowedUsers = await vault.maxAllowedUsers();
			console.log('maxAllowedUsers is:' + maxAllowedUsers.toString());

			let minDepositAmount = await vault.minDepositAmount();
			console.log('minDepositAmount is:' + minDepositAmount.toString() / 1e18);

			let utilizationRate = await vault.utilizationRate();
			console.log('utilizationRate is:' + utilizationRate.toString() / 1e18);

			let maxAllowedDeposit = await vault.maxAllowedDeposit();
			console.log('maxAllowedDeposit is:' + maxAllowedDeposit.toString() / 1e18);

			let skewImpactLimit = await vault.skewImpactLimit();
			console.log('skewImpactLimit is:' + skewImpactLimit.toString() / 1e18);

			let priceUpperLimit = await vault.priceUpperLimit();
			console.log('priceUpperLimit is:' + priceUpperLimit.toString() / 1e18);

			let priceLowerLimit = await vault.priceLowerLimit();
			console.log('priceLowerLimit is:' + priceLowerLimit.toString() / 1e18);

			let roundLength = await vault.roundLength();
			console.log('roundLength is:' + roundLength / day + ' days');
		});

		it('Vault creation', async () => {
			let round = await vault.round();
			console.log('round is:' + round.toString());

			let vaultStarted = await vault.vaultStarted();
			console.log('vaultStarted is:' + vaultStarted);

			await vault.deposit(toUnit(100), { from: first });

			let volume = await StakingThales.getAMMVolume(first);
			console.log('volume first is:' + volume / 1e18);

			volume = await StakingThales.getAMMVolume(second);
			console.log('volume second is:' + volume / 1e18);

			round = 1;
			assert.bnEqual(await vault.getBalancesPerRound(round, first), toUnit(100));

			assert.bnEqual(await Thales.balanceOf(vault.address), toUnit(100));
			assert.bnEqual(await vault.allocationPerRound(round), toUnit(100));
			assert.bnEqual(await vault.capPerRound(round), toUnit(100));

			assert.bnEqual(await vault.allocationPerRound(0), 0);
			assert.bnEqual(await vault.allocationPerRound(2), 0);

			let usersCurrentlyInVault = await vault.usersCurrentlyInVault();
			console.log('usersCurrentlyInVault is:' + usersCurrentlyInVault);

			await vault.startVault({ from: owner });
			round = 2;
			await vault.deposit(toUnit(200), { from: second });
			assert.bnEqual(await vault.getBalancesPerRound(round, first), 0);
			assert.bnEqual(await vault.getBalancesPerRound(round, second), toUnit(200));

			assert.bnEqual(await Thales.balanceOf(vault.address), toUnit(300));
			assert.bnEqual(await vault.allocationPerRound(round), toUnit(200));
			assert.bnEqual(await vault.capPerRound(round), toUnit(300));

			await assert.revert(
				vault.deposit(toUnit(1000), { from: first }),
				'Deposit amount exceeds vault cap'
			);
			await assert.revert(vault.deposit(toUnit(10), { from: first }), 'Invalid amount');

			usersCurrentlyInVault = await vault.usersCurrentlyInVault();
			console.log('usersCurrentlyInVault is:' + usersCurrentlyInVault);

			await fastForward(day);
			// CLOSE ROUND #1 - START ROUND #2
			await vault.closeRound();

			volume = await StakingThales.getAMMVolume(first);
			console.log('volume first round 2 is:' + volume / 1e18);

			volume = await StakingThales.getAMMVolume(second);
			console.log('volume second round 2 is:' + volume / 1e18);

			await StakingThales.delegateVolume(second, { from: first });

			round = 2;
			assert.bnEqual(await vault.getBalancesPerRound(round, first), toUnit(100));
			assert.bnEqual(await vault.getBalancesPerRound(round, second), toUnit(200));
			assert.bnEqual(await Thales.balanceOf(vault.address), toUnit(300));

			await vault.withdrawalRequest({ from: second });
			assert.bnEqual(await vault.capPerRound(3), toUnit(100));
			usersCurrentlyInVault = await vault.usersCurrentlyInVault();
			console.log('usersCurrentlyInVault is:' + usersCurrentlyInVault);

			await fastForward(day);
			// CLOSE ROUND #2 - START ROUND #3
			await vault.closeRound();

			volume = await StakingThales.getAMMVolume(first);
			console.log('volume first round 3 is:' + volume / 1e18);

			volume = await StakingThales.getAMMVolume(second);
			console.log('volume second round 3 is:' + volume / 1e18);
			round = 3;
			assert.bnEqual(await vault.getBalancesPerRound(round, first), toUnit(100));
			assert.bnEqual(await vault.getBalancesPerRound(round, second), 0);
			assert.bnEqual(await Thales.balanceOf(vault.address), toUnit(100));
			assert.bnEqual(await vault.allocationPerRound(round), toUnit(100));

			usersCurrentlyInVault = await vault.usersCurrentlyInVault();
			console.log('usersCurrentlyInVault is:' + usersCurrentlyInVault);

			await assert.revert(vault.withdrawalRequest({ from: second }), 'Nothing to withdraw');

			await vault.withdrawalRequest({ from: first });

			await fastForward(day);
			// CLOSE ROUND #3 - START ROUND #4
			await vault.closeRound();
			round = 4;
			assert.bnEqual(await vault.getBalancesPerRound(round, first), 0);
			assert.bnEqual(await vault.getBalancesPerRound(round, second), 0);
			assert.bnEqual(await Thales.balanceOf(vault.address), 0);
			assert.bnEqual(await vault.allocationPerRound(round), 0);
			usersCurrentlyInVault = await vault.usersCurrentlyInVault();
			console.log('usersCurrentlyInVault is:' + usersCurrentlyInVault);

			await vault.deposit(toUnit(200), { from: second });
			await vault.deposit(toUnit(300), { from: first });

			await fastForward(day);
			// CLOSE ROUND #4 - START ROUND #5
			await vault.closeRound();

			await vault.deposit(toUnit(100), { from: second });
			await assert.revert(
				vault.withdrawalRequest({ from: second }),
				"Can't withdraw as you already deposited for next round"
			);

			await fastForward(day);
			// CLOSE ROUND #5 - START ROUND #6
			await vault.closeRound();

			// await fastForward(game1NBATime - (await currentTime()) - SECOND);

			let roundLength = await vault.roundLength();
			console.log('roundLength is:' + roundLength);

			round = await vault.round();
			console.log('round is:' + round);

			let roundStartTime = await vault.roundStartTime(round);
			console.log('roundStartTime is:' + roundStartTime);

			//await createMarkets();

			await fastForward(day);
			// CLOSE ROUND #6 - START ROUND #7
			await vault.closeRound();
			round = await vault.round();
			console.log('round is:' + round);
			roundStartTime = await vault.roundStartTime(round);
			console.log('roundStartTime is:' + roundStartTime);

			let getCurrentRoundEnd = await vault.getCurrentRoundEnd();
			console.log('getCurrentRoundEnd is:' + getCurrentRoundEnd);

			let allocationSpentInARound = await vault.allocationSpentInARound(round);
			console.log('allocationSpentInARound is:' + allocationSpentInARound / 1e18);

			allocationSpentInARound = await vault.allocationSpentInARound(round);
			console.log('allocationSpentInARound is:' + allocationSpentInARound / 1e18);

			let canCloseCurrentRound = await vault.canCloseCurrentRound();
			console.log('canCloseCurrentRound is:' + canCloseCurrentRound);

			await fastForward(day);
			canCloseCurrentRound = await vault.canCloseCurrentRound();
			console.log('canCloseCurrentRound is:' + canCloseCurrentRound);

			canCloseCurrentRound = await vault.canCloseCurrentRound();
			console.log('canCloseCurrentRound is:' + canCloseCurrentRound);

			let balanceFirst = await vault.getBalancesPerRound(round, first);
			console.log('balanceFirst is:' + balanceFirst / 1e18);

			let balanceSecond = await vault.getBalancesPerRound(round, second);
			console.log('balanceSecond is:' + balanceSecond / 1e18);

			let balanceVault = await Thales.balanceOf(vault.address);
			console.log('balanceVault is:' + balanceVault / 1e18);

			let profitAndLossPerRound = await vault.profitAndLossPerRound(round - 1);
			console.log('profitAndLossPerRound is:' + profitAndLossPerRound / 1e18);

			await fastForward(day);
			await vault.closeRound();

			round = await vault.round();
			console.log('round is:' + round);

			balanceFirst = await vault.getBalancesPerRound(round, first);
			console.log('balanceFirst is:' + balanceFirst / 1e18);

			balanceSecond = await vault.getBalancesPerRound(round, second);
			console.log('balanceSecond is:' + balanceSecond / 1e18);

			balanceVault = await Thales.balanceOf(vault.address);
			console.log('balanceVault is:' + balanceVault / 1e18);

			profitAndLossPerRound = await vault.profitAndLossPerRound(round - 1);
			console.log('profitAndLossPerRound is:' + profitAndLossPerRound / 1e18);

			volume = await StakingThales.getAMMVolume(first);
			console.log('volume first is:' + volume / 1e18);

			volume = await StakingThales.getAMMVolume(second);
			console.log('volume second is:' + volume / 1e18);
		});

		it('Vault trade', async () => {
			await fastForward(game1NBATime - (await currentTime()) - SECOND);

			let round = await vault.round();
			console.log('round is:' + round.toString());

			let vaultStarted = await vault.vaultStarted();
			console.log('vaultStarted is:' + vaultStarted);

			await vault.deposit(toUnit(300), { from: first });
			await vault.deposit(toUnit(300), { from: second });

			await createMarkets();

			round = 1;

			let usersCurrentlyInVault = await vault.usersCurrentlyInVault();
			console.log('usersCurrentlyInVault is:' + usersCurrentlyInVault);

			await vault.startVault({ from: owner });
			round = await vault.round();
			console.log('round is:' + round.toString());

			usersCurrentlyInVault = await vault.usersCurrentlyInVault();
			console.log('usersCurrentlyInVault is:' + usersCurrentlyInVault);

			let roundStartTime1 = await vault.roundStartTime(round);
			console.log('roundStartTime ROUND 1 is:' + roundStartTime1);
			console.log('roundENDTime ROUND 1 is:' + (await vault.getCurrentRoundEnd()));

			assert.bnEqual(await vault.getBalancesPerRound(round, first), toUnit(300));
			assert.bnEqual(await vault.getBalancesPerRound(round, second), toUnit(300));
			assert.bnEqual(await Thales.balanceOf(vault.address), toUnit(600));

			let balanceVault = await Thales.balanceOf(vault.address);
			console.log('balanceVault before trade is:' + balanceVault / 1e18);

			await fastForward(game1NBATime - (await currentTime()) - SECOND);

			let totalSUSDToPay = toUnit('10');
			parlayPositions = ['1', '1', '1'];
			parlayPositions2 = ['1', '1'];
			let parlayMarketsAddress = [];
			let parlayMarketsAddress2 = [];
			for (let i = 0; i < parlayMarkets.length; i++) {
				parlayMarketsAddress[i] = parlayMarkets[i].address;
				parlayMarketsAddress2[i] = parlayMarkets[i].address;

				console.log(parlayMarkets[i].address, (await parlayMarkets[i].times()).maturity / 1);
			}

			parlayMarketsAddress2.pop();
			let slippage = toUnit('0.01');

			let result = await ParlayAMM.buyQuoteFromParlay(
				parlayMarketsAddress,
				parlayPositions,
				totalSUSDToPay
			);
			console.log('first', fromUnit(result[0]));
			console.log('sUSDAfterFees: ', fromUnit(result.sUSDAfterFees));
			console.log('totalQuote: ', fromUnit(result.totalQuote));
			console.log('totalBuyAmount: ', fromUnit(result.totalBuyAmount));
			console.log('initialQuote: ', fromUnit(result.initialQuote));
			console.log('skewImpact: ', fromUnit(result.skewImpact));

			for (let i = 0; i < parlayMarkets.length; i++) {
				console.log(result.amountsToBuy[i] / 1e18);
				let buyFromAmmQuote = await SportsAMM.buyFromAmmQuote(
					parlayMarkets[i].address,
					1,
					result.amountsToBuy[i]
				);
				console.log('buyQuote: ', fromUnit(buyFromAmmQuote));

				let buyPriceImpactFirst = await SportsAMM.buyPriceImpact(
					parlayMarkets[i].address,
					1,
					result.amountsToBuy[i]
				);
				console.log('buyPriceImpact: ', fromUnit(buyPriceImpactFirst));
			}

			console.log('trading allocation', await vault.tradingAllocation());

			await assert.revert(
				vault.trade(parlayMarketsAddress, parlayPositions, totalSUSDToPay),
				'Amount exceeds max value per trade'
			);

			await vault.setMaxTradeRate(toUnit(0.04).toString(), { from: owner });

			await vault.trade(parlayMarketsAddress, parlayPositions, totalSUSDToPay);

			await assert.revert(
				vault.trade(parlayMarketsAddress, parlayPositions, totalSUSDToPay),
				'Parlay market already exists'
			);

			await vault.trade(parlayMarketsAddress2, parlayPositions2, totalSUSDToPay);
			await vault.trade(
				[parlayMarketsAddress[1], parlayMarketsAddress[2]],
				parlayPositions2,
				totalSUSDToPay
			);

			await vault.setMaxMarketUsedInRoundCount(1, { from: owner });

			await assert.revert(
				vault.trade(
					[parlayMarketsAddress[0], parlayMarketsAddress[2]],
					parlayPositions2,
					totalSUSDToPay
				),
				'Market is at the maximum number of tickets'
			);

			balanceVault = await Thales.balanceOf(vault.address);
			console.log('balanceVault after trade is:' + balanceVault / 1e18);

			let allocationSpentInARound = await vault.allocationSpentInARound(round);
			console.log('allocationSpentInARound is:' + allocationSpentInARound / 1e18);

			let canCloseCurrentRound = await vault.canCloseCurrentRound();
			console.log('canCloseCurrentRound is:' + canCloseCurrentRound);

			await fastForward(day);
			canCloseCurrentRound = await vault.canCloseCurrentRound();
			console.log('canCloseCurrentRound is:' + canCloseCurrentRound);

			await fastForward(fightTime - (await currentTime()) + 3 * hour);
			let resolveMatrix = ['2', '2', '2'];
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

			let activeParlays = await ParlayAMM.activeParlayMarkets('0', '100');
			parlaySingleMarketAddress = activeParlays[0];
			parlaySingleMarket = await ParlayMarketContract.at(activeParlays[0].toString());

			let answer = await parlaySingleMarket.isAnySportMarketResolved();
			result = await ParlayAMM.resolvableSportPositionsInParlay(parlaySingleMarket.address);
			assert.equal(answer.isResolved, true);
			assert.equal(result.isAnyResolvable, true);

			canCloseCurrentRound = await vault.canCloseCurrentRound();
			console.log('canCloseCurrentRound is:' + canCloseCurrentRound);

			let balanceFirst = await vault.getBalancesPerRound(round, first);
			console.log('balanceFirst is:' + balanceFirst / 1e18);

			let balanceSecond = await vault.getBalancesPerRound(round, second);
			console.log('balanceSecond is:' + balanceSecond / 1e18);

			balanceVault = await Thales.balanceOf(vault.address);
			console.log('balanceVault is:' + balanceVault / 1e18);

			let profitAndLossPerRound = await vault.profitAndLossPerRound(round - 1);
			console.log('profitAndLossPerRound is:' + profitAndLossPerRound / 1e18);

			await fastForward(day);
			await vault.closeRound();

			round = await vault.round();
			console.log('round is:' + round);

			balanceFirst = await vault.getBalancesPerRound(round, first);
			console.log('balanceFirst is:' + balanceFirst / 1e18);

			balanceSecond = await vault.getBalancesPerRound(round, second);
			console.log('balanceSecond is:' + balanceSecond / 1e18);

			balanceVault = await Thales.balanceOf(vault.address);
			console.log('balanceVault is:' + balanceVault / 1e18);

			profitAndLossPerRound = await vault.profitAndLossPerRound(round - 1);
			console.log('profitAndLossPerRound is:' + profitAndLossPerRound / 1e18);
		});
	});
});
