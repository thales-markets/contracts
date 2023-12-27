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
	getEventByName,
} = require('../../utils/helpers');

contract('SportsAMM DoubleChance', (accounts) => {
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
	const SportsAMMUtils = artifacts.require('SportsAMMUtils');

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
	let GamesOddsObtainerDeployed, SportAMMRiskManager;
	let emptyArray = [];

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
		SportsAMM,
		SportAMMLiquidityPool,
		multiCollateralOnOffRamp;

	const game1NBATime = 1646958600;
	const gameFootballTime = 1649876400;

	const sportId_4 = 4; // NBA
	const sportId_16 = 16; // CHL

	const tagID_4 = 9000 + sportId_4;
	const tagID_16 = 9000 + sportId_16;

	let gameMarket;

	const usdcQuantity = toBN(10000 * 1e6); //100 USDC

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
		// TestOdds = await TestOddsContract.new();
		await AddressResolver.setSNXRewardsAddress(SNXRewards.address);

		Thales = await ThalesContract.new({ from: owner });
		let GamesQueue = artifacts.require('GamesQueue');
		gamesQueue = await GamesQueue.new({ from: owner });
		await gamesQueue.initialize(owner, { from: owner });

		await SportPositionalMarketManager.initialize(manager, Thales.address, { from: manager });
		await SportPositionalMarketFactory.initialize(manager, { from: manager });

		await SportPositionalMarketManager.setExpiryDuration(5 * DAY, { from: manager });
		// await SportPositionalMarketManager.setCancelTimeout(2 * HOUR, { from: manager });
		await SportPositionalMarketManager.setIsDoubleChanceSupported(true, { from: manager });

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

		await SportPositionalMarketManager.setSupportedSportForDoubleChance(
			[10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
			true,
			{
				from: manager,
			}
		);
		Referrals = await ReferralsContract.new();
		await Referrals.initialize(owner, ZERO_ADDRESS, ZERO_ADDRESS, { from: owner });

		await SportsAMM.initialize(owner, Thales.address, toUnit('0.02'), toUnit('0.2'), DAY, {
			from: owner,
		});

		await SportsAMM.setParameters(
			DAY,
			toUnit('0.04'), //_minSpread
			toUnit('0.2'),
			toUnit('0.001'),
			toUnit('0.9'),
			toUnit('0.01'),
			toUnit('0.005'),
			toUnit('500000'),
			{ from: owner }
		);

		await SportsAMM.setSportsPositionalMarketManager(SportPositionalMarketManager.address, {
			from: owner,
		});

		sportsAMMUtils = await SportsAMMUtils.new(SportsAMM.address);
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
			second,
			second,
			SportsAMM.address,
			second,
			second,
			second,
			second,
			second,
			second,
			ZERO_ADDRESS,
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
			[sportId_4, sportId_16],
			SportPositionalMarketManager.address,
			[sportId_4],
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

		let GamesPlayerProps = artifacts.require('GamesPlayerProps');
		let GamesPlayerPropsDeployed = await GamesPlayerProps.new({ from: owner });
		await GamesPlayerPropsDeployed.initialize(
			owner,
			TherundownConsumerDeployed.address,
			verifier.address,
			SportPositionalMarketManager.address,
			fourth, // dummy at beggining
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
			GamesPlayerPropsDeployed.address,
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
		await SportPositionalMarketManager.setOddsObtainer(GamesOddsObtainerDeployed.address, {
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

		let MultiCollateralOnOffRamp = artifacts.require('MultiCollateralOnOffRamp');
		multiCollateralOnOffRamp = await MultiCollateralOnOffRamp.new();
		await multiCollateralOnOffRamp.initialize(owner, Thales.address);

		let MockPriceFeed = artifacts.require('MockPriceFeed');
		let MockPriceFeedDeployed = await MockPriceFeed.new(owner);
		await multiCollateralOnOffRamp.setPriceFeed(MockPriceFeedDeployed.address, { from: owner });
		await MockPriceFeedDeployed.setPricetoReturn(toUnit(1), { from: owner });

		await multiCollateralOnOffRamp.setSupportedAMM(SportsAMM.address, true, { from: owner });

		await multiCollateralOnOffRamp.setSupportedCollateral(testUSDC.address, true, { from: owner });

		await SportsAMM.setMultiCollateralOnOffRamp(multiCollateralOnOffRamp.address, true, {
			from: owner,
		});

		let CurveMock = artifacts.require('CurveMock');
		let curveMock = await CurveMock.new(
			Thales.address,
			testUSDC.address,
			testUSDC.address,
			testUSDC.address
		);

		await multiCollateralOnOffRamp.setCurveSUSD(
			curveMock.address,
			testUSDC.address,
			testUSDC.address,
			testUSDC.address,
			true,
			toUnit('0.01'),
			{ from: owner }
		);

		await Thales.transfer(curveMock.address, toUnit('1000'), { from: owner });

		let SportAMMLiquidityPoolContract = artifacts.require('SportAMMLiquidityPool');
		SportAMMLiquidityPool = await SportAMMLiquidityPoolContract.new();

		await SportAMMLiquidityPool.initialize(
			{
				_owner: owner,
				_sportsAmm: SportsAMM.address,
				_sUSD: Thales.address,
				_roundLength: WEEK,
				_maxAllowedDeposit: toUnit(10000000).toString(),
				_minDepositAmount: toUnit(100).toString(),
				_maxAllowedUsers: 100,
				_needsTransformingCollateral: false,
			},
			{ from: owner }
		);
		await SportAMMLiquidityPool.setUtilizationRate(toUnit(1), {
			from: owner,
		});

		let SportAMMRiskManagerContract = artifacts.require('SportAMMRiskManager');
		SportAMMRiskManager = await SportAMMRiskManagerContract.new();

		await SportAMMRiskManager.initialize(
			owner,
			SportPositionalMarketManager.address,
			toUnit('5000'),
			[tagID_4],
			[toUnit('50000')],
			emptyArray,
			emptyArray,
			emptyArray,
			3,
			[tagID_4],
			[5],
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
			SportAMMLiquidityPool.address,
			SportAMMRiskManager.address,
			{ from: owner }
		);

		let aMMLiquidityPoolRoundMastercopy = await SportAMMLiquidityPoolRoundMastercopy.new();
		await SportAMMLiquidityPool.setPoolRoundMastercopy(aMMLiquidityPoolRoundMastercopy.address, {
			from: owner,
		});
		await Thales.transfer(firstLiquidityProvider, toUnit('1000000'), { from: owner });
		await Thales.approve(SportAMMLiquidityPool.address, toUnit('1000000'), {
			from: firstLiquidityProvider,
		});
		await SportAMMLiquidityPool.setWhitelistedAddresses([firstLiquidityProvider], true, {
			from: owner,
		});
		await SportAMMLiquidityPool.deposit(toUnit(1000000), { from: firstLiquidityProvider });
		await SportAMMLiquidityPool.start({ from: owner });
		await SportAMMLiquidityPool.setDefaultLiquidityProvider(defaultLiquidityProvider, {
			from: owner,
		});
		await Thales.transfer(defaultLiquidityProvider, toUnit('1000000'), { from: owner });
		await Thales.approve(SportAMMLiquidityPool.address, toUnit('1000000'), {
			from: defaultLiquidityProvider,
		});

		await testUSDC.mint(first, toUnit(1000));
		await testUSDC.approve(SportsAMM.address, toUnit(1000), { from: first });
	});

	describe('Test double chance markets game', () => {
		let deployedMarket, homeTeamNotLoseMarket, awayTeamNotLoseMarket, noDrawMarket;
		let answer;
		beforeEach(async () => {
			let _currentTime = await currentTime();
			// await fastForward(game1NBATime - (await currentTime()) - SECOND);
			// await fastForward(gameFootballTime - (await currentTime()) - SECOND);
			await fastForward(game1NBATime - (await currentTime()) - SECOND);
			// console.log("Fast forward: ", (gameFootballTime - _currentTime - SECOND).toString());

			// req. games
			const tx = await TherundownConsumerDeployed.fulfillGamesCreated(
				reqIdFootballCreate,
				gamesFootballCreated,
				sportId_16,
				game1NBATime,
				{ from: wrapper }
			);

			let game = await TherundownConsumerDeployed.gameCreated(gameFootballid1);
			// console.log("Current time: ", _currentTime.toString());
			// console.log("Start time: ", game.startTime.toString());
			// console.log("Difference: ", (_currentTime - game.startTime).toString());

			// create markets
			const tx_create = await TherundownConsumerDeployed.createMarketForGame(gameFootballid1);

			let marketAdd = await TherundownConsumerDeployed.marketPerGameId(gameFootballid1);

			// check if event is emited
			let answer = await SportPositionalMarketManager.getActiveMarketAddress('0');
			let homeTeamNotLoseAnswer = await SportPositionalMarketManager.getActiveMarketAddress('1');
			let awayTeamNotLoseAnswer = await SportPositionalMarketManager.getActiveMarketAddress('2');
			let noDrawAnswer = await SportPositionalMarketManager.getActiveMarketAddress('3');
			// console.log("Active market: ", answer.toString());
			// console.log("Double chance market 1: ", homeTeamNotLoseAnswer.toString());
			// console.log("Double chance market 2: ", awayTeamNotLoseAnswer.toString());
			// console.log("Double chance market 3: ", noDrawAnswer.toString());
			deployedMarket = await SportPositionalMarketContract.at(answer);
			homeTeamNotLoseMarket = await SportPositionalMarketContract.at(homeTeamNotLoseAnswer);
			awayTeamNotLoseMarket = await SportPositionalMarketContract.at(awayTeamNotLoseAnswer);
			noDrawMarket = await SportPositionalMarketContract.at(noDrawAnswer);

			//console.log(await SportPositionalMarketManager.getDoubleChanceMarketsByParentMarket(answer));

			assert.equal(
				await SportPositionalMarketManager.doubleChanceMarketsByParent(answer, 0),
				homeTeamNotLoseAnswer
			);

			assert.equal(
				await SportPositionalMarketManager.doubleChanceMarketsByParent(answer, 1),
				awayTeamNotLoseAnswer
			);

			assert.equal(
				await SportPositionalMarketManager.doubleChanceMarketsByParent(answer, 2),
				noDrawAnswer
			);
		});

		let position = 0;
		let value = 100;

		it('Checking SportsAMM variables', async () => {
			assert.bnEqual(await SportsAMM.min_spread(), toUnit('0.04'));
			assert.bnEqual(await SportsAMM.max_spread(), toUnit('0.2'));
			assert.bnEqual(await SportsAMM.minimalTimeLeftToMaturity(), DAY);
		});

		it('Checking consumer team variables', async () => {
			// consumer.getGameCreatedById(consumer.gameIdPerMarket(_sportMarkets[_index])).homeTeam
			let gameIdPerMarket = await TherundownConsumerDeployed.gameIdPerMarket(
				homeTeamNotLoseMarket.address
			);

			console.log(
				'home team',
				(await TherundownConsumerDeployed.getGameCreatedById(gameIdPerMarket)).homeTeam
			);
			console.log(
				'away team',
				(await TherundownConsumerDeployed.getGameCreatedById(gameIdPerMarket)).awayTeam
			);
		});

		it('Toggle manager flag for dc creation', async () => {
			await SportPositionalMarketManager.setIsDoubleChanceSupported(false, { from: manager });

			console.log(
				'isDoubleChanceSupported',
				await SportPositionalMarketManager.isDoubleChanceSupported()
			);

			await fastForward(game1NBATime - (await currentTime()) - SECOND);
			await TherundownConsumerDeployed.fulfillGamesCreated(
				reqIdFootballCreate,
				gamesFootballCreated,
				sportId_16,
				game1NBATime,
				{ from: wrapper }
			);
			await TherundownConsumerDeployed.gameCreated(gameFootballid2);
			await TherundownConsumerDeployed.createMarketForGame(gameFootballid2);
			await TherundownConsumerDeployed.marketPerGameId(gameFootballid2);

			let answer = await SportPositionalMarketManager.getActiveMarketAddress('4');
			let markets = await SportPositionalMarketManager.getDoubleChanceMarketsByParentMarket(answer);
			assert.equal(markets.length, 0);

			await SportPositionalMarketManager.setIsDoubleChanceSupported(true, { from: manager });

			await fastForward(game1NBATime - (await currentTime()) - SECOND);
			await TherundownConsumerDeployed.fulfillGamesCreated(
				reqIdFootballCreate,
				gamesFootballCreated,
				sportId_16,
				game1NBATime,
				{ from: wrapper }
			);
			await TherundownConsumerDeployed.gameCreated(gameFootballid3);
			await TherundownConsumerDeployed.createMarketForGame(gameFootballid3);
			await TherundownConsumerDeployed.marketPerGameId(gameFootballid3);

			answer = await SportPositionalMarketManager.getActiveMarketAddress('5');

			markets = await SportPositionalMarketManager.getDoubleChanceMarketsByParentMarket(answer);
			assert.equal(markets.length, 3);
		});

		it('Create double chance market for parent', async () => {
			await SportPositionalMarketManager.setIsDoubleChanceSupported(false, { from: manager });

			await fastForward(game1NBATime - (await currentTime()) - SECOND);
			await TherundownConsumerDeployed.fulfillGamesCreated(
				reqIdFootballCreate,
				gamesFootballCreated,
				sportId_16,
				game1NBATime,
				{ from: wrapper }
			);
			await TherundownConsumerDeployed.gameCreated(gameFootballid2);
			await TherundownConsumerDeployed.createMarketForGame(gameFootballid2);
			await TherundownConsumerDeployed.marketPerGameId(gameFootballid2);

			let answer = await SportPositionalMarketManager.getActiveMarketAddress('4');
			let markets = await SportPositionalMarketManager.getDoubleChanceMarketsByParentMarket(answer);
			assert.equal(markets.length, 0);

			await SportPositionalMarketManager.setIsDoubleChanceSupported(true, { from: manager });

			await SportPositionalMarketManager.createDoubleChanceMarketsForParent(answer, {
				from: manager,
			});

			markets = await SportPositionalMarketManager.getDoubleChanceMarketsByParentMarket(answer);
			assert.equal(markets.length, 3);
		});

		it('Are double chance markets in AMM trading', async () => {
			answer = await SportsAMM.isMarketInAMMTrading(homeTeamNotLoseMarket.address);
			assert.equal(answer, true);
			answer = await SportsAMM.isMarketInAMMTrading(awayTeamNotLoseMarket.address);
			assert.equal(answer, true);
			answer = await SportsAMM.isMarketInAMMTrading(noDrawMarket.address);
			assert.equal(answer, true);
		});

		it('Market data test', async () => {
			let activeMarkets = await SportPositionalMarketData.getOddsForAllActiveMarkets();
			assert.bnEqual(activeMarkets.length, 4);
		});

		it('Pause market', async () => {
			assert.equal(await SportPositionalMarketManager.whitelistedAddresses(first), true);
			assert.equal(await SportPositionalMarketManager.whitelistedAddresses(second), false);
			assert.equal(await SportPositionalMarketManager.whitelistedAddresses(third), true);
			assert.equal(await SportPositionalMarketManager.whitelistedAddresses(fourth), false);

			await expect(
				SportPositionalMarketManager.setMarketPaused(deployedMarket.address, true, { from: fourth })
			).to.be.revertedWith('Invalid caller');

			await expect(
				SportPositionalMarketManager.setMarketPaused(homeTeamNotLoseMarket.address, true, {
					from: fourth,
				})
			).to.be.revertedWith('Invalid caller');

			await SportPositionalMarketManager.setMarketPaused(deployedMarket.address, true);
			await SportPositionalMarketManager.setMarketPaused(homeTeamNotLoseMarket.address, true);
			await SportPositionalMarketManager.setMarketPaused(awayTeamNotLoseMarket.address, true);
			await SportPositionalMarketManager.setMarketPaused(noDrawMarket.address, true);
			answer = await SportsAMM.isMarketInAMMTrading(deployedMarket.address);
			assert.equal(answer, false);

			answer = await SportsAMM.isMarketInAMMTrading(homeTeamNotLoseMarket.address);
			assert.equal(answer, false);
			answer = await SportsAMM.isMarketInAMMTrading(awayTeamNotLoseMarket.address);
			assert.equal(answer, false);
			answer = await SportsAMM.isMarketInAMMTrading(noDrawMarket.address);
			assert.equal(answer, false);

			await SportPositionalMarketManager.setMarketPaused(deployedMarket.address, false, {
				from: third,
			});

			await SportPositionalMarketManager.setMarketPaused(homeTeamNotLoseMarket.address, false, {
				from: third,
			});
			answer = await SportsAMM.isMarketInAMMTrading(deployedMarket.address);
			assert.equal(answer, true);

			answer = await SportsAMM.isMarketInAMMTrading(homeTeamNotLoseMarket.address);
			assert.equal(answer, true);
		});

		it('Get odds', async () => {
			answer = await SportsAMM.obtainOdds(deployedMarket.address, 0);
			let sumOfOdds = answer;
			console.log('Odds for pos 0: ', fromUnit(answer));
			answer = await SportsAMM.obtainOdds(deployedMarket.address, 1);
			sumOfOdds = sumOfOdds.add(answer);
			console.log('Odds for pos 1: ', fromUnit(answer));
			answer = await SportsAMM.obtainOdds(deployedMarket.address, 2);
			sumOfOdds = sumOfOdds.add(answer);
			console.log('Odds for pos 2: ', fromUnit(answer));
			console.log('Total odds: ', fromUnit(sumOfOdds));
		});

		it('Get odds double chance', async () => {
			console.log('HomeNotLose -> 1X -> Home + Draw');
			let parentMarketAnswer = await SportsAMM.obtainOdds(deployedMarket.address, 0);
			let sumOfOddsParent = parentMarketAnswer;
			parentMarketAnswer = await SportsAMM.obtainOdds(deployedMarket.address, 2);
			sumOfOddsParent = sumOfOddsParent.add(parentMarketAnswer);

			answer = await SportsAMM.obtainOdds(homeTeamNotLoseMarket.address, 0);
			console.log('Odds for pos 0: ', fromUnit(answer));
			console.log(
				'Odds for pos 1: ',
				fromUnit(await SportsAMM.obtainOdds(homeTeamNotLoseMarket.address, 1))
			);
			assert.equal(await SportsAMM.obtainOdds(homeTeamNotLoseMarket.address, 1), 0);

			assert.bnEqual(sumOfOddsParent, answer);

			console.log('AwayNotLose -> 2X -> Away + Draw');
			parentMarketAnswer = await SportsAMM.obtainOdds(deployedMarket.address, 1);
			sumOfOddsParent = parentMarketAnswer;
			parentMarketAnswer = await SportsAMM.obtainOdds(deployedMarket.address, 2);
			sumOfOddsParent = sumOfOddsParent.add(parentMarketAnswer);

			answer = await SportsAMM.obtainOdds(awayTeamNotLoseMarket.address, 0);
			console.log('Odds for pos 0: ', fromUnit(answer));
			console.log(
				'Odds for pos 1: ',
				fromUnit(await SportsAMM.obtainOdds(awayTeamNotLoseMarket.address, 1))
			);
			assert.equal(await SportsAMM.obtainOdds(awayTeamNotLoseMarket.address, 1), 0);

			assert.bnEqual(sumOfOddsParent, answer);

			console.log('NoDraw -> 12 -> Home + Away');
			parentMarketAnswer = await SportsAMM.obtainOdds(deployedMarket.address, 0);
			sumOfOddsParent = parentMarketAnswer;
			parentMarketAnswer = await SportsAMM.obtainOdds(deployedMarket.address, 1);
			sumOfOddsParent = sumOfOddsParent.add(parentMarketAnswer);

			answer = await SportsAMM.obtainOdds(noDrawMarket.address, 0);
			console.log('Odds for pos 0: ', fromUnit(answer));
			console.log(
				'Odds for pos 1: ',
				fromUnit(await SportsAMM.obtainOdds(noDrawMarket.address, 1))
			);
			assert.equal(await SportsAMM.obtainOdds(noDrawMarket.address, 1), 0);

			assert.bnEqual(sumOfOddsParent, answer);
		});

		it('Get Available to buy from SportsAMM, position 0', async () => {
			answer = await SportsAMM.availableToBuyFromAMM(deployedMarket.address, 0);
			console.log('Available to buy pos 0: ', fromUnit(answer));
		});

		it('Get Available to buy from SportsAMM, position 1', async () => {
			answer = await SportsAMM.availableToBuyFromAMM(deployedMarket.address, 1);
			console.log('Available to buy pos 1: ', fromUnit(answer));
		});

		it('Get Available to buy from SportsAMM, position 2', async () => {
			answer = await SportsAMM.availableToBuyFromAMM(deployedMarket.address, 2);
			console.log('Available to buy pos 2: ', fromUnit(answer));
		});

		it('Get Available to buy from SportsAMM - double chance', async () => {
			// HomeNotLose -> 1X -> min(1, X);
			answer = await SportsAMM.availableToBuyFromAMM(homeTeamNotLoseMarket.address, 0);
			console.log('Available to buy pos 0: ', fromUnit(answer));
			console.log(
				'Available to buy pos 1: ',
				fromUnit(await SportsAMM.availableToBuyFromAMM(homeTeamNotLoseMarket.address, 1))
			);
			let answer1 = await SportsAMM.availableToBuyFromAMM(deployedMarket.address, 0);
			let answer2 = await SportsAMM.availableToBuyFromAMM(deployedMarket.address, 2);

			console.log(Math.min(fromUnit(answer1), fromUnit(answer2)));
		});

		it('Test max odds - get Available to buy from SportsAMM', async () => {
			answer = await SportsAMM.availableToBuyFromAMM(homeTeamNotLoseMarket.address, 0);
			console.log('Available to buy with max odds 0.9 - pos 0: ', fromUnit(answer));

			await SportsAMM.setParameters(
				DAY,
				toUnit('0.04'), //_minSpread
				toUnit('0.2'),
				toUnit('0.001'),
				toUnit('0.1'),
				toUnit('0.01'),
				toUnit('0.005'),
				toUnit('500'),
				{ from: owner }
			);
			answer = await SportsAMM.availableToBuyFromAMM(homeTeamNotLoseMarket.address, 0);
			console.log('Available to buy with max odds 0.1 - pos 1: ', fromUnit(answer));
		});

		it('Get BuyQuote from SportsAMM, position 1, value: 100', async () => {
			answer = await SportsAMM.buyFromAmmQuote(deployedMarket.address, 1, toUnit(100));
			console.log('buyAMMQuote: ', fromUnit(answer));
		});

		it('Test max odds -  Get BuyQuote from SportsAMM - double chance, value: 100', async () => {
			answer = await SportsAMM.buyFromAmmQuote(homeTeamNotLoseMarket.address, 0, toUnit(100));
			console.log('buyAMMQuote max odds 0.9: ', fromUnit(answer));

			await SportsAMM.setParameters(
				DAY,
				toUnit('0.04'), //_minSpread
				toUnit('0.2'),
				toUnit('0.001'),
				toUnit('0.1'),
				toUnit('0.01'),
				toUnit('0.005'),
				toUnit('500'),
				{ from: owner }
			);

			answer = await SportsAMM.buyFromAmmQuote(homeTeamNotLoseMarket.address, 0, toUnit(100));
			console.log('buyAMMQuote max odds 0.1: ', fromUnit(answer));
		});

		it('Get BuyQuote from SportsAMM - double chance, value: 100', async () => {
			answer = await SportsAMM.buyFromAmmQuote(homeTeamNotLoseMarket.address, 1, toUnit(100));
			console.log('buyAMMQuote: ', fromUnit(answer));
		});

		it('Buy from SportsAMM - double chance, position 1, value: 100', async () => {
			let availableToBuy = await SportsAMM.availableToBuyFromAMM(homeTeamNotLoseMarket.address, 0);
			console.log('available to buy double chance', availableToBuy / 1e18);
			let additionalSlippage = toUnit(0.01);
			let buyFromAmmQuote = await SportsAMM.buyFromAmmQuote(
				homeTeamNotLoseMarket.address,
				0,
				toUnit(100)
			);
			answer = await Thales.balanceOf(first);
			let before_balance = answer;
			console.log('acc balance: ', fromUnit(answer));
			console.log('buyQuote: ', fromUnit(buyFromAmmQuote));
			answer = await SportsAMM.buyFromAMM(
				homeTeamNotLoseMarket.address,
				0,
				toUnit(100),
				buyFromAmmQuote,
				additionalSlippage,
				{ from: first }
			);
			answer = await Thales.balanceOf(first);
			console.log('acc after buy balance: ', fromUnit(answer));
			console.log('cost: ', fromUnit(before_balance.sub(answer)));
			let options = await homeTeamNotLoseMarket.balancesOf(first);
			console.log('Balances', fromUnit(options[0]), fromUnit(options[1]));
		});

		it('Test cancellation double chance, exercise for SportsAMM', async () => {
			position = 0;
			value = 100;
			let odds = [];
			odds[0] = await SportsAMM.obtainOdds(homeTeamNotLoseMarket.address, 0);
			odds[1] = await SportsAMM.obtainOdds(awayTeamNotLoseMarket.address, 0);
			odds[2] = await SportsAMM.obtainOdds(noDrawMarket.address, 0);
			console.log(
				'Game odds: homeTeamNotLoseMarket=',
				fromUnit(odds[0]),
				', awayTeamNotLoseMarket=',
				fromUnit(odds[1]),
				', noDrawMarket=',
				fromUnit(odds[2])
			);
			let optionsCount = await homeTeamNotLoseMarket.optionsCount();
			console.log('Positions count homeTeamNotLoseMarket: ', optionsCount.toString());
			optionsCount = await awayTeamNotLoseMarket.optionsCount();
			console.log('Positions count awayTeamNotLoseMarket: ', optionsCount.toString());
			optionsCount = await noDrawMarket.optionsCount();
			console.log('Positions count noDrawMarket: ', optionsCount.toString());

			answer = await Thales.balanceOf(first);
			console.log('Balance before buying: ', fromUnit(answer));
			console.log('Is parent cancelled: ', await deployedMarket.cancelled());

			let additionalSlippage = toUnit(0.01);
			let buyFromAmmQuote = await SportsAMM.buyFromAmmQuote(
				homeTeamNotLoseMarket.address,
				position,
				toUnit(value)
			);

			console.log('buy from amm quote homeTeamNotLoseMarket', buyFromAmmQuote / 1e18);
			answer = await SportsAMM.buyFromAMM(
				homeTeamNotLoseMarket.address,
				position,
				toUnit(value),
				buyFromAmmQuote,
				additionalSlippage,
				{ from: first }
			);

			buyFromAmmQuote = await SportsAMM.buyFromAmmQuote(
				awayTeamNotLoseMarket.address,
				0,
				toUnit(value)
			);

			console.log('buy from amm quote awayTeamNotLoseMarket', buyFromAmmQuote / 1e18);
			answer = await SportsAMM.buyFromAMM(
				awayTeamNotLoseMarket.address,
				0,
				toUnit(value),
				buyFromAmmQuote,
				additionalSlippage,
				{ from: first }
			);

			buyFromAmmQuote = await SportsAMM.buyFromAmmQuote(
				homeTeamNotLoseMarket.address,
				0,
				toUnit(value)
			);

			console.log('buy from amm quote homeTeamNotLoseMarket second', buyFromAmmQuote / 1e18);
			answer = await SportsAMM.buyFromAMM(
				homeTeamNotLoseMarket.address,
				0,
				toUnit(value),
				buyFromAmmQuote,
				additionalSlippage,
				{ from: second }
			);

			let cancelTx = await TherundownConsumerDeployed.resolveMarketManually(
				deployedMarket.address,
				0,
				0,
				0,
				false,
				{
					from: third,
				}
			);

			console.log('Is parent cancelled: ', await deployedMarket.cancelled());

			answer = await Thales.balanceOf(first);
			console.log('Balance after buying: ', fromUnit(answer));

			let balancesHomeTeamNotLose = await homeTeamNotLoseMarket.balancesOf(first);

			let payoutOnCancelationHomeTeamNotLose =
				await homeTeamNotLoseMarket.calculatePayoutOnCancellation(
					balancesHomeTeamNotLose[0],
					balancesHomeTeamNotLose[1],
					balancesHomeTeamNotLose[2]
				);

			console.log(
				'payoutOnCancelation first homeTeamNotLoseMarket',
				payoutOnCancelationHomeTeamNotLose / 1e18
			);

			let balancesAwayTeamNotLose = await homeTeamNotLoseMarket.balancesOf(first);

			let payoutOnCancelationAwayTeamNotLose =
				await awayTeamNotLoseMarket.calculatePayoutOnCancellation(
					balancesAwayTeamNotLose[0],
					balancesAwayTeamNotLose[1],
					balancesAwayTeamNotLose[2]
				);

			console.log(
				'payoutOnCancelation first awayTeamNotLoseMarket',
				payoutOnCancelationAwayTeamNotLose / 1e18
			);

			let balancesAMMHomeTeamNotLose = await homeTeamNotLoseMarket.balancesOf(SportsAMM.address);
			console.log(
				'Balances AMM homeTeamNotLoseMarket',
				balancesAMMHomeTeamNotLose[0] / 1e18,
				balancesAMMHomeTeamNotLose[1] / 1e18,
				balancesAMMHomeTeamNotLose[2] / 1e18
			);
			let payoutOnCancelationAMM = await homeTeamNotLoseMarket.calculatePayoutOnCancellation(
				balancesAMMHomeTeamNotLose[0],
				balancesAMMHomeTeamNotLose[1],
				balancesAMMHomeTeamNotLose[2]
			);

			console.log(
				'payoutOnCancelation sportsAMM homeTeamNotLoseMarket',
				payoutOnCancelationAMM / 1e18
			);

			let balances = await homeTeamNotLoseMarket.balancesOf(second);
			let payoutOnCancelation = await homeTeamNotLoseMarket.calculatePayoutOnCancellation(
				balances[0],
				balances[1],
				balances[2]
			);

			console.log('payoutOnCancelation second homeTeamNotLoseMarket', payoutOnCancelation / 1e18);
			balances = await deployedMarket.balancesOf(homeTeamNotLoseMarket.address);
			payoutOnCancelation = await deployedMarket.calculatePayoutOnCancellation(
				balances[0],
				balances[1],
				balances[2]
			);

			console.log(
				'homeTeamNotLoseMarket on deployedMarket balances',
				balances[0] / 1e18,
				balances[1] / 1e18,
				balances[2] / 1e18
			);
			console.log(
				'payoutOnCancelation on deployedMarket homeTeamNotLoseMArket',
				payoutOnCancelation / 1e18
			);

			balances = await deployedMarket.balancesOf(awayTeamNotLoseMarket.address);
			payoutOnCancelation = await deployedMarket.calculatePayoutOnCancellation(
				balances[0],
				balances[1],
				balances[2]
			);

			console.log(
				'awayTeamNotLoseMarket on deployedMarket balances',
				balances[0] / 1e18,
				balances[1] / 1e18,
				balances[2] / 1e18
			);
			console.log(
				'payoutOnCancelation on deployedMarket awayTeamNotLoseMarket',
				payoutOnCancelation / 1e18
			);

			answer = await Thales.balanceOf(first);
			console.log('Balance before exercise of first: ', fromUnit(answer));
			answer = await homeTeamNotLoseMarket.exerciseOptions({ from: first });
			answer = await awayTeamNotLoseMarket.exerciseOptions({ from: first });
			answer = await Thales.balanceOf(first);
			console.log('Balance after exercise of first: ', fromUnit(answer));

			answer = await Thales.balanceOf(second);
			console.log('Balance before exercise of second: ', fromUnit(answer));
			answer = await homeTeamNotLoseMarket.exerciseOptions({ from: second });
			answer = await Thales.balanceOf(second);
			console.log('Balance after exercise of second: ', fromUnit(answer));
		});

		it('Cannot resolve manually double chance', async () => {
			position = 0;
			value = 100;
			let odds = [];
			odds[0] = await SportsAMM.obtainOdds(homeTeamNotLoseMarket.address, 0);
			odds[1] = await SportsAMM.obtainOdds(awayTeamNotLoseMarket.address, 0);
			odds[2] = await SportsAMM.obtainOdds(noDrawMarket.address, 0);
			console.log(
				'Game odds: homeTeamNotLoseMarket=',
				fromUnit(odds[0]),
				', awayTeamNotLoseMarket=',
				fromUnit(odds[1]),
				', noDrawMarket=',
				fromUnit(odds[2])
			);

			let additionalSlippage = toUnit(0.05);
			let buyFromAmmQuote = await SportsAMM.buyFromAmmQuote(
				awayTeamNotLoseMarket.address,
				position,
				toUnit(value)
			);
			answer = await Thales.balanceOf(first);
			let initial_balance = answer;
			console.log('first acc sUSD balance before buy: ', fromUnit(answer));
			console.log('buyQuote: ', fromUnit(buyFromAmmQuote));
			answer = await SportsAMM.buyFromAMM(
				awayTeamNotLoseMarket.address,
				position,
				toUnit(value),
				buyFromAmmQuote,
				additionalSlippage,
				{ from: first }
			);

			let balances = await deployedMarket.balancesOf(awayTeamNotLoseMarket.address);
			console.log(
				'balances double chance',
				balances[0] / 1e18,
				balances[1] / 1e18,
				balances[2] / 1e18
			);

			balances = await awayTeamNotLoseMarket.balancesOf(first);
			console.log('balances first', balances[0] / 1e18, balances[1] / 1e18, balances[2] / 1e18);
			let cost;
			answer = await Thales.balanceOf(first);
			console.log('acc sUSD balance after buy: ', fromUnit(answer));
			cost = initial_balance.sub(answer);
			console.log('cost in sUSD: ', fromUnit(cost));

			await fastForward(await currentTime());

			assert.equal(true, await awayTeamNotLoseMarket.canResolve());

			const tx_2 = await TherundownConsumerDeployed.fulfillGamesResolved(
				reqIdResolve,
				gamesResolved,
				sportId_4,
				{ from: wrapper }
			);

			await assert.revert(
				SportPositionalMarketManager.resolveMarketWithResult(
					homeTeamNotLoseMarket.address,
					2,
					1,
					2,
					TherundownConsumerDeployed.address,
					false,
					{
						from: second,
					}
				),
				'Not supported for double chance markets'
			);

			await assert.revert(
				SportPositionalMarketManager.resolveMarket(homeTeamNotLoseMarket.address, 2, {
					from: second,
				}),
				'Not supported for double chance markets'
			);
		});

		it('Resolve manually, and claim double chance', async () => {
			position = 0;
			value = 100;
			let odds = [];
			odds[0] = await SportsAMM.obtainOdds(homeTeamNotLoseMarket.address, 0);
			odds[1] = await SportsAMM.obtainOdds(awayTeamNotLoseMarket.address, 0);
			odds[2] = await SportsAMM.obtainOdds(noDrawMarket.address, 0);
			console.log(
				'Game odds: homeTeamNotLoseMarket=',
				fromUnit(odds[0]),
				', awayTeamNotLoseMarket=',
				fromUnit(odds[1]),
				', noDrawMarket=',
				fromUnit(odds[2])
			);

			let additionalSlippage = toUnit(0.05);
			let buyFromAmmQuote = await SportsAMM.buyFromAmmQuote(
				awayTeamNotLoseMarket.address,
				position,
				toUnit(value)
			);
			answer = await Thales.balanceOf(first);
			let initial_balance = answer;
			console.log('first acc sUSD balance before buy: ', fromUnit(answer));
			console.log('buyQuote: ', fromUnit(buyFromAmmQuote));
			answer = await SportsAMM.buyFromAMM(
				awayTeamNotLoseMarket.address,
				position,
				toUnit(value),
				buyFromAmmQuote,
				additionalSlippage,
				{ from: first }
			);

			let balances = await deployedMarket.balancesOf(awayTeamNotLoseMarket.address);
			console.log(
				'balances double chance',
				balances[0] / 1e18,
				balances[1] / 1e18,
				balances[2] / 1e18
			);

			balances = await awayTeamNotLoseMarket.balancesOf(first);
			console.log('balances first', balances[0] / 1e18, balances[1] / 1e18, balances[2] / 1e18);
			let cost;
			answer = await Thales.balanceOf(first);
			console.log('acc sUSD balance after buy: ', fromUnit(answer));
			cost = initial_balance.sub(answer);
			console.log('cost in sUSD: ', fromUnit(cost));

			await fastForward(await currentTime());

			assert.equal(true, await awayTeamNotLoseMarket.canResolve());

			const tx_2 = await TherundownConsumerDeployed.fulfillGamesResolved(
				reqIdResolve,
				gamesResolved,
				sportId_4,
				{ from: wrapper }
			);

			let gameR = await TherundownConsumerDeployed.gameResolved(gameFootballid1);
			// resolve markets
			// const tx_resolve = await TherundownConsumerDeployed.resolveMarketForGame(gameid1);
			let marketAdd = await TherundownConsumerDeployed.marketPerGameId(gameFootballid1);
			const tx_resolve = await SportPositionalMarketManager.resolveMarketWithResult(
				marketAdd,
				2,
				1,
				2,
				TherundownConsumerDeployed.address,
				false,
				{
					from: second,
				}
			);
			answer = await deployedMarket.result();
			let game_results = ['Cancelled', 'Home', 'Away', 'Draw'];
			console.log('Game result: ', game_results[parseInt(answer.toString())], ' wins');
			answer = await Thales.balanceOf(first);
			initial_balance = answer;
			console.log('first acc sUSD balance before exercise: ', fromUnit(answer));
			let options = await awayTeamNotLoseMarket.balancesOf(first);
			console.log('options balance before exercise: ', fromUnit(options[position]));
			await awayTeamNotLoseMarket.exerciseOptions({ from: first });
			answer = await Thales.balanceOf(first);
			cost = answer.sub(initial_balance);
			console.log('acc sUSD balance after exercise: ', fromUnit(answer));
			options = await awayTeamNotLoseMarket.balancesOf(first);
			console.log('options balance after exercise: ', fromUnit(options[position]));
			console.log('difference: ', fromUnit(cost));

			console.log(
				'get odds for all active markets',
				await SportPositionalMarketData.getOddsForAllActiveMarkets()
			);
		});

		it('Detailed test from creation to resolution - double chance', async () => {
			let odds = [];
			odds[0] = await SportsAMM.obtainOdds(homeTeamNotLoseMarket.address, 0);
			odds[1] = await SportsAMM.obtainOdds(awayTeamNotLoseMarket.address, 1);
			odds[2] = await SportsAMM.obtainOdds(noDrawMarket.address, 2);
			console.log(
				'Game odds: homeTeamNotLoseAnswer=',
				fromUnit(odds[0]),
				', awayTeamNotLoseMarket=',
				fromUnit(odds[1]),
				', noDrawMarket=',
				fromUnit(odds[2])
			);

			let user1_position = 0; // 1X
			let user1_USDamount = 100;
			let user2_position = 0; // 2X
			let user2_USDamount = 100;
			let user3_position = 0; // 12
			let user3_USDamount = 100;

			let availableToBuy = await SportsAMM.availableToBuyFromAMM(
				homeTeamNotLoseMarket.address,
				user1_position
			);
			console.log(
				'Available to buy for user 1 position homeTeamNotLoseMarket: ',
				fromUnit(availableToBuy)
			);
			availableToBuy = await SportsAMM.availableToBuyFromAMM(
				awayTeamNotLoseMarket.address,
				user2_position
			);
			console.log(
				'Available to buy for user 2 position awayTeamNotLoseMarket: ',
				fromUnit(availableToBuy)
			);
			availableToBuy = await SportsAMM.availableToBuyFromAMM(noDrawMarket.address, user3_position);
			console.log('Available to buy for user 3 position noDrawMarket: ', fromUnit(availableToBuy));

			let additionalSlippage = toUnit(0.05);
			console.log('Additional slipage: ', fromUnit(additionalSlippage));
			let buyFromAmmQuote_1 = await SportsAMM.buyFromAmmQuote(
				homeTeamNotLoseMarket.address,
				user1_position,
				toUnit(user1_USDamount)
			);
			console.log(
				'User 1 buy quote homeTeamNotLoseMarket for ',
				user1_USDamount,
				': ',
				fromUnit(buyFromAmmQuote_1)
			);

			let buyFromAmmQuote_2 = await SportsAMM.buyFromAmmQuote(
				awayTeamNotLoseMarket.address,
				user2_position,
				toUnit(user2_USDamount)
			);
			console.log(
				'User 2 buy quote awayTeamNotLoseMarket for ',
				user2_USDamount,
				': ',
				fromUnit(buyFromAmmQuote_2)
			);

			let buyFromAmmQuote_3 = await SportsAMM.buyFromAmmQuote(
				noDrawMarket.address,
				user3_position,
				toUnit(user3_USDamount)
			);

			console.log(
				'User 3 buy quote noDrawMarket for ',
				user3_USDamount,
				': ',
				fromUnit(buyFromAmmQuote_3)
			);

			let balance = await Thales.balanceOf(first);
			console.log('USD balance of user 1: ', fromUnit(balance));
			balance = await Thales.balanceOf(second);
			console.log('USD balance of user 2: ', fromUnit(balance));
			balance = await Thales.balanceOf(third);
			console.log('USD balance of user 3: ', fromUnit(balance));
			balance = await Thales.balanceOf(SportsAMM.address);
			console.log('USD balance of AMM: ', fromUnit(balance));
			console.log('User 1, User 2, User 3 buying ....');

			answer = await SportsAMM.buyFromAMM(
				homeTeamNotLoseMarket.address,
				user1_position,
				toUnit(user1_USDamount),
				buyFromAmmQuote_1,
				additionalSlippage,
				{ from: first }
			);
			answer = await SportsAMM.buyFromAMM(
				awayTeamNotLoseMarket.address,
				user2_position,
				toUnit(user2_USDamount),
				buyFromAmmQuote_2,
				additionalSlippage,
				{ from: second }
			);

			answer = await SportsAMM.buyFromAMM(
				noDrawMarket.address,
				user3_position,
				toUnit(user3_USDamount),
				buyFromAmmQuote_3,
				additionalSlippage,
				{ from: third }
			);

			let options = await homeTeamNotLoseMarket.balancesOf(first);
			console.log(
				'User 1 options bought: ',
				fromUnit(options[0]),
				fromUnit(options[1]),
				fromUnit(options[2])
			);
			options = await awayTeamNotLoseMarket.balancesOf(second);
			console.log(
				'User 2 options bought: ',
				fromUnit(options[0]),
				fromUnit(options[1]),
				fromUnit(options[2])
			);

			options = await noDrawMarket.balancesOf(third);
			console.log(
				'User 3 options bought: ',
				fromUnit(options[0]),
				fromUnit(options[1]),
				fromUnit(options[2])
			);
			console.log('-------------------------------------------');
			balance = await Thales.balanceOf(first);
			console.log('USD balance of user 1: ', fromUnit(balance));
			balance = await Thales.balanceOf(second);
			console.log('USD balance of user 2: ', fromUnit(balance));
			balance = await Thales.balanceOf(third);
			console.log('USD balance of user 3: ', fromUnit(balance));
			balance = await Thales.balanceOf(SportsAMM.address);
			console.log('USD balance of AMM: ', fromUnit(balance));

			console.log('-------------------------------------------');
			console.log('-------------- RESOLVE GAME ---------------');
			console.log('-------------------------------------------');
			await fastForward(await currentTime());
			assert.equal(true, await homeTeamNotLoseMarket.canResolve());
			assert.equal(true, await awayTeamNotLoseMarket.canResolve());
			assert.equal(true, await noDrawMarket.canResolve());

			const tx_2 = await TherundownConsumerDeployed.fulfillGamesResolved(
				reqIdResolve,
				gamesResolved,
				sportId_4,
				{ from: wrapper }
			);
			let gameR = await TherundownConsumerDeployed.gameResolved(gameFootballid1);
			let marketAdd = await TherundownConsumerDeployed.marketPerGameId(gameFootballid1);
			const tx_resolve = await TherundownConsumerDeployed.resolveMarketManually(
				marketAdd,
				2,
				1,
				2,
				false,
				{ from: owner }
			);
			answer = await deployedMarket.result();
			let game_results = ['Cancelled', 'Home', 'Away', 'Draw'];
			console.log('Game result: ', game_results[parseInt(answer.toString())], ' wins');
			marketAdd = await TherundownConsumerDeployed.marketPerGameId(gameid1);

			options = await homeTeamNotLoseMarket.balancesOf(first);
			console.log('User 1 options to excercise: ', fromUnit(options[user1_position]));
			options = await awayTeamNotLoseMarket.balancesOf(second);
			console.log('User 2 options to excercise: ', fromUnit(options[user2_position]));
			options = await noDrawMarket.balancesOf(third);
			console.log('User 3 options to excercise: ', fromUnit(options[user3_position]));

			answer = await Thales.balanceOf(first);
			let initial_balance_1 = answer;
			balance = await Thales.balanceOf(first);
			console.log('USD balance of user 1 before excercising: ', fromUnit(balance));
			balance = await Thales.balanceOf(second);
			let initial_balance_2 = balance;
			console.log('USD balance of user 2 before excercising: ', fromUnit(balance));
			balance = await Thales.balanceOf(third);
			let initial_balance_3 = balance;
			console.log('USD balance of user 3 before excercising: ', fromUnit(balance));
			console.log('----------- EXCERCISING OPTIONS -----------');

			options = await deployedMarket.balancesOf(homeTeamNotLoseMarket.address);
			console.log(
				'homeTeamNotLoseMarket options: ',
				fromUnit(options[0]),
				fromUnit(options[1]),
				fromUnit(options[2])
			);
			options = await deployedMarket.balancesOf(awayTeamNotLoseMarket.address);
			console.log(
				'awayTeamNotLoseMarket options: ',
				fromUnit(options[0]),
				fromUnit(options[1]),
				fromUnit(options[2])
			);
			options = await deployedMarket.balancesOf(noDrawMarket.address);
			console.log(
				'noDrawMarket options: ',
				fromUnit(options[0]),
				fromUnit(options[1]),
				fromUnit(options[2])
			);

			await homeTeamNotLoseMarket.exerciseOptions({ from: first });
			await awayTeamNotLoseMarket.exerciseOptions({ from: second });
			await noDrawMarket.exerciseOptions({ from: third });

			options = await homeTeamNotLoseMarket.balancesOf(first);
			console.log('User 1 options after excercise: ', fromUnit(options[user1_position]));
			options = await awayTeamNotLoseMarket.balancesOf(second);
			console.log('User 2 options after excercise: ', fromUnit(options[user2_position]));
			options = await noDrawMarket.balancesOf(second);
			console.log('User 3 options after excercise: ', fromUnit(options[user2_position]));

			balance = await Thales.balanceOf(first);
			console.log('USD balance of user 1 after excercising: ', fromUnit(balance));
			let cost = balance.sub(initial_balance_1);
			console.log('User 1 gained after excercising: ', fromUnit(cost));
			balance = await Thales.balanceOf(second);
			console.log('USD balance of user 2 after excercising: ', fromUnit(balance));
			cost = balance.sub(initial_balance_2);
			console.log('User 2 gained after excercising: ', fromUnit(cost));
			balance = await Thales.balanceOf(third);
			console.log('USD balance of user 3 after excercising: ', fromUnit(balance));
			cost = balance.sub(initial_balance_3);
			console.log('User 3 gained after excercising: ', fromUnit(cost));
		});

		it('Buy from SportsAMM double chance - check spent on game', async () => {
			let availableToBuy = await SportsAMM.availableToBuyFromAMM(homeTeamNotLoseMarket.address, 0);
			console.log('available to buy double chance', availableToBuy / 1e18);
			let additionalSlippage = toUnit(0.01);
			let buyFromAmmQuote = await SportsAMM.buyFromAmmQuote(
				homeTeamNotLoseMarket.address,
				0,
				toUnit(100)
			);
			answer = await Thales.balanceOf(first);
			let before_balance = answer;
			console.log('acc balance: ', fromUnit(answer));
			console.log('buyQuote: ', fromUnit(buyFromAmmQuote));
			answer = await SportsAMM.buyFromAMM(
				homeTeamNotLoseMarket.address,
				0,
				toUnit(100),
				buyFromAmmQuote,
				additionalSlippage,
				{ from: first }
			);
			answer = await Thales.balanceOf(first);
			console.log('acc after buy balance: ', fromUnit(answer));
			console.log('cost: ', fromUnit(before_balance.sub(answer)));
			let options = await homeTeamNotLoseMarket.balancesOf(first);
			console.log('Balances', fromUnit(options[0]), fromUnit(options[1]));

			console.log(
				'Spent on game homeTeamNotLose',
				(await SportsAMM.spentOnGame(homeTeamNotLoseMarket.address)) / 1e18
			);
			console.log(
				'Spent on game deployedMarket',
				(await SportsAMM.spentOnGame(deployedMarket.address)) / 1e18
			);

			// individual buy
			availableToBuy = await SportsAMM.availableToBuyFromAMM(deployedMarket.address, 0);
			console.log('available to buy deployed market', availableToBuy / 1e18);
			additionalSlippage = toUnit(0.01);
			buyFromAmmQuote = await SportsAMM.buyFromAmmQuote(deployedMarket.address, 0, toUnit(100));
			answer = await Thales.balanceOf(second);
			before_balance = answer;
			console.log('second acc balance: ', fromUnit(answer));
			console.log('buyQuote: ', fromUnit(buyFromAmmQuote));
			answer = await SportsAMM.buyFromAMM(
				deployedMarket.address,
				0,
				toUnit(100),
				buyFromAmmQuote,
				additionalSlippage,
				{ from: second }
			);
			answer = await Thales.balanceOf(second);
			console.log('sesond acc after buy balance: ', fromUnit(answer));
			console.log('cost: ', fromUnit(before_balance.sub(answer)));

			console.log(
				'Spent on game deployedMarket',
				(await SportsAMM.spentOnGame(deployedMarket.address)) / 1e18
			);

			availableToBuy = await SportsAMM.availableToBuyFromAMM(deployedMarket.address, 2);
			console.log('available to buy deployed market', availableToBuy / 1e18);
			additionalSlippage = toUnit(0.01);
			buyFromAmmQuote = await SportsAMM.buyFromAmmQuote(deployedMarket.address, 2, toUnit(100));
			answer = await Thales.balanceOf(third);
			before_balance = answer;
			console.log('third acc balance: ', fromUnit(answer));
			console.log('buyQuote: ', fromUnit(buyFromAmmQuote));
			answer = await SportsAMM.buyFromAMM(
				deployedMarket.address,
				2,
				toUnit(100),
				buyFromAmmQuote,
				additionalSlippage,
				{ from: third }
			);
			answer = await Thales.balanceOf(third);
			console.log('sesond acc after buy balance: ', fromUnit(answer));
			console.log('cost: ', fromUnit(before_balance.sub(answer)));

			console.log(
				'Spent on game deployedMarket',
				(await SportsAMM.spentOnGame(deployedMarket.address)) / 1e18
			);
		});

		it('Buy from SportsAMM individual buy - check spent on game', async () => {
			// individual buy
			let availableToBuy = await SportsAMM.availableToBuyFromAMM(deployedMarket.address, 0);
			console.log('available to buy deployed market', availableToBuy / 1e18);
			let additionalSlippage = toUnit(0.01);
			let buyFromAmmQuote = await SportsAMM.buyFromAmmQuote(deployedMarket.address, 0, toUnit(100));
			let answer = await Thales.balanceOf(second);
			let before_balance = answer;
			console.log('second acc balance: ', fromUnit(answer));
			console.log('buyQuote: ', fromUnit(buyFromAmmQuote));
			answer = await SportsAMM.buyFromAMM(
				deployedMarket.address,
				0,
				toUnit(100),
				buyFromAmmQuote,
				additionalSlippage,
				{ from: second }
			);
			answer = await Thales.balanceOf(second);
			console.log('sesond acc after buy balance: ', fromUnit(answer));
			console.log('cost: ', fromUnit(before_balance.sub(answer)));

			console.log(
				'Spent on game deployedMarket',
				(await SportsAMM.spentOnGame(deployedMarket.address)) / 1e18
			);

			availableToBuy = await SportsAMM.availableToBuyFromAMM(deployedMarket.address, 2);
			console.log('available to buy deployed market', availableToBuy / 1e18);
			additionalSlippage = toUnit(0.01);
			buyFromAmmQuote = await SportsAMM.buyFromAmmQuote(deployedMarket.address, 2, toUnit(100));
			answer = await Thales.balanceOf(third);
			before_balance = answer;
			console.log('third acc balance: ', fromUnit(answer));
			console.log('buyQuote: ', fromUnit(buyFromAmmQuote));
			answer = await SportsAMM.buyFromAMM(
				deployedMarket.address,
				2,
				toUnit(100),
				buyFromAmmQuote,
				additionalSlippage,
				{ from: third }
			);
			answer = await Thales.balanceOf(third);
			console.log('sesond acc after buy balance: ', fromUnit(answer));
			console.log('cost: ', fromUnit(before_balance.sub(answer)));

			console.log(
				'Spent on game deployedMarket',
				(await SportsAMM.spentOnGame(deployedMarket.address)) / 1e18
			);
		});
	});
});
