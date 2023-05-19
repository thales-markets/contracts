'use strict';

const { artifacts, contract, web3 } = require('hardhat');
const { toBN } = web3.utils;

const { assert, addSnapshotBeforeRestoreAfterEach } = require('../../utils/common');
const { fastForward, toUnit, currentTime, multiplyDecimalRound, divideDecimalRound } =
	require('../../utils')();
const { toBytes32 } = require('../../../index');
const { setupContract, setupAllContracts } = require('../../utils/setup');

const {
	ensureOnlyExpectedMutativeFunctions,
	onlyGivenAddressCanInvoke,
	getEventByName,
	getDecodedLogs,
	decodedEventEqual,
	convertToDecimals,
} = require('../../utils/helpers');

let PositionalMarketFactory, factory, PositionalMarketManager, manager, addressResolver, testUSDC;
let PositionalMarket,
	priceFeed,
	oracle,
	sUSDSynth,
	PositionalMarketMastercopy,
	PositionMastercopy,
	RangedMarket;
let market, up, down, position, Synth;

let aggregator_sAUD, aggregator_sETH, aggregator_sUSD, aggregator_nonRate;

const ZERO_ADDRESS = '0x' + '0'.repeat(40);
const WEEK = 7 * 24 * 60 * 60;

const MockAggregator = artifacts.require('MockAggregatorV2V3');

const Phase = {
	Trading: toBN(0),
	Maturity: toBN(1),
	Expiry: toBN(2),
};

