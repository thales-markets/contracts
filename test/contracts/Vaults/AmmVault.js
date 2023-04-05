'use strict';

const { artifacts, contract, web3 } = require('hardhat');
const { toBN } = web3.utils;

const {
	fastForward,
	toUnit,
	fromUnit,
	currentTime,
	bytesToString,
	multiplyDecimalRound,
	divideDecimalRound,
} = require('../../utils')();

const { assert } = require('../../utils/common');
const { toBytes32 } = require('../../../index');
const { setupAllContracts } = require('../../utils/setup');

const { convertToDecimals } = require('../../utils/helpers');

let factory, manager, addressResolver;
let PositionalMarket, priceFeed, oracle, sUSDSynth, PositionalMarketMastercopy, PositionMastercopy;
let market, up, down, position, Synth;

let aggregator_SNX, aggregator_ETH, aggregator_sUSD, aggregator_BTC, aggregator_sAUD;

const ZERO_ADDRESS = '0x' + '0'.repeat(40);

const MockAggregator = artifacts.require('MockAggregatorV2V3');

contract('Vault', (accounts) => {
	const [
		initialCreator,
		managerOwner,
		minter,
		dummy,
		exersicer,
		secondCreator,
		safeBox,
		first,
		second,
		firstLiquidityProvider,
		defaultLiquidityProvider,
	] = accounts;
	const [creator, owner] = accounts;
	let creatorSigner, ownerSigner;

	const sUSDQty = toUnit(100000);
	const sUSDQtyAmm = toUnit(1000);

	const hour = 60 * 60;
	const day = 24 * 60 * 60;
	const week = 7 * day;

	const sAUDKey = toBytes32('sAUD');
	const sUSDKey = toBytes32('sUSD');
	const ETHkey = toBytes32('ETH');
	const BTCkey = toBytes32('BTC');
	const SNXkey = toBytes32('SNX');

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

		await factory.connect(ownerSigner).setPositionalMarketManager(manager.address);
		await factory
			.connect(ownerSigner)
			.setPositionalMarketMastercopy(PositionalMarketMastercopy.address);
		await factory.connect(ownerSigner).setPositionMastercopy(PositionMastercopy.address);

		aggregator_SNX = await MockAggregator.new({ from: managerOwner });
		aggregator_ETH = await MockAggregator.new({ from: managerOwner });
		aggregator_BTC = await MockAggregator.new({ from: managerOwner });
		aggregator_sUSD = await MockAggregator.new({ from: managerOwner });
		aggregator_sAUD = await MockAggregator.new({ from: managerOwner });
		aggregator_SNX.setDecimals('8');
		aggregator_ETH.setDecimals('8');
		aggregator_sUSD.setDecimals('8');
		aggregator_BTC.setDecimals('8');
		aggregator_sAUD.setDecimals('8');
		const timestamp = await currentTime();

		await aggregator_SNX.setLatestAnswer(convertToDecimals(100, 8), timestamp);
		await aggregator_ETH.setLatestAnswer(convertToDecimals(10000, 8), timestamp);
		await aggregator_BTC.setLatestAnswer(convertToDecimals(30000, 8), timestamp);
		await aggregator_sUSD.setLatestAnswer(convertToDecimals(100, 8), timestamp);
		await aggregator_sAUD.setLatestAnswer(convertToDecimals(10000, 8), timestamp);
		await manager.connect(creatorSigner).setTimeframeBuffer(1);
		await manager.connect(creatorSigner).setPriceBuffer(toUnit(0.01).toString());

		await priceFeed.connect(ownerSigner).addAggregator(SNXkey, aggregator_SNX.address);
		await priceFeed.connect(ownerSigner).addAggregator(ETHkey, aggregator_ETH.address);
		await priceFeed.connect(ownerSigner).addAggregator(BTCkey, aggregator_BTC.address);
		await priceFeed.connect(ownerSigner).addAggregator(sUSDKey, aggregator_sUSD.address);
		await priceFeed.connect(ownerSigner).addAggregator(sAUDKey, aggregator_sAUD.address);

		await Promise.all([
			sUSDSynth.issue(initialCreator, sUSDQty),
			sUSDSynth.approve(manager.address, sUSDQty, { from: initialCreator }),
			sUSDSynth.issue(minter, sUSDQty),
			sUSDSynth.approve(manager.address, sUSDQty, { from: minter }),
			sUSDSynth.issue(dummy, sUSDQty),
			sUSDSynth.approve(manager.address, sUSDQty, { from: dummy }),
			sUSDSynth.issue(exersicer, sUSDQty),
			sUSDSynth.approve(manager.address, sUSDQty, { from: exersicer }),
			sUSDSynth.issue(secondCreator, sUSDQty),
			sUSDSynth.approve(manager.address, sUSDQty, { from: secondCreator }),
		]);
	});

	let priceFeedAddress;
	let rewardTokenAddress;
	let ThalesAMM;
	let thalesAMM;
	let Vault, vault;
	let MockPriceFeedDeployed;
	let ThalesAMMLiquidityPool;

	beforeEach(async () => {
		priceFeedAddress = owner;
		rewardTokenAddress = owner;

		let MockPriceFeed = artifacts.require('MockPriceFeed');
		MockPriceFeedDeployed = await MockPriceFeed.new(owner);
		await MockPriceFeedDeployed.setPricetoReturn(10000);

		priceFeedAddress = MockPriceFeedDeployed.address;

		const hour = 60 * 60;
		const day = 24 * 60 * 60;
		const week = 7 * day;
		ThalesAMM = artifacts.require('ThalesAMM');
		thalesAMM = await ThalesAMM.new();
		await thalesAMM.initialize(
			owner,
			priceFeedAddress,
			sUSDSynth.address,
			toUnit(1000),
			owner,
			toUnit(0.01),
			toUnit(0.05),
			hour * 2
		);
		await thalesAMM.setPositionalMarketManager(manager.address, { from: owner });
		await thalesAMM.setImpliedVolatilityPerAsset(ETHkey, toUnit(120), { from: owner });
		await thalesAMM.setImpliedVolatilityPerAsset(BTCkey, toUnit(120), { from: owner });
		await thalesAMM.setImpliedVolatilityPerAsset(SNXkey, toUnit(120), { from: owner });
		await thalesAMM.setImpliedVolatilityPerAsset(sAUDKey, toUnit(120), { from: owner });
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
				_sUSD: sUSDSynth.address,
				_roundLength: week,
				_maxAllowedDeposit: toUnit(1000).toString(),
				_minDepositAmount: toUnit(100).toString(),
				_maxAllowedUsers: 100,
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
		await sUSDSynth.issue(firstLiquidityProvider, toUnit('100000'), { from: owner });
		await sUSDSynth.approve(ThalesAMMLiquidityPool.address, toUnit('100000'), {
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
		await sUSDSynth.issue(defaultLiquidityProvider, toUnit('100000'), { from: owner });
		await sUSDSynth.approve(ThalesAMMLiquidityPool.address, toUnit('100000'), {
			from: defaultLiquidityProvider,
		});

		await factory.connect(ownerSigner).setThalesAMM(thalesAMM.address);

		sUSDSynth.issue(thalesAMM.address, sUSDQtyAmm);

		Vault = artifacts.require('AmmVault');
		vault = await Vault.new();

		await vault.initialize({
			_owner: owner,
			_thalesAmm: thalesAMM.address,
			_sUSD: sUSDSynth.address,
			_roundLength: week,
			_priceLowerLimit: toUnit(0.05).toString(),
			_priceUpperLimit: toUnit(1).toString(),
			_skewImpactLimit: toUnit(0.1).toString(), // 40%
			_allocationLimitsPerMarketPerRound: toUnit(10).toString(), // 40%
			_maxAllowedDeposit: toUnit(1000).toString(), // 20%
			_utilizationRate: toUnit(0.5).toString(),
			_minDepositAmount: toUnit(100).toString(),
			_maxAllowedUsers: 100,
			_minTradeAmount: toUnit(10).toString(),
		});

		await sUSDSynth.approve(vault.address, toUnit('100000'), { from: first });
		await sUSDSynth.approve(vault.address, toUnit('100000'), { from: second });
		await sUSDSynth.approve(thalesAMM.address, toUnit('100000'), { from: first });
		await sUSDSynth.approve(thalesAMM.address, toUnit('100000'), { from: second });
		sUSDSynth.issue(first, sUSDQtyAmm);
		sUSDSynth.issue(second, sUSDQtyAmm);

		await thalesAMM.setSafeBoxFeePerAddress(vault.address, toUnit('0.005'), {
			from: owner,
		});

		await thalesAMM.setMinSpreadPerAddress(vault.address, toUnit('0.005'), {
			from: owner,
		});
	});

	const Position = {
		UP: toBN(0),
		DOWN: toBN(1),
	};

	const Asset = {
		ETH: toBN(0),
		BTC: toBN(1),
		Other: toBN(2),
	};

	describe('Test vault', () => {
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

			round = 1;
			assert.bnEqual(await vault.getBalancesPerRound(round, first), toUnit(100));

			assert.bnEqual(await sUSDSynth.balanceOf(vault.address), toUnit(100));
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

			assert.bnEqual(await sUSDSynth.balanceOf(vault.address), toUnit(300));
			assert.bnEqual(await vault.allocationPerRound(round), toUnit(200));
			assert.bnEqual(await vault.capPerRound(round), toUnit(300));

			await assert.revert(
				vault.deposit(toUnit(1000), { from: first }),
				'Deposit amount exceeds vault cap'
			);
			await assert.revert(vault.deposit(toUnit(10), { from: first }), 'Invalid amount');

			usersCurrentlyInVault = await vault.usersCurrentlyInVault();
			console.log('usersCurrentlyInVault is:' + usersCurrentlyInVault);

			await fastForward(week);
			// CLOSE ROUND #1 - START ROUND #2
			await vault.closeRound();

			round = 2;
			assert.bnEqual(await vault.getBalancesPerRound(round, first), toUnit(100));
			assert.bnEqual(await vault.getBalancesPerRound(round, second), toUnit(200));
			assert.bnEqual(await sUSDSynth.balanceOf(vault.address), toUnit(300));

			await vault.withdrawalRequest({ from: second });
			assert.bnEqual(await vault.capPerRound(3), toUnit(100));
			usersCurrentlyInVault = await vault.usersCurrentlyInVault();
			console.log('usersCurrentlyInVault is:' + usersCurrentlyInVault);

			await fastForward(week);
			// CLOSE ROUND #1 - START ROUND #3
			await vault.closeRound();

			round = 3;
			assert.bnEqual(await vault.getBalancesPerRound(round, first), toUnit(100));
			assert.bnEqual(await vault.getBalancesPerRound(round, second), 0);
			assert.bnEqual(await sUSDSynth.balanceOf(vault.address), toUnit(100));
			assert.bnEqual(await vault.allocationPerRound(round), toUnit(100));

			usersCurrentlyInVault = await vault.usersCurrentlyInVault();
			console.log('usersCurrentlyInVault is:' + usersCurrentlyInVault);

			await assert.revert(vault.withdrawalRequest({ from: second }), 'Nothing to withdraw');

			await vault.withdrawalRequest({ from: first });

			await fastForward(week);
			// CLOSE ROUND #1 - START ROUND #4
			await vault.closeRound();
			round = 4;
			assert.bnEqual(await vault.getBalancesPerRound(round, first), 0);
			assert.bnEqual(await vault.getBalancesPerRound(round, second), 0);
			assert.bnEqual(await sUSDSynth.balanceOf(vault.address), 0);
			assert.bnEqual(await vault.allocationPerRound(round), 0);
			usersCurrentlyInVault = await vault.usersCurrentlyInVault();
			console.log('usersCurrentlyInVault is:' + usersCurrentlyInVault);

			await vault.deposit(toUnit(200), { from: second });
			await vault.deposit(toUnit(300), { from: first });

			await fastForward(week);
			// CLOSE ROUND #1 - START ROUND #5
			await vault.closeRound();

			await vault.deposit(toUnit(100), { from: second });
			await assert.revert(
				vault.withdrawalRequest({ from: second }),
				"Can't withdraw as you already deposited for next round"
			);

			await fastForward(week);
			// CLOSE ROUND #1 - START ROUND #6
			await vault.closeRound();

			roundLength = await vault.roundLength();
			console.log('roundLength is:' + roundLength);

			round = await vault.round();
			console.log('round is:' + round);

			let roundStartTime = await vault.roundStartTime(round);
			console.log('roundStartTime is:' + roundStartTime);

			let now = await currentTime();
			// CLOSE ROUND #1 - START ROUND #7
			await fastForward(week);
			await vault.closeRound();
			round = await vault.round();
			console.log('round is:' + round);
			roundStartTime = await vault.roundStartTime(round);
			console.log('roundStartTime is:' + roundStartTime);

			let getCurrentRoundEnd = await vault.getCurrentRoundEnd();
			console.log('getCurrentRoundEnd is:' + getCurrentRoundEnd);

			now = await currentTime();
			let market1 = await createMarket(
				manager,
				ETHkey,
				toUnit(12000),
				now + day * 5,
				toUnit(10),
				creatorSigner
			);

			let maturity = await market1.times();

			var maturityBefore = maturity[0];
			console.log('maturityBefore is:' + maturityBefore);

			let availableToBuy = await thalesAMM.availableToBuyFromAMM(market1.address, 0);
			console.log('AvailableToBuy: ' + availableToBuy / 1e18);
			let additionalSlippage = toUnit(0.01);
			let buyFromAmmQuote = await thalesAMM.buyFromAmmQuote(market1.address, 1, toUnit(140));
			console.log('buyQuote: ', fromUnit(buyFromAmmQuote));
			let answer = await thalesAMM.buyFromAMM(
				market1.address,
				1,
				toUnit(140),
				buyFromAmmQuote,
				additionalSlippage,
				{ from: first }
			);

			let buyPriceImpactFirst = await thalesAMM.buyPriceImpact(market1.address, 0, toUnit(20));
			console.log('buyPriceImpactFirst: ', fromUnit(buyPriceImpactFirst));

			buyFromAmmQuote = await thalesAMM.buyFromAmmQuote(market1.address, 0, toUnit(1));
			console.log('buyQuote: ', fromUnit(buyFromAmmQuote));

			buyFromAmmQuote = await thalesAMM.buyFromAmmQuote(market1.address, 0, toUnit(20));
			console.log('buyQuote 20: ', fromUnit(buyFromAmmQuote));

			let allocationSpentInARound = await vault.allocationSpentInARound(round);
			console.log('allocationSpentInARound is:' + allocationSpentInARound / 1e18);

			await vault.trade(market1.address, toUnit(20), 0);

			allocationSpentInARound = await vault.allocationSpentInARound(round);
			console.log('allocationSpentInARound is:' + allocationSpentInARound / 1e18);

			buyFromAmmQuote = await thalesAMM.buyFromAmmQuote(market1.address, 0, toUnit(200));
			console.log('buyQuote: ', fromUnit(buyFromAmmQuote));
			answer = await thalesAMM.buyFromAMM(
				market1.address,
				0,
				toUnit(200),
				buyFromAmmQuote,
				additionalSlippage,
				{ from: first }
			);

			buyPriceImpactFirst = await thalesAMM.buyPriceImpact(market1.address, 1, toUnit(20));
			console.log('buyPriceImpactFirst: ', fromUnit(buyPriceImpactFirst));
			buyFromAmmQuote = await thalesAMM.buyFromAmmQuote(market1.address, 1, toUnit(1));
			console.log('buyQuote: ', fromUnit(buyFromAmmQuote));

			let canCloseCurrentRound = await vault.canCloseCurrentRound();
			console.log('canCloseCurrentRound is:' + canCloseCurrentRound);

			await fastForward(week);
			canCloseCurrentRound = await vault.canCloseCurrentRound();
			console.log('canCloseCurrentRound is:' + canCloseCurrentRound);

			assert.equal(true, await market1.canResolve());

			await manager.resolveMarket(market1.address);

			canCloseCurrentRound = await vault.canCloseCurrentRound();
			console.log('canCloseCurrentRound is:' + canCloseCurrentRound);

			let balanceFirst = await vault.getBalancesPerRound(round, first);
			console.log('balanceFirst is:' + balanceFirst / 1e18);

			let balanceSecond = await vault.getBalancesPerRound(round, second);
			console.log('balanceSecond is:' + balanceSecond / 1e18);

			let balanceVault = await sUSDSynth.balanceOf(vault.address);
			console.log('balanceVault is:' + balanceVault / 1e18);

			let profitAndLossPerRound = await vault.profitAndLossPerRound(round - 1);
			console.log('profitAndLossPerRound is:' + profitAndLossPerRound / 1e18);

			await fastForward(week);
			await vault.closeRound();

			round = await vault.round();
			console.log('round is:' + round);

			balanceFirst = await vault.getBalancesPerRound(round, first);
			console.log('balanceFirst is:' + balanceFirst / 1e18);

			balanceSecond = await vault.getBalancesPerRound(round, second);
			console.log('balanceSecond is:' + balanceSecond / 1e18);

			balanceVault = await sUSDSynth.balanceOf(vault.address);
			console.log('balanceVault is:' + balanceVault / 1e18);

			profitAndLossPerRound = await vault.profitAndLossPerRound(round - 1);
			console.log('profitAndLossPerRound is:' + profitAndLossPerRound / 1e18);
		});
	});
});
