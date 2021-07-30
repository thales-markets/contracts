'use strict';

const { artifacts, contract, web3 } = require('hardhat');
const { toBN, fromBN } = web3.utils;

const { assert, addSnapshotBeforeRestoreAfterEach } = require('./common');

const { toBytes32 } = require('../..');
const { expect } = require('chai');
const { toDecimal } = require('web3-utils');
const { ethers } = require('ethers');

const ZERO_ADDRESS = '0x' + '0'.repeat(40);

const {
	fastForward,
	toUnit,
	currentTime,
	multiplyDecimalRound,
	divideDecimalRound,
} = require('../utils')();

contract('StakingThales', accounts => {
	const [first, second, third, owner] = accounts;
	let ThalesDeployed, ThalesFeeDeployed, StakingThalesDeployed, EscrowThalesDeployed;

	const SECOND = 1000;
	const DAY = 86400;
	const WEEK = 604800;
	const YEAR = 31556926;

	describe('Deploy Staking Thales', () => {
		it('deploy all Contracts', async () => {
			let Thales = artifacts.require('Thales');
			let EscrowThales = artifacts.require('EscrowThales');
			let StakingThales = artifacts.require('StakingThales');
			ThalesDeployed = await Thales.new({ from: owner });
			ThalesFeeDeployed = await Thales.new({ from: owner });
			EscrowThalesDeployed = await EscrowThales.new(owner, ThalesDeployed.address, owner, {
				from: owner,
			});

			StakingThalesDeployed = await StakingThales.new(
				owner,
				EscrowThalesDeployed.address,
				ThalesDeployed.address,
				first,
				{ from: owner }
			);
		});
	});

	beforeEach(async () => {
		let Thales = artifacts.require('Thales');
		let EscrowThales = artifacts.require('EscrowThales');
		let StakingThales = artifacts.require('StakingThales');
		ThalesDeployed = await Thales.new({ from: owner });
		ThalesFeeDeployed = await Thales.new({ from: owner });
		EscrowThalesDeployed = await EscrowThales.new(owner, ThalesDeployed.address, owner, {
			from: owner,
		});

		StakingThalesDeployed = await StakingThales.new(
			owner,
			EscrowThalesDeployed.address,
			ThalesDeployed.address,
			ThalesFeeDeployed.address,
			{ from: owner }
		);
	});

	describe('EscrowThales basic check', () => {
		it('get if StakingThales address in EscrowThales is equal to owner', async () => {
			let getStakingAddress = await EscrowThalesDeployed.getStakingThalesContract.call({
				from: owner,
			});
			// console.log("Staking Thaless address: " + getStakingAddress);
			// console.log("Owner address: " + owner);
			assert.equal(owner, getStakingAddress);
		});

		it('set StakingThales address in EscrowThales to the actual contract ', async () => {
			let setStakingAddress = await EscrowThalesDeployed.setStakingThalesContract(
				StakingThalesDeployed.address,
				{ from: owner }
			);
			let getStakingAddress = await EscrowThalesDeployed.getStakingThalesContract.call({
				from: owner,
			});
			// console.log("NEW Staking Thaless address: " + getStakingAddress);
			// console.log("StakingThalesDeployed address: " + StakingThalesDeployed.address);
			assert.equal(StakingThalesDeployed.address, getStakingAddress);
		});

		it('get if CurrentStakingWeek is 0', async () => {
			let stakingWeek = await EscrowThalesDeployed.getCurrentWeek.call({ from: owner });
			assert.equal(0, stakingWeek);
		});
		it('set CurrentStakingWeek to 20 and check', async () => {
			let setStakingAddress = await EscrowThalesDeployed.setStakingThalesContract(first, {
				from: owner,
			});
			let getStakingAddress = await EscrowThalesDeployed.getStakingThalesContract.call({
				from: owner,
			});
			assert.equal(first, getStakingAddress);

			let setWeek = await EscrowThalesDeployed.updateCurrentWeek('20', { from: first });
			let stakingWeek = await EscrowThalesDeployed.getCurrentWeek.call();
			assert.equal(20, stakingWeek);
		});

		it('check claimable function', async () => {
			let answer = await EscrowThalesDeployed.claimable.call(second);
			assert.equal(answer, 0);
		});

		it('check ZERO address usage for external functions', async () => {
			await expect(EscrowThalesDeployed.claimable.call(ZERO_ADDRESS)).to.be.revertedWith(
				'Invalid address'
			);
			await expect(EscrowThalesDeployed.addToEscrow(ZERO_ADDRESS, 0)).to.be.revertedWith(
				'Invalid address'
			);
			// await expect(EscrowThalesDeployed.vest(0,{from:ZERO_ADDRESS})).to.be.revertedWith("Invalid address");
			// await expect(EscrowThalesDeployed.moveToStakerSilo(ZERO_ADDRESS, 10, 11)).to.be.revertedWith("Invalid address");
		});
	});

	describe('StakingThales basic check', () => {
		it('Check if all external get functions return 0', async () => {
			let answer = await StakingThalesDeployed.totalStakedAmount.call();
			assert.equal(answer, 0);
			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.equal(answer, 0);
			answer = await StakingThalesDeployed.getAlreadyClaimedRewards.call(first);
			assert.equal(answer, 0);
			answer = await StakingThalesDeployed.getAlreadyClaimedFees.call(first);
			assert.equal(answer, 0);
			answer = await StakingThalesDeployed.getContractRewardFunds.call({ from: owner });
			assert.equal(answer, 0);
			answer = await StakingThalesDeployed.getContractFeeFunds.call({ from: owner });
			assert.equal(answer, 0);
			await expect(StakingThalesDeployed.getRewardsAvailable.call(first)).to.be.revertedWith(
				'Account is not a staker'
			);
			await expect(StakingThalesDeployed.getRewardFeesAvailable.call(first)).to.be.revertedWith(
				'Account is not a staker'
			);
		});

		it('Deposit funds to the StakingThales', async () => {
			await StakingThalesDeployed.depositRewards(10, { from: owner });
			await StakingThalesDeployed.depositFees(10, { from: owner });
			let answer = await StakingThalesDeployed.getContractRewardFunds.call({ from: owner });
			assert.equal(answer, 10);
			answer = await StakingThalesDeployed.getContractFeeFunds.call({ from: owner });
			assert.equal(answer, 10);
		});

		it('Start staking period', async () => {
			// console.log(toDecimal(await StakingThalesDeployed.startTime.call()));
			assert.equal(toDecimal(await StakingThalesDeployed.startTime.call()), 0);
			let answer = await StakingThalesDeployed.startStakingPeriod({ from: owner });
			assert.isAbove(toDecimal(await StakingThalesDeployed.startTime.call()), 0);
			assert.equal(
				toDecimal(await StakingThalesDeployed.startTime.call()),
				toDecimal(await StakingThalesDeployed.lastPeriod.call())
			);
			// console.log(toDecimal(await StakingThalesDeployed.startTime.call()));
		});

		it('Close staking period before 1)staking started and 2) before a week passes', async () => {
			await expect(StakingThalesDeployed.closePeriod({ from: owner })).to.be.revertedWith(
				'Staking period has not started'
			);
			let answer = await StakingThalesDeployed.startStakingPeriod({ from: owner });
			fastForward(3 * DAY);
			await expect(StakingThalesDeployed.closePeriod({ from: owner })).to.be.revertedWith(
				'7 days has not passed since the last closed period'
			);
		});

		it('Close staking period after week without funds in StakingThales', async () => {
			// const [ETHfund] = await ethers.getSigners();
			// await web3.sendTransaction({from:owner, to:StakingThalesDeployed.address, value: web3.utils.toWei("10")});
			// const transactionHash = await ETHfund.sendTransaction({to:StakingThalesDeployed.address, value: ethers.utils.parseEther("1.0")});
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
				'Staking period has not started'
			);
			let answer = await StakingThalesDeployed.startStakingPeriod({ from: owner });
			fastForward(WEEK + SECOND);
			await expect(StakingThalesDeployed.closePeriod({ from: second })).to.be.revertedWith(
				'Low THALES balance in the Smart-contract'
			);
			// answer = await StakingThalesDeployed.closePeriod({from:owner});
			// assert.isAbove(toDecimal(await StakingThalesDeployed.lastPeriod.call()), WEEK);
		});

		it('Stake with first and second account', async () => {
			// console.log(toDecimal(await StakingThalesDeployed.startTime.call()));
			// assert.equal(toDecimal(await StakingThalesDeployed.startTime.call()), 0);
			let answer = await StakingThalesDeployed.startStakingPeriod({ from: owner });
			// assert.isAbove(toDecimal(await StakingThalesDeployed.startTime.call()), 0);
			// assert.equal(toDecimal(await StakingThalesDeployed.startTime.call()), toDecimal(await StakingThalesDeployed.lastPeriod.call()));
			// console.log(toDecimal(await StakingThalesDeployed.startTime.call()));
		});
	});

	describe('Staking:', () => {
		it('Close staking period after week without funds in StakingThales', async () => {
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
				'Staking period has not started'
			);
			let answer = await StakingThalesDeployed.startStakingPeriod({ from: owner });
			fastForward(WEEK + SECOND);
			await expect(StakingThalesDeployed.closePeriod({ from: second })).to.be.revertedWith(
				'Low THALES balance in the Smart-contract'
			);
			// answer = await StakingThalesDeployed.closePeriod({from:owner});
			// assert.isAbove(toDecimal(await StakingThalesDeployed.lastPeriod.call()), WEEK);
		});

		it('Close staking period after week with low funds (69999) in StakingThales', async () => {
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
				'Staking period has not started'
			);
			let answer = await StakingThalesDeployed.startStakingPeriod({ from: owner });
			await StakingThalesDeployed.depositRewards(69999, { from: owner });
			fastForward(WEEK + SECOND);
			await expect(StakingThalesDeployed.closePeriod({ from: second })).to.be.revertedWith(
				'Low THALES balance in the Smart-contract'
			);
			answer = await StakingThalesDeployed.getContractRewardFunds.call({ from: owner });
			assert.equal(answer, 69999);
			// let answer = await StakingThalesDeployed.startStakingPeriod({from:owner});
			// assert.isAbove(toDecimal(await StakingThalesDeployed.startTime.call()), 0);
			// assert.equal(toDecimal(await StakingThalesDeployed.startTime.call()), toDecimal(await StakingThalesDeployed.lastPeriod.call()));
			// console.log(toDecimal(await StakingThalesDeployed.startTime.call()));
		});

		it('Close staking period after week with funds (70001) but NO Fees in StakingThales', async () => {
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
				'Staking period has not started'
			);
			let answer = await StakingThalesDeployed.startStakingPeriod({ from: owner });
			await StakingThalesDeployed.depositRewards(70001, { from: owner });
			fastForward(WEEK + SECOND);
			await expect(StakingThalesDeployed.closePeriod({ from: second })).to.be.revertedWith(
				'No Available fees'
			);
			// await StakingThalesDeployed.closePeriod({ from: second });
			// answer = await StakingThalesDeployed.getContractRewardFunds.call({ from: owner });
			// assert.equal(answer, 70001);
			// let answer = await StakingThalesDeployed.startStakingPeriod({from:owner});
			// assert.isAbove(toDecimal(await StakingThalesDeployed.startTime.call()), 0);
			// assert.equal(toDecimal(await StakingThalesDeployed.startTime.call()), toDecimal(await StakingThalesDeployed.lastPeriod.call()));
			// console.log(toDecimal(await StakingThalesDeployed.startTime.call()));
		});

		it('Close staking period after week with funds (70001) in StakingThales', async () => {
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
				'Staking period has not started'
			);
			let answer = await StakingThalesDeployed.startStakingPeriod({ from: owner });
			await StakingThalesDeployed.depositRewards(70001, { from: owner });
			await StakingThalesDeployed.depositFees(10000, { from: owner });
			fastForward(WEEK + SECOND);
			await StakingThalesDeployed.closePeriod({ from: second });
			answer = await StakingThalesDeployed.getContractRewardFunds.call({ from: owner });
			assert.equal(answer, 70001);
			// let answer = await StakingThalesDeployed.startStakingPeriod({from:owner});
			// assert.isAbove(toDecimal(await StakingThalesDeployed.startTime.call()), 0);
			// assert.equal(toDecimal(await StakingThalesDeployed.startTime.call()), toDecimal(await StakingThalesDeployed.lastPeriod.call()));
			// console.log(toDecimal(await StakingThalesDeployed.startTime.call()));
		});

		it('Stake with first account with NO THALES funds and fees', async () => {
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
				'Staking period has not started'
			);

			// await ThalesDeployed.transferFrom(owner, first, 1500, {from:owner});
			// let answer = await ThalesDeployed.balanceOf.call(first);
			// assert.equal(answer, 1500);
			let answer = await StakingThalesDeployed.startStakingPeriod({ from: owner });
			await StakingThalesDeployed.depositRewards(70001, { from: owner });
			await expect(StakingThalesDeployed.stake(1000, { from: first })).to.be.revertedWith(
				'SafeERC20: low-level call failed'
			);

			// answer = StakingThalesDeployed.stakedBalanceOf.call(first);
			// assert.equal(answer, 1000)
			// fastForward(WEEK + SECOND);
			// await StakingThalesDeployed.closePeriod({ from: second });
			// answer = await StakingThalesDeployed.getContractRewardFunds.call({ from: owner });
			// assert.equal(answer, 70001);
			// let answer = await StakingThalesDeployed.startStakingPeriod({from:owner});
			// assert.isAbove(toDecimal(await StakingThalesDeployed.startTime.call()), 0);
			// assert.equal(toDecimal(await StakingThalesDeployed.startTime.call()), toDecimal(await StakingThalesDeployed.lastPeriod.call()));
			// console.log(toDecimal(await StakingThalesDeployed.startTime.call()));
		});

		it('Stake with first account', async () => {
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
				'Staking period has not started'
			);

			await ThalesDeployed.transferFrom(owner, first, 1500, { from: owner });
			let answer = await ThalesDeployed.balanceOf.call(first);
			assert.equal(answer, 1500);
			answer = await StakingThalesDeployed.startStakingPeriod({ from: owner });
			await StakingThalesDeployed.depositRewards(70001, { from: owner });
			await StakingThalesDeployed.stake(1000, { from: first });
			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.equal(answer, 1000);
			// fastForward(WEEK + SECOND);
			// await StakingThalesDeployed.closePeriod({ from: second });
			// answer = await StakingThalesDeployed.getContractRewardFunds.call({ from: owner });
			// assert.equal(answer, 70001);
			// let answer = await StakingThalesDeployed.startStakingPeriod({from:owner});
			// assert.isAbove(toDecimal(await StakingThalesDeployed.startTime.call()), 0);
			// assert.equal(toDecimal(await StakingThalesDeployed.startTime.call()), toDecimal(await StakingThalesDeployed.lastPeriod.call()));
			// console.log(toDecimal(await StakingThalesDeployed.startTime.call()));
		});

		it('Stake with first account and claim reward (but no fees available)', async () => {
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
				'Staking period has not started'
			);

			await ThalesDeployed.transferFrom(owner, first, 1500, { from: owner });
			let answer = await ThalesDeployed.balanceOf.call(first);
			assert.equal(answer, 1500);
			answer = await StakingThalesDeployed.startStakingPeriod({ from: owner });
			// fastForward(2*DAY);
			await StakingThalesDeployed.depositRewards(150000, { from: owner });
			await StakingThalesDeployed.stake(1000, { from: first });
			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.equal(answer, 1000);
			fastForward(WEEK + 5 * SECOND);
			await expect(StakingThalesDeployed.closePeriod({ from: second })).to.be.revertedWith(
				'No Available fees'
			);
		});

		it('Stake with first account and claim reward', async () => {
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
				'Staking period has not started'
			);

			await ThalesDeployed.transferFrom(owner, first, 1500, { from: owner });
			let answer = await ThalesDeployed.balanceOf.call(first);
			assert.equal(answer, 1500);
			answer = await StakingThalesDeployed.startStakingPeriod({ from: owner });
			// fastForward(2*DAY);
			await StakingThalesDeployed.depositRewards(150000, { from: owner });
			await StakingThalesDeployed.depositFees(5555, { from: owner });
			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.equal(answer, 0);
			await StakingThalesDeployed.stake(1000, { from: first });
			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.equal(answer, 1000);
			await expect(StakingThalesDeployed.getRewardsAvailable.call(first)).to.be.revertedWith(
				'Rewards already claimed for last week'
			);

			fastForward(WEEK + 5 * SECOND);
			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.equal(answer, 1000);
			await StakingThalesDeployed.closePeriod({ from: second });
			answer = await StakingThalesDeployed.getContractRewardFunds.call({ from: owner });
			// console.log(web3.utils.toDecimal(answer))
			// console.log(answer)
			// answer = await StakingThalesDeployed.getRewardFeesAvailable.call(first);
			// console.log(answer)
			// answer = await ThalesDeployed.balanceOf.call(StakingThalesDeployed.address);;
			// console.log(answer)
			fastForward(DAY);
			answer = await StakingThalesDeployed.getRewardsAvailable.call(first);
			assert.equal(web3.utils.toDecimal(answer), 70000);
			answer = await StakingThalesDeployed.getRewardFeesAvailable.call(first);
			assert.equal(web3.utils.toDecimal(answer), 5555);
			answer = await StakingThalesDeployed.claimReward({ from: first });
			// assert.equal(answer.words[0], 70000);
			// let answer = await StakingThalesDeployed.startStakingPeriod({from:owner});
			// assert.isAbove(toDecimal(await StakingThalesDeployed.startTime.call()), 0);
			// assert.equal(toDecimal(await StakingThalesDeployed.startTime.call()), toDecimal(await StakingThalesDeployed.lastPeriod.call()));
			// console.log(toDecimal(await StakingThalesDeployed.startTime.call()));
		});

		it('Stake with first account, claim reward, then unstake WITHOUT periodClose', async () => {
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
				'Staking period has not started'
			);

			await ThalesDeployed.transferFrom(owner, first, 1500, { from: owner });
			let answer = await ThalesDeployed.balanceOf.call(first);
			console.log('First account Thales balance: ' + web3.utils.toDecimal(answer));
			assert.equal(answer, 1500);
			answer = await StakingThalesDeployed.startStakingPeriod({ from: owner });
			// fastForward(2*DAY);
			await StakingThalesDeployed.depositRewards(150000, { from: owner });
			await StakingThalesDeployed.depositFees(5555, { from: owner });
			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.equal(answer, 0);
			await StakingThalesDeployed.stake(1000, { from: first });
			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.equal(answer, 1000);
			await expect(StakingThalesDeployed.getRewardsAvailable.call(first)).to.be.revertedWith(
				'Rewards already claimed for last week'
			);

			fastForward(WEEK + 5 * SECOND);
			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.equal(answer, 1000);
			await StakingThalesDeployed.closePeriod({ from: second });
			answer = await StakingThalesDeployed.getContractRewardFunds.call({ from: owner });

			fastForward(DAY);
			answer = await StakingThalesDeployed.getRewardsAvailable.call(first);
			assert.equal(web3.utils.toDecimal(answer), 70000);
			answer = await StakingThalesDeployed.getRewardFeesAvailable.call(first);
			assert.equal(web3.utils.toDecimal(answer), 5555);
			answer = await ThalesDeployed.balanceOf.call(first);
			console.log('First account Thales balance: ' + web3.utils.toDecimal(answer));
			answer = await StakingThalesDeployed.claimReward({ from: first });
			answer = await StakingThalesDeployed.startUnstake({ from: first });
			fastForward(WEEK + 5 * SECOND);

			answer = await StakingThalesDeployed.unstake({ from: first });
			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.equal(answer, 0);

			answer = await ThalesDeployed.balanceOf.call(first);
			console.log('First account Thales balance: ' + web3.utils.toDecimal(answer));
		});
		it('Stake, claim reward twice, then unstake', async () => {
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
				'Staking period has not started'
			);

			await ThalesDeployed.transferFrom(owner, first, 1500, { from: owner });
			let answer = await ThalesDeployed.balanceOf.call(first);
			assert.equal(answer, 1500);
			answer = await StakingThalesDeployed.startStakingPeriod({ from: owner });
			// fastForward(2*DAY);
			await StakingThalesDeployed.depositRewards(1500000, { from: owner });
			await StakingThalesDeployed.depositFees(5555, { from: owner });
			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.equal(answer, 0);
			await StakingThalesDeployed.stake(1000, { from: first });
			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.equal(answer, 1000);
			await expect(StakingThalesDeployed.getRewardsAvailable.call(first)).to.be.revertedWith(
				'Rewards already claimed for last week'
			);

			fastForward(WEEK + 5 * SECOND);
			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.equal(answer, 1000);
			await StakingThalesDeployed.closePeriod({ from: second });
			answer = await StakingThalesDeployed.getContractRewardFunds.call({ from: owner });

			fastForward(DAY);
			answer = await StakingThalesDeployed.getRewardsAvailable.call(first);
			assert.equal(web3.utils.toDecimal(answer), 70000);
			answer = await StakingThalesDeployed.getRewardFeesAvailable.call(first);
			assert.equal(web3.utils.toDecimal(answer), 5555);
			answer = await ThalesDeployed.balanceOf.call(first);
			console.log('First account Thales balance: ' + web3.utils.toDecimal(answer));
			answer = await StakingThalesDeployed.claimReward({ from: first });

			fastForward(WEEK + 5 * SECOND);
			await StakingThalesDeployed.depositFees(1000, { from: owner });
			await StakingThalesDeployed.closePeriod({ from: second });

			answer = await StakingThalesDeployed.claimReward({ from: first });
			answer = await StakingThalesDeployed.startUnstake({ from: first });

			fastForward(WEEK + 5 * SECOND);
			await StakingThalesDeployed.depositFees(1000, { from: owner });
			await StakingThalesDeployed.closePeriod({ from: second });

			answer = await StakingThalesDeployed.unstake({ from: first });
			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.equal(answer, 0);

			answer = await ThalesDeployed.balanceOf.call(first);
			console.log('First account Thales balance: ' + web3.utils.toDecimal(answer));
		});
	});
	describe('Vesting:', () => {
		it('Claimable', async () => {
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
				'Staking period has not started'
			);

			await ThalesDeployed.transferFrom(owner, first, 1500, { from: owner });
			let answer = await ThalesDeployed.balanceOf.call(first);
			assert.equal(answer, 1500);
			answer = await StakingThalesDeployed.startStakingPeriod({ from: owner });
			// fastForward(2*DAY);
			await StakingThalesDeployed.depositRewards(1500000, { from: owner });
			await StakingThalesDeployed.depositFees(5555, { from: owner });
			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.equal(answer, 0);
			await StakingThalesDeployed.stake(1000, { from: first });
			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.equal(answer, 1000);
			await expect(StakingThalesDeployed.getRewardsAvailable.call(first)).to.be.revertedWith(
				'Rewards already claimed for last week'
			);

			fastForward(WEEK + 5 * SECOND);
			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.equal(answer, 1000);
			await StakingThalesDeployed.closePeriod({ from: second });
			answer = await StakingThalesDeployed.getContractRewardFunds.call({ from: owner });

			fastForward(DAY);
			answer = await StakingThalesDeployed.getRewardsAvailable.call(first);
			assert.equal(web3.utils.toDecimal(answer), 70000);
			answer = await StakingThalesDeployed.getRewardFeesAvailable.call(first);
			assert.equal(web3.utils.toDecimal(answer), 5555);

			answer = await ThalesDeployed.balanceOf.call(EscrowThalesDeployed.address);
			console.log('Balance of Escrow:' + web3.utils.toDecimal(answer));

			answer = await StakingThalesDeployed.claimReward({ from: first });
			answer = await EscrowThalesDeployed.getStakerWeeksLength.call(first);
			console.log('Staker weeks length: ' + web3.utils.toDecimal(answer));
			for (let i = 0; i < 11; i++) {
				fastForward(WEEK + SECOND);
				await StakingThalesDeployed.depositFees(5555, { from: owner });
				await StakingThalesDeployed.closePeriod({ from: second });
				answer = await StakingThalesDeployed.claimReward({ from: first });
				answer = await ThalesDeployed.balanceOf.call(EscrowThalesDeployed.address);
				console.log('Balance of Escrow:' + web3.utils.toDecimal(answer));
				answer = await EscrowThalesDeployed.getLastStakedWeek.call(first);
				console.log('Last claimed week: ' + web3.utils.toDecimal(answer));
				answer = await EscrowThalesDeployed.getStakerWeeks.call(first);
				for (let j = 0; j < answer.length; j++) {
					console.log('Staker field' + j + ': ' + web3.utils.toDecimal(answer[j]));
				}
				answer = await EscrowThalesDeployed.getStakerSilo.call(first);
				console.log('Staker silo: ' + web3.utils.toDecimal(answer));
			}

			answer = await EscrowThalesDeployed.getCurrentWeek.call();
			console.log('Current week: ' + web3.utils.toDecimal(answer));
			answer = await EscrowThalesDeployed.getLastStakedWeek.call(first);
			console.log('Last claimed week: ' + web3.utils.toDecimal(answer));

			answer = await EscrowThalesDeployed.claimable.call(first);
			console.log('Claimable:' + web3.utils.toDecimal(answer));
			// assert.equal(answer.words[0], 70000);
			// let answer = await StakingThalesDeployed.startStakingPeriod({from:owner});
			// assert.isAbove(toDecimal(await StakingThalesDeployed.startTime.call()), 0);
			// assert.equal(toDecimal(await StakingThalesDeployed.startTime.call()), toDecimal(await StakingThalesDeployed.lastPeriod.call()));
			// console.log(toDecimal(await StakingThalesDeployed.startTime.call()));
		});

		it('Claim first user', async () => {
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
				'Staking period has not started'
			);

			await ThalesDeployed.transferFrom(owner, first, 1500, { from: owner });
			let answer = await ThalesDeployed.balanceOf.call(first);
			assert.equal(answer, 1500);
			answer = await StakingThalesDeployed.startStakingPeriod({ from: owner });
			// fastForward(2*DAY);
			await StakingThalesDeployed.depositRewards(1500000, { from: owner });
			await StakingThalesDeployed.depositFees(5555, { from: owner });
			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.equal(answer, 0);
			await StakingThalesDeployed.stake(1000, { from: first });
			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.equal(answer, 1000);
			await expect(StakingThalesDeployed.getRewardsAvailable.call(first)).to.be.revertedWith(
				'Rewards already claimed for last week'
			);

			fastForward(WEEK + 5 * SECOND);
			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.equal(answer, 1000);
			await StakingThalesDeployed.closePeriod({ from: second });
			answer = await StakingThalesDeployed.getContractRewardFunds.call({ from: owner });

			fastForward(DAY);
			answer = await StakingThalesDeployed.getRewardsAvailable.call(first);
			assert.equal(web3.utils.toDecimal(answer), 70000);
			answer = await StakingThalesDeployed.getRewardFeesAvailable.call(first);
			assert.equal(web3.utils.toDecimal(answer), 5555);

			answer = await ThalesDeployed.balanceOf.call(EscrowThalesDeployed.address);
			// console.log("Balance of Escrow:" + web3.utils.toDecimal(answer));

			answer = await StakingThalesDeployed.claimReward({ from: first });
			answer = await EscrowThalesDeployed.getStakerWeeksLength.call(first);

			for (let i = 0; i < 11; i++) {
				fastForward(WEEK + SECOND);
				await StakingThalesDeployed.depositFees(5555, { from: owner });
				await StakingThalesDeployed.closePeriod({ from: second });
				answer = await StakingThalesDeployed.claimReward({ from: first });
			}

			answer = await EscrowThalesDeployed.getStakerSilo.call(first);
			let answer2 = await EscrowThalesDeployed.claimable.call(first);
			assert.equal(web3.utils.toDecimal(answer), web3.utils.toDecimal(answer2));

			answer = await ThalesDeployed.balanceOf.call(first);
			console.log('Thales balance of first user:' + web3.utils.toDecimal(answer));

			let claimable = web3.utils.toDecimal(answer2);

			console.log('Current claimable: ' + claimable);

			answer = await EscrowThalesDeployed.vest(claimable, { from: first });
			// assert.equal(answer, true);
			console.log(answer.logs[0].event);
			console.log('Claimed: ' + web3.utils.toDecimal(answer.logs[0].args.amount));
			assert.equal(answer.logs[0].args.account, first);
			answer = await EscrowThalesDeployed.getStakerSilo.call(first);
			console.log('New claimable: ' + web3.utils.toDecimal(answer));

			answer = await ThalesDeployed.balanceOf.call(first);
			console.log('Thales balance of first user:' + web3.utils.toDecimal(answer));
		});

		it('Staking & claiming with 2 users', async () => {
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
				'Staking period has not started'
			);
			await ThalesDeployed.transferFrom(owner, first, 1500, { from: owner });
			let answer = await ThalesDeployed.balanceOf.call(first);
			assert.equal(answer, 1500);
			await ThalesDeployed.transferFrom(owner, second, 1500, { from: owner });
			answer = await ThalesDeployed.balanceOf.call(second);
			assert.equal(answer, 1500);

			answer = await StakingThalesDeployed.startStakingPeriod({ from: owner });
			// fastForward(2*DAY);
			await StakingThalesDeployed.depositRewards(1500000, { from: owner });
			await StakingThalesDeployed.depositFees(5555, { from: owner });
			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.equal(answer, 0);
			await StakingThalesDeployed.stake(1000, { from: first });
			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.equal(answer, 1000);
			await expect(StakingThalesDeployed.getRewardsAvailable.call(first)).to.be.revertedWith(
				'Rewards already claimed for last week'
			);
			answer = await StakingThalesDeployed.stakedBalanceOf.call(second);
			assert.equal(answer, 0);
			await StakingThalesDeployed.stake(1000, { from: second });
			answer = await StakingThalesDeployed.stakedBalanceOf.call(second);
			assert.equal(answer, 1000);
			await expect(StakingThalesDeployed.getRewardsAvailable.call(second)).to.be.revertedWith(
				'Rewards already claimed for last week'
			);

			fastForward(WEEK + 5 * SECOND);
			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.equal(answer, 1000);
			answer = await StakingThalesDeployed.stakedBalanceOf.call(second);
			assert.equal(answer, 1000);
			await StakingThalesDeployed.closePeriod({ from: second });
			answer = await StakingThalesDeployed.getContractRewardFunds.call({ from: owner });

			fastForward(DAY);
			answer = await StakingThalesDeployed.getRewardsAvailable.call(first);
			console.log('First rewards avail.: ' + web3.utils.toDecimal(answer));
			// answer = await StakingThalesDeployed.getLastWeekRewards.call();
			// console.log(web3.utils.toDecimal(answer));
			// answer = await StakingThalesDeployed.totalStakedAmount.call();
			// console.log(web3.utils.toDecimal(answer));
			// answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			// console.log(web3.utils.toDecimal(answer));

			assert.equal(web3.utils.toDecimal(answer), 70000 / 2);

			answer = await StakingThalesDeployed.getRewardsAvailable.call(second);
			console.log('Second rewards avail.: ' + web3.utils.toDecimal(answer));
			assert.equal(web3.utils.toDecimal(answer), 70000 / 2);
			answer = await StakingThalesDeployed.getRewardFeesAvailable.call(first);
			assert.equal(web3.utils.toDecimal(answer), 2777);
			answer = await StakingThalesDeployed.getRewardFeesAvailable.call(second);
			assert.equal(web3.utils.toDecimal(answer), 2777);

			answer = await ThalesDeployed.balanceOf.call(EscrowThalesDeployed.address);
			// console.log("Balance of Escrow:" + web3.utils.toDecimal(answer));

			answer = await StakingThalesDeployed.claimReward({ from: first });
			answer = await EscrowThalesDeployed.getStakerWeeksLength.call(first);
			answer = await StakingThalesDeployed.claimReward({ from: second });
			answer = await EscrowThalesDeployed.getStakerWeeksLength.call(second);

			answer = await StakingThalesDeployed.getLastWeekOfClaimedRewards.call(first);
			console.log(web3.utils.toDecimal(answer));
			answer = await StakingThalesDeployed.getLastWeekOfClaimedRewards.call(second);
			console.log(web3.utils.toDecimal(answer));

			// for (let i = 0; i < 11; i++) {
			// 	fastForward(WEEK + SECOND);
			// 	await StakingThalesDeployed.depositFees(4000, { from: owner });
			// 	await StakingThalesDeployed.closePeriod({ from: second });
			// 	fastForward(3600*DAY);
			// 	answer = await StakingThalesDeployed.claimReward({ from: second });
			// 	answer = await StakingThalesDeployed.claimReward({ from: first });
			// }

			for (let i = 0; i < 11; i++) {
				fastForward(WEEK + SECOND);
				await StakingThalesDeployed.depositFees(5555, { from: owner });
				await StakingThalesDeployed.closePeriod({ from: second });
				answer = await StakingThalesDeployed.claimReward({ from: first });
				answer = await ThalesDeployed.balanceOf.call(EscrowThalesDeployed.address);
				console.log('Balance of Escrow:' + web3.utils.toDecimal(answer));
				answer = await StakingThalesDeployed.claimReward({ from: second });
				answer = await ThalesDeployed.balanceOf.call(EscrowThalesDeployed.address);
				console.log('Balance of Escrow:' + web3.utils.toDecimal(answer));
				answer = await EscrowThalesDeployed.getLastStakedWeek.call(first);
				console.log('Last first week: ' + web3.utils.toDecimal(answer));
				answer = await EscrowThalesDeployed.getLastStakedWeek.call(second);
				console.log('Last second week: ' + web3.utils.toDecimal(answer));
				answer = await EscrowThalesDeployed.getStakerWeeks.call(first);
				for (let j = 0; j < answer.length; j++) {
					console.log('First field' + j + ': ' + web3.utils.toDecimal(answer[j]));
				}
				answer = await EscrowThalesDeployed.getStakerSilo.call(first);
				console.log('First silo: ' + web3.utils.toDecimal(answer));
				answer = await EscrowThalesDeployed.getStakerWeeks.call(second);
				for (let j = 0; j < answer.length; j++) {
					console.log('Second field' + j + ': ' + web3.utils.toDecimal(answer[j]));
				}
				answer = await EscrowThalesDeployed.getStakerSilo.call(second);
				console.log('Second silo: ' + web3.utils.toDecimal(answer));
			}

			answer = await EscrowThalesDeployed.getStakerSilo.call(first);
			console.log('Silo balance first:' + web3.utils.toDecimal(answer));
			answer = await EscrowThalesDeployed.getStakerSilo.call(second);
			console.log('Silo balance second:' + web3.utils.toDecimal(answer));

			answer = await EscrowThalesDeployed.getStakerSilo.call(first);
			let answer2 = await EscrowThalesDeployed.claimable.call(first);
			assert.equal(web3.utils.toDecimal(answer), web3.utils.toDecimal(answer2));
			answer = await EscrowThalesDeployed.getStakerSilo.call(second);
			answer2 = await EscrowThalesDeployed.claimable.call(second);
			assert.equal(web3.utils.toDecimal(answer), web3.utils.toDecimal(answer2));

			answer = await ThalesDeployed.balanceOf.call(first);
			console.log('Thales balance of first user:' + web3.utils.toDecimal(answer));
			answer = await ThalesDeployed.balanceOf.call(second);
			console.log('Thales balance of second user:' + web3.utils.toDecimal(answer));

			answer2 = await EscrowThalesDeployed.claimable.call(first);
			let claimable = web3.utils.toDecimal(answer2);
			console.log('Current claimable first: ' + claimable);

			answer2 = await EscrowThalesDeployed.claimable.call(second);
			let claimable2 = web3.utils.toDecimal(answer2);
			console.log('Current claimable second: ' + claimable2);

			answer = await EscrowThalesDeployed.vest(claimable, { from: first });
			// assert.equal(answer, true);
			console.log(answer.logs[0].event);
			console.log('Claimed first: ' + web3.utils.toDecimal(answer.logs[0].args.amount));
			assert.equal(answer.logs[0].args.account, first);

			answer2 = await EscrowThalesDeployed.vest(claimable2, { from: second });
			// assert.equal(answer, true);
			console.log(answer2.logs[0].event);
			console.log('Claimed second: ' + web3.utils.toDecimal(answer2.logs[0].args.amount));
			assert.equal(answer2.logs[0].args.account, second);

			answer = await EscrowThalesDeployed.getStakerSilo.call(first);
			console.log('New first claimable: ' + web3.utils.toDecimal(answer));

			answer = await EscrowThalesDeployed.getStakerSilo.call(second);
			console.log('New second claimable: ' + web3.utils.toDecimal(answer));

			answer = await ThalesDeployed.balanceOf.call(first);
			console.log('Thales balance of first user:' + web3.utils.toDecimal(answer));

			answer = await ThalesDeployed.balanceOf.call(second);
			console.log('Thales balance of second user:' + web3.utils.toDecimal(answer));
		});

		it('Staking & claiming with 3 users', async () => {
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
				'Staking period has not started'
			);
			await ThalesDeployed.transferFrom(owner, first, 1500, { from: owner });
			let answer = await ThalesDeployed.balanceOf.call(first);
			assert.equal(answer, 1500);
			await ThalesDeployed.transferFrom(owner, second, 1500, { from: owner });
			answer = await ThalesDeployed.balanceOf.call(second);
			assert.equal(answer, 1500);
			await ThalesDeployed.transferFrom(owner, third, 1500, { from: owner });
			answer = await ThalesDeployed.balanceOf.call(second);
			assert.equal(answer, 1500);

			answer = await StakingThalesDeployed.startStakingPeriod({ from: owner });
			// fastForward(2*DAY);
			await StakingThalesDeployed.depositRewards(1500000, { from: owner });
			await StakingThalesDeployed.depositFees(6000, { from: owner });

			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.equal(answer, 0);
			await StakingThalesDeployed.stake(1000, { from: first });
			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.equal(answer, 1000);
			await expect(StakingThalesDeployed.getRewardsAvailable.call(first)).to.be.revertedWith(
				'Rewards already claimed for last week'
			);
			answer = await StakingThalesDeployed.stakedBalanceOf.call(second);
			assert.equal(answer, 0);
			await StakingThalesDeployed.stake(1000, { from: second });
			answer = await StakingThalesDeployed.stakedBalanceOf.call(second);
			assert.equal(answer, 1000);
			await expect(StakingThalesDeployed.getRewardsAvailable.call(second)).to.be.revertedWith(
				'Rewards already claimed for last week'
			);
			answer = await StakingThalesDeployed.stakedBalanceOf.call(third);
			assert.equal(answer, 0);
			await StakingThalesDeployed.stake(1000, { from: third });
			answer = await StakingThalesDeployed.stakedBalanceOf.call(third);
			assert.equal(answer, 1000);
			await expect(StakingThalesDeployed.getRewardsAvailable.call(third)).to.be.revertedWith(
				'Rewards already claimed for last week'
			);

			fastForward(WEEK + 5 * SECOND);
			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.equal(answer, 1000);
			answer = await StakingThalesDeployed.stakedBalanceOf.call(second);
			assert.equal(answer, 1000);
			answer = await StakingThalesDeployed.stakedBalanceOf.call(third);
			assert.equal(answer, 1000);

			await StakingThalesDeployed.closePeriod({ from: second });
			answer = await StakingThalesDeployed.getContractRewardFunds.call({ from: owner });

			fastForward(DAY);
			answer = await StakingThalesDeployed.getRewardsAvailable.call(first);
			console.log('First rewards avail.: ' + web3.utils.toDecimal(answer));
			assert.equal(web3.utils.toDecimal(answer), 23333);

			answer = await StakingThalesDeployed.getRewardsAvailable.call(second);
			console.log('Second rewards avail.: ' + web3.utils.toDecimal(answer));
			assert.equal(web3.utils.toDecimal(answer), 23333);

			answer = await StakingThalesDeployed.getRewardsAvailable.call(third);
			console.log('Second rewards avail.: ' + web3.utils.toDecimal(answer));
			assert.equal(web3.utils.toDecimal(answer), 23333);

			answer = await StakingThalesDeployed.getRewardFeesAvailable.call(first);
			assert.equal(web3.utils.toDecimal(answer), 6000 / 3);

			answer = await StakingThalesDeployed.getRewardFeesAvailable.call(second);
			assert.equal(web3.utils.toDecimal(answer), 6000 / 3);

			answer = await StakingThalesDeployed.getRewardFeesAvailable.call(third);
			assert.equal(web3.utils.toDecimal(answer), 6000 / 3);

			answer = await ThalesDeployed.balanceOf.call(EscrowThalesDeployed.address);
			// console.log("Balance of Escrow:" + web3.utils.toDecimal(answer));

			answer = await StakingThalesDeployed.claimReward({ from: first });
			answer = await EscrowThalesDeployed.getStakerWeeksLength.call(first);

			answer = await StakingThalesDeployed.claimReward({ from: second });
			answer = await EscrowThalesDeployed.getStakerWeeksLength.call(second);

			answer = await StakingThalesDeployed.claimReward({ from: third });
			answer = await EscrowThalesDeployed.getStakerWeeksLength.call(third);

			answer = await StakingThalesDeployed.getLastWeekOfClaimedRewards.call(first);
			console.log(web3.utils.toDecimal(answer));
			answer = await StakingThalesDeployed.getLastWeekOfClaimedRewards.call(second);
			console.log(web3.utils.toDecimal(answer));
			answer = await StakingThalesDeployed.getLastWeekOfClaimedRewards.call(third);
			console.log(web3.utils.toDecimal(answer));

			for (let i = 0; i < 11; i++) {
				fastForward(WEEK + SECOND);
				await StakingThalesDeployed.depositFees(5555, { from: owner });
				await StakingThalesDeployed.closePeriod({ from: second });
				answer = await StakingThalesDeployed.claimReward({ from: first });
				answer = await ThalesDeployed.balanceOf.call(EscrowThalesDeployed.address);
				console.log('Balance of Escrow:' + web3.utils.toDecimal(answer));
				answer = await StakingThalesDeployed.claimReward({ from: second });
				answer = await ThalesDeployed.balanceOf.call(EscrowThalesDeployed.address);
				console.log('Balance of Escrow:' + web3.utils.toDecimal(answer));
				answer = await StakingThalesDeployed.claimReward({ from: third });
				answer = await ThalesDeployed.balanceOf.call(EscrowThalesDeployed.address);
				console.log('Balance of Escrow:' + web3.utils.toDecimal(answer));
				answer = await EscrowThalesDeployed.getLastStakedWeek.call(first);
				console.log('Last first week: ' + web3.utils.toDecimal(answer));
				answer = await EscrowThalesDeployed.getLastStakedWeek.call(second);
				console.log('Last second week: ' + web3.utils.toDecimal(answer));
				answer = await EscrowThalesDeployed.getLastStakedWeek.call(third);
				console.log('Last third week: ' + web3.utils.toDecimal(answer));
				answer = await EscrowThalesDeployed.getStakerWeeks.call(first);
				for (let j = 0; j < answer.length; j++) {
					console.log('First field' + j + ': ' + web3.utils.toDecimal(answer[j]));
				}
				answer = await EscrowThalesDeployed.getStakerSilo.call(first);
				console.log('First silo: ' + web3.utils.toDecimal(answer));
				answer = await EscrowThalesDeployed.getStakerWeeks.call(second);
				for (let j = 0; j < answer.length; j++) {
					console.log('Second field' + j + ': ' + web3.utils.toDecimal(answer[j]));
				}
				answer = await EscrowThalesDeployed.getStakerSilo.call(second);
				console.log('Second silo: ' + web3.utils.toDecimal(answer));
				answer = await EscrowThalesDeployed.getStakerWeeks.call(third);
				for (let j = 0; j < answer.length; j++) {
					console.log('Third field' + j + ': ' + web3.utils.toDecimal(answer[j]));
				}
				answer = await EscrowThalesDeployed.getStakerSilo.call(third);
				console.log('Third silo: ' + web3.utils.toDecimal(answer));
			}

			answer = await EscrowThalesDeployed.getStakerSilo.call(first);
			console.log('Silo balance first:' + web3.utils.toDecimal(answer));
			answer = await EscrowThalesDeployed.getStakerSilo.call(second);
			console.log('Silo balance second:' + web3.utils.toDecimal(answer));
			answer = await EscrowThalesDeployed.getStakerSilo.call(third);
			console.log('Silo balance second:' + web3.utils.toDecimal(answer));

			answer = await EscrowThalesDeployed.getStakerSilo.call(first);
			let answer2 = await EscrowThalesDeployed.claimable.call(first);
			assert.equal(web3.utils.toDecimal(answer), web3.utils.toDecimal(answer2));
			answer = await EscrowThalesDeployed.getStakerSilo.call(second);
			answer2 = await EscrowThalesDeployed.claimable.call(second);
			assert.equal(web3.utils.toDecimal(answer), web3.utils.toDecimal(answer2));

			answer = await EscrowThalesDeployed.getStakerSilo.call(third);
			answer2 = await EscrowThalesDeployed.claimable.call(third);
			assert.equal(web3.utils.toDecimal(answer), web3.utils.toDecimal(answer2));

			answer = await ThalesDeployed.balanceOf.call(first);
			console.log('Thales balance of first user:' + web3.utils.toDecimal(answer));

			answer = await ThalesDeployed.balanceOf.call(second);
			console.log('Thales balance of second user:' + web3.utils.toDecimal(answer));

			answer = await ThalesDeployed.balanceOf.call(third);
			console.log('Thales balance of third user:' + web3.utils.toDecimal(answer));

			answer2 = await EscrowThalesDeployed.claimable.call(first);
			let claimable = web3.utils.toDecimal(answer2);
			console.log('Current claimable first: ' + claimable);

			answer2 = await EscrowThalesDeployed.claimable.call(second);
			let claimable2 = web3.utils.toDecimal(answer2);
			console.log('Current claimable second: ' + claimable2);

			answer2 = await EscrowThalesDeployed.claimable.call(third);
			let claimable3 = web3.utils.toDecimal(answer2);
			console.log('Current claimable second: ' + claimable3);

			answer = await EscrowThalesDeployed.vest(claimable, { from: first });
			// assert.equal(answer, true);
			console.log(answer.logs[0].event);
			console.log('Claimed first: ' + web3.utils.toDecimal(answer.logs[0].args.amount));
			assert.equal(answer.logs[0].args.account, first);

			answer2 = await EscrowThalesDeployed.vest(claimable2, { from: second });
			// assert.equal(answer, true);
			console.log(answer2.logs[0].event);
			console.log('Claimed second: ' + web3.utils.toDecimal(answer2.logs[0].args.amount));
			assert.equal(answer2.logs[0].args.account, second);

			answer2 = await EscrowThalesDeployed.vest(claimable3, { from: third });
			// assert.equal(answer, true);
			console.log(answer2.logs[0].event);
			console.log('Claimed third: ' + web3.utils.toDecimal(answer2.logs[0].args.amount));
			assert.equal(answer2.logs[0].args.account, third);

			answer = await EscrowThalesDeployed.getStakerSilo.call(first);
			console.log('New first claimable: ' + web3.utils.toDecimal(answer));

			answer = await EscrowThalesDeployed.getStakerSilo.call(second);
			console.log('New second claimable: ' + web3.utils.toDecimal(answer));

			answer = await EscrowThalesDeployed.getStakerSilo.call(third);
			console.log('New third claimable: ' + web3.utils.toDecimal(answer));

			answer = await ThalesDeployed.balanceOf.call(first);
			console.log('Thales balance of first user:' + web3.utils.toDecimal(answer));

			answer = await ThalesDeployed.balanceOf.call(second);
			console.log('Thales balance of second user:' + web3.utils.toDecimal(answer));

			answer = await ThalesDeployed.balanceOf.call(third);
			console.log('Thales balance of third user:' + web3.utils.toDecimal(answer));
		});
	});
});
