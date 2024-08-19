'use strict';

const { artifacts, contract, web3 } = require('hardhat');
const { toBN } = web3.utils;

const { assert } = require('../../utils/common');

const { toBytes32 } = require('../../../index');
const { expect } = require('chai');
const { toDecimal } = require('web3-utils');
const { setupAllContracts } = require('../../utils/setup');

const ZERO_ADDRESS = '0x' + '0'.repeat(40);

const { fastForward, toUnit, fromUnit, currentTime } = require('../../utils')();
const { encodeCall, convertToDecimals } = require('../../utils/helpers');
const MockAggregator = artifacts.require('MockAggregatorV2V3');

contract('StakingThales', (accounts) => {
	const [first, second, third, stakingBettingProxy, owner] = accounts;
	const [initialCreator, managerOwner, minter, dummy] = accounts;
	let ThalesDeployed,
		ThalesFeeDeployed,
		StakingThalesDeployed,
		EscrowThalesDeployed,
		SNXRewardsDeployed,
		AddressResolverDeployed,
		ProxyEscrowDeployed,
		ProxyStakingDeployed,
		ThalesStakingRewardsPoolDeployed;
	let ThalesStakingRewardsPool;

	let initializeStalkingData, initializeEscrowData;

	let EscrowImplementation, StakingImplementation;

	const sUSDQty = toUnit(5555);
	const SECOND = 1000;
	const DAY = 86400;
	const WEEK = 604800;
	let manager, factory;
	let sUSDSynth, PositionalMarketMastercopy, PositionMastercopy, addressResolver;

	const SNX = toBytes32('SNX');
	let PriceFeedInstance;
	let aggregatorSNX;
	let timestamp;
	let newRate = 4.797;

	before(async () => {
		({
			PositionalMarketManager: manager,
			PositionalMarketFactory: factory,
			PositionalMarketMastercopy: PositionalMarketMastercopy,
			PositionMastercopy: PositionMastercopy,
			AddressResolver: addressResolver,
			SynthsUSD: sUSDSynth,
			PriceFeed: PriceFeedInstance,
		} = await setupAllContracts({
			accounts,
			synths: ['sUSD'],
			contracts: [
				'FeePool',
				'PositionalMarketMastercopy',
				'PositionMastercopy',
				'PositionalMarketFactory',
			],
		}));

		const [creatorSigner, ownerSigner] = await ethers.getSigners();

		aggregatorSNX = await MockAggregator.new({ from: managerOwner });
		await aggregatorSNX.setDecimals('8');

		await manager.connect(creatorSigner).setPositionalMarketFactory(factory.address);

		await factory.connect(ownerSigner).setPositionalMarketManager(manager.address);
		await factory
			.connect(ownerSigner)
			.setPositionalMarketMastercopy(PositionalMarketMastercopy.address);
		await factory.connect(ownerSigner).setPositionMastercopy(PositionMastercopy.address);

		await Promise.all([
			sUSDSynth.issue(initialCreator, sUSDQty),
			sUSDSynth.approve(manager.address, sUSDQty, { from: initialCreator }),
			sUSDSynth.issue(minter, sUSDQty),
			sUSDSynth.approve(manager.address, sUSDQty, { from: minter }),
			sUSDSynth.issue(dummy, sUSDQty),
			sUSDSynth.approve(manager.address, sUSDQty, { from: dummy }),
		]);
	});

	beforeEach(async () => {
		const [creatorSigner, ownerSigner] = await ethers.getSigners();
		let Thales = artifacts.require('Thales');
		let EscrowThales = artifacts.require('EscrowThales');
		let StakingThales = artifacts.require('StakingThales');
		let SNXRewards = artifacts.require('SNXRewards');
		SNXRewardsDeployed = await SNXRewards.new();
		let AddressResolver = artifacts.require('AddressResolverHelper');
		AddressResolverDeployed = await AddressResolver.new();
		await AddressResolverDeployed.setSNXRewardsAddress(SNXRewardsDeployed.address);
		let OwnedUpgradeabilityProxy = artifacts.require('OwnedUpgradeabilityProxy');
		ThalesDeployed = await Thales.new({ from: owner });
		ThalesFeeDeployed = await Thales.new({ from: owner });
		//Price feed setup
		await PriceFeedInstance.connect(ownerSigner).addAggregator(SNX, aggregatorSNX.address);
		timestamp = await currentTime();

		await aggregatorSNX.setLatestAnswer(convertToDecimals(newRate, 8), timestamp);

		ProxyEscrowDeployed = await OwnedUpgradeabilityProxy.new({ from: initialCreator });
		ProxyStakingDeployed = await OwnedUpgradeabilityProxy.new({ from: initialCreator });
		EscrowImplementation = await EscrowThales.new({ from: owner });
		StakingImplementation = await StakingThales.new({ from: owner });
		EscrowThalesDeployed = await EscrowThales.at(ProxyEscrowDeployed.address);
		StakingThalesDeployed = await StakingThales.at(ProxyStakingDeployed.address);

		initializeEscrowData = encodeCall(
			'initialize',
			['address', 'address'],
			[owner, ThalesDeployed.address]
		);
		await ProxyEscrowDeployed.upgradeToAndCall(EscrowImplementation.address, initializeEscrowData, {
			from: initialCreator,
		});

		initializeStalkingData = encodeCall(
			'initialize',
			['address', 'address', 'address', 'address', 'uint256', 'uint256', 'address'],
			[
				owner,
				EscrowThalesDeployed.address,
				ThalesDeployed.address,
				ThalesFeeDeployed.address,
				WEEK,
				WEEK,
				SNXRewardsDeployed.address,
			]
		);

		await ProxyStakingDeployed.upgradeToAndCall(
			StakingImplementation.address,
			initializeStalkingData,
			{
				from: initialCreator,
			}
		);

		ThalesStakingRewardsPool = artifacts.require('ThalesStakingRewardsPool');
		ThalesStakingRewardsPoolDeployed = await ThalesStakingRewardsPool.new({ from: owner });
		await ThalesStakingRewardsPoolDeployed.initialize(
			owner,
			ProxyStakingDeployed.address,
			ThalesDeployed.address,
			EscrowThalesDeployed.address
		);
		await EscrowThalesDeployed.setThalesStakingRewardsPool(
			ThalesStakingRewardsPoolDeployed.address,
			{ from: owner }
		);
		await SNXRewardsDeployed.setIssuanceRatio('1666666666666666666'.toString());
		await StakingThalesDeployed.setStakingParameters(true, true, WEEK, WEEK, true, true, false, {
			from: owner,
		});
		await StakingThalesDeployed.setStakingRewardsParameters(100000, 100000, false, { from: owner });
		await StakingThalesDeployed.setAddresses(
			dummy,
			dummy,
			dummy,
			PriceFeedInstance.address,
			ThalesStakingRewardsPoolDeployed.address,
			AddressResolverDeployed.address,
			ZERO_ADDRESS,
			{ from: owner }
		);
		await StakingThalesDeployed.setStakingThalesBettingProxy(stakingBettingProxy, { from: owner });

		await ThalesDeployed.transfer(stakingBettingProxy, toUnit(2000), {
			from: owner,
		});
		await ThalesDeployed.approve(StakingThalesDeployed.address, toUnit(2000), {
			from: stakingBettingProxy,
		});
	});

	describe('Staking:', () => {
		it('Stake with first account and claim reward (with fees available)', async () => {
			let deposit = toUnit(100000);
			let stake = toUnit(1500);
			await ThalesDeployed.transfer(first, stake, { from: owner });
			await ThalesFeeDeployed.transfer(StakingThalesDeployed.address, toUnit(2000), {
				from: owner,
			});

			let balanceStaking = await ThalesFeeDeployed.balanceOf(StakingThalesDeployed.address);
			assert.equal(fromUnit(balanceStaking), 2000);
			await StakingThalesDeployed.setStakingRewardsParameters(deposit, 100000, false, {
				from: owner,
			});
			assert.equal(await StakingThalesDeployed.distributeFeesEnabled(), true);
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			let answer = await StakingThalesDeployed.getContractFeeFunds();
			assert.bnEqual(fromUnit(answer), 2000);
			await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
				'Staking period has not started'
			);
			await ThalesDeployed.transfer(ThalesStakingRewardsPoolDeployed.address, deposit, {
				from: owner,
			});
			await StakingThalesDeployed.startStakingPeriod({ from: owner });
			await ThalesDeployed.approve(StakingThalesDeployed.address, stake, { from: first });
			await StakingThalesDeployed.stake(stake, { from: first });
			let initialStakedBalance = await StakingThalesDeployed.stakedBalanceOf(first);
			await StakingThalesDeployed.increaseAndTransferStakedThales(first, toUnit(100), {
				from: stakingBettingProxy,
			});
			let afterStakingBalance = await StakingThalesDeployed.stakedBalanceOf(first);
			assert.bnEqual(
				parseInt(afterStakingBalance),
				parseInt(initialStakedBalance) + parseInt(toUnit(100))
			);
			await StakingThalesDeployed.decreaseAndTransferStakedThales(first, toUnit(100), {
				from: stakingBettingProxy,
			});

			await fastForward(WEEK + SECOND);
			let currentFees = await StakingThalesDeployed.currentPeriodFees();
			await StakingThalesDeployed.closePeriod({ from: second });

			let balaceFirstBefore = await ThalesFeeDeployed.balanceOf(first);
			currentFees = await StakingThalesDeployed.currentPeriodFees();
			let baseRewards = await StakingThalesDeployed.getBaseReward(first);
			answer = await StakingThalesDeployed.getRewardsAvailable(first);
			let feesAvailable = await StakingThalesDeployed.getRewardFeesAvailable(first);

			initialStakedBalance = afterStakingBalance;
			await StakingThalesDeployed.increaseAndTransferStakedThales(first, toUnit(100), {
				from: stakingBettingProxy,
			});
			afterStakingBalance = await StakingThalesDeployed.stakedBalanceOf(first);

			// assert.bnEqual(parseInt(afterStakingBalance), parseInt(initialStakedBalance) + parseInt(toUnit(100)));
			await StakingThalesDeployed.decreaseAndTransferStakedThales(first, toUnit(100), {
				from: stakingBettingProxy,
			});
			assert.bnEqual(parseInt(afterStakingBalance), parseInt(initialStakedBalance));
			// await StakingThalesDeployed.claimReward({ from: first });

			let balanceAfter = await ThalesFeeDeployed.balanceOf(first);
			assert.equal(fromUnit(balanceAfter.sub(balaceFirstBefore)), 2000);
			balaceFirstBefore = balanceAfter;
			await fastForward(WEEK + SECOND);
			await StakingThalesDeployed.closePeriod({ from: second });
			balanceAfter = await ThalesFeeDeployed.balanceOf(first);
			assert.equal(fromUnit(balanceAfter.sub(balaceFirstBefore)), 0);
			let answer2 = await EscrowThalesDeployed.getStakedEscrowedBalanceForRewards(first);
			assert.bnEqual(answer, answer2);
		});

		it('Stake with first account and claim reward', async () => {
			let deposit = toUnit(100000);
			let stake = toUnit(1500);
			await ThalesDeployed.transfer(first, stake, { from: owner });
			await StakingThalesDeployed.setStakingRewardsParameters(deposit, 100000, false, {
				from: owner,
			});
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await ThalesFeeDeployed.transfer(StakingThalesDeployed.address, deposit, { from: owner });
			let answer = await StakingThalesDeployed.getContractFeeFunds();
			assert.bnEqual(answer, deposit);
			await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
				'Staking period has not started'
			);
			await ThalesDeployed.transfer(ThalesStakingRewardsPoolDeployed.address, deposit, {
				from: owner,
			});
			await StakingThalesDeployed.startStakingPeriod({ from: owner });
			await ThalesDeployed.approve(StakingThalesDeployed.address, stake, { from: first });
			await StakingThalesDeployed.stake(stake, { from: first });
			await fastForward(WEEK + SECOND);
			await StakingThalesDeployed.closePeriod({ from: second });
			answer = await StakingThalesDeployed.getRewardsAvailable(first);

			await StakingThalesDeployed.claimReward({ from: first });
			await fastForward(WEEK + SECOND);
			await StakingThalesDeployed.closePeriod({ from: second });
			let answer2 = await EscrowThalesDeployed.getStakedEscrowedBalanceForRewards(first);
			assert.bnEqual(answer, answer2);
		});

		it('Stake, claim reward twice, then (claim at) unstake ', async () => {
			let deposit = toUnit(100000);
			let lowerDeposit = toUnit(500);
			let stake = toUnit(1500);
			await ThalesDeployed.transfer(first, stake, { from: owner });
			await StakingThalesDeployed.setStakingRewardsParameters(deposit, 100000, false, {
				from: owner,
			});
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await ThalesFeeDeployed.transfer(StakingThalesDeployed.address, deposit, { from: owner });
			let answer = await StakingThalesDeployed.getContractFeeFunds();
			assert.bnEqual(answer, deposit);
			await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
				'Staking period has not started'
			);
			await ThalesDeployed.transfer(ThalesStakingRewardsPoolDeployed.address, deposit, {
				from: owner,
			});
			await StakingThalesDeployed.startStakingPeriod({ from: owner });
			await ThalesDeployed.approve(StakingThalesDeployed.address, stake, { from: first });
			await StakingThalesDeployed.stake(stake, { from: first });
			await fastForward(WEEK + SECOND);
			await StakingThalesDeployed.closePeriod({ from: second });
			await ThalesFeeDeployed.transfer(StakingThalesDeployed.address, toUnit(2000), {
				from: owner,
			});
			answer = await StakingThalesDeployed.getRewardsAvailable(first);
			// CLAIM 1
			let balanceBefore = await ThalesFeeDeployed.balanceOf(first);
			await StakingThalesDeployed.claimReward({ from: first });
			let balanceAfter = await ThalesFeeDeployed.balanceOf(first);
			assert.equal(fromUnit(balanceAfter.sub(balanceBefore)), fromUnit(deposit));
			balanceBefore = balanceAfter;
			await fastForward(WEEK + SECOND);
			await StakingThalesDeployed.closePeriod({ from: second });
			// await ThalesFeeDeployed.transfer(StakingThalesDeployed.address, toUnit(2000), { from: owner });
			let answer2 = await EscrowThalesDeployed.getStakedEscrowedBalanceForRewards(first);
			assert.bnEqual(answer, answer2);

			await fastForward(WEEK + 5 * SECOND);
			await StakingThalesDeployed.closePeriod({ from: second });
			await ThalesFeeDeployed.transfer(StakingThalesDeployed.address, toUnit(2000), {
				from: owner,
			});
			answer = await StakingThalesDeployed.getRewardsAvailable(first);
			// CLAIM 2
			await ThalesDeployed.transfer(ThalesStakingRewardsPoolDeployed.address, deposit, {
				from: owner,
			});
			balanceBefore = await ThalesFeeDeployed.balanceOf(first);
			await StakingThalesDeployed.claimReward({ from: first });
			balanceAfter = await ThalesFeeDeployed.balanceOf(first);
			assert.equal(fromUnit(balanceAfter.sub(balanceBefore)), 2000);
			balanceBefore = balanceAfter;
			await fastForward(WEEK + SECOND);
			await StakingThalesDeployed.closePeriod({ from: second });
			answer2 = await EscrowThalesDeployed.getStakedEscrowedBalanceForRewards(first);
			assert.bnEqual(answer.mul(toBN(2)), answer2);
			// CLAIM 3
			expect(StakingThalesDeployed.startUnstake(stake, { from: first })).to.be.revertedWith(
				'SafeERC20: low-level call failed'
			);
			await ThalesDeployed.transfer(ThalesStakingRewardsPoolDeployed.address, deposit, {
				from: owner,
			});
			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.bnEqual(answer, stake);
			answer = await StakingThalesDeployed.startUnstake(stake, { from: first });
			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.bnEqual(answer, 0);
		});
	});

	describe('StakingThales - Extended Tests:', () => {
		it('should increase staking balance for a user and validate total staking amount', async () => {
			let initialStake = toUnit(1500);
			let additionalStake = toUnit(500);

			await ThalesDeployed.transfer(first, initialStake, { from: owner });
			await ThalesDeployed.approve(StakingThalesDeployed.address, initialStake, { from: first });
			await StakingThalesDeployed.startStakingPeriod({ from: owner });
			await StakingThalesDeployed.stake(initialStake, { from: first });
			let initialStakedBalance = await StakingThalesDeployed.stakedBalanceOf(first);
			let initialTotalStaked = await StakingThalesDeployed.totalStakedAmount();

			// Increase staking balance for the first user using the staking proxy
			await StakingThalesDeployed.increaseAndTransferStakedThales(first, additionalStake, {
				from: stakingBettingProxy,
			});
			let afterStakedBalance = await StakingThalesDeployed.stakedBalanceOf(first);
			let afterTotalStaked = await StakingThalesDeployed.totalStakedAmount();

			// Validate the staking balance and total staked amount after increase
			assert.bnEqual(afterStakedBalance, initialStakedBalance.add(additionalStake));
			assert.bnEqual(afterTotalStaked, initialTotalStaked.add(additionalStake));
		});

		it('should decrease staking balance for a user and validate total staking amount', async () => {
			let initialStake = toUnit(1500);
			let reductionStake = toUnit(500);

			await ThalesDeployed.transfer(first, initialStake, { from: owner });
			await ThalesDeployed.approve(StakingThalesDeployed.address, initialStake, { from: first });
			await StakingThalesDeployed.startStakingPeriod({ from: owner });
			await StakingThalesDeployed.stake(initialStake, { from: first });
			let initialStakedBalance = await StakingThalesDeployed.stakedBalanceOf(first);
			let initialTotalStaked = await StakingThalesDeployed.totalStakedAmount();

			// Decrease staking balance for the first user using the staking proxy
			await StakingThalesDeployed.decreaseAndTransferStakedThales(first, reductionStake, {
				from: stakingBettingProxy,
			});
			let afterStakedBalance = await StakingThalesDeployed.stakedBalanceOf(first);
			let afterTotalStaked = await StakingThalesDeployed.totalStakedAmount();

			// Validate the staking balance and total staked amount after decrease
			assert.bnEqual(afterStakedBalance, initialStakedBalance.sub(reductionStake));
			assert.bnEqual(afterTotalStaked, initialTotalStaked.sub(reductionStake));
		});

		it('should revert when trying to increase staking balance with an unauthorized account', async () => {
			let additionalStake = toUnit(500);
			await StakingThalesDeployed.startStakingPeriod({ from: owner });
			await expect(
				StakingThalesDeployed.increaseAndTransferStakedThales(first, additionalStake, {
					from: second,
				})
			).to.be.revertedWith('Unsupported staking proxy');
		});

		it('should revert when trying to decrease staking balance with an unauthorized account', async () => {
			let reductionStake = toUnit(500);
			await StakingThalesDeployed.startStakingPeriod({ from: owner });
			await expect(
				StakingThalesDeployed.decreaseAndTransferStakedThales(first, reductionStake, {
					from: second,
				})
			).to.be.revertedWith('Unsupported staking proxy');
		});

		it('should revert when trying to decrease staking balance below current balance', async () => {
			let initialStake = toUnit(1500);
			let reductionStake = toUnit(2000); // More than the staked amount

			// Transfer tokens to the first user and approve the staking contract to spend them
			await ThalesDeployed.transfer(first, initialStake, { from: owner });
			await ThalesDeployed.approve(StakingThalesDeployed.address, initialStake, { from: first });
			await StakingThalesDeployed.startStakingPeriod({ from: owner });
			// Stake initial amount
			await StakingThalesDeployed.stake(initialStake, { from: first });

			// Try to decrease staking balance for the first user using the staking proxy
			await expect(
				StakingThalesDeployed.decreaseAndTransferStakedThales(first, reductionStake, {
					from: stakingBettingProxy,
				})
			).to.be.revertedWith('Insufficient staked amount');
		});

		it('should properly handle multiple increases and decreases in staking balance', async () => {
			let initialStake = toUnit(1000);
			let firstIncrease = toUnit(500);
			let secondIncrease = toUnit(300);
			let firstDecrease = toUnit(400);
			let secondDecrease = toUnit(200);

			await ThalesDeployed.transfer(first, initialStake, { from: owner });
			await ThalesDeployed.approve(StakingThalesDeployed.address, initialStake, { from: first });
			await StakingThalesDeployed.startStakingPeriod({ from: owner });
			await StakingThalesDeployed.stake(initialStake, { from: first });

			// Multiple staking balance modifications
			await StakingThalesDeployed.increaseAndTransferStakedThales(first, firstIncrease, {
				from: stakingBettingProxy,
			});
			await StakingThalesDeployed.decreaseAndTransferStakedThales(first, firstDecrease, {
				from: stakingBettingProxy,
			});
			await StakingThalesDeployed.increaseAndTransferStakedThales(first, secondIncrease, {
				from: stakingBettingProxy,
			});
			await StakingThalesDeployed.decreaseAndTransferStakedThales(first, secondDecrease, {
				from: stakingBettingProxy,
			});

			let finalStakedBalance = await StakingThalesDeployed.stakedBalanceOf(first);
			let finalTotalStaked = await StakingThalesDeployed.totalStakedAmount();

			// Validate final balances
			let expectedBalance = initialStake
				.add(firstIncrease)
				.add(secondIncrease)
				.sub(firstDecrease)
				.sub(secondDecrease);
			assert.bnEqual(finalStakedBalance, expectedBalance);
			assert.bnEqual(finalTotalStaked, expectedBalance);
		});
	});
});
