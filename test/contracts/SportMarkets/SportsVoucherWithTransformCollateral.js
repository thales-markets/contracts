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

const { toWei } = require('web3-utils');

const toUnitSix = (amount) => toBN(toWei(amount.toString(), 'ether') / 1e12);

contract('SportsVauchers', (accounts) => {
	const [
		manager,
		first,
		owner,
		second,
		third,
		fourth,
		safeBox,
		wrapper,
		minter,
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

	let sportsAMMUtils;
	let Thales;
	let voucher;
	let consumer;
	let TherundownConsumer;
	let TherundownConsumerImplementation;
	let TherundownConsumerDeployed;
	let MockTherundownConsumerWrapper;
	let initializeConsumerData;
	let verifier;
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
	let gamesResolvedFootball, SportAMMLiquidityPool;

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
		GamesOddsObtainerDeployed,
		position;

	const game1NBATime = 1646958600;
	const gameFootballTime = 1649876400;

	const sportId_4 = 4; // NBA
	const sportId_16 = 16; // CHL

	let gameMarket;

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
		await SportPositionalMarketManager.setNeedsTransformingCollateral(true, { from: manager });

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
			toUnit('500000'),
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

		await Thales.transfer(first, toUnitSix('1000'), { from: owner });
		await Thales.transfer(minter, toUnitSix('1000'), { from: owner });
		await Thales.transfer(third, toUnitSix('1000'), { from: owner });
		await Thales.transfer(SportsAMM.address, toUnit('100000'), { from: owner });

		await Thales.approve(SportsAMM.address, toUnitSix('1000'), { from: first });
		await Thales.approve(SportsAMM.address, toUnitSix('1000'), { from: second });
		await Thales.approve(SportsAMM.address, toUnitSix('1000'), { from: third });

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
			'0x6536306366613738303834366166363839373862343935373965356366333936000000000000000000000000000000000000000000000000000000000000006400000000000000000000000000000000000000000000000000000000000000810000000000000000000000000000000000000000000000000000000000000008';
		game_2_resolve =
			'0x3937346533663036386233333764313239656435633133646632376133326662000000000000000000000000000000000000000000000000000000000000006600000000000000000000000000000000000000000000000000000000000000710000000000000000000000000000000000000000000000000000000000000008';
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
			['TBD TBD', 'TBA TBA'],
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
		//await SportPositionalMarketManager.setIsDoubleChanceSupported(true, { from: manager });
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
				_needsTransformingCollateral: false,
			},
			{ from: owner }
		);
		await SportAMMLiquidityPool.setUtilizationRate(toUnit(1), {
			from: owner,
		});

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
		await SportAMMLiquidityPool.deposit(toUnit(100), { from: firstLiquidityProvider });
		await SportAMMLiquidityPool.start({ from: owner });
		await SportAMMLiquidityPool.setDefaultLiquidityProvider(defaultLiquidityProvider, {
			from: owner,
		});
		await Thales.transfer(defaultLiquidityProvider, toUnit('1000000'), { from: owner });
		await Thales.approve(SportAMMLiquidityPool.address, toUnit('1000000'), {
			from: defaultLiquidityProvider,
		});

		await testUSDC.mint(first, toUnit(1000));
		await testUSDC.mint(curveSUSD.address, toUnit(1000));
		await testUSDC.approve(SportsAMM.address, toUnit(1000), { from: first });
	});

	describe('Test Sports Voucher', () => {
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

			let OvertimeVoucher = artifacts.require('OvertimeVoucher');

			voucher = await OvertimeVoucher.new(
				Thales.address,
				'',
				'',
				'',
				'',
				'',
				'',
				'',
				'',
				SportsAMM.address,
				SportsAMM.address
			);

			await voucher.setSportsAMM(SportsAMM.address);
			await voucher.setPause(false);
			await voucher.setTokenUris('', '', '', '', '', '', '', '');
			await voucher.setMultiplier(toUnitSix(1));

			position = artifacts.require('SportPosition');
		});
		let position = 0;
		let value = 100;

		it('Mint voucher', async () => {
			let odds = [];
			odds[0] = await SportsAMM.obtainOdds(deployedMarket.address, 0);
			odds[1] = await SportsAMM.obtainOdds(deployedMarket.address, 1);
			odds[2] = await SportsAMM.obtainOdds(deployedMarket.address, 2);
			console.log(
				'Game odds: 0=',
				fromUnit(odds[0]),
				', 1=',
				fromUnit(odds[1]),
				' 2=',
				fromUnit(odds[2])
			);

			console.log(toUnitSix(20) / 1e6);
			Thales.approve(voucher.address, toUnitSix(20), { from: minter });

			let balanceOfMinter = await Thales.balanceOf(minter);
			console.log('sUSD balance of minter = ' + balanceOfMinter / 1e6);
			const id = 1;

			const fifteenSUSD = toUnitSix(15);
			await expect(voucher.mint(first, fifteenSUSD, { from: minter })).to.be.revertedWith(
				'Invalid amount'
			);

			const twentysUSD = toUnitSix(20);
			await voucher.mint(first, twentysUSD, { from: minter });
			balanceOfMinter = await Thales.balanceOf(minter);
			console.log('sUSD balance of minter = ' + balanceOfMinter / 1e6);

			let balanceOfVoucher = await Thales.balanceOf(voucher.address);
			console.log('sUSD balance of voucher = ' + balanceOfVoucher / 1e6);

			assert.bnEqual(1, await voucher.balanceOf(first));
			assert.equal(first, await voucher.ownerOf(id));
			assert.bnEqual(toUnitSix(20), await voucher.amountInVoucher(id));

			await voucher.safeTransferFrom(first, second, id, { from: first });
			assert.equal(second, await voucher.ownerOf(id));

			let buyFromAmmQuote = await SportsAMM.buyFromAmmQuote(deployedMarket.address, 1, toUnit(20));
			console.log('Quote is ' + buyFromAmmQuote / 1e6);

			await voucher.buyFromAMMWithVoucher(deployedMarket.address, 1, toUnit(20), id, {
				from: second,
			});

			let options = await deployedMarket.options();
			let home = await position.at(options.home);
			let away = await position.at(options.away);

			let balanceHome = await home.balanceOf(second);
			console.log('Balance Home = ' + balanceHome);

			let balanceAway = await away.balanceOf(second);
			console.log('Balance Away = ' + balanceAway);

			balanceOfVoucher = await Thales.balanceOf(voucher.address);
			console.log('sUSD balance of voucher = ' + balanceOfVoucher);

			let amountInVoucher = await voucher.amountInVoucher(id);
			console.log('Amount in voucher is ' + amountInVoucher / 1e6);

			buyFromAmmQuote = await SportsAMM.buyFromAmmQuote(deployedMarket.address, 1, toUnit(100));
			console.log('100 Quote is ' + buyFromAmmQuote / 1e6);

			await expect(
				voucher.buyFromAMMWithVoucher(deployedMarket.address, 1, toUnit(100), id, {
					from: second,
				})
			).to.be.revertedWith('Insufficient amount in voucher');

			await expect(
				voucher.buyFromAMMWithVoucher(deployedMarket.address, 1, toUnit(100), id, {
					from: first,
				})
			).to.be.revertedWith('You are not the voucher owner!');

			buyFromAmmQuote = await SportsAMM.buyFromAmmQuote(deployedMarket.address, 1, toUnit(67));
			console.log('65 Quote is ' + buyFromAmmQuote / 1e6);

			let secondBalanceBeforeBurn = await voucher.balanceOf(second);
			console.log('Second balance before burn is ' + secondBalanceBeforeBurn);

			await voucher.buyFromAMMWithVoucher(deployedMarket.address, 1, toUnit(67), id, {
				from: second,
			});

			home = await position.at(options.home);
			away = await position.at(options.away);

			balanceHome = await home.balanceOf(second);
			console.log('Balance Home = ' + balanceHome);

			balanceAway = await away.balanceOf(second);
			console.log('Balance Away = ' + balanceAway);

			balanceOfVoucher = await Thales.balanceOf(voucher.address);
			console.log('sUSD balance of voucher = ' + balanceOfVoucher);

			let secondBalanceAfterBurn = await voucher.balanceOf(second);
			console.log('Second balance after burn is ' + secondBalanceAfterBurn);

			assert.bnEqual(0, secondBalanceAfterBurn);
		});

		// it('Buy from SportsAMM, position 1, value: 100', async () => {
		// 	let availableToBuy = await SportsAMM.availableToBuyFromAMM(deployedMarket.address, 1);
		// 	let additionalSlippage = toUnit(0.01);
		// 	let buyFromAmmQuote = await SportsAMM.buyFromAmmQuote(deployedMarket.address, 1, toUnit(100));
		// 	answer = await Thales.balanceOf(first);
		// 	let before_balance = answer;
		// 	console.log('acc balance: ', fromUnit(answer));
		// 	console.log('buyQuote: ', fromUnit(buyFromAmmQuote));
		// 	answer = await SportsAMM.buyFromAMM(
		// 		deployedMarket.address,
		// 		1,
		// 		toUnit(100),
		// 		buyFromAmmQuote,
		// 		additionalSlippage,
		// 		{ from: first }
		// 	);
		// 	answer = await Thales.balanceOf(first);
		// 	console.log('acc after buy balance: ', fromUnit(answer));
		// 	console.log('cost: ', fromUnit(before_balance.sub(answer)));
		// 	let options = await deployedMarket.balancesOf(first);
		// 	console.log('Balances', options[0].toString(), fromUnit(options[1]), options[2].toString());
		// });
	});
});
