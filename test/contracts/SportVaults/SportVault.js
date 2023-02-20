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

const hour = 60 * 60;
const day = 24 * 60 * 60;
const week = 7 * day;

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

	let Thales;
	let answer;
	let verifier;
	let sportsAMMUtils;
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
		GamesOddsObtainerDeployed,
		SportsAMM,
		SportAMMLiquidityPool;

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

		await SportsAMM.initialize(
			owner,
			Thales.address,
			toUnit('100'),
			toUnit('0.02'),
			toUnit('0.2'),
			HOUR,
			{ from: owner }
		);

		await SportsAMM.setParameters(
			HOUR,
			toUnit('0.02'),
			toUnit('0.2'),
			toUnit('0.001'),
			toUnit('0.9'),
			toUnit('100'),
			toUnit('0.01'),
			toUnit('0.005'),
			toUnit('500'),
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

		await Thales.transfer(first, toUnit('100000'), { from: owner });
		await Thales.transfer(second, toUnit('100000'), { from: owner });
		await Thales.transfer(third, toUnit('100000'), { from: owner });
		await Thales.transfer(SportsAMM.address, toUnit('100000'), { from: owner });

		await Thales.approve(SportsAMM.address, toUnit('100000'), { from: first });
		await Thales.approve(SportsAMM.address, toUnit('100000'), { from: second });
		await Thales.approve(SportsAMM.address, toUnit('100000'), { from: third });

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
		await TherundownConsumerDeployed.addToWhitelist(SportPositionalMarketManager.address, true, {
			from: owner,
		});

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
			},
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
			{ from: owner }
		);

		let sportAMMLiquidityPoolRoundMastercopy = await SportAMMLiquidityPoolRoundMastercopy.new();
		await SportAMMLiquidityPool.setPoolRoundMastercopy(
			sportAMMLiquidityPoolRoundMastercopy.address,
			{
				from: owner,
			}
		);
		await Thales.transfer(firstLiquidityProvider, toUnit('1000000'), { from: owner });
		await Thales.approve(SportAMMLiquidityPool.address, toUnit('1000000'), {
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
		await Thales.transfer(defaultLiquidityProvider, toUnit('1000000'), { from: owner });
		await Thales.approve(SportAMMLiquidityPool.address, toUnit('1000000'), {
			from: defaultLiquidityProvider,
		});

		await testUSDC.mint(first, toUnit(100000));
		await testUSDC.mint(curveSUSD.address, toUnit(100000));
		await testUSDC.approve(SportsAMM.address, toUnit(100000), { from: first });
	});

	let rewardTokenAddress;
	let Vault, vault;
	let MockPriceFeedDeployed;

	beforeEach(async () => {
		rewardTokenAddress = owner;

		Vault = artifacts.require('SportVault');
		vault = await Vault.new();

		await vault.initialize({
			_owner: owner,
			_sportsAmm: SportsAMM.address,
			_sUSD: Thales.address,
			_roundLength: day,
			_priceLowerLimit: toUnit(0.1).toString(),
			_priceUpperLimit: toUnit(1).toString(),
			_skewImpactLimit: toUnit(-0.03).toString(), // 40%
			_allocationLimitsPerMarketPerRound: toUnit(10).toString(), // 40%
			_maxAllowedDeposit: toUnit(1000).toString(), // 20%
			_utilizationRate: toUnit(0.5).toString(),
			_minDepositAmount: toUnit(100).toString(),
			_maxAllowedUsers: 100,
			_minTradeAmount: toUnit(10).toString(),
		});

		await vault.setAllocationLimits(toUnit(10), { from: owner });
		await vault.setMaxAllowedUsers(100, { from: owner });
		await vault.setMinAllowedDeposit(toUnit(100), { from: owner });
		await vault.setMaxAllowedDeposit(toUnit(1000), { from: owner });
		await vault.setUtilizationRate(toUnit(0.5), { from: owner });
		await vault.setRoundLength(day, { from: owner });
		await vault.setSportAmm(SportsAMM.address, { from: owner });
		await vault.setSkewImpactLimit(toUnit(-0.03), { from: owner });
		await vault.setMinTradeAmount(toUnit(10), { from: owner });
		await vault.setPriceLimits(toUnit(0.1), toUnit(1), { from: owner });

		await Thales.approve(vault.address, toUnit('100000'), { from: first });
		await Thales.approve(vault.address, toUnit('100000'), { from: second });
		await Thales.approve(vault.address, toUnit('100000'), { from: third });

		await StakingThales.setSupportedSportVault(vault.address, true, { from: owner });
		await StakingThales.startStakingPeriod({ from: owner });
		await vault.setStakingThales(StakingThales.address, { from: owner });

		await SportsAMM.setSafeBoxFeeAndMinSpreadPerAddress(
			vault.address,
			toUnit('0.005'),
			toUnit('0.005'),
			{
				from: owner,
			}
		);
	});

	describe('Test sport vault', () => {
		it('Vault creation', async () => {
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

			let allocationLimitsPerMarketPerRound = await vault.allocationLimitsPerMarketPerRound();
			console.log(
				'allocationLimitsPerMarketPerRound is:' +
					allocationLimitsPerMarketPerRound.toString() / 1e18
			);

			let skewImpactLimit = await vault.skewImpactLimit();
			console.log('skewImpactLimit is:' + skewImpactLimit.toString() / 1e18);

			let priceUpperLimit = await vault.priceUpperLimit();
			console.log('priceUpperLimit is:' + priceUpperLimit.toString() / 1e18);

			let priceLowerLimit = await vault.priceLowerLimit();
			console.log('priceLowerLimit is:' + priceLowerLimit.toString() / 1e18);

			let roundLength = await vault.roundLength();
			console.log('roundLength is:' + roundLength);

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
			//round1

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
			// CLOSE ROUND #1 - START ROUND #3
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
			// CLOSE ROUND #1 - START ROUND #4
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
			// CLOSE ROUND #1 - START ROUND #5
			await vault.closeRound();

			await vault.deposit(toUnit(100), { from: second });
			await assert.revert(
				vault.withdrawalRequest({ from: second }),
				"Can't withdraw as you already deposited for next round"
			);

			await fastForward(day);
			// CLOSE ROUND #1 - START ROUND #6
			await vault.closeRound();

			roundLength = await vault.roundLength();
			console.log('roundLength is:' + roundLength);

			round = await vault.round();
			console.log('round is:' + round);

			let roundStartTime = await vault.roundStartTime(round);
			console.log('roundStartTime is:' + roundStartTime);

			await fastForward(game1NBATime - (await currentTime()) - SECOND);
			const tx = await TherundownConsumerDeployed.fulfillGamesCreated(
				reqIdCreate,
				gamesCreated,
				sportId_4,
				game1NBATime,
				{ from: wrapper }
			);

			let game = await TherundownConsumerDeployed.gameCreated(gameid1);
			let gameTime = game.startTime;

			assert.equal(await TherundownConsumerDeployed.gameFulfilledCreated(gameid1), true);

			console.log('gameTime ' + gameTime);

			await TherundownConsumerDeployed.createMarketForGame(gameid1);
			await TherundownConsumerDeployed.marketPerGameId(gameid1);
			answer = await SportPositionalMarketManager.getActiveMarketAddress('0');
			deployedMarket = await SportPositionalMarketContract.at(answer.toString());

			let now = await currentTime();
			await fastForward(gameTime - now - day);
			// CLOSE ROUND #1 - START ROUND #7
			await vault.closeRound();
			round = await vault.round();
			console.log('round is:' + round);
			roundStartTime = await vault.roundStartTime(round);
			console.log('roundStartTime is:' + roundStartTime);

			let maturity = await deployedMarket.times();

			var maturityBefore = maturity[0];
			console.log('maturityBefore is:' + maturityBefore);

			let getCurrentRoundEnd = await vault.getCurrentRoundEnd();
			console.log('getCurrentRoundEnd is:' + getCurrentRoundEnd);

			let availableToBuy = await SportsAMM.availableToBuyFromAMM(deployedMarket.address, 0);
			console.log('AvailableToBuy: ' + availableToBuy / 1e18);
			let additionalSlippage = toUnit(0.01);
			let buyFromAmmQuote = await SportsAMM.buyFromAmmQuote(deployedMarket.address, 1, toUnit(140));
			console.log('buyQuote: ', fromUnit(buyFromAmmQuote));
			answer = await SportsAMM.buyFromAMM(
				deployedMarket.address,
				1,
				toUnit(140),
				buyFromAmmQuote,
				additionalSlippage,
				{ from: first }
			);

			let buyPriceImpactFirst = await SportsAMM.buyPriceImpact(
				deployedMarket.address,
				0,
				toUnit(20)
			);
			console.log('buyPriceImpactFirst: ', fromUnit(buyPriceImpactFirst));

			buyFromAmmQuote = await SportsAMM.buyFromAmmQuote(deployedMarket.address, 0, toUnit(1));
			console.log('buyQuote: ', fromUnit(buyFromAmmQuote));

			buyFromAmmQuote = await SportsAMM.buyFromAmmQuote(deployedMarket.address, 0, toUnit(20));
			console.log('buyQuote 20: ', fromUnit(buyFromAmmQuote));

			let allocationSpentInARound = await vault.allocationSpentInARound(round);
			console.log('allocationSpentInARound is:' + allocationSpentInARound / 1e18);

			let balanceVault = await Thales.balanceOf(vault.address);
			console.log('balanceVault before trade is:' + balanceVault / 1e18);

			await vault.trade(deployedMarket.address, toUnit(20), 0);

			balanceVault = await Thales.balanceOf(vault.address);
			console.log('balanceVault after trade is:' + balanceVault / 1e18);

			allocationSpentInARound = await vault.allocationSpentInARound(round);
			console.log('allocationSpentInARound is:' + allocationSpentInARound / 1e18);

			await assert.revert(
				vault.trade(deployedMarket.address, toUnit(20), 1),
				'Skew impact too high'
			);

			buyFromAmmQuote = await SportsAMM.buyFromAmmQuote(deployedMarket.address, 0, toUnit(200));
			console.log('buyQuote: ', fromUnit(buyFromAmmQuote));
			answer = await SportsAMM.buyFromAMM(
				deployedMarket.address,
				0,
				toUnit(200),
				buyFromAmmQuote,
				additionalSlippage,
				{ from: first }
			);

			buyPriceImpactFirst = await SportsAMM.buyPriceImpact(deployedMarket.address, 1, toUnit(20));
			console.log('buyPriceImpactFirst: ', fromUnit(buyPriceImpactFirst));
			buyFromAmmQuote = await SportsAMM.buyFromAmmQuote(deployedMarket.address, 1, toUnit(1));
			console.log('buyQuote: ', fromUnit(buyFromAmmQuote));

			let canCloseCurrentRound = await vault.canCloseCurrentRound();
			console.log('canCloseCurrentRound is:' + canCloseCurrentRound);

			await fastForward(day);
			canCloseCurrentRound = await vault.canCloseCurrentRound();
			console.log('canCloseCurrentRound is:' + canCloseCurrentRound);

			assert.equal(true, await deployedMarket.canResolve());

			assert.equal('Atlanta Hawks', game.homeTeam);
			assert.equal('Charlotte Hornets', game.awayTeam);

			const tx_2 = await TherundownConsumerDeployed.fulfillGamesResolved(
				reqIdResolve,
				gamesResolved,
				sportId_4,
				{ from: wrapper }
			);

			let gameR = await TherundownConsumerDeployed.gameResolved(gameid1);
			assert.equal(100, gameR.homeScore);
			assert.equal(129, gameR.awayScore);

			// resolve markets
			const tx_resolve = await TherundownConsumerDeployed.resolveMarketForGame(gameid1);

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

			volume = await StakingThales.getAMMVolume(first);
			console.log('volume first is:' + volume / 1e18);

			volume = await StakingThales.getAMMVolume(second);
			console.log('volume second is:' + volume / 1e18);
		});
	});
});
