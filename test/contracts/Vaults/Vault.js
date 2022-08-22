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

let aggregator_SNX, aggregator_ETH, aggregator_sUSD, aggregator_BTC;

const ZERO_ADDRESS = '0x' + '0'.repeat(40);

const MockAggregator = artifacts.require('MockAggregatorV2V3');

contract('Vault', accounts => {
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
			.createMarket(
				oracleKey,
				strikePrice.toString(),
				maturity,
				initialMint.toString(),
				false,
				ZERO_ADDRESS
			);
		let receipt = await tx.wait();
		const marketEvent = receipt.events.find(
			event => event['event'] && event['event'] === 'MarketCreated'
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
		aggregator_SNX.setDecimals('8');
		aggregator_ETH.setDecimals('8');
		aggregator_sUSD.setDecimals('8');
		aggregator_BTC.setDecimals('8');
		const timestamp = await currentTime();

		await aggregator_SNX.setLatestAnswer(convertToDecimals(100, 8), timestamp);
		await aggregator_ETH.setLatestAnswer(convertToDecimals(10000, 8), timestamp);
		await aggregator_BTC.setLatestAnswer(convertToDecimals(30000, 8), timestamp);
		await aggregator_sUSD.setLatestAnswer(convertToDecimals(100, 8), timestamp);

		await priceFeed.connect(ownerSigner).addAggregator(SNXkey, aggregator_SNX.address);
		await priceFeed.connect(ownerSigner).addAggregator(ETHkey, aggregator_ETH.address);
		await priceFeed.connect(ownerSigner).addAggregator(BTCkey, aggregator_BTC.address);
		await priceFeed.connect(ownerSigner).addAggregator(sUSDKey, aggregator_sUSD.address);

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
		await thalesAMM.setSafeBoxData(safeBox, toUnit(0.01), { from: owner });
		await thalesAMM.setMinMaxSupportedPriceAndCap(toUnit(0.05), toUnit(0.95), toUnit(1000), {
			from: owner,
		});

		sUSDSynth.issue(thalesAMM.address, sUSDQtyAmm);

		Vault = artifacts.require('Vault');
		vault = await Vault.new();

		await vault.initialize(
			owner,
			thalesAMM.address,
			sUSDSynth.address,
			week,
			toUnit(0.85),
			toUnit(0.95),
			toUnit(1),
			toUnit(40), // 40%
			toUnit(40), // 40%
			toUnit(20) // 20%
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

			const allocationPercentSum = toBN(allocationETH)
				.add(allocationBTC)
				.add(allocationOther);
			assert.equal(allocationPercentSum.toString(), toUnit(100).toString());
		});

		it('should revert if allocation limit values are not valid', async () => {
			const REVERT = 'Invalid allocation limit values';

			await assert.revert(
				vault.setAllocationLimits(toUnit(20), toUnit(20), toUnit(20), { from: owner }),
				REVERT
			);
		});

		it('should revert if price limit values are not valid', async () => {
			const REVERT = 'Invalid price limit values';

			await assert.revert(vault.setPriceLimits(toUnit(80), toUnit(70), { from: owner }), REVERT);
		});

		it('should revert if caller is not owner', async () => {
			const REVERT = 'Only the contract owner may perform this action';

			await assert.revert(vault.setSkewImpactLimit(toUnit(2), { from: minter }), REVERT);
			await assert.revert(vault.setSUSD(ZERO_ADDRESS, { from: minter }), REVERT);
			await assert.revert(vault.setThalesAMM(ZERO_ADDRESS, { from: minter }), REVERT);
		});
	});

	describe('Deposit', () => {
		it('should not deposit with 0', async () => {
			const REVERT = 'Invalid amount';
			await assert.revert(vault.deposit(0, { from: exersicer }), REVERT);
		});

		it('should not deposit if no sUSD', async () => {
			const REVERT = 'No enough sUSD';
			await assert.revert(vault.deposit(toUnit(100), { from: safeBox }), REVERT);
		});

		it('should not deposit if no allowance', async () => {
			const REVERT = 'No allowance';
			await assert.revert(vault.deposit(toUnit(100), { from: minter }), REVERT);
		});

		it('should deposit before vault starts', async () => {
			const round = 1;

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

			assert.equal((await sUSDSynth.balanceOf(vault.address)).toString(), toUnit(300).toString());
		});

		it('can deposit multiple times before vault starts', async () => {
			const round = (await vault.round()) + 1;

			await sUSDSynth.approve(vault.address, toUnit(150), { from: minter });
			await vault.deposit(toUnit(50), { from: minter });
			await vault.deposit(toUnit(50), { from: minter });
			await vault.deposit(toUnit(50), { from: minter });

			assert.equal(
				(await vault.getBalancesPerRound(round, minter)).toString(),
				toUnit(150).toString()
			);
		});
	});

	describe('Start vault', () => {
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

			assert.equal((await sUSDSynth.balanceOf(vault.address)).toString(), toUnit(300).toString());
		});

		it('should start vault', async () => {
			assert.bnEqual(await vault.allocationPerRound(round), toUnit(300));

			const tx = await vault.startVault({ from: owner });
			const now = await currentTime();

			// should set round to 1
			assert.equal((await vault.round()).toString(), round);
			assert.equal(
				(await sUSDSynth.balanceOf(vault.address)).toString(),
				(await vault.allocationPerRound(round)).toString()
			);
			assert.equal((await vault.roundStartTime(round)).toString(), now);
			assert.equal((await vault.roundEndTime(round)).toString(), now + week);

			assert.eventEqual(tx.logs[0], 'VaultStarted', {});
		});

		it('shoult set PnL to 1 if no allocation for round', async () => {
			await vault.startVault({ from: owner });

			fastForward(week);
			await vault.closeRound();

			await sUSDSynth.approve(vault.address, toUnit(150), { from: secondCreator });
			await vault.deposit(toUnit(150), { from: secondCreator });

			fastForward(week);
			await vault.closeRound();
			fastForward(week);
			await vault.closeRound();

			assert.bnEqual(await vault.profitAndLossPerRound(1), toUnit(1));
			assert.bnEqual(await vault.profitAndLossPerRound(2), toUnit(1));
			assert.bnEqual(await vault.profitAndLossPerRound(3), toUnit(1));
			assert.bnEqual(await vault.getAvailableToClaim(secondCreator), toUnit(150));
		});
	});

	describe('Close round', () => {
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
		});

		it('should not close round if vault has not started', async () => {
			const REVERT = 'Vault has not started';
			await assert.revert(vault.closeRound(), REVERT);
		});

		it('should not close round if not enough time has passed', async () => {
			await vault.startVault({ from: owner });
			const REVERT = "Can't close round yet";
			await assert.revert(vault.closeRound(), REVERT);
		});

		it('should close round', async () => {
			await vault.startVault({ from: owner });
			fastForward(week);

			const tx = await vault.closeRound();

			assert.equal(await vault.round(), 2);

			assert.eventEqual(tx.logs[0], 'RoundClosed', {
				round: round,
			});
		});

		it('should set balances per round properly', async () => {
			// START VAULT - START ROUND #1
			await vault.startVault({ from: owner });
			fastForward(week);

			await sUSDSynth.approve(vault.address, toUnit(10), { from: minter });
			await sUSDSynth.approve(vault.address, toUnit(20), { from: dummy });
			await vault.deposit(toUnit(10), { from: minter });
			await vault.deposit(toUnit(20), { from: dummy });

			// CLOSE ROUND #1 - START ROUND #2
			await vault.closeRound({ from: owner });

			round = await vault.round();

			let vaultBalance = (await sUSDSynth.balanceOf(vault.address)).toString();
			let vaultAllocation = (await vault.allocationPerRound(round)).toString();
			assert.equal(vaultBalance, vaultAllocation);

			assert.equal(vaultAllocation, toUnit(330));

			assert.equal(await vault.getClaimedPerRound(1, minter), false);
			assert.equal(await vault.getClaimedPerRound(1, dummy), false);

			assert.equal(await vault.getClaimedPerRound(2, minter), false);
			assert.equal(await vault.getClaimedPerRound(2, dummy), false);

			assert.bnEqual(await vault.getBalancesPerRound(2, minter), toUnit(10));
			assert.bnEqual(await vault.getBalancesPerRound(2, dummy), toUnit(20));

			await sUSDSynth.approve(vault.address, toUnit(10), { from: minter });
			await sUSDSynth.approve(vault.address, toUnit(20), { from: dummy });
			await vault.deposit(toUnit(10), { from: minter });
			await vault.deposit(toUnit(20), { from: dummy });

			fastForward(week);

			// CLOSE ROUND #2 - START ROUND #3
			await vault.closeRound({ from: owner });

			round = await vault.round();

			assert.equal(await vault.getClaimedPerRound(1, minter), true);
			assert.equal(await vault.getClaimedPerRound(1, dummy), true);

			assert.equal(await vault.getClaimedPerRound(2, minter), false);
			assert.equal(await vault.getClaimedPerRound(2, dummy), false);

			assert.equal(await vault.getClaimedPerRound(3, minter), false);
			assert.equal(await vault.getClaimedPerRound(3, dummy), false);

			assert.bnEqual(await vault.getBalancesPerRound(2, minter), toUnit(110));
			assert.bnEqual(await vault.getBalancesPerRound(2, dummy), toUnit(220));

			assert.bnEqual(await vault.getBalancesPerRound(3, minter), toUnit(10));
			assert.bnEqual(await vault.getBalancesPerRound(3, dummy), toUnit(20));

			// no trades in those rounds - PnL is always 1
			assert.bnEqual(await vault.profitAndLossPerRound(1), toUnit(1));
			assert.bnEqual(await vault.profitAndLossPerRound(2), toUnit(1));
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
		});

		it('should not execute trade if amount exceeds available allocation', async () => {
			let now = await currentTime();
			let market1 = await createMarket(
				manager,
				ETHkey,
				toUnit(12000),
				now + day * 5,
				toUnit(10),
				creatorSigner
			);

			const REVERT = 'Amount exceeds available allocation for asset';

			let quote = await thalesAMM.buyFromAmmQuote(
				market1.address,
				Position.DOWN,
				toUnit(40).toString()
			);

			console.log('quote', quote / 1e18);

			console.log('allocation per round', (await vault.allocationPerRound(1)) / 1e18);
			console.log('alloc eth limit', (await vault.allocationLimits(Asset.ETH)) / 1e18);

			await vault.trade(market1.address, toUnit(40).toString());
			console.log('after 40 positions', (await sUSDSynth.balanceOf(vault.address)) / 1e18);
			console.log(
				'eth alloc spent',
				(await vault.getAllocationSpentPerRound(round, Asset.ETH)) / 1e18
			);
			quote = await thalesAMM.buyFromAmmQuote(
				market1.address,
				Position.DOWN,
				toUnit(60).toString()
			);

			console.log('quote', quote / 1e18);

			await vault.trade(market1.address, toUnit(60).toString());
			console.log('after 60 positions', (await sUSDSynth.balanceOf(vault.address)) / 1e18);
			console.log('eth spent', (await vault.getAllocationSpentPerRound(round, Asset.ETH)) / 1e18);
			await vault.trade(market1.address, toUnit(20).toString());
			console.log('after 20 positions', (await sUSDSynth.balanceOf(vault.address)) / 1e18);
			console.log('eth spent', (await vault.getAllocationSpentPerRound(round, Asset.ETH)) / 1e18);

			await assert.revert(vault.trade(market1.address, toUnit(150).toString()), REVERT);
		});

		it('should not execute trade if allocation spent for asset', async () => {
			let now = await currentTime();
			let market1 = await createMarket(
				manager,
				ETHkey,
				toUnit(12000),
				now + day * 5,
				toUnit(10),
				creatorSigner
			);

			const REVERT = 'Amount exceeds available allocation for asset';
			await vault.trade(market1.address, toUnit(130).toString());
			await assert.revert(vault.trade(market1.address, toUnit(150).toString()), REVERT);
		});

		it('should execute trade and distribute amounts properly after one round', async () => {
			let now = await currentTime();
			let market1 = await createMarket(
				manager,
				ETHkey,
				toUnit(12000),
				now + day * 5,
				toUnit(10),
				creatorSigner
			);

			let market2 = await createMarket(
				manager,
				BTCkey,
				toUnit(37000),
				now + day * 6,
				toUnit(10),
				creatorSigner
			);

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

		it('should execute trade and distribute amounts properly after multiple rounds', async () => {
			let now = await currentTime();
			let market1 = await createMarket(
				manager,
				ETHkey,
				toUnit(12000),
				now + day * 5,
				toUnit(10),
				creatorSigner
			);

			let market2 = await createMarket(
				manager,
				BTCkey,
				toUnit(37000),
				now + day * 6,
				toUnit(10),
				creatorSigner
			);

			let market3 = await createMarket(
				manager,
				ETHkey,
				toUnit(12000),
				now + day * 12,
				toUnit(10),
				creatorSigner
			);

			let market4 = await createMarket(
				manager,
				BTCkey,
				toUnit(37000),
				now + day * 13,
				toUnit(10),
				creatorSigner
			);

			await vault.trade(market1.address, toUnit(50).toString());
			await vault.trade(market2.address, toUnit(50).toString());

			await sUSDSynth.approve(vault.address, toUnit(70), { from: minter });
			await sUSDSynth.approve(vault.address, toUnit(80), { from: dummy });
			await sUSDSynth.approve(vault.address, toUnit(1000), { from: exersicer });
			await sUSDSynth.approve(vault.address, toUnit(500), { from: secondCreator });
			await vault.deposit(toUnit(70), { from: minter });
			await vault.deposit(toUnit(80), { from: dummy });
			await vault.deposit(toUnit(1000), { from: exersicer }); // in #1 for #2
			await vault.deposit(toUnit(500), { from: secondCreator });

			assert.bnEqual(await vault.getAvailableToClaim(minter), toUnit(0));
			assert.bnEqual(await vault.getAvailableToClaim(dummy), toUnit(0));
			assert.bnEqual(await vault.getAvailableToClaim(exersicer), toUnit(0));
			assert.bnEqual(await vault.getAvailableToClaim(secondCreator), toUnit(0));

			console.log('#1 available to claim minter', (await vault.getAvailableToClaim(minter)) / 1e18);
			console.log('#1 available to claim dummy', (await vault.getAvailableToClaim(dummy)) / 1e18);
			console.log(
				'#1 available to claim exersicer',
				(await vault.getAvailableToClaim(exersicer)) / 1e18
			);
			console.log(
				'#1 available to claim secondCreator',
				(await vault.getAvailableToClaim(secondCreator)) / 1e18
			);

			// CLOSE ROUND #1 - START ROUND #2
			fastForward(week);

			await vault.closeRound();
			const pnl1 = (await vault.profitAndLossPerRound(1)) / 1e18;
			console.log('pnl #1', pnl1);

			await vault.trade(market3.address, toUnit(50).toString());
			await vault.trade(market4.address, toUnit(50).toString());
			await vault.trade(market3.address, toUnit(50).toString());
			await vault.trade(market4.address, toUnit(50).toString());
			await vault.trade(market3.address, toUnit(50).toString());
			await vault.trade(market4.address, toUnit(50).toString());

			await sUSDSynth.approve(vault.address, toUnit(50), { from: minter });
			await sUSDSynth.approve(vault.address, toUnit(60), { from: dummy });
			await vault.deposit(toUnit(50), { from: minter });
			await vault.deposit(toUnit(60), { from: dummy });

			expect((await vault.getAvailableToClaim(minter)) / 1e18).to.be.approximately(
				pnl1 * 100,
				0.0000000001
			);

			expect((await vault.getAvailableToClaim(dummy)) / 1e18).to.be.approximately(
				pnl1 * 200,
				0.0000000001
			);

			assert.bnEqual(await vault.getAvailableToClaim(exersicer), toUnit(0));
			assert.bnEqual(await vault.getAvailableToClaim(secondCreator), toUnit(0));
			console.log('#2 available to claim minter', (await vault.getAvailableToClaim(minter)) / 1e18);
			console.log('#2 available to claim dummy', (await vault.getAvailableToClaim(dummy)) / 1e18);
			console.log(
				'#2 available to claim exerciser',
				(await vault.getAvailableToClaim(exersicer)) / 1e18
			);
			console.log(
				'#2 available to claim secondCreator',
				(await vault.getAvailableToClaim(secondCreator)) / 1e18
			);

			await vault.withdrawalRequest({ from: minter });
			await vault.withdrawalRequest({ from: dummy });

			console.log('--- AFTER WITHDRAWAL REQUEST minter/dummy ---');

			expect((await vault.getAvailableToClaim(minter)) / 1e18).to.be.approximately(
				pnl1 * 100 + 70,
				0.0000000001
			);

			expect((await vault.getAvailableToClaim(dummy)) / 1e18).to.be.approximately(
				pnl1 * 200 + 80,
				0.0000000001
			);

			assert.bnEqual(await vault.getAvailableToClaim(exersicer), toUnit(0));
			assert.bnEqual(await vault.getAvailableToClaim(secondCreator), toUnit(0));
			console.log('#2 available to claim minter', (await vault.getAvailableToClaim(minter)) / 1e18);
			console.log('#2 available to claim dummy', (await vault.getAvailableToClaim(dummy)) / 1e18);
			console.log(
				'#2 available to claim exerciser',
				(await vault.getAvailableToClaim(exersicer)) / 1e18
			);
			console.log(
				'#2 available to claim secondCreator',
				(await vault.getAvailableToClaim(secondCreator)) / 1e18
			);

			// CLOSE ROUND #2 - START ROUND #3
			fastForward(week);
			await vault.closeRound();

			const pnl2 = (await vault.profitAndLossPerRound(2)) / 1e18;
			console.log('pnl #2', pnl2);

			await sUSDSynth.approve(vault.address, toUnit(150), { from: minter });
			await sUSDSynth.approve(vault.address, toUnit(160), { from: dummy });

			console.log('#3 available to claim minter', (await vault.getAvailableToClaim(minter)) / 1e18);
			console.log('#3 available to claim dummy', (await vault.getAvailableToClaim(dummy)) / 1e18);

			console.log(
				'#3 available to claim exerciser',
				(await vault.getAvailableToClaim(exersicer)) / 1e18
			);
			console.log(
				'#3 available to claim secondCreator',
				(await vault.getAvailableToClaim(secondCreator)) / 1e18
			);

			let tx = await vault.claim({ from: minter });
			let claimedAmountMinter = tx.logs[0].args.amount / 1e18;

			tx = await vault.claim({ from: dummy });
			let claimedAmountDummy = tx.logs[0].args.amount / 1e18;

			console.log('--- AFTER CLAIM #3 minter/dummy ---');
			console.log('#3 available to claim minter', (await vault.getAvailableToClaim(minter)) / 1e18);
			console.log('#3 available to claim dummy', (await vault.getAvailableToClaim(dummy)) / 1e18);
			console.log(
				'#3 available to claim exerciser',
				(await vault.getAvailableToClaim(exersicer)) / 1e18
			);
			console.log(
				'#3 available to claim secondCreator',
				(await vault.getAvailableToClaim(secondCreator)) / 1e18
			);

			await vault.deposit(toUnit(150), { from: minter });
			await vault.deposit(toUnit(160), { from: dummy });

			let calculatedClaimedMinter = (100 * pnl1 + 70) * pnl2;
			let calculatedClaimedDummy = (200 * pnl1 + 80) * pnl2;

			expect(calculatedClaimedMinter).to.be.approximately(claimedAmountMinter, 0.0000000001);
			expect(calculatedClaimedDummy).to.be.approximately(claimedAmountDummy, 0.0000000001);

			console.log('--- AFTER DEPOSIT #3 minter/dummy ---');

			console.log('#3 available to claim minter', (await vault.getAvailableToClaim(minter)) / 1e18);
			console.log('#3 available to claim dummy', (await vault.getAvailableToClaim(dummy)) / 1e18);
			console.log(
				'#3 available to claim exerciser',
				(await vault.getAvailableToClaim(exersicer)) / 1e18
			);
			console.log(
				'#3 available to claim secondCreator',
				(await vault.getAvailableToClaim(secondCreator)) / 1e18
			);

			// CLOSE ROUND #3 - START ROUND #4
			fastForward(week);
			await vault.closeRound();

			now = await currentTime();
			let market5 = await createMarket(
				manager,
				ETHkey,
				toUnit(12000),
				now + day * 5,
				toUnit(10),
				creatorSigner
			);

			let market6 = await createMarket(
				manager,
				BTCkey,
				toUnit(37000),
				now + day * 6,
				toUnit(10),
				creatorSigner
			);

			let market7 = await createMarket(
				manager,
				SNXkey,
				toUnit(120),
				now + day * 6,
				toUnit(10),
				creatorSigner
			);

			const pnl3 = (await vault.profitAndLossPerRound(3)) / 1e18;
			console.log('pnl 3', pnl3);

			// let priceUp = await thalesAMM.price(market5.address, Position.UP);
			// console.log('priceUp ETH is:' + priceUp / 1e18);

			// let priceDown = await thalesAMM.price(market5.address, Position.DOWN);
			// console.log('priceDown ETH is:' + priceDown / 1e18);

			// priceUp = await thalesAMM.price(market6.address, Position.UP);
			// console.log('priceUp BTC is:' + priceUp / 1e18);

			// priceDown = await thalesAMM.price(market6.address, Position.DOWN);
			// console.log('priceDown BTC is:' + priceDown / 1e18);

			// priceUp = await thalesAMM.price(market7.address, Position.UP);
			// console.log('priceUp SNX is:' + priceUp / 1e18);

			// priceDown = await thalesAMM.price(market7.address, Position.DOWN);
			// console.log('priceDown SNX is:' + priceDown / 1e18);

			await vault.trade(market5.address, toUnit(80).toString());
			await vault.trade(market5.address, toUnit(80).toString());
			await vault.trade(market6.address, toUnit(90).toString());
			await vault.trade(market7.address, toUnit(10).toString());
			await vault.trade(market5.address, toUnit(10).toString());
			await vault.trade(market6.address, toUnit(70).toString());
			await vault.trade(market7.address, toUnit(20).toString());
			await vault.trade(market7.address, toUnit(20).toString());
			await vault.trade(market7.address, toUnit(20).toString());
			await vault.trade(market7.address, toUnit(10).toString());

			console.log('#4 available to claim minter', (await vault.getAvailableToClaim(minter)) / 1e18);
			console.log('#4 available to claim dummy', (await vault.getAvailableToClaim(dummy)) / 1e18);
			console.log(
				'#4 available to claim exerciser',
				(await vault.getAvailableToClaim(exersicer)) / 1e18
			);
			console.log(
				'#4 available to claim secondCreator',
				(await vault.getAvailableToClaim(secondCreator)) / 1e18
			);

			await vault.withdrawalRequest({ from: minter });
			await vault.withdrawalRequest({ from: dummy });

			console.log('--- AFTER WITHDRAWAL REQUEST #4 minter/dummy ---');

			console.log('#4 available to claim minter', (await vault.getAvailableToClaim(minter)) / 1e18);
			console.log('#4 available to claim dummy', (await vault.getAvailableToClaim(dummy)) / 1e18);

			let availableExerciser = 1000 * pnl2 * pnl3;
			let availableSecondCreator = 500 * pnl2 * pnl3;
			expect((await vault.getAvailableToClaim(exersicer)) / 1e18).to.be.approximately(
				availableExerciser,
				0.0000000001
			);
			expect((await vault.getAvailableToClaim(secondCreator)) / 1e18).to.be.approximately(
				availableSecondCreator,
				0.0000000001
			);
			console.log(
				'#4 available to claim exerciser',
				(await vault.getAvailableToClaim(exersicer)) / 1e18
			);
			console.log(
				'#4 available to claim secondCreator',
				(await vault.getAvailableToClaim(secondCreator)) / 1e18
			);

			// CLOSE ROUND #4 - START ROUND #5
			fastForward(week);
			await vault.closeRound();

			const pnl4 = (await vault.profitAndLossPerRound(4)) / 1e18;
			console.log('pnl #4', pnl4);

			now = await currentTime();
			let market8 = await createMarket(
				manager,
				SNXkey,
				toUnit(86),
				now + day * 4,
				toUnit(10),
				creatorSigner
			);

			// priceUp = await thalesAMM.price(market8.address, Position.UP);
			// console.log('priceUp SNX is:' + priceUp / 1e18);

			// priceDown = await thalesAMM.price(market8.address, Position.DOWN);
			// console.log('priceDown SNX is:' + priceDown / 1e18);

			console.log('#5 available to claim minter', (await vault.getAvailableToClaim(minter)) / 1e18);
			console.log('#5 available to claim dummy', (await vault.getAvailableToClaim(dummy)) / 1e18);
			console.log(
				'#5 available to claim exerciser',
				(await vault.getAvailableToClaim(exersicer)) / 1e18
			);
			console.log(
				'#5 available to claim secondCreator',
				(await vault.getAvailableToClaim(secondCreator)) / 1e18
			);

			tx = await vault.claim({ from: minter });
			claimedAmountMinter = tx.logs[0].args.amount / 1e18;

			tx = await vault.claim({ from: dummy });
			claimedAmountDummy = tx.logs[0].args.amount / 1e18;

			console.log('#5 available to claim minter', (await vault.getAvailableToClaim(minter)) / 1e18);
			console.log('#5 available to claim dummy', (await vault.getAvailableToClaim(dummy)) / 1e18);
			console.log(
				'#5 available to claim exerciser',
				(await vault.getAvailableToClaim(exersicer)) / 1e18
			);
			console.log(
				'#5 available to claim secondCreator',
				(await vault.getAvailableToClaim(secondCreator)) / 1e18
			);

			assert.equal(await vault.getBalancesPerRound(5, minter), 0);
			assert.equal(await vault.getBalancesPerRound(5, dummy), 0);

			availableExerciser = 1000 * pnl2 * pnl3 * pnl4;
			availableSecondCreator = 500 * pnl2 * pnl3 * pnl4;
			assert.bnEqual(await vault.getAvailableToClaim(minter), 0);
			assert.bnEqual(await vault.getAvailableToClaim(dummy), 0);
			expect((await vault.getAvailableToClaim(exersicer)) / 1e18).to.be.approximately(
				availableExerciser,
				0.0000000001
			);
			expect((await vault.getAvailableToClaim(secondCreator)) / 1e18).to.be.approximately(
				availableSecondCreator,
				0.0000000001
			);

			await vault.withdrawalRequest({ from: exersicer });
			await vault.withdrawalRequest({ from: secondCreator });

			console.log('--- AFTER WITHDRAWAL REQUEST #5 exersicer/secondCreator ---');
			expect((await vault.getAvailableToClaim(exersicer)) / 1e18).to.be.approximately(
				availableExerciser,
				0.0000000001
			);
			expect((await vault.getAvailableToClaim(secondCreator)) / 1e18).to.be.approximately(
				availableSecondCreator,
				0.0000000001
			);
		});
	});
});
