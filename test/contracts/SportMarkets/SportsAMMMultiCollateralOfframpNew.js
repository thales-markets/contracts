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

const { toWei } = require('web3-utils');
const toUnitSix = (amount) => toBN(toWei(amount.toString(), 'ether') / 1e12);

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

contract('SportsAMM', (accounts) => {
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
	let GamesOddsObtainerDeployed;
	let multiCollateralOnOffRamp, swapRouterMock, MockPriceFeedDeployed;

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
		SportAMMRiskManager,
		curveMock;
	let emptyArray = [];

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
			toUnit('500'),
			{ from: owner }
		);

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
			SNXRewards.address,
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
		await SportPositionalMarketManager.setSupportedSportForDoubleChance(
			[10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
			true,
			{
				from: manager,
			}
		);
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

		let MockPriceFeed = artifacts.require('MockPriceFeed');
		MockPriceFeedDeployed = await MockPriceFeed.new(owner);

		await multiCollateralOnOffRamp.initialize(owner, Thales.address);

		await multiCollateralOnOffRamp.setPriceFeed(MockPriceFeedDeployed.address, { from: owner });

		let SwapRouterMock = artifacts.require('SwapRouterMock');
		swapRouterMock = await SwapRouterMock.new();

		await multiCollateralOnOffRamp.setSwapRouter(swapRouterMock.address, { from: owner });

		await MockPriceFeedDeployed.setPricetoReturn(toUnit(1));

		await multiCollateralOnOffRamp.setSupportedAMM(SportsAMM.address, true, { from: owner });

		await multiCollateralOnOffRamp.setSupportedCollateral(testUSDC.address, true, { from: owner });

		await SportsAMM.setMultiCollateralOnOffRamp(multiCollateralOnOffRamp.address, true, {
			from: owner,
		});

		let CurveMock = artifacts.require('CurveMock');
		curveMock = await CurveMock.new(
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
				_maxAllowedDeposit: toUnit(1000).toString(),
				_minDepositAmount: toUnit(100).toString(),
				_maxAllowedUsers: 100,
				_needsTransformingCollateral: false,
			},
			{ from: owner }
		);
		await SportAMMLiquidityPool.setUtilizationRate(toUnit(1), {
			from: owner,
		});

		await SportsAMM.setSportsPositionalMarketManager(SportPositionalMarketManager.address, {
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
		await SportsAMM.setSportOnePositional(9455, true, { from: owner });

		let aMMLiquidityPoolRoundMastercopy = await SportAMMLiquidityPoolRoundMastercopy.new();
		await SportAMMLiquidityPool.setPoolRoundMastercopy(aMMLiquidityPoolRoundMastercopy.address, {
			from: owner,
		});
		await Thales.transfer(firstLiquidityProvider, toUnit('100000'), { from: owner });
		await Thales.approve(SportAMMLiquidityPool.address, toUnit('100000'), {
			from: firstLiquidityProvider,
		});
		await SportAMMLiquidityPool.setWhitelistedAddresses([firstLiquidityProvider], true, {
			from: owner,
		});
		await SportAMMLiquidityPool.deposit(toUnit(100), { from: firstLiquidityProvider });
		await SportAMMLiquidityPool.start({ from: owner });
		await SportAMMLiquidityPool.setDefaultLiquidityProvider(defaultLiquidityProvider, {
			from: owner,
		});
		await Thales.transfer(defaultLiquidityProvider, toUnit('100000'), { from: owner });
		await Thales.approve(SportAMMLiquidityPool.address, toUnit('100000'), {
			from: defaultLiquidityProvider,
		});

		await testUSDC.mint(curveMock.address, toUnitSix(10000));
		await testUSDC.approve(SportsAMM.address, toUnitSix(1000), { from: first });
	});

	describe('Init', () => {
		it('Check init Therundown consumer', async () => {
			assert.equal(true, await TherundownConsumerDeployed.supportedSport(sportId_4));
			assert.equal(true, await TherundownConsumerDeployed.supportedSport(sportId_16));
			assert.equal(false, await TherundownConsumerDeployed.supportedSport(0));
			assert.equal(false, await TherundownConsumerDeployed.supportedSport(1));

			assert.equal(true, await TherundownConsumerDeployed.isSportTwoPositionsSport(sportId_4));
			assert.equal(false, await TherundownConsumerDeployed.isSportTwoPositionsSport(sportId_16));
			assert.equal(false, await TherundownConsumerDeployed.isSportTwoPositionsSport(7));

			assert.equal(true, await verifier.isSupportedMarketType('create'));
			assert.equal(true, await verifier.isSupportedMarketType('resolve'));
			assert.equal(false, await verifier.isSupportedMarketType('aaa'));

			assert.equal(false, await TherundownConsumerDeployed.cancelGameStatuses(8));
			assert.equal(true, await TherundownConsumerDeployed.cancelGameStatuses(1));

			assert.equal(true, await SportsAMM.isMarketForSportOnePositional(9455));
			assert.equal(false, await SportsAMM.isMarketForSportOnePositional(9456));
		});

		it('Check init Master copies', async () => {
			SportPositionalMarketMastercopy = await SportPositionalMarketMasterCopyContract.new({
				from: manager,
			});
			SportPositionMastercopy = await SportPositionMasterCopyContract.new({ from: manager });
		});
	});

	describe('Create games markets', () => {
		it('Fulfill Games Created - NBA, create market, check results', async () => {
			await fastForward(game1NBATime - (await currentTime()) - SECOND);

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

			assert.bnEqual(1649890800, await gamesQueue.gameStartPerGameId(gameid1));
			assert.bnEqual(1649890800, await gamesQueue.gameStartPerGameId(gameid2));

			assert.equal(true, await TherundownConsumerDeployed.isSportTwoPositionsSport(sportId_4));
			assert.equal(true, await TherundownConsumerDeployed.supportedSport(sportId_4));

			let result = await GamesOddsObtainerDeployed.getOddsForGame(gameid1);
			assert.bnEqual(-20700, result[0]);
			assert.bnEqual(17700, result[1]);

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

			assert.equal(2, await deployedMarket.optionsCount());

			await fastForward(await currentTime());

			assert.equal(true, await deployedMarket.canResolve());

			const tx_2 = await TherundownConsumerDeployed.fulfillGamesResolved(
				reqIdResolve,
				gamesResolved,
				sportId_4,
				{ from: wrapper }
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

		it('Resolove manually, and claim as USDC', async () => {
			position = 2;
			value = 100;
			let odds = [];
			odds[0] = await SportsAMM.obtainOdds(deployedMarket.address, 0);
			odds[1] = await SportsAMM.obtainOdds(deployedMarket.address, 1);
			odds[2] = await SportsAMM.obtainOdds(deployedMarket.address, 2);
			console.log(
				'Game odds: 0=',
				fromUnit(odds[0]),
				', 1=',
				fromUnit(odds[1]),
				', 2=',
				fromUnit(odds[1])
			);
			let optionsCount = await deployedMarket.optionsCount();
			console.log('Positions count: ', optionsCount.toString());
			let positionInAMM = position > 0 ? position - 1 : position;
			let availableToBuy = await SportsAMM.availableToBuyFromAMM(
				deployedMarket.address,
				positionInAMM
			);
			let additionalSlippage = toUnit(0.05);
			let buyFromAmmQuote = await SportsAMM.buyFromAmmQuote(
				deployedMarket.address,
				positionInAMM,
				toUnit(value)
			);
			answer = await Thales.balanceOf(first);
			let startBalance = answer;
			let initial_balance = answer;
			console.log('acc sUSD balance before buy: ', fromUnit(answer));
			console.log('buyQuote: ', fromUnit(buyFromAmmQuote));
			answer = await SportsAMM.buyFromAMM(
				deployedMarket.address,
				positionInAMM,
				toUnit(value),
				buyFromAmmQuote,
				additionalSlippage,
				{ from: first }
			);
			// let availableToBuy = await SportsAMM.availableToBuyFromAMM(deployedMarket.address, position);
			let cost;
			answer = await Thales.balanceOf(first);
			console.log('acc sUSD balance after buy: ', fromUnit(answer));
			cost = initial_balance.sub(answer);
			console.log('cost in sUSD: ', fromUnit(cost));

			await fastForward(await currentTime());

			assert.equal(true, await deployedMarket.canResolve());

			const tx_2 = await TherundownConsumerDeployed.fulfillGamesResolved(
				reqIdResolve,
				gamesResolved,
				sportId_4,
				{ from: wrapper }
			);

			let gameR = await TherundownConsumerDeployed.gameResolved(gameid1);
			// resolve markets
			// const tx_resolve = await TherundownConsumerDeployed.resolveMarketForGame(gameid1);
			let marketAdd = await TherundownConsumerDeployed.marketPerGameId(gameid1);
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
			answer = await Thales.balanceOf(first);
			initial_balance = answer;
			console.log('acc sUSD balance before exercise: ', fromUnit(answer));
			let options = await deployedMarket.balancesOf(first);
			console.log('options balance before exercise: ', fromUnit(options[positionInAMM]));

			let firstBalances = await sportsAMMUtils.getBalanceOfPositionsOnMarket(
				deployedMarket.address,
				first
			);
			console.log('firstBalances 0' + firstBalances[0] / 1e18);
			console.log('firstBalances 1' + firstBalances[1] / 1e18);
			console.log('firstBalances 2' + firstBalances[2] / 1e18);

			firstBalances = await deployedMarket.balancesOf(first);
			console.log('firstBalances direct 0' + firstBalances[0] / 1e18);
			console.log('firstBalances direct 1' + firstBalances[1] / 1e18);
			console.log('firstBalances direct 2' + firstBalances[2] / 1e18);

			let minimumReceivedOfframp = await multiCollateralOnOffRamp.getMinimumReceivedOfframp(
				testUSDC.address,
				toUnit(100)
			);
			console.log('minimumReceivedOfframp USDC for 100 sUSD is ' + minimumReceivedOfframp / 1e6);

			let maximumReceivedOfframp = await multiCollateralOnOffRamp.getMaximumReceivedOfframp(
				testUSDC.address,
				toUnit(100)
			);
			console.log('maximumReceivedOfframp USDC for 100 sUSD is ' + maximumReceivedOfframp / 1e6);

			let balance = await testUSDC.balanceOf(curveMock.address);
			console.log('Balance testUSDC curveMock before ' + balance / 1e6);

			await SportsAMM.exerciseWithOfframp(deployedMarket.address, testUSDC.address, false, {
				from: first,
			});

			answer = await Thales.balanceOf(first);
			cost = answer.sub(initial_balance);
			console.log('acc sUSD balance after exercise: ', fromUnit(answer));
			options = await deployedMarket.balancesOf(first);
			console.log('options balance after exercise: ', fromUnit(options[positionInAMM]));
			console.log('difference: ', fromUnit(cost));

			assert.bnEqual(fromUnit(cost), toUnitSix('0'));

			balance = await testUSDC.balanceOf(curveMock.address);
			console.log('Balance testUSDC curveMock after ' + balance / 1e6);

			balance = await testUSDC.balanceOf(first);
			console.log('Balance testUSDC first after ' + balance / 1e6);

			assert.bnGte(balance, toUnitSix('99.9'));
			assert.bnLte(balance, toUnitSix('100.1'));
		});

		it('Resolove manually, and claim as ETH', async () => {
			position = 2;
			value = 100;
			let odds = [];
			odds[0] = await SportsAMM.obtainOdds(deployedMarket.address, 0);
			odds[1] = await SportsAMM.obtainOdds(deployedMarket.address, 1);
			odds[2] = await SportsAMM.obtainOdds(deployedMarket.address, 2);
			console.log(
				'Game odds: 0=',
				fromUnit(odds[0]),
				', 1=',
				fromUnit(odds[1]),
				', 2=',
				fromUnit(odds[1])
			);
			let optionsCount = await deployedMarket.optionsCount();
			console.log('Positions count: ', optionsCount.toString());
			let positionInAMM = position > 0 ? position - 1 : position;
			let availableToBuy = await SportsAMM.availableToBuyFromAMM(
				deployedMarket.address,
				positionInAMM
			);
			let additionalSlippage = toUnit(0.05);
			let buyFromAmmQuote = await SportsAMM.buyFromAmmQuote(
				deployedMarket.address,
				positionInAMM,
				toUnit(value)
			);
			answer = await Thales.balanceOf(first);
			let startBalance = answer;
			let initial_balance = answer;
			console.log('acc sUSD balance before buy: ', fromUnit(answer));
			console.log('buyQuote: ', fromUnit(buyFromAmmQuote));
			answer = await SportsAMM.buyFromAMM(
				deployedMarket.address,
				positionInAMM,
				toUnit(value),
				buyFromAmmQuote,
				additionalSlippage,
				{ from: first }
			);
			// let availableToBuy = await SportsAMM.availableToBuyFromAMM(deployedMarket.address, position);
			let cost;
			answer = await Thales.balanceOf(first);
			console.log('acc sUSD balance after buy: ', fromUnit(answer));
			cost = initial_balance.sub(answer);
			console.log('cost in sUSD: ', fromUnit(cost));

			await fastForward(await currentTime());

			assert.equal(true, await deployedMarket.canResolve());

			const tx_2 = await TherundownConsumerDeployed.fulfillGamesResolved(
				reqIdResolve,
				gamesResolved,
				sportId_4,
				{ from: wrapper }
			);

			let gameR = await TherundownConsumerDeployed.gameResolved(gameid1);
			// resolve markets
			// const tx_resolve = await TherundownConsumerDeployed.resolveMarketForGame(gameid1);
			let marketAdd = await TherundownConsumerDeployed.marketPerGameId(gameid1);
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
			answer = await Thales.balanceOf(first);
			initial_balance = answer;
			console.log('acc sUSD balance before exercise: ', fromUnit(answer));
			let options = await deployedMarket.balancesOf(first);
			console.log('options balance before exercise: ', fromUnit(options[positionInAMM]));

			let firstBalances = await sportsAMMUtils.getBalanceOfPositionsOnMarket(
				deployedMarket.address,
				first
			);
			console.log('firstBalances 0' + firstBalances[0] / 1e18);
			console.log('firstBalances 1' + firstBalances[1] / 1e18);
			console.log('firstBalances 2' + firstBalances[2] / 1e18);

			firstBalances = await deployedMarket.balancesOf(first);
			console.log('firstBalances direct 0' + firstBalances[0] / 1e18);
			console.log('firstBalances direct 1' + firstBalances[1] / 1e18);
			console.log('firstBalances direct 2' + firstBalances[2] / 1e18);

			let MockWeth = artifacts.require('MockWeth');
			let mockWeth = await MockWeth.new();
			await multiCollateralOnOffRamp.setWETH(mockWeth.address, { from: owner });

			await MockPriceFeedDeployed.setPricetoReturn(toUnit(2000));

			let minimumReceivedOfframp = await multiCollateralOnOffRamp.getMinimumReceivedOfframp(
				mockWeth.address,
				toUnit(100)
			);
			console.log('minimumReceivedOfframp weth for 100 sUSD is ' + minimumReceivedOfframp / 1e18);

			let maximumReceivedOfframp = await multiCollateralOnOffRamp.getMaximumReceivedOfframp(
				mockWeth.address,
				toUnit(100)
			);
			console.log('maximumReceivedOfframp weth for 100 sUSD is ' + maximumReceivedOfframp / 1e18);

			await mockWeth.deposit({ value: toUnit(1), from: first });
			let userEthBalance = await web3.eth.getBalance(first);
			console.log('userEthBalance ' + userEthBalance);

			await multiCollateralOnOffRamp.setSupportedCollateral(mockWeth.address, true, {
				from: owner,
			});
			await swapRouterMock.setDefaults(Thales.address, mockWeth.address);

			await mockWeth.transfer(swapRouterMock.address, toUnit(0.5), { from: first });
			userEthBalance = await web3.eth.getBalance(first);
			console.log('userEthBalance ' + userEthBalance);

			let swapRouterMockWethBalance = await mockWeth.balanceOf(swapRouterMock.address);
			console.log('swapRouterMockWethBalance before ' + swapRouterMockWethBalance / 1e18);

			await SportsAMM.exerciseWithOfframp(deployedMarket.address, mockWeth.address, true, {
				from: first,
			});

			answer = await Thales.balanceOf(first);
			cost = answer.sub(initial_balance);
			console.log('acc sUSD balance after exercise: ', fromUnit(answer));
			options = await deployedMarket.balancesOf(first);
			console.log('options balance after exercise: ', fromUnit(options[positionInAMM]));
			console.log('difference: ', fromUnit(cost));

			assert.bnEqual(fromUnit(cost), toUnitSix('0'));

			let swapRouterMockWethBalanceAfter = await mockWeth.balanceOf(swapRouterMock.address);
			console.log('swapRouterMockWethBalance after ' + swapRouterMockWethBalanceAfter / 1e18);

			let swapRouterMockWethBalanceDiff =
				swapRouterMockWethBalance / 1e18 - swapRouterMockWethBalanceAfter / 1e18;
			console.log('swapRouterMockWethBalanceDiff ' + swapRouterMockWethBalanceDiff);

			let userEthBalanceAfter = await web3.eth.getBalance(first);
			console.log('userEthBalance after ' + userEthBalanceAfter);

			let userEthBalanceAfterDiff = userEthBalanceAfter / 1e18 - userEthBalance / 1e18;
			console.log('userEthBalanceAfterDiff ' + userEthBalanceAfterDiff);

			assert.bnGte(toUnit(userEthBalanceAfterDiff), toUnit('0.04'));
			assert.bnLte(toUnit(userEthBalanceAfterDiff), toUnit('0.05'));
		});
	});
});
