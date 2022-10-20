'use strict';

const { artifacts, contract, web3 } = require('hardhat');
const { toBN } = web3.utils;

const { assert } = require('../../utils/common');
const { fastForward, toUnit, currentTime } = require('../../utils')();
const { toBytes32 } = require('../../../index');
const { setupAllContracts } = require('../../utils/setup');

const { convertToDecimals } = require('../../utils/helpers');

let factory, manager, addressResolver;
let PositionalMarket, priceFeed, oracle, sUSDSynth, PositionalMarketMastercopy, PositionMastercopy;
let market, up, down, position, Synth;

let aggregator_SNX, aggregator_ETH, aggregator_sUSD, aggregator_BTC, aggregator_sAUD;

const ZERO_ADDRESS = '0x' + '0'.repeat(40);

const MockAggregator = artifacts.require('MockAggregatorV2V3');

contract('DiscountVault', (accounts) => {
	const [initialCreator, managerOwner, minter, dummy, exersicer, secondCreator, safeBox] = accounts;
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
	let deciMath;
	let rewardTokenAddress;
	let ThalesAMM;
	let thalesAMM;
	let Vault, vault;
	let MockPriceFeedDeployed;

	beforeEach(async () => {
		priceFeedAddress = owner;
		rewardTokenAddress = owner;

		let MockPriceFeed = artifacts.require('MockPriceFeed');
		MockPriceFeedDeployed = await MockPriceFeed.new(owner);
		await MockPriceFeedDeployed.setPricetoReturn(10000);

		let DeciMath = artifacts.require('DeciMath');
		deciMath = await DeciMath.new();
		await deciMath.setLUT1();
		await deciMath.setLUT2();
		await deciMath.setLUT3_1();
		await deciMath.setLUT3_2();
		await deciMath.setLUT3_3();
		await deciMath.setLUT3_4();

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
			deciMath.address,
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

		await factory.connect(ownerSigner).setThalesAMM(thalesAMM.address);

		sUSDSynth.issue(thalesAMM.address, sUSDQtyAmm);

		Vault = artifacts.require('DiscountVault');
		vault = await Vault.new();

		await vault.initialize(
			owner,
			thalesAMM.address,
			sUSDSynth.address,
			week,
			toUnit(0.2),
			toUnit(0),
			toUnit(40), // 40%
			toUnit(40), // 40%
			toUnit(20), // 20%
			toUnit(1000),
			toUnit(0.6)
		);
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

	describe('Initial properties check', () => {
		it('should set allocation limits properly', async () => {
			const allocationETH = await vault.allocationLimits(Asset.ETH);
			const allocationBTC = await vault.allocationLimits(Asset.BTC);
			const allocationOther = await vault.allocationLimits(Asset.Other);

			const allocationPercentSum = toBN(allocationETH).add(allocationBTC).add(allocationOther);
			assert.equal(allocationPercentSum.toString(), toUnit(100).toString());
		});

		it('should revert if allocation limit values are not valid', async () => {
			const REVERT = 'Invalid allocation limit values';

			await assert.revert(
				vault.setAllocationLimits(toUnit(20), toUnit(20), toUnit(20), { from: owner }),
				REVERT
			);
		});

		it('should revert if caller is not owner setSkewImpactLimit', async () => {
			const REVERT = 'Only the contract owner may perform this action';
			await assert.revert(vault.setDiscountLimit(toUnit(-2), { from: minter }), REVERT);
		});

		it('should revert if discount is not negative', async () => {
			const REVERT = 'Invalid discount value';
			await assert.revert(vault.setDiscountLimit(toUnit(2), { from: owner }), REVERT);
		});

		it('should revert if caller is not owner setThalesAMM', async () => {
			const REVERT = 'Only the contract owner may perform this action';
			await assert.revert(vault.setThalesAMM(ZERO_ADDRESS, { from: minter }), REVERT);
		});
	});

	describe('Claim', () => {
		let round;
		beforeEach(async () => {
			round = 1;

			await sUSDSynth.approve(vault.address, toUnit(100), { from: minter });
			await sUSDSynth.approve(vault.address, toUnit(200), { from: dummy });
			await vault.deposit(toUnit(100), { from: minter });
			await vault.deposit(toUnit(200), { from: dummy });

			assert.bnEqual(await vault.getBalancesPerRound(round, minter), toUnit(100));
			assert.bnEqual(await vault.getBalancesPerRound(round, dummy), toUnit(200));

			assert.bnEqual(await sUSDSynth.balanceOf(vault.address), toUnit(300));
			assert.bnEqual(await vault.allocationPerRound(round), toUnit(300));

			// START VAULT - START ROUND #1
			await vault.startVault({ from: owner });
		});

		it('should not claim if no withdrawal request', async () => {
			fastForward(week);
			// CLOSE ROUND #1 - START ROUND #2
			await vault.closeRound();

			const REVERT = 'Withdrawal request has not been sent';
			await assert.revert(vault.claim({ from: minter }), REVERT);
		});

		it('should be able to claim amount from previous round', async () => {
			fastForward(week);

			// available to claim before round is closed
			assert.bnEqual(await vault.getAvailableToClaim(minter), toUnit(0));
			console.log('cap per round', (await vault.capPerRound(2)) / 1e18);
			await vault.withdrawalRequest({ from: minter });

			// CLOSE ROUND #1 - START ROUND #2
			await vault.closeRound();

			// available to claim before claim
			assert.bnEqual(await vault.getAvailableToClaim(minter), toUnit(100));

			let balanceBeforeClaim = await sUSDSynth.balanceOf(minter);
			let balanceInARound = await vault.getBalancesPerRound(round, minter);

			await vault.claim({ from: minter });
			let balanceAfterClaim = await sUSDSynth.balanceOf(minter);

			// available to claim after claim
			assert.bnEqual(await vault.getAvailableToClaim(minter), toUnit(0));

			assert.bnEqual(balanceAfterClaim, toBN(balanceBeforeClaim).add(balanceInARound));

			const REVERT = 'Withdrawal request has not been sent';
			await assert.revert(vault.claim({ from: minter }), REVERT);
		});

		it('should be able to claim after inactivity', async () => {
			for (let i = 0; i <= 3; i++) {
				fastForward(week);
				await vault.closeRound();
			}

			assert.bnEqual(await vault.getAvailableToClaim(minter), toUnit(100));
			await vault.withdrawalRequest({ from: minter });

			fastForward(week);
			await vault.closeRound();

			round = (await vault.round()).toString();

			assert.bnEqual(await vault.getAvailableToClaim(minter), toUnit(100));

			let balanceBeforeClaim = await sUSDSynth.balanceOf(minter);

			await vault.claim({ from: minter });

			assert.bnEqual(await vault.getAvailableToClaim(minter), toUnit(0));

			for (let i = 1; i < round; i++) {
				assert.bnEqual(await vault.getBalancesPerRound(i, minter), toUnit(100));
			}
			let balanceInARound = await vault.getBalancesPerRound(parseInt(round) - 1, minter);
			let balanceAfterClaim = await sUSDSynth.balanceOf(minter);

			for (let i = 1; i < round; i++) {
				assert.equal(await vault.getClaimedPerRound(i, minter), true);
			}

			assert.bnEqual(balanceAfterClaim, toBN(balanceBeforeClaim).add(balanceInARound));
		});

		it('user claim stress test', async () => {
			for (let i = 0; i <= 53; i++) {
				fastForward(week);
				await vault.closeRound();
			}

			let tx = await vault.withdrawalRequest({ from: minter });
			console.log('gas used - withdrawal request', tx.receipt.gasUsed);
			fastForward(week);
			await vault.closeRound();

			round = (await vault.round()).toString();

			tx = await vault.claim({ from: minter });

			console.log('gas used - claim', tx.receipt.gasUsed);
		});
	});

	describe('Trade', () => {
		let round;
		beforeEach(async () => {
			round = 1;

			await sUSDSynth.approve(vault.address, toUnit(100), { from: minter });
			await sUSDSynth.approve(vault.address, toUnit(200), { from: dummy });
			await vault.deposit(toUnit(100), { from: minter });
			await vault.deposit(toUnit(200), { from: dummy });

			assert.equal(
				(await vault.getBalancesPerRound(round, minter)).toString(),
				toUnit(100).toString()
			);
			assert.equal(
				(await vault.getBalancesPerRound(round, dummy)).toString(),
				toUnit(200).toString()
			);

			assert.bnEqual(await sUSDSynth.balanceOf(vault.address), toUnit(300));
			assert.bnEqual(await vault.allocationPerRound(round), toUnit(300));

			// START VAULT - START ROUND #1
			await vault.startVault({ from: owner });
		});

		it('should not execute trade if market is not valid time wise', async () => {
			const REVERT = 'Market not valid';
			let now = await currentTime();
			let market = await createMarket(
				manager,
				BTCkey,
				toUnit(22000),
				now + day * 16,
				toUnit(10),
				creatorSigner
			);

			await assert.revert(vault.trade(market.address, toUnit(50).toString()), REVERT);
		});

		it('should not execute trade if market is not valid price wise', async () => {
			const REVERT = 'Market not valid';
			let now = await currentTime();
			let market = await createMarket(
				manager,
				BTCkey,
				toUnit(22000),
				now + day * 6,
				toUnit(10),
				creatorSigner
			);

			await assert.revert(vault.trade(market.address, toUnit(50).toString()), REVERT);

			fastForward(week);
			await vault.closeRound();
		});

		it('should not execute trade if amount exceeds available allocation', async () => {
			let now = await currentTime();
			let newMarket = await createMarket(
				manager,
				ETHkey,
				toUnit(11000),
				now + day * 6,
				toUnit(10),
				creatorSigner
			);

			let priceUp = await thalesAMM.price(newMarket.address, Position.UP);
			console.log('priceUp decimal is:' + priceUp / 1e18);

			let options = await newMarket.options();
			up = await position.at(options.up);
			down = await position.at(options.down);

			let ammUpBalance = await up.balanceOf(thalesAMM.address);
			console.log('amm Up Balance is:' + ammUpBalance / 1e18);

			let ammDownBalance = await down.balanceOf(thalesAMM.address);
			console.log('amm Down Balance is:' + ammDownBalance / 1e18);

			let buyFromAmmQuote = await thalesAMM.buyFromAmmQuote(
				newMarket.address,
				Position.DOWN,
				toUnit(300)
			);
			console.log('buyFromAmmQuote decimal is:' + buyFromAmmQuote / 1e18);
			let additionalSlippage = toUnit(0.01);
			await sUSDSynth.approve(thalesAMM.address, sUSDQty, { from: minter });
			await thalesAMM.buyFromAMM(
				newMarket.address,
				Position.DOWN,
				toUnit(300),
				buyFromAmmQuote,
				additionalSlippage,
				{ from: minter }
			);

			priceUp = await thalesAMM.price(newMarket.address, Position.UP);
			console.log('priceUp decimal is:' + priceUp / 1e18);

			let buyPriceImpactPostBuy = await thalesAMM.buyPriceImpact(
				newMarket.address,
				Position.UP,
				toUnit(1)
			);

			let priceDown = await thalesAMM.price(newMarket.address, Position.DOWN);
			console.log('priceDown decimal is:' + priceDown / 1e18);
			console.log('buyPriceImpact post buy 1 decimal is:' + buyPriceImpactPostBuy / 1e16);

			const REVERT = 'Amount exceeds available allocation for asset';

			let quote = await thalesAMM.buyFromAmmQuote(
				newMarket.address,
				Position.UP,
				toUnit(40).toString()
			);

			buyPriceImpactPostBuy = await thalesAMM.buyPriceImpact(
				newMarket.address,
				Position.UP,
				toUnit(40)
			);

			console.log('buyPriceImpact 40 UP decimal is:' + buyPriceImpactPostBuy / 1e16);

			console.log('quote', quote / 1e18);

			console.log('allocation per round', (await vault.allocationPerRound(1)) / 1e18);
			console.log('alloc eth limit', (await vault.allocationLimits(Asset.ETH)) / 1e18);

			await vault.trade(newMarket.address, toUnit(40).toString());
			console.log('after 40 positions', (await sUSDSynth.balanceOf(vault.address)) / 1e18);
			console.log(
				'eth alloc spent',
				(await vault.getAllocationSpentPerRound(round, Asset.ETH)) / 1e18
			);
			console.log(
				'alloc for eth left',
				(await vault.getAvailableAllocationPerAsset(round, Asset.ETH)) / 1e18
			);

			quote = await thalesAMM.buyFromAmmQuote(
				newMarket.address,
				Position.UP,
				toUnit(20).toString()
			);

			console.log('quote', quote / 1e18);

			priceUp = await thalesAMM.price(newMarket.address, Position.UP);
			console.log('price up', priceUp / 1e18);

			await vault.trade(newMarket.address, toUnit(20).toString());
			console.log('after 20 positions', (await sUSDSynth.balanceOf(vault.address)) / 1e18);
			console.log('eth spent', (await vault.getAllocationSpentPerRound(round, Asset.ETH)) / 1e18);
			console.log(
				'alloc for eth left',
				(await vault.getAvailableAllocationPerAsset(round, Asset.ETH)) / 1e18
			);
			await vault.trade(newMarket.address, toUnit(50).toString());
			console.log('after 50 positions', (await sUSDSynth.balanceOf(vault.address)) / 1e18);
			console.log('eth spent', (await vault.getAllocationSpentPerRound(round, Asset.ETH)) / 1e18);
			console.log(
				'alloc for eth left',
				(await vault.getAvailableAllocationPerAsset(round, Asset.ETH)) / 1e18
			);

			await assert.revert(vault.trade(newMarket.address, toUnit(200).toString()), REVERT);

			fastForward(week);
			await vault.closeRound();
		});

		it('should not execute trade if allocation spent for asset', async () => {
			let now = await currentTime();
			let newMarket = await createMarket(
				manager,
				sAUDKey,
				toUnit(11000),
				now + day * 6,
				toUnit(10),
				creatorSigner
			);

			let priceUp = await thalesAMM.price(newMarket.address, Position.UP);
			console.log('priceUp decimal is:' + priceUp / 1e18);

			let options = await newMarket.options();
			up = await position.at(options.up);
			down = await position.at(options.down);

			let ammUpBalance = await up.balanceOf(thalesAMM.address);
			console.log('amm Up Balance is:' + ammUpBalance / 1e18);

			let ammDownBalance = await down.balanceOf(thalesAMM.address);
			console.log('amm Down Balance is:' + ammDownBalance / 1e18);

			let buyFromAmmQuote = await thalesAMM.buyFromAmmQuote(
				newMarket.address,
				Position.DOWN,
				toUnit(300)
			);
			console.log('buyFromAmmQuote decimal is:' + buyFromAmmQuote / 1e18);
			let additionalSlippage = toUnit(0.01);
			await sUSDSynth.approve(thalesAMM.address, sUSDQty, { from: minter });
			await thalesAMM.buyFromAMM(
				newMarket.address,
				Position.DOWN,
				toUnit(300),
				buyFromAmmQuote,
				additionalSlippage,
				{ from: minter }
			);

			priceUp = await thalesAMM.price(newMarket.address, Position.UP);
			console.log('priceUp decimal is:' + priceUp / 1e18);

			let buyPriceImpactPostBuy = await thalesAMM.buyPriceImpact(
				newMarket.address,
				Position.UP,
				toUnit(1)
			);

			let priceDown = await thalesAMM.price(newMarket.address, Position.DOWN);
			console.log('priceDown decimal is:' + priceDown / 1e18);
			console.log('buyPriceImpact post buy 1 decimal is:' + buyPriceImpactPostBuy / 1e16);

			const REVERT = 'Amount exceeds available allocation for asset';
			await vault.trade(newMarket.address, toUnit(70).toString());
			await assert.revert(vault.trade(newMarket.address, toUnit(100).toString()), REVERT);
		});

		it('should execute trade and distribute amounts properly after one round', async () => {
			let now = await currentTime();
			let market1 = await createMarket(
				manager,
				ETHkey,
				toUnit(11000),
				now + day * 6,
				toUnit(10),
				creatorSigner
			);

			let priceUp = await thalesAMM.price(market1.address, Position.UP);
			console.log('priceUp decimal is:' + priceUp / 1e18);

			let options = await market1.options();
			up = await position.at(options.up);
			down = await position.at(options.down);

			let ammUpBalance = await up.balanceOf(thalesAMM.address);
			console.log('amm Up Balance is:' + ammUpBalance / 1e18);

			let ammDownBalance = await down.balanceOf(thalesAMM.address);
			console.log('amm Down Balance is:' + ammDownBalance / 1e18);

			let buyFromAmmQuote = await thalesAMM.buyFromAmmQuote(
				market1.address,
				Position.DOWN,
				toUnit(300)
			);
			console.log('buyFromAmmQuote decimal is:' + buyFromAmmQuote / 1e18);
			let additionalSlippage = toUnit(0.01);
			await sUSDSynth.approve(thalesAMM.address, sUSDQty, { from: minter });
			await thalesAMM.buyFromAMM(
				market1.address,
				Position.DOWN,
				toUnit(300),
				buyFromAmmQuote,
				additionalSlippage,
				{ from: minter }
			);

			priceUp = await thalesAMM.price(market1.address, Position.UP);
			console.log('priceUp decimal is:' + priceUp / 1e18);

			let buyPriceImpactPostBuy = await thalesAMM.buyPriceImpact(
				market1.address,
				Position.UP,
				toUnit(1)
			);

			let priceDown = await thalesAMM.price(market1.address, Position.DOWN);
			console.log('priceDown decimal is:' + priceDown / 1e18);
			console.log('buyPriceImpact post buy 1 decimal is:' + buyPriceImpactPostBuy / 1e16);

			let market2 = await createMarket(
				manager,
				BTCkey,
				toUnit(33000),
				now + day * 6,
				toUnit(10),
				creatorSigner
			);

			priceUp = await thalesAMM.price(market2.address, Position.UP);
			console.log('priceUp decimal is:' + priceUp / 1e18);

			options = await market2.options();
			up = await position.at(options.up);
			down = await position.at(options.down);

			ammUpBalance = await up.balanceOf(thalesAMM.address);
			console.log('amm Up Balance is:' + ammUpBalance / 1e18);

			ammDownBalance = await down.balanceOf(thalesAMM.address);
			console.log('amm Down Balance is:' + ammDownBalance / 1e18);

			buyFromAmmQuote = await thalesAMM.buyFromAmmQuote(
				market2.address,
				Position.DOWN,
				toUnit(300)
			);
			console.log('buyFromAmmQuote decimal is:' + buyFromAmmQuote / 1e18);
			additionalSlippage = toUnit(0.01);
			await sUSDSynth.approve(thalesAMM.address, sUSDQty, { from: minter });
			await thalesAMM.buyFromAMM(
				market2.address,
				Position.DOWN,
				toUnit(300),
				buyFromAmmQuote,
				additionalSlippage,
				{ from: minter }
			);

			priceUp = await thalesAMM.price(market2.address, Position.UP);
			console.log('priceUp decimal is:' + priceUp / 1e18);

			buyPriceImpactPostBuy = await thalesAMM.buyPriceImpact(
				market2.address,
				Position.UP,
				toUnit(1)
			);

			priceDown = await thalesAMM.price(market2.address, Position.DOWN);
			console.log('priceDown decimal is:' + priceDown / 1e18);
			console.log('buyPriceImpact post buy 1 decimal is:' + buyPriceImpactPostBuy / 1e16);

			// let priceUp = await thalesAMM.price(market1.address, Position.UP);
			// console.log('priceUp ETH is:' + priceUp / 1e18);

			// let priceDown = await thalesAMM.price(market1.address, Position.DOWN);
			// console.log('priceDown ETH is:' + priceDown / 1e18);

			// priceUp = await thalesAMM.price(market2.address, Position.UP);
			// console.log('priceUp BTC is:' + priceUp / 1e18);

			// priceDown = await thalesAMM.price(market2.address, Position.DOWN);
			// console.log('priceDown BTC is:' + priceDown / 1e18);

			console.log('vault balance before trade', (await sUSDSynth.balanceOf(vault.address)) / 1e18);

			await vault.trade(market1.address, toUnit(50).toString());
			await vault.trade(market2.address, toUnit(50).toString());

			await vault.withdrawalRequest({ from: minter });
			await vault.withdrawalRequest({ from: dummy });

			fastForward(week);

			// CLOSE ROUND #1 - START ROUND #2
			await vault.closeRound({ from: owner });
			console.log('vault balance after trade', (await sUSDSynth.balanceOf(vault.address)) / 1e18);

			const pnl = (await vault.profitAndLossPerRound(1)) / 1e18;
			console.log('pnl', pnl);

			let balanceBeforeClaimMinter = (await sUSDSynth.balanceOf(minter)) / 1e18;
			let balanceBeforeClaimDummy = (await sUSDSynth.balanceOf(dummy)) / 1e18;

			await vault.claim({ from: minter });
			await vault.claim({ from: dummy });

			let balanceAfterClaimMinter = (await sUSDSynth.balanceOf(minter)) / 1e18;
			let balanceAfterClaimDummy = (await sUSDSynth.balanceOf(dummy)) / 1e18;

			let balanceAfterRoundMinter = 100 * pnl;
			let balanceAfterRoundDummy = 200 * pnl;

			expect(balanceAfterClaimMinter).to.be.approximately(
				balanceBeforeClaimMinter + balanceAfterRoundMinter,
				0.0000000001
			);
			expect(balanceAfterClaimDummy).to.be.approximately(
				balanceBeforeClaimDummy + balanceAfterRoundDummy,
				0.0000000001
			);
		});
	});
});