contract('RangedAMM', (accounts) => {
	const [
		initialCreator,
		managerOwner,
		minter,
		dummy,
		exersicer,
		secondCreator,
		safeBox,
		referrerAddress,
		firstLiquidityProvider,
		defaultLiquidityProvider,
	] = accounts;
	const [creator, owner] = accounts;
	let creatorSigner, ownerSigner;

	const sUSDQty = toBN(100 * 1e6);
	const sUSDQtyAmm = toBN(100 * 1e10);

	const usdcQuantity = toBN(10000 * 1e6); //100 USDC
	const ammusdcQuantity = toBN(10000 * 1e6); //100 USDC

	const hour = 60 * 60;
	const day = 24 * 60 * 60;

	const capitalRequirement = toUnit(2);
	const skewLimit = toUnit(0.05);
	const maxOraclePriceAge = toBN(60 * 61);
	const expiryDuration = toBN(26 * 7 * 24 * 60 * 60);
	const maxTimeToMaturity = toBN(365 * 24 * 60 * 60);

	const initialStrikePrice = toUnit(100);
	const initialStrikePriceValue = 100;

	const sAUDKey = toBytes32('sAUD');
	const sUSDKey = toBytes32('sUSD');
	const sETHKey = toBytes32('sETH');
	const nonRate = toBytes32('nonExistent');

	let timeToMaturity = 200;
	let totalDeposited;

	const Side = {
		Up: toBN(0),
		Down: toBN(1),
	};

	const Range = {
		In: toBN(0),
		Out: toBN(1),
	};

	const createMarket = async (man, oracleKey, strikePrice, maturity, initialMint, creator) => {
		const tx = await man
			.connect(creator)
			.createMarket(oracleKey, strikePrice.toString(), maturity, initialMint.toString());
		let receipt = await tx.wait();
		const marketEvent = receipt.events.find(
			(event) => event['event'] && event['event'] === 'MarketCreated'
		);
		return PositionalMarket.at(marketEvent.args.market);
	};

	before(async () => {
		PositionalMarket = artifacts.require('PositionalMarket');
	});

	before(async () => {
		Synth = artifacts.require('Synth');
	});

	before(async () => {
		position = artifacts.require('Position');
	});

	before(async () => {
		({
			PositionalMarketManager: manager,
			PositionalMarketFactory: factory,
			PositionalMarketMastercopy: PositionalMarketMastercopy,
			PositionMastercopy: PositionMastercopy,
			AddressResolver: addressResolver,
			PriceFeed: priceFeed,
			SynthsUSD: sUSDSynth,
		} = await setupAllContracts({
			accounts,
			synths: ['sUSD'],
			contracts: [
				'FeePool',
				'PriceFeed',
				'PositionalMarketMastercopy',
				'PositionMastercopy',
				'PositionalMarketFactory',
			],
		}));

		[creatorSigner, ownerSigner] = await ethers.getSigners();

		await manager.connect(creatorSigner).setPositionalMarketFactory(factory.address);
		await manager.setNeedsTransformingCollateral(true);

		await factory.connect(ownerSigner).setPositionalMarketManager(manager.address);
		await factory
			.connect(ownerSigner)
			.setPositionalMarketMastercopy(PositionalMarketMastercopy.address);
		await factory.connect(ownerSigner).setPositionMastercopy(PositionMastercopy.address);

		aggregator_sAUD = await MockAggregator.new({ from: managerOwner });
		aggregator_sETH = await MockAggregator.new({ from: managerOwner });
		aggregator_sUSD = await MockAggregator.new({ from: managerOwner });
		aggregator_nonRate = await MockAggregator.new({ from: managerOwner });
		aggregator_sAUD.setDecimals('8');
		aggregator_sETH.setDecimals('8');
		aggregator_sUSD.setDecimals('8');
		const timestamp = await currentTime();

		await aggregator_sAUD.setLatestAnswer(convertToDecimals(100, 8), timestamp);
		await aggregator_sETH.setLatestAnswer(convertToDecimals(10000, 8), timestamp);
		await aggregator_sUSD.setLatestAnswer(convertToDecimals(100, 8), timestamp);

		await priceFeed.connect(ownerSigner).addAggregator(sAUDKey, aggregator_sAUD.address);

		await priceFeed.connect(ownerSigner).addAggregator(sETHKey, aggregator_sETH.address);

		await priceFeed.connect(ownerSigner).addAggregator(sUSDKey, aggregator_sUSD.address);

		await priceFeed.connect(ownerSigner).addAggregator(nonRate, aggregator_nonRate.address);
	});

	let priceFeedAddress;
	let rewardTokenAddress;
	let ThalesAMM;
	let thalesAMM;
	let rangedMarketsAMM;
	let MockPriceFeedDeployed;
	let ThalesAMMLiquidityPool;

	beforeEach(async () => {
		priceFeedAddress = owner;
		rewardTokenAddress = owner;

		let MockPriceFeed = artifacts.require('MockPriceFeed');
		MockPriceFeedDeployed = await MockPriceFeed.new(owner);
		await MockPriceFeedDeployed.setPricetoReturn(10000);

		priceFeedAddress = MockPriceFeedDeployed.address;

		let TestUSDC = artifacts.require('TestUSDC');
		testUSDC = await TestUSDC.new();

		const hour = 60 * 60;
		ThalesAMM = artifacts.require('ThalesAMM');
		thalesAMM = await ThalesAMM.new();
		await thalesAMM.initialize(
			owner,
			priceFeedAddress,
			testUSDC.address,
			toUnit(1000),
			owner,
			toUnit(0.01),
			toUnit(0.05),
			hour * 2
		);
		await thalesAMM.setPositionalMarketManager(manager.address, { from: owner });
		await thalesAMM.setImpliedVolatilityPerAsset(sETHKey, toUnit(120), { from: owner });
		await thalesAMM.setSafeBoxData(safeBox, toUnit(0.01), { from: owner });
		await thalesAMM.setMinMaxSupportedPriceAndCap(toUnit(0.05), toUnit(0.95), toUnit(1000), {
			from: owner,
		});
		let ThalesAMMUtils = artifacts.require('ThalesAMMUtils');
		let thalesAMMUtils = await ThalesAMMUtils.new();
		await thalesAMM.setAmmUtils(thalesAMMUtils.address, {
			from: owner,
		});

		let ThalesAMMLiquidityPoolContract = artifacts.require('ThalesAMMLiquidityPool');
		ThalesAMMLiquidityPool = await ThalesAMMLiquidityPoolContract.new();

		await ThalesAMMLiquidityPool.initialize(
			{
				_owner: owner,
				_thalesAMM: thalesAMM.address,
				_sUSD: testUSDC.address,
				_roundLength: WEEK,
				_maxAllowedDeposit: toUnit(1000).toString(),
				_minDepositAmount: toUnit(100).toString(),
				_maxAllowedUsers: 100,
				_needsTransformingCollateral: false,
			},
			{ from: owner }
		);

		await thalesAMM.setLiquidityPool(ThalesAMMLiquidityPool.address, {
			from: owner,
		});

		let ThalesAMMLiquidityPoolRoundMastercopy = artifacts.require(
			'ThalesAMMLiquidityPoolRoundMastercopy'
		);

		let aMMLiquidityPoolRoundMastercopy = await ThalesAMMLiquidityPoolRoundMastercopy.new();
		await ThalesAMMLiquidityPool.setPoolRoundMastercopy(aMMLiquidityPoolRoundMastercopy.address, {
			from: owner,
		});
		await testUSDC.mint(firstLiquidityProvider, toUnit('100000'));
		await testUSDC.approve(ThalesAMMLiquidityPool.address, toUnit('100000'), {
			from: firstLiquidityProvider,
		});
		await ThalesAMMLiquidityPool.setWhitelistedAddresses([firstLiquidityProvider], true, {
			from: owner,
		});
		await ThalesAMMLiquidityPool.deposit(toUnit(100), { from: firstLiquidityProvider });
		await ThalesAMMLiquidityPool.start({ from: owner });
		await ThalesAMMLiquidityPool.setDefaultLiquidityProvider(defaultLiquidityProvider, {
			from: owner,
		});
		await testUSDC.mint(defaultLiquidityProvider, toUnit('100000'));
		await testUSDC.approve(ThalesAMMLiquidityPool.address, toUnit('100000'), {
			from: defaultLiquidityProvider,
		});

		await factory.connect(ownerSigner).setThalesAMM(thalesAMM.address);

		testUSDC.mint(thalesAMM.address, sUSDQtyAmm);

		let RangedMarketsAMM = artifacts.require('RangedMarketsAMM');
		rangedMarketsAMM = await RangedMarketsAMM.new();

		await rangedMarketsAMM.initialize(
			managerOwner,
			thalesAMM.address,
			toUnit('0.01'),
			toUnit('1000'),
			testUSDC.address,
			safeBox,
			toUnit('0.01')
		);

		console.log('Successfully create rangedMarketsAMM ' + rangedMarketsAMM.address);
		testUSDC.mint(rangedMarketsAMM.address, sUSDQtyAmm);

		[creatorSigner, ownerSigner] = await ethers.getSigners();

		RangedMarket = artifacts.require('RangedMarket');

		let RangedMarketMastercopy = artifacts.require('RangedMarketMastercopy');
		let rangedMarketMastercopy = await RangedMarketMastercopy.new();
		console.log('Setting mastercopy 11');

		let RangedPositionMastercopy = artifacts.require('RangedPositionMastercopy');
		let rangedPositionMastercopy = await RangedPositionMastercopy.new();
		await rangedMarketsAMM.setRangedMarketMastercopies(
			rangedMarketMastercopy.address,
			rangedPositionMastercopy.address,
			{
				from: owner,
			}
		);

		await rangedMarketsAMM.setMinMaxSupportedPrice(toUnit(0.05), toUnit(0.95), 5, 200, {
			from: owner,
		});
		console.log('Setting min prices');

		await testUSDC.approve(rangedMarketsAMM.address, usdcQuantity, { from: minter });

		let Referrals = artifacts.require('Referrals');
		let referrals = await Referrals.new();
		await referrals.initialize(owner, thalesAMM.address, rangedMarketsAMM.address);

		await rangedMarketsAMM.setThalesAMMStakingThalesAndReferrals(
			thalesAMM.address,
			ZERO_ADDRESS,
			referrals.address,
			toUnit('0.01'),
			{
				from: owner,
			}
		);
		console.log('rangedMarketsAMM -  set Referrals');

		await manager.setsUSD(testUSDC.address);
		await testUSDC.mint(minter, usdcQuantity);
		await testUSDC.approve(manager.address, usdcQuantity, { from: minter });
		await testUSDC.approve(thalesAMM.address, usdcQuantity, { from: minter });
		await testUSDC.mint(thalesAMM.address, ammusdcQuantity);
		await testUSDC.mint(creatorSigner.address, usdcQuantity);
		await testUSDC.approve(manager.address, usdcQuantity, { from: creatorSigner.address });
	});

	const Position = {
		UP: toBN(0),
		DOWN: toBN(1),
	};

	const RangedPosition = {
		IN: toBN(0),
		OUT: toBN(1),
	};

	describe('Test ranged AMM', () => {
		it('create market test ', async () => {
			let now = await currentTime();
			await manager.setMarketCreationParameters(now - WEEK + 200, now - 3 * day + 200);
			let price = (await priceFeed.rateForCurrency(sETHKey)) / 1e18;
			let strikePriceStep = (await manager.getStrikePriceStep(sETHKey)) / 1e18;

			let leftMarket = await createMarket(
				manager,
				sETHKey,
				toUnit(price - 2 * strikePriceStep),
				now + WEEK + 200,
				toUnit(10),
				creatorSigner
			);
			console.log('Left market is ' + leftMarket.address);

			let rightMarket = await createMarket(
				manager,
				sETHKey,
				toUnit(price + 2 * strikePriceStep),
				now + WEEK + 200,
				toUnit(10),
				creatorSigner
			);

			let tx = await rangedMarketsAMM.createRangedMarket(leftMarket.address, rightMarket.address);
			let createdMarketAddress = tx.receipt.logs[0].args.market;
			console.log('created market is :' + createdMarketAddress);

			let rangedMarket = await RangedMarket.at(createdMarketAddress);

			console.log('rangedMarket is ' + rangedMarket.address);

			let rangedMarketsAMMAddressFromCreatedMarket = await rangedMarket.rangedMarketsAMM();
			console.log('rangedMarketsAMM market is ' + rangedMarketsAMMAddressFromCreatedMarket);

			let leftMarketAddressFromCreatedRangedMarket = await rangedMarket.leftMarket();
			console.log(
				'leftMarketAddressFromCreatedRangedMarket is ' + leftMarketAddressFromCreatedRangedMarket
			);

			console.log('BUYING IN POSITION!!!!!!!!!!!!!!!!!!!!!!');

			let buyInQuote = await rangedMarketsAMM.buyFromAmmQuote(
				rangedMarket.address,
				RangedPosition.IN,
				toUnit('2')
			);

			console.log('buyInQuote is:' + buyInQuote / 1e6);

			let minterSusdBalance = await testUSDC.balanceOf(minter);
			console.log('minterSusdBalance before:' + minterSusdBalance / 1e6);

			let rangedMarketsAMMBalanceSUSd = await testUSDC.balanceOf(rangedMarketsAMM.address);
			console.log('rangedMarketsAMM before:' + rangedMarketsAMMBalanceSUSd / 1e6);

			let additionalSlippage = toUnit(0.01);
			await rangedMarketsAMM.buyFromAMM(
				rangedMarket.address,
				RangedPosition.IN,
				toUnit('2'),
				buyInQuote,
				additionalSlippage,
				{ from: minter }
			);

			let inposition = artifacts.require('RangedPosition');
			let outposition = artifacts.require('RangedPosition');

			let positions = await rangedMarket.positions();
			let inPosition = await inposition.at(positions.inp);
			let outPosition = await outposition.at(positions.outp);

			let minterBalance = await inPosition.balanceOf(minter);
			console.log('minter In tokens balance:' + minterBalance / 1e18);

			minterSusdBalance = await testUSDC.balanceOf(minter);
			console.log('minterSusdBalance after:' + minterSusdBalance / 1e6);

			rangedMarketsAMMBalanceSUSd = await testUSDC.balanceOf(rangedMarketsAMM.address);
			console.log('rangedMarketsAMM after:' + rangedMarketsAMMBalanceSUSd / 1e6);

			let options = await leftMarket.options();
			up = await position.at(options.up);
			down = await position.at(options.down);

			let rangedPositionLeftMarketUPBalance = await up.balanceOf(rangedMarket.address);
			console.log('rangedPositionLeftMarketUPBalance:' + rangedPositionLeftMarketUPBalance / 1e18);

			let rangedPositionLeftMarketDOWNBalance = await down.balanceOf(rangedMarket.address);
			console.log(
				'rangedPositionLeftMarketDOWNBalance:' + rangedPositionLeftMarketDOWNBalance / 1e18
			);

			options = await rightMarket.options();
			up = await position.at(options.up);
			down = await position.at(options.down);

			let rangedPositionRightMarketUPBalance = await up.balanceOf(rangedMarket.address);
			console.log(
				'rangedPositionRightMarketUPBalance:' + rangedPositionRightMarketUPBalance / 1e18
			);

			let rangedPositionRightMarketDOWNBalance = await down.balanceOf(rangedMarket.address);
			console.log(
				'rangedPositionRightMarketDOWNBalance:' + rangedPositionRightMarketDOWNBalance / 1e18
			);

			console.log('DONE BUYING IN POSITION!!!!!!!!!!!!!!!!!!!!!!');
			console.log('BUYING OUT POSITION!!!!!!!!!!!!!!!!!!!!!!');

			let buyOutQuote = await rangedMarketsAMM.buyFromAmmQuote(
				rangedMarket.address,
				RangedPosition.OUT,
				toUnit('2')
			);

			console.log('buyOutQuote is:' + buyOutQuote / 1e6);

			minterSusdBalance = await testUSDC.balanceOf(minter);
			console.log('minterSusdBalance before:' + minterSusdBalance / 1e6);

			rangedMarketsAMMBalanceSUSd = await testUSDC.balanceOf(rangedMarketsAMM.address);
			console.log('rangedMarketsAMM before:' + rangedMarketsAMMBalanceSUSd / 1e6);

			await rangedMarketsAMM.buyFromAMM(
				rangedMarket.address,
				RangedPosition.OUT,
				toUnit('2'),
				buyOutQuote,
				additionalSlippage,
				{ from: minter }
			);

			minterBalance = await outPosition.balanceOf(minter);
			console.log('minter out tokens balance:' + minterBalance / 1e18);

			minterSusdBalance = await testUSDC.balanceOf(minter);
			console.log('minterSusdBalance after:' + minterSusdBalance / 1e6);

			rangedMarketsAMMBalanceSUSd = await testUSDC.balanceOf(rangedMarketsAMM.address);
			console.log('rangedMarketsAMM after:' + rangedMarketsAMMBalanceSUSd / 1e6);

			options = await leftMarket.options();
			up = await position.at(options.up);
			down = await position.at(options.down);

			rangedPositionLeftMarketUPBalance = await up.balanceOf(rangedMarket.address);
			console.log('rangedPositionLeftMarketUPBalance:' + rangedPositionLeftMarketUPBalance / 1e18);

			rangedPositionLeftMarketDOWNBalance = await down.balanceOf(rangedMarket.address);
			console.log(
				'rangedPositionLeftMarketDOWNBalance:' + rangedPositionLeftMarketDOWNBalance / 1e18
			);

			options = await rightMarket.options();
			up = await position.at(options.up);
			down = await position.at(options.down);

			rangedPositionRightMarketUPBalance = await up.balanceOf(rangedMarket.address);
			console.log(
				'rangedPositionRightMarketUPBalance:' + rangedPositionRightMarketUPBalance / 1e18
			);

			rangedPositionRightMarketDOWNBalance = await down.balanceOf(rangedMarket.address);
			console.log(
				'rangedPositionRightMarketDOWNBalance:' + rangedPositionRightMarketDOWNBalance / 1e18
			);

			console.log('DONE BUYING OUT POSITION!!!!!!!!!!!!!!!!!!!!!!');

			console.log('SELIING IN POSITION!!!!!!!!!!!!!!!!!!!!!!');

			let sellInQuote = await rangedMarketsAMM.sellToAmmQuote(
				rangedMarket.address,
				RangedPosition.IN,
				toUnit('1')
			);
			console.log('sellInQuote ' + sellInQuote / 1e6);

			await rangedMarketsAMM.sellToAMM(
				rangedMarket.address,
				RangedPosition.IN,
				toUnit('1'),
				sellInQuote,
				additionalSlippage,
				{ from: minter }
			);

			minterBalance = await inPosition.balanceOf(minter);
			console.log('minter in tokens balance:' + minterBalance / 1e18);

			minterSusdBalance = await testUSDC.balanceOf(minter);
			console.log('minterSusdBalance after:' + minterSusdBalance / 1e6);

			rangedMarketsAMMBalanceSUSd = await testUSDC.balanceOf(rangedMarketsAMM.address);
			console.log('rangedMarketsAMM after:' + rangedMarketsAMMBalanceSUSd / 1e6);

			options = await leftMarket.options();
			up = await position.at(options.up);
			down = await position.at(options.down);

			rangedPositionLeftMarketUPBalance = await up.balanceOf(rangedMarket.address);
			console.log('rangedPositionLeftMarketUPBalance:' + rangedPositionLeftMarketUPBalance / 1e18);

			rangedPositionLeftMarketDOWNBalance = await down.balanceOf(rangedMarket.address);
			console.log(
				'rangedPositionLeftMarketDOWNBalance:' + rangedPositionLeftMarketDOWNBalance / 1e18
			);

			options = await rightMarket.options();
			up = await position.at(options.up);
			down = await position.at(options.down);

			rangedPositionRightMarketUPBalance = await up.balanceOf(rangedMarket.address);
			console.log(
				'rangedPositionRightMarketUPBalance:' + rangedPositionRightMarketUPBalance / 1e18
			);

			rangedPositionRightMarketDOWNBalance = await down.balanceOf(rangedMarket.address);
			console.log(
				'rangedPositionRightMarketDOWNBalance:' + rangedPositionRightMarketDOWNBalance / 1e18
			);

			console.log('DONE SELIING IN POSITION!!!!!!!!!!!!!!!!!!!!!!');

			console.log('SELIING OUT POSITION!!!!!!!!!!!!!!!!!!!!!!');
			let sellOutQuote = await rangedMarketsAMM.sellToAmmQuote(
				rangedMarket.address,
				RangedPosition.OUT,
				toUnit('1')
			);
			console.log('sellOutQuote ' + sellOutQuote / 1e6);

			await rangedMarketsAMM.sellToAMM(
				rangedMarket.address,
				RangedPosition.OUT,
				toUnit('1'),
				sellOutQuote,
				additionalSlippage,
				{ from: minter }
			);

			minterBalance = await outPosition.balanceOf(minter);
			console.log('minter out tokens balance:' + minterBalance / 1e18);

			minterSusdBalance = await testUSDC.balanceOf(minter);
			console.log('minterSusdBalance after:' + minterSusdBalance / 1e6);

			rangedMarketsAMMBalanceSUSd = await testUSDC.balanceOf(rangedMarketsAMM.address);
			console.log('rangedMarketsAMM after:' + rangedMarketsAMMBalanceSUSd / 1e6);

			options = await leftMarket.options();
			up = await position.at(options.up);
			down = await position.at(options.down);

			rangedPositionLeftMarketUPBalance = await up.balanceOf(rangedMarket.address);
			console.log('rangedPositionLeftMarketUPBalance:' + rangedPositionLeftMarketUPBalance / 1e18);

			rangedPositionLeftMarketDOWNBalance = await down.balanceOf(rangedMarket.address);
			console.log(
				'rangedPositionLeftMarketDOWNBalance:' + rangedPositionLeftMarketDOWNBalance / 1e18
			);

			options = await rightMarket.options();
			up = await position.at(options.up);
			down = await position.at(options.down);

			rangedPositionRightMarketUPBalance = await up.balanceOf(rangedMarket.address);
			console.log(
				'rangedPositionRightMarketUPBalance:' + rangedPositionRightMarketUPBalance / 1e18
			);

			rangedPositionRightMarketDOWNBalance = await down.balanceOf(rangedMarket.address);
			console.log(
				'rangedPositionRightMarketDOWNBalance:' + rangedPositionRightMarketDOWNBalance / 1e18
			);

			minterBalance = await inPosition.balanceOf(minter);
			console.log('minter in tokens balance:' + minterBalance / 1e18);

			minterBalance = await outPosition.balanceOf(minter);
			console.log('minter out tokens balance:' + minterBalance / 1e18);

			console.log('DONE SELLING OUT POSITIONS!!!!!');

			console.log('BREAK BUY MAXIMUM IN!!!!!!!!!');
			let availableToBuyFromAMMIn = await rangedMarketsAMM.availableToBuyFromAMM(
				rangedMarket.address,
				RangedPosition.IN
			);

			console.log('availableToBuyFromAMMIn is:' + availableToBuyFromAMMIn / 1e18);

			buyInQuote = await rangedMarketsAMM.buyFromAmmQuote(
				rangedMarket.address,
				RangedPosition.IN,
				toUnit(availableToBuyFromAMMIn / 1e18 - 1)
			);

			console.log('buyInQuote is:' + buyInQuote / 1e6);

			await expect(
				rangedMarketsAMM.buyFromAMM(
					rangedMarket.address,
					RangedPosition.IN,
					toUnit(availableToBuyFromAMMIn / 1e18 + 1),
					buyInQuote,
					additionalSlippage,
					{ from: minter }
				)
			).to.be.revertedWith('ID4');

			console.log('BUY MAXIMUM IN!!!!!!!!!');
			availableToBuyFromAMMIn = await rangedMarketsAMM.availableToBuyFromAMM(
				rangedMarket.address,
				RangedPosition.IN
			);

			console.log('availableToBuyFromAMMIn is:' + availableToBuyFromAMMIn / 1e18);

			buyInQuote = await rangedMarketsAMM.buyFromAmmQuote(
				rangedMarket.address,
				RangedPosition.IN,
				toUnit(availableToBuyFromAMMIn / 1e18 - 1)
			);

			console.log('buyInQuote is:' + buyInQuote / 1e6);

			minterSusdBalance = await testUSDC.balanceOf(minter);
			console.log('minterSusdBalance after:' + minterSusdBalance / 1e6);

			await rangedMarketsAMM.buyFromAMM(
				rangedMarket.address,
				RangedPosition.IN,
				toUnit(availableToBuyFromAMMIn / 1e18 - 1),
				buyInQuote,
				additionalSlippage,
				{ from: minter }
			);

			minterBalance = await inPosition.balanceOf(minter);
			console.log('minter In tokens balance:' + minterBalance / 1e18);

			minterSusdBalance = await testUSDC.balanceOf(minter);
			console.log('minterSusdBalance after:' + minterSusdBalance / 1e6);

			rangedMarketsAMMBalanceSUSd = await testUSDC.balanceOf(rangedMarketsAMM.address);
			console.log('rangedMarketsAMM after:' + rangedMarketsAMMBalanceSUSd / 1e6);

			rangedPositionLeftMarketUPBalance = await up.balanceOf(rangedMarket.address);
			console.log('rangedPositionLeftMarketUPBalance:' + rangedPositionLeftMarketUPBalance / 1e18);

			rangedPositionLeftMarketDOWNBalance = await down.balanceOf(rangedMarket.address);
			console.log(
				'rangedPositionLeftMarketDOWNBalance:' + rangedPositionLeftMarketDOWNBalance / 1e18
			);

			rangedPositionRightMarketUPBalance = await up.balanceOf(rangedMarket.address);
			console.log(
				'rangedPositionRightMarketUPBalance:' + rangedPositionRightMarketUPBalance / 1e18
			);

			rangedPositionRightMarketDOWNBalance = await down.balanceOf(rangedMarket.address);
			console.log(
				'rangedPositionRightMarketDOWNBalance:' + rangedPositionRightMarketDOWNBalance / 1e18
			);

			console.log('DONE BUYING MAXIMUM IN!!!');

			console.log('TESTING EXERCISING!!!');

			await fastForward(day * 20);
			const timestamp = await currentTime();
			await aggregator_sETH.setLatestAnswer(convertToDecimals(5000, 8), timestamp);

			await manager.resolveMarket(leftMarket.address);
			await manager.resolveMarket(rightMarket.address);

			await rangedMarket.exercisePositions({ from: minter });
			minterBalance = await inPosition.balanceOf(minter);
			console.log('minter in tokens balance:' + minterBalance / 1e18);

			minterBalance = await outPosition.balanceOf(minter);
			console.log('minter out tokens balance:' + minterBalance / 1e18);

			minterSusdBalance = await testUSDC.balanceOf(minter);
			console.log('minterSusdBalance before:' + minterSusdBalance / 1e6);

			rangedMarketsAMMBalanceSUSd = await testUSDC.balanceOf(rangedMarketsAMM.address);
			console.log('rangedMarketsAMM after:' + rangedMarketsAMMBalanceSUSd / 1e6);

			let safeBoxsUSD = await testUSDC.balanceOf(safeBox);
			console.log('safeBoxsUSD post buy decimal is:' + safeBoxsUSD / 1e6);
		});
	});
});
