'use strict';

const { artifacts, contract, web3 } = require('hardhat');
const { toBN, fromBN } = web3.utils;

const { assert, addSnapshotBeforeRestoreAfterEach } = require('../../utils/common');

const { toBytes32 } = require('../../../index');
const { expect } = require('chai');
const { toDecimal } = require('web3-utils');
const { ethers } = require('ethers');
const { setupContract, setupAllContracts } = require('../../utils/setup');

const ZERO_ADDRESS = '0x' + '0'.repeat(40);

const {
	fastForward,
	toUnit,
	currentTime,
	multiplyDecimalRound,
	divideDecimalRound,
} = require('../../utils')();

contract('StakingThales', accounts => {
	const [first, second, third, owner] = accounts;
	const [initialCreator, managerOwner, minter, dummy, exersicer, secondCreator] = accounts;
	let ThalesDeployed,
		ThalesFeeDeployed,
		StakingThalesDeployed,
		EscrowThalesDeployed,
		OngoingAirdropDeployed;

	const sUSDQty = toUnit(5555);
	const sUSD = 5555;
	const sAUDKey = toBytes32('sAUD');
	const SECOND = 1000;
	const DAY = 86400;
	const WEEK = 604800;
	const YEAR = 31556926;

	let BinaryOptionMarket = artifacts.require('BinaryOptionMarket');
	let Synth = artifacts.require('Synth');
	let BinaryOption = artifacts.require('BinaryOption');
	let manager, factory, addressResolver;
	let exchangeRates, oracle, sUSDSynth, binaryOptionMarketMastercopy, binaryOptionMastercopy;

	describe('Deploy Staking Thales', () => {
		it('deploy all Contracts', async () => {
			let Thales = artifacts.require('Thales');
			let EscrowThales = artifacts.require('EscrowThales');
			let StakingThales = artifacts.require('StakingThales');
			let OngoingAirdrop = artifacts.require('OngoingAirdrop');
			ThalesDeployed = await Thales.new({ from: owner });
			ThalesFeeDeployed = await Thales.new({ from: owner });
			OngoingAirdropDeployed = await OngoingAirdrop.new(
				owner,
				ThalesDeployed.address,
				toBytes32('random'),
				{ from: owner }
			);
			EscrowThalesDeployed = await EscrowThales.new(owner, ThalesDeployed.address, {
				from: owner,
			});

			StakingThalesDeployed = await StakingThales.new(
				owner,
				EscrowThalesDeployed.address,
				ThalesDeployed.address,
				first,
				WEEK,
				WEEK,
				{ from: owner }
			);
		});
	});

	before(async () => {
		({
			BinaryOptionMarketManager: manager,
			BinaryOptionMarketFactory: factory,
			BinaryOptionMarketMastercopy: binaryOptionMarketMastercopy,
			BinaryOptionMastercopy: binaryOptionMastercopy,
			AddressResolver: addressResolver,
			ExchangeRates: exchangeRates,
			SynthsUSD: sUSDSynth,
		} = await setupAllContracts({
			accounts,
			synths: ['sUSD'],
			contracts: [
				'FeePool',
				'ExchangeRates',
				'BinaryOptionMarketMastercopy',
				'BinaryOptionMastercopy',
				'BinaryOptionMarketFactory',
			],
		}));

		manager.setBinaryOptionsMarketFactory(factory.address, { from: managerOwner });

		factory.setBinaryOptionMarketManager(manager.address, { from: managerOwner });
		factory.setBinaryOptionMarketMastercopy(binaryOptionMarketMastercopy.address, {
			from: managerOwner,
		});
		factory.setBinaryOptionMastercopy(binaryOptionMastercopy.address, { from: managerOwner });

		oracle = await exchangeRates.oracle();

		await exchangeRates.updateRates([sAUDKey], [toUnit(5)], await currentTime(), {
			from: oracle,
		});

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
		let Thales = artifacts.require('Thales');
		let EscrowThales = artifacts.require('EscrowThales');
		let StakingThales = artifacts.require('StakingThales');
		let OngoingAirdrop = artifacts.require('OngoingAirdrop');

		ThalesDeployed = await Thales.new({ from: owner });
		ThalesFeeDeployed = await Thales.new({ from: owner });
		OngoingAirdropDeployed = await OngoingAirdrop.new(
			owner,
			ThalesDeployed.address,
			toBytes32('random'),
			{ from: owner }
		);
		EscrowThalesDeployed = await EscrowThales.new(owner, ThalesDeployed.address, {
			from: owner,
		});

		StakingThalesDeployed = await StakingThales.new(
			owner,
			EscrowThalesDeployed.address,
			ThalesDeployed.address,
			sUSDSynth.address,
			WEEK,
			WEEK,
			{ from: owner }
		);

		await StakingThalesDeployed.setDistributeFeesEnabled(true, { from: owner });
		await StakingThalesDeployed.setClaimEnabled(true, { from: owner });
		await StakingThalesDeployed.setFixedPeriodReward(100000, { from: owner });
	});

	describe('EscrowThales basic check', () => {
		it('get if StakingThales address in EscrowThales is equal to ZERO address', async () => {
			let getStakingAddress = await EscrowThalesDeployed.iStakingThales();
			// console.log("Staking Thaless address: " + getStakingAddress);
			// console.log("Owner address: " + owner);
			assert.equal(ZERO_ADDRESS, getStakingAddress);
		});

		it('set StakingThales address in EscrowThales to the actual contract ', async () => {
			let setStakingAddress = await EscrowThalesDeployed.setStakingThalesContract(
				StakingThalesDeployed.address,
				{ from: owner }
			);
			let getStakingAddress = await EscrowThalesDeployed.iStakingThales();
			// console.log("NEW Staking Thaless address: " + getStakingAddress);
			// console.log("StakingThalesDeployed address: " + StakingThalesDeployed.address);
			assert.equal(StakingThalesDeployed.address, getStakingAddress);
		});

		it('get if CurrentStakingPeriod is 0', async () => {
			let stakingPeriod = await EscrowThalesDeployed.currentVestingPeriod.call({ from: owner });
			assert.equal(0, stakingPeriod);
		});
		it('set CurrentStakingPeriod to 1 and check', async () => {
			let setStakingAddress = await EscrowThalesDeployed.setStakingThalesContract(first, {
				from: owner,
			});
			let getStakingAddress = await EscrowThalesDeployed.iStakingThales();
			assert.equal(first, getStakingAddress);

			let setPeriod = await EscrowThalesDeployed.updateCurrentPeriod({ from: first });
			let stakingPeriod = await EscrowThalesDeployed.currentVestingPeriod.call();
			assert.equal(1, stakingPeriod);
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
			// await StakingThalesDeployed.depositRewards(10, { from: owner });
			await ThalesDeployed.transfer(StakingThalesDeployed.address, 10, { from: owner });
			await ThalesFeeDeployed.transfer(StakingThalesDeployed.address, 10, {
				from: owner,
			});
			let answer = await StakingThalesDeployed.getContractRewardFunds.call({ from: owner });
			assert.equal(answer, toDecimal(answer));
			answer = await StakingThalesDeployed.getContractFeeFunds.call({ from: owner });
			assert.equal(answer, toDecimal(answer));
		});

		it('Start staking period', async () => {
			assert.equal(toDecimal(await StakingThalesDeployed.startTimeStamp.call()), 0);
			let answer = await StakingThalesDeployed.startStakingPeriod({ from: owner });
			assert.isAbove(toDecimal(await StakingThalesDeployed.startTimeStamp.call()), 0);
			assert.equal(
				toDecimal(await StakingThalesDeployed.startTimeStamp.call()),
				toDecimal(await StakingThalesDeployed.lastPeriodTimeStamp.call())
			);
		});

		it('Close staking period before 1)staking started and 2) before a period passes', async () => {
			await expect(StakingThalesDeployed.closePeriod({ from: owner })).to.be.revertedWith(
				'Staking period has not started'
			);
			let answer = await StakingThalesDeployed.startStakingPeriod({ from: owner });
			await fastForward(3 * DAY);
			await expect(StakingThalesDeployed.closePeriod({ from: owner })).to.be.revertedWith(
				'A full period has not passed since the last closed period'
			);
		});

		it('Stake with first and second account', async () => {
			let answer = await StakingThalesDeployed.startStakingPeriod({ from: owner });
		});
	});

	describe('Staking:', () => {
		it('Close staking period after period without funds in StakingThales', async () => {
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
				'Staking period has not started'
			);
		});

		it('Close staking period after period with low funds (69999) in StakingThales', async () => {
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
				'Staking period has not started'
			);
		});

		it('Close staking period after period with funds (100001) but NO Fees in StakingThales', async () => {
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
				'Staking period has not started'
			);
			let answer = await StakingThalesDeployed.startStakingPeriod({ from: owner });
		});

		it('Close staking period after period with funds (100001) in StakingThales', async () => {
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
				'Staking period has not started'
			);
			let answer = await StakingThalesDeployed.startStakingPeriod({ from: owner });
			// await StakingThalesDeployed.depositRewards(70001, { from: owner });
			await ThalesDeployed.transfer(StakingThalesDeployed.address, 100001, {
				from: owner,
			});
			await ThalesFeeDeployed.transfer(StakingThalesDeployed.address, 10000, {
				from: owner,
			});

			// await sUSDSynth.approve(StakingThalesDeployed.address, sUSDQty, { from: initialCreator });
			await sUSDSynth.issue(initialCreator, sUSDQty);
			await sUSDSynth.transfer(StakingThalesDeployed.address, sUSDQty, { from: initialCreator });

			// await StakingThalesDeployed.depositFees(10000, { from: owner });
			await fastForward(WEEK + SECOND);
			await StakingThalesDeployed.closePeriod({ from: second });
			answer = await StakingThalesDeployed.getContractRewardFunds.call({ from: owner });
			assert.equal(web3.utils.toDecimal(answer), 100001);
			// let answer = await StakingThalesDeployed.startStakingPeriod({from:owner});
			// assert.isAbove(toDecimal(await StakingThalesDeployed.startTimeStamp.call()), 0);
			// assert.equal(toDecimal(await StakingThalesDeployed.startTimeStamp.call()), toDecimal(await StakingThalesDeployed.lastPeriodTimeStamp.call()));
			// console.log(toDecimal(await StakingThalesDeployed.startTimeStamp.call()));
		});

		it('Stake with first account with NO THALES funds and fees', async () => {
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
				'Staking period has not started'
			);

			// await ThalesDeployed.transfer(first, 1500, {from:owner});
			// let answer = await ThalesDeployed.balanceOf.call(first);
			// assert.equal(answer, 1500);
			let answer = await StakingThalesDeployed.startStakingPeriod({ from: owner });
			// await StakingThalesDeployed.depositRewards(70001, { from: owner });
			await ThalesDeployed.transfer(StakingThalesDeployed.address, 70001, {
				from: owner,
			});
			await expect(StakingThalesDeployed.stake(1000, { from: first })).to.be.revertedWith(
				'No allowance. Please grant StakingThales allowance'
			);
		});

		it('Stake with first account', async () => {
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
				'Staking period has not started'
			);

			await ThalesDeployed.transfer(first, 1500, { from: owner });
			let answer = await ThalesDeployed.balanceOf.call(first);
			assert.equal(answer, 1500);
			answer = await StakingThalesDeployed.startStakingPeriod({ from: owner });
			await ThalesDeployed.transfer(StakingThalesDeployed.address, 70001, {
				from: owner,
			});
			// await StakingThalesDeployed.depositRewards(70001, { from: owner });
			await ThalesDeployed.approve(StakingThalesDeployed.address, 1000, { from: first });
			await StakingThalesDeployed.stake(1000, { from: first });
			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.equal(answer, 1000);
		});

		it('Stake with first account and claim reward (but no fees available)', async () => {
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
				'Staking period has not started'
			);

			await ThalesDeployed.transfer(first, 1500, { from: owner });
			let answer = await ThalesDeployed.balanceOf.call(first);
			assert.equal(answer, 1500);
			answer = await StakingThalesDeployed.startStakingPeriod({ from: owner });
			// await fastForward(2*DAY);
			await ThalesDeployed.transfer(StakingThalesDeployed.address, 15000, {
				from: owner,
			});
			// await StakingThalesDeployed.depositRewards(150000, { from: owner });
			await ThalesDeployed.approve(StakingThalesDeployed.address, 1000, { from: first });
			await StakingThalesDeployed.stake(1000, { from: first });
			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.equal(answer, 1000);
		});

		it('Stake with first account and claim reward', async () => {
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
				'Staking period has not started'
			);

			await ThalesDeployed.transfer(first, 1500, { from: owner });
			let answer = await ThalesDeployed.balanceOf.call(first);
			assert.equal(answer, 1500);
			answer = await StakingThalesDeployed.startStakingPeriod({ from: owner });
			// await fastForward(2*DAY);
			// await StakingThalesDeployed.depositRewards(150000, { from: owner });
			await ThalesDeployed.transfer(StakingThalesDeployed.address, 150000, {
				from: owner,
			});
			await ThalesFeeDeployed.transfer(StakingThalesDeployed.address, 5555, {
				from: owner,
			});

			await sUSDSynth.issue(initialCreator, sUSD);
			// await sUSDSynth.approve(StakingThalesDeployed.address, sUSD, { from: initialCreator });
			await sUSDSynth.transfer(StakingThalesDeployed.address, sUSD, { from: initialCreator });

			// await StakingThalesDeployed.depositFees(5555, { from: owner });
			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.equal(answer, 0);
			await ThalesDeployed.approve(StakingThalesDeployed.address, 1000, { from: first });
			await StakingThalesDeployed.stake(1000, { from: first });
			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.equal(answer, 1000);
			await expect(StakingThalesDeployed.getRewardsAvailable.call(first)).to.be.revertedWith(
				'Rewards already claimed for last period'
			);

			await fastForward(WEEK + 5 * SECOND);
			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.equal(answer, 1000);
			await StakingThalesDeployed.closePeriod({ from: second });
			answer = await StakingThalesDeployed.getContractRewardFunds.call({ from: owner });
			await fastForward(DAY);
			answer = await StakingThalesDeployed.getRewardsAvailable.call(first);
			assert.equal(web3.utils.toDecimal(answer), 100000);
			answer = await StakingThalesDeployed.getRewardFeesAvailable.call(first);
			assert.equal(web3.utils.toDecimal(answer), 5555);
			answer = await StakingThalesDeployed.claimReward({ from: first });
		});

		it('Stake with first account, claim reward, then unstake WITHOUT periodClose', async () => {
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
				'Staking period has not started'
			);

			await ThalesDeployed.transfer(first, 1500, { from: owner });
			let answer = await ThalesDeployed.balanceOf.call(first);
			assert.equal(answer, 1500);
			answer = await StakingThalesDeployed.startStakingPeriod({ from: owner });
			await ThalesDeployed.transfer(StakingThalesDeployed.address, 150000, {
				from: owner,
			});
			await ThalesFeeDeployed.transfer(StakingThalesDeployed.address, 5555, {
				from: owner,
			});
			await sUSDSynth.issue(initialCreator, sUSD);
			await sUSDSynth.transfer(StakingThalesDeployed.address, sUSD, { from: initialCreator });

			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.equal(answer, 0);
			await ThalesDeployed.approve(StakingThalesDeployed.address, 1000, { from: first });
			await StakingThalesDeployed.stake(1000, { from: first });
			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.equal(answer, 1000);
			await expect(StakingThalesDeployed.getRewardsAvailable.call(first)).to.be.revertedWith(
				'Rewards already claimed for last period'
			);

			await fastForward(WEEK + 5 * SECOND);
			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.equal(answer, 1000);
			await StakingThalesDeployed.closePeriod({ from: second });
			answer = await StakingThalesDeployed.getContractRewardFunds.call({ from: owner });

			await fastForward(DAY);
			answer = await StakingThalesDeployed.getRewardsAvailable.call(first);
			assert.equal(web3.utils.toDecimal(answer), 100000);
			answer = await StakingThalesDeployed.getRewardFeesAvailable.call(first);
			assert.equal(web3.utils.toDecimal(answer), 5555);
			answer = await ThalesDeployed.balanceOf.call(first);
			// console.log('First account Thales balance: ' + web3.utils.toDecimal(answer));
			answer = await StakingThalesDeployed.claimReward({ from: first });
			answer = await StakingThalesDeployed.startUnstake(
				await StakingThalesDeployed.stakedBalanceOf(first),
				{ from: first }
			);
			await fastForward(WEEK + 5 * SECOND);

			answer = await StakingThalesDeployed.unstake({ from: first });
			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.equal(answer, 0);

			answer = await ThalesDeployed.balanceOf.call(first);
			// console.log('First account Thales balance: ' + web3.utils.toDecimal(answer));
		});
		it('Stake, claim reward twice, then unstake', async () => {
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
				'Staking period has not started'
			);

			await ThalesDeployed.transfer(first, 1500, { from: owner });
			let answer = await ThalesDeployed.balanceOf.call(first);
			assert.equal(answer, 1500);
			answer = await StakingThalesDeployed.startStakingPeriod({ from: owner });
			await ThalesDeployed.transfer(StakingThalesDeployed.address, 300000, {
				from: owner,
			});
			await ThalesFeeDeployed.transfer(StakingThalesDeployed.address, 5555, {
				from: owner,
			});
			await sUSDSynth.issue(initialCreator, sUSD);
			await sUSDSynth.transfer(StakingThalesDeployed.address, sUSD, { from: initialCreator });

			// await StakingThalesDeployed.depositFees(5555, { from: owner });
			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.equal(answer, 0);
			await ThalesDeployed.approve(StakingThalesDeployed.address, 1000, { from: first });
			await StakingThalesDeployed.stake(1000, { from: first });
			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.equal(answer, 1000);
			await expect(StakingThalesDeployed.getRewardsAvailable.call(first)).to.be.revertedWith(
				'Rewards already claimed for last period'
			);

			await fastForward(WEEK + 5 * SECOND);
			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.equal(answer, 1000);
			await StakingThalesDeployed.closePeriod({ from: second });
			answer = await StakingThalesDeployed.getContractRewardFunds.call({ from: owner });

			await fastForward(DAY);
			answer = await StakingThalesDeployed.getRewardsAvailable.call(first);
			assert.equal(web3.utils.toDecimal(answer), 100000);
			answer = await StakingThalesDeployed.getRewardFeesAvailable.call(first);
			assert.equal(web3.utils.toDecimal(answer), 5555);
			answer = await ThalesDeployed.balanceOf.call(first);
			console.log('First account Thales balance: ' + web3.utils.toDecimal(answer));
			answer = await StakingThalesDeployed.claimReward({ from: first });

			await fastForward(WEEK + 5 * SECOND);
			// await StakingThalesDeployed.depositFees(1000, { from: owner });
			await ThalesFeeDeployed.transfer(StakingThalesDeployed.address, 1000, {
				from: owner,
			});
			await sUSDSynth.issue(initialCreator, sUSD);
			await sUSDSynth.transfer(StakingThalesDeployed.address, sUSD, { from: initialCreator });

			await StakingThalesDeployed.closePeriod({ from: second });

			answer = await StakingThalesDeployed.claimReward({ from: first });
			answer = await StakingThalesDeployed.startUnstake(
				await StakingThalesDeployed.stakedBalanceOf(first),
				{ from: first }
			);

			await fastForward(WEEK + 5 * SECOND);
			// await StakingThalesDeployed.depositFees(1000, { from: owner });
			await ThalesFeeDeployed.transfer(StakingThalesDeployed.address, 1000, {
				from: owner,
			});
			await sUSDSynth.issue(initialCreator, sUSD);
			await sUSDSynth.transfer(StakingThalesDeployed.address, sUSD, { from: initialCreator });

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

			await ThalesDeployed.transfer(first, 1500, { from: owner });
			let answer = await ThalesDeployed.balanceOf.call(first);
			assert.equal(answer, 1500);
			answer = await StakingThalesDeployed.startStakingPeriod({ from: owner });
			// await fastForward(2*DAY);
			// await StakingThalesDeployed.depositRewards(1500000, { from: owner });
			await ThalesDeployed.transfer(StakingThalesDeployed.address, 15000000, {
				from: owner,
			});
			await ThalesFeeDeployed.transfer(StakingThalesDeployed.address, 5555, {
				from: owner,
			});
			await sUSDSynth.issue(initialCreator, sUSD);
			await sUSDSynth.transfer(StakingThalesDeployed.address, sUSD, { from: initialCreator });

			// await StakingThalesDeployed.depositFees(5555, { from: owner });
			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.equal(answer, 0);
			await ThalesDeployed.approve(StakingThalesDeployed.address, 1000, { from: first });
			await StakingThalesDeployed.stake(1000, { from: first });
			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.equal(answer, 1000);
			await expect(StakingThalesDeployed.getRewardsAvailable.call(first)).to.be.revertedWith(
				'Rewards already claimed for last period'
			);

			await fastForward(WEEK + 5 * SECOND);
			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.equal(answer, 1000);
			await StakingThalesDeployed.closePeriod({ from: second });
			answer = await StakingThalesDeployed.getContractRewardFunds.call({ from: owner });

			await fastForward(DAY);
			answer = await StakingThalesDeployed.getRewardsAvailable.call(first);
			assert.equal(web3.utils.toDecimal(answer), 100000);
			answer = await StakingThalesDeployed.getRewardFeesAvailable.call(first);
			assert.equal(web3.utils.toDecimal(answer), 5555);

			answer = await ThalesDeployed.balanceOf.call(EscrowThalesDeployed.address);
			console.log('Balance of Escrow:' + web3.utils.toDecimal(answer));

			answer = await StakingThalesDeployed.claimReward({ from: first });
			answer = await EscrowThalesDeployed.NUM_PERIODS.call();
			console.log('Staker periods length: ' + web3.utils.toDecimal(answer));
			for (let i = 0; i < 11; i++) {
				await fastForward(WEEK + SECOND);
				// await StakingThalesDeployed.depositFees(5555, { from: owner });
				await ThalesFeeDeployed.transfer(StakingThalesDeployed.address, 5555, {
					from: owner,
				});
				await sUSDSynth.issue(initialCreator, sUSD);
				await sUSDSynth.transfer(StakingThalesDeployed.address, sUSD, { from: initialCreator });

				await StakingThalesDeployed.closePeriod({ from: second });
				// console.log(i)
				answer = await StakingThalesDeployed.claimReward({ from: first });
				answer = await ThalesDeployed.balanceOf.call(EscrowThalesDeployed.address);
				answer = await EscrowThalesDeployed.lastPeriodAddedReward.call(first);
				answer = await EscrowThalesDeployed.claimable.call(first);
			}

			answer = await EscrowThalesDeployed.currentVestingPeriod.call();
			answer = await EscrowThalesDeployed.lastPeriodAddedReward.call(first);

			answer = await EscrowThalesDeployed.claimable.call(first);
		});

		it('Vest first user', async () => {
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
				'Staking period has not started'
			);

			await ThalesDeployed.transfer(first, 1500, { from: owner });
			let answer = await ThalesDeployed.balanceOf.call(first);
			assert.equal(answer, 1500);
			answer = await StakingThalesDeployed.startStakingPeriod({ from: owner });
			await ThalesDeployed.transfer(StakingThalesDeployed.address, 5500000, {
				from: owner,
			});
			await ThalesFeeDeployed.transfer(StakingThalesDeployed.address, 5555, {
				from: owner,
			});
			await sUSDSynth.issue(initialCreator, sUSD);
			await sUSDSynth.transfer(StakingThalesDeployed.address, sUSD, { from: initialCreator });

			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.equal(answer, 0);
			await ThalesDeployed.approve(StakingThalesDeployed.address, 1000, { from: first });
			await StakingThalesDeployed.stake(1000, { from: first });
			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.equal(answer, 1000);
			await expect(StakingThalesDeployed.getRewardsAvailable.call(first)).to.be.revertedWith(
				'Rewards already claimed for last period'
			);

			await fastForward(WEEK + 5 * SECOND);
			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.equal(answer, 1000);
			await StakingThalesDeployed.closePeriod({ from: second });
			answer = await StakingThalesDeployed.getContractRewardFunds.call({ from: owner });

			await fastForward(DAY);
			answer = await StakingThalesDeployed.getRewardsAvailable.call(first);
			assert.equal(web3.utils.toDecimal(answer), 100000);
			answer = await StakingThalesDeployed.getRewardFeesAvailable.call(first);
			assert.equal(web3.utils.toDecimal(answer), 5555);

			answer = await ThalesDeployed.balanceOf.call(EscrowThalesDeployed.address);

			answer = await StakingThalesDeployed.claimReward({ from: first });

			for (let i = 0; i < 11; i++) {
				await fastForward(WEEK + SECOND);
				// await StakingThalesDeployed.depositFees(5555, { from: owner });
				await ThalesFeeDeployed.transfer(StakingThalesDeployed.address, 5555, {
					from: owner,
				});
				await sUSDSynth.issue(initialCreator, sUSD);
				await sUSDSynth.transfer(StakingThalesDeployed.address, sUSD, { from: initialCreator });

				await StakingThalesDeployed.closePeriod({ from: second });
				answer = await StakingThalesDeployed.claimReward({ from: first });
			}

			answer = await EscrowThalesDeployed.claimable.call(first);
			let answer2 = await EscrowThalesDeployed.claimable.call(first);
			assert.equal(web3.utils.toDecimal(answer), web3.utils.toDecimal(answer2));

			answer = await ThalesDeployed.balanceOf.call(first);
			// console.log('Thales balance of first user:' + web3.utils.toDecimal(answer));

			let claimable = web3.utils.toDecimal(answer2);

			// console.log('Current claimable: ' + claimable);

			await fastForward(WEEK + 5 * SECOND);
			// await StakingThalesDeployed.depositFees(1000, { from: owner });
			await ThalesFeeDeployed.transfer(StakingThalesDeployed.address, 1000, {
				from: owner,
			});
			await sUSDSynth.issue(initialCreator, sUSD);
			await sUSDSynth.transfer(StakingThalesDeployed.address, sUSD, { from: initialCreator });

			await StakingThalesDeployed.closePeriod({ from: second });

			// answer = await StakingThalesDeployed.claimReward({ from: first });
			answer = await StakingThalesDeployed.startUnstake(
				await StakingThalesDeployed.stakedBalanceOf(first),
				{ from: first }
			);

			await fastForward(WEEK + 5 * SECOND);
			// await StakingThalesDeployed.depositFees(1000, { from: owner });
			await ThalesFeeDeployed.transfer(StakingThalesDeployed.address, 1000, {
				from: owner,
			});
			await sUSDSynth.issue(initialCreator, sUSD);
			await sUSDSynth.transfer(StakingThalesDeployed.address, sUSD, { from: initialCreator });

			await StakingThalesDeployed.closePeriod({ from: second });

			answer = await StakingThalesDeployed.unstake({ from: first });
			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.equal(answer, 0);

			answer = await ThalesDeployed.balanceOf.call(first);
			console.log('First account Thales balance: ' + web3.utils.toDecimal(answer));

			answer = await EscrowThalesDeployed.vest(claimable, { from: first });
			// assert.equal(answer, true);
			console.log(answer.logs[0].event);
			// console.log('Claimed: ' + web3.utils.toDecimal(answer.logs[0].args.amount));
			assert.equal(answer.logs[0].args.account, first);
			answer = await EscrowThalesDeployed.claimable.call(first);
			// console.log('New claimable: ' + web3.utils.toDecimal(answer));

			answer = await ThalesDeployed.balanceOf.call(first);
			// console.log('Thales balance of first user:' + web3.utils.toDecimal(answer));
		});

		it('Staking & vesting with 2 users', async () => {
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
				'Staking period has not started'
			);
			await ThalesDeployed.transfer(first, 1500, { from: owner });
			let answer = await ThalesDeployed.balanceOf.call(first);
			assert.equal(answer, 1500);
			await ThalesDeployed.transfer(second, 1500, { from: owner });
			answer = await ThalesDeployed.balanceOf.call(second);
			assert.equal(answer, 1500);

			answer = await StakingThalesDeployed.startStakingPeriod({ from: owner });
			await ThalesDeployed.transfer(StakingThalesDeployed.address, 2500000, {
				from: owner,
			});
			await ThalesFeeDeployed.transfer(StakingThalesDeployed.address, 5555, {
				from: owner,
			});
			await sUSDSynth.issue(initialCreator, sUSD);
			await sUSDSynth.transfer(StakingThalesDeployed.address, sUSD, { from: initialCreator });

			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.equal(answer, 0);
			await ThalesDeployed.approve(StakingThalesDeployed.address, 1000, { from: first });
			await StakingThalesDeployed.stake(1000, { from: first });
			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.equal(answer, 1000);
			await expect(StakingThalesDeployed.getRewardsAvailable.call(first)).to.be.revertedWith(
				'Rewards already claimed for last period'
			);
			answer = await StakingThalesDeployed.stakedBalanceOf.call(second);
			assert.equal(answer, 0);
			await ThalesDeployed.approve(StakingThalesDeployed.address, 1000, { from: second });
			await StakingThalesDeployed.stake(1000, { from: second });
			answer = await StakingThalesDeployed.stakedBalanceOf.call(second);
			assert.equal(answer, 1000);
			await expect(StakingThalesDeployed.getRewardsAvailable.call(second)).to.be.revertedWith(
				'Rewards already claimed for last period'
			);

			await fastForward(WEEK + 5 * SECOND);
			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.equal(answer, 1000);
			answer = await StakingThalesDeployed.stakedBalanceOf.call(second);
			assert.equal(answer, 1000);
			await StakingThalesDeployed.closePeriod({ from: second });
			answer = await StakingThalesDeployed.getContractRewardFunds.call({ from: owner });

			await fastForward(DAY);
			answer = await StakingThalesDeployed.getRewardsAvailable.call(first);

			assert.equal(web3.utils.toDecimal(answer), 100000 / 2);

			answer = await StakingThalesDeployed.getRewardsAvailable.call(second);
			// console.log('Second rewards avail.: ' + web3.utils.toDecimal(answer));
			assert.equal(web3.utils.toDecimal(answer), 100000 / 2);
			answer = await StakingThalesDeployed.getRewardFeesAvailable.call(first);
			assert.equal(web3.utils.toDecimal(answer), 2777);
			answer = await StakingThalesDeployed.getRewardFeesAvailable.call(second);
			assert.equal(web3.utils.toDecimal(answer), 2777);

			answer = await ThalesDeployed.balanceOf.call(EscrowThalesDeployed.address);

			answer = await StakingThalesDeployed.claimReward({ from: first });
			answer = await StakingThalesDeployed.claimReward({ from: second });

			answer = await StakingThalesDeployed.getLastPeriodOfClaimedRewards.call(first);
			answer = await StakingThalesDeployed.getLastPeriodOfClaimedRewards.call(second);

			for (let i = 0; i < 14; i++) {
				await fastForward(WEEK + SECOND);
				// await StakingThalesDeployed.depositFees(5555, { from: owner });
				await ThalesFeeDeployed.transfer(StakingThalesDeployed.address, 5555, {
					from: owner,
				});
				await sUSDSynth.issue(initialCreator, sUSD);
				await sUSDSynth.transfer(StakingThalesDeployed.address, sUSD, { from: initialCreator });

				await StakingThalesDeployed.closePeriod({ from: second });
				answer = await StakingThalesDeployed.claimReward({ from: first });
				answer = await ThalesDeployed.balanceOf.call(EscrowThalesDeployed.address);
				answer = await StakingThalesDeployed.claimReward({ from: second });
				answer = await ThalesDeployed.balanceOf.call(EscrowThalesDeployed.address);
				answer = await EscrowThalesDeployed.lastPeriodAddedReward.call(first);
				answer = await EscrowThalesDeployed.lastPeriodAddedReward.call(second);
				answer = await EscrowThalesDeployed.claimable.call(first);
				answer = await EscrowThalesDeployed.claimable.call(second);
			}

			answer = await EscrowThalesDeployed.claimable.call(first);
			answer = await EscrowThalesDeployed.claimable.call(second);

			answer = await EscrowThalesDeployed.claimable.call(first);
			let answer2 = await EscrowThalesDeployed.claimable.call(first);
			assert.equal(web3.utils.toDecimal(answer), web3.utils.toDecimal(answer2));
			answer = await EscrowThalesDeployed.claimable.call(second);
			answer2 = await EscrowThalesDeployed.claimable.call(second);
			assert.equal(web3.utils.toDecimal(answer), web3.utils.toDecimal(answer2));

			answer = await ThalesDeployed.balanceOf.call(first);
			// console.log('Thales balance of first user:' + web3.utils.toDecimal(answer));
			answer = await ThalesDeployed.balanceOf.call(second);
			// console.log('Thales balance of second user:' + web3.utils.toDecimal(answer));

			answer2 = await EscrowThalesDeployed.claimable.call(first);
			let claimable = web3.utils.toDecimal(answer2);

			answer2 = await EscrowThalesDeployed.claimable.call(second);
			let claimable2 = web3.utils.toDecimal(answer2);

			answer = await StakingThalesDeployed.startUnstake(
				await StakingThalesDeployed.stakedBalanceOf(first),
				{ from: first }
			);
			answer = await StakingThalesDeployed.startUnstake(
				await StakingThalesDeployed.stakedBalanceOf(second),
				{ from: second }
			);

			await fastForward(WEEK + 5 * SECOND);
			await ThalesFeeDeployed.transfer(StakingThalesDeployed.address, 1000, {
				from: owner,
			});
			await sUSDSynth.issue(initialCreator, sUSD);
			await sUSDSynth.transfer(StakingThalesDeployed.address, sUSD, { from: initialCreator });

			await StakingThalesDeployed.closePeriod({ from: second });

			answer = await StakingThalesDeployed.unstake({ from: first });
			answer = await StakingThalesDeployed.unstake({ from: second });

			answer = await EscrowThalesDeployed.vest(claimable, { from: first });
			console.log(answer.logs[0].event);
			assert.equal(answer.logs[0].args.account, first);

			answer2 = await EscrowThalesDeployed.vest(claimable2, { from: second });
			console.log(answer2.logs[0].event);
			assert.equal(answer2.logs[0].args.account, second);

			answer = await EscrowThalesDeployed.claimable.call(first);

			answer = await EscrowThalesDeployed.claimable.call(second);

			answer = await ThalesDeployed.balanceOf.call(first);

			answer = await ThalesDeployed.balanceOf.call(second);
		});

		it('Staking & vesting with 3 users', async () => {
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
				'Staking period has not started'
			);
			await ThalesDeployed.transfer(first, 1500, { from: owner });
			let answer = await ThalesDeployed.balanceOf.call(first);
			assert.equal(answer, 1500);
			await ThalesDeployed.transfer(second, 1500, { from: owner });
			answer = await ThalesDeployed.balanceOf.call(second);
			assert.equal(answer, 1500);
			await ThalesDeployed.transfer(third, 1500, { from: owner });
			answer = await ThalesDeployed.balanceOf.call(second);
			assert.equal(answer, 1500);

			answer = await StakingThalesDeployed.startStakingPeriod({ from: owner });
			// await fastForward(2*DAY);
			// await StakingThalesDeployed.depositRewards(1500000, { from: owner });
			await ThalesDeployed.transfer(StakingThalesDeployed.address, 1500000, {
				from: owner,
			});
			// await StakingThalesDeployed.depositFees(6000, { from: owner });
			await ThalesFeeDeployed.transfer(StakingThalesDeployed.address, 6000, {
				from: owner,
			});
			await sUSDSynth.issue(initialCreator, 6000);
			await sUSDSynth.transfer(StakingThalesDeployed.address, 6000, { from: initialCreator });

			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.equal(answer, 0);
			await ThalesDeployed.approve(StakingThalesDeployed.address, 1000, { from: first });
			await StakingThalesDeployed.stake(1000, { from: first });
			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.equal(answer, 1000);
			await expect(StakingThalesDeployed.getRewardsAvailable.call(first)).to.be.revertedWith(
				'Rewards already claimed for last period'
			);
			answer = await StakingThalesDeployed.stakedBalanceOf.call(second);
			assert.equal(answer, 0);
			await ThalesDeployed.approve(StakingThalesDeployed.address, 1000, { from: second });
			await StakingThalesDeployed.stake(1000, { from: second });
			answer = await StakingThalesDeployed.stakedBalanceOf.call(second);
			assert.equal(answer, 1000);
			await expect(StakingThalesDeployed.getRewardsAvailable.call(second)).to.be.revertedWith(
				'Rewards already claimed for last period'
			);
			answer = await StakingThalesDeployed.stakedBalanceOf.call(third);
			assert.equal(answer, 0);
			await ThalesDeployed.approve(StakingThalesDeployed.address, 1000, { from: third });
			await StakingThalesDeployed.stake(1000, { from: third });
			answer = await StakingThalesDeployed.stakedBalanceOf.call(third);
			assert.equal(answer, 1000);
			await expect(StakingThalesDeployed.getRewardsAvailable.call(third)).to.be.revertedWith(
				'Rewards already claimed for last period'
			);

			await fastForward(WEEK + 5 * SECOND);
			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.equal(answer, 1000);
			answer = await StakingThalesDeployed.stakedBalanceOf.call(second);
			assert.equal(answer, 1000);
			answer = await StakingThalesDeployed.stakedBalanceOf.call(third);
			assert.equal(answer, 1000);

			await StakingThalesDeployed.closePeriod({ from: second });
			answer = await StakingThalesDeployed.getContractRewardFunds.call({ from: owner });

			await fastForward(DAY);
			answer = await StakingThalesDeployed.getRewardsAvailable.call(first);
			// console.log('First rewards avail.: ' + web3.utils.toDecimal(answer));
			assert.equal(web3.utils.toDecimal(answer), 33333);

			answer = await StakingThalesDeployed.getRewardsAvailable.call(second);
			// console.log('Second rewards avail.: ' + web3.utils.toDecimal(answer));
			assert.equal(web3.utils.toDecimal(answer), 33333);

			answer = await StakingThalesDeployed.getRewardsAvailable.call(third);
			// console.log('Second rewards avail.: ' + web3.utils.toDecimal(answer));
			assert.equal(web3.utils.toDecimal(answer), 33333);

			answer = await StakingThalesDeployed.getRewardFeesAvailable.call(first);
			assert.equal(web3.utils.toDecimal(answer), 6000 / 3);

			answer = await StakingThalesDeployed.getRewardFeesAvailable.call(second);
			assert.equal(web3.utils.toDecimal(answer), 6000 / 3);

			answer = await StakingThalesDeployed.getRewardFeesAvailable.call(third);
			assert.equal(web3.utils.toDecimal(answer), 6000 / 3);

			answer = await ThalesDeployed.balanceOf.call(EscrowThalesDeployed.address);
			// console.log("Balance of Escrow:" + web3.utils.toDecimal(answer));

			answer = await StakingThalesDeployed.claimReward({ from: first });
			// answer = await EscrowThalesDeployed.getStakerPeriodsLength.call(first);

			answer = await StakingThalesDeployed.claimReward({ from: second });
			// answer = await EscrowThalesDeployed.getStakerPeriodsLength.call(second);

			answer = await StakingThalesDeployed.claimReward({ from: third });
			// answer = await EscrowThalesDeployed.getStakerPeriodsLength.call(third);

			answer = await StakingThalesDeployed.getLastPeriodOfClaimedRewards.call(first);
			// console.log(web3.utils.toDecimal(answer));
			answer = await StakingThalesDeployed.getLastPeriodOfClaimedRewards.call(second);
			// console.log(web3.utils.toDecimal(answer));
			answer = await StakingThalesDeployed.getLastPeriodOfClaimedRewards.call(third);
			// console.log(web3.utils.toDecimal(answer));

			for (let i = 0; i < 11; i++) {
				await fastForward(WEEK + SECOND);
				// await StakingThalesDeployed.depositFees(5555, { from: owner });
				await ThalesFeeDeployed.transfer(StakingThalesDeployed.address, 6000, {
					from: owner,
				});
				await sUSDSynth.issue(initialCreator, sUSD);
				await sUSDSynth.transfer(StakingThalesDeployed.address, sUSD, { from: initialCreator });

				await StakingThalesDeployed.closePeriod({ from: second });
				answer = await StakingThalesDeployed.claimReward({ from: first });
				answer = await ThalesDeployed.balanceOf.call(EscrowThalesDeployed.address);
				answer = await StakingThalesDeployed.claimReward({ from: second });
				answer = await ThalesDeployed.balanceOf.call(EscrowThalesDeployed.address);
				answer = await StakingThalesDeployed.claimReward({ from: third });
				answer = await ThalesDeployed.balanceOf.call(EscrowThalesDeployed.address);
				answer = await EscrowThalesDeployed.lastPeriodAddedReward.call(first);
				answer = await EscrowThalesDeployed.lastPeriodAddedReward.call(second);
				answer = await EscrowThalesDeployed.lastPeriodAddedReward.call(third);
				answer = await EscrowThalesDeployed.claimable.call(first);
				answer = await EscrowThalesDeployed.claimable.call(second);
				answer = await EscrowThalesDeployed.claimable.call(third);
			}

			answer = await EscrowThalesDeployed.claimable.call(first);
			answer = await EscrowThalesDeployed.claimable.call(second);
			answer = await EscrowThalesDeployed.claimable.call(third);

			answer = await EscrowThalesDeployed.claimable.call(first);
			let answer2 = await EscrowThalesDeployed.claimable.call(first);
			assert.equal(web3.utils.toDecimal(answer), web3.utils.toDecimal(answer2));
			answer = await EscrowThalesDeployed.claimable.call(second);
			answer2 = await EscrowThalesDeployed.claimable.call(second);
			assert.equal(web3.utils.toDecimal(answer), web3.utils.toDecimal(answer2));

			answer = await EscrowThalesDeployed.claimable.call(third);
			answer2 = await EscrowThalesDeployed.claimable.call(third);
			assert.equal(web3.utils.toDecimal(answer), web3.utils.toDecimal(answer2));

			answer = await ThalesDeployed.balanceOf.call(first);

			answer = await ThalesDeployed.balanceOf.call(second);

			answer = await ThalesDeployed.balanceOf.call(third);

			answer2 = await EscrowThalesDeployed.claimable.call(first);
			let claimable = web3.utils.toDecimal(answer2);

			answer2 = await EscrowThalesDeployed.claimable.call(second);
			let claimable2 = web3.utils.toDecimal(answer2);

			answer2 = await EscrowThalesDeployed.claimable.call(third);
			let claimable3 = web3.utils.toDecimal(answer2);

			answer = await StakingThalesDeployed.startUnstake(
				await StakingThalesDeployed.stakedBalanceOf(first),
				{ from: first }
			);
			answer = await StakingThalesDeployed.startUnstake(
				await StakingThalesDeployed.stakedBalanceOf(second),
				{ from: second }
			);
			answer = await StakingThalesDeployed.startUnstake(
				await StakingThalesDeployed.stakedBalanceOf(third),
				{ from: third }
			);

			await fastForward(WEEK + 5 * SECOND);
			// await StakingThalesDeployed.depositFees(1000, { from: owner });
			await ThalesFeeDeployed.transfer(StakingThalesDeployed.address, 1000, {
				from: owner,
			});
			await sUSDSynth.issue(initialCreator, sUSD);
			await sUSDSynth.transfer(StakingThalesDeployed.address, sUSD, { from: initialCreator });

			await StakingThalesDeployed.closePeriod({ from: second });

			answer = await StakingThalesDeployed.unstake({ from: first });
			answer = await StakingThalesDeployed.unstake({ from: second });
			answer = await StakingThalesDeployed.unstake({ from: third });

			answer = await EscrowThalesDeployed.vest(claimable, { from: first });
			assert.equal(answer.logs[0].args.account, first);

			answer2 = await EscrowThalesDeployed.vest(claimable2, { from: second });
			assert.equal(answer2.logs[0].args.account, second);

			answer2 = await EscrowThalesDeployed.vest(claimable3, { from: third });
			assert.equal(answer2.logs[0].args.account, third);

			answer = await EscrowThalesDeployed.claimable.call(first);

			answer = await EscrowThalesDeployed.claimable.call(second);

			answer = await EscrowThalesDeployed.claimable.call(third);

			answer = await ThalesDeployed.balanceOf.call(first);

			answer = await ThalesDeployed.balanceOf.call(second);

			answer = await ThalesDeployed.balanceOf.call(third);
		});

		it('Claim rewards first user: 5, 9, 13', async () => {
			let periods = [5, 4, 4];
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
				'Staking period has not started'
			);
			await ThalesDeployed.transfer(first, 1500, { from: owner });
			let answer = await StakingThalesDeployed.startStakingPeriod({ from: owner });
			await ThalesDeployed.transfer(StakingThalesDeployed.address, 5500000, {
				from: owner,
			});
			await ThalesFeeDeployed.transfer(StakingThalesDeployed.address, 5555, {
				from: owner,
			});
			await sUSDSynth.issue(initialCreator, sUSD);
			await sUSDSynth.transfer(StakingThalesDeployed.address, sUSD, { from: initialCreator });

			await ThalesDeployed.approve(StakingThalesDeployed.address, 1000, { from: first });
			await StakingThalesDeployed.stake(1000, { from: first });

			for (let n = 0; n < periods.length; n++) {
				for (let i = 0; i < periods[n]; i++) {
					await fastForward(WEEK + SECOND);
					// await StakingThalesDeployed.depositFees(5555, { from: owner });
					await ThalesFeeDeployed.transfer(StakingThalesDeployed.address, 5555, {
						from: owner,
					});
					await sUSDSynth.issue(initialCreator, sUSD);
					await sUSDSynth.transfer(StakingThalesDeployed.address, sUSD, { from: initialCreator });

					await StakingThalesDeployed.closePeriod({ from: second });
				}
				answer = await StakingThalesDeployed.claimReward({ from: first });
			}
			answer = await EscrowThalesDeployed.claimable.call(first);
			let answer2 = await EscrowThalesDeployed.claimable.call(first);
			let claimable = web3.utils.toDecimal(answer2);
			console.log('Current claimable: ' + claimable);
			assert.equal(web3.utils.toDecimal(answer), web3.utils.toDecimal(answer2));
		});

		it('Claim rewards first user: 5, 9, 16', async () => {
			let periods = [5, 4, 7];
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
				'Staking period has not started'
			);
			await ThalesDeployed.transfer(first, 1500, { from: owner });
			let answer = await StakingThalesDeployed.startStakingPeriod({ from: owner });
			await ThalesDeployed.transfer(StakingThalesDeployed.address, 5500000, {
				from: owner,
			});
			await ThalesFeeDeployed.transfer(StakingThalesDeployed.address, 5555, {
				from: owner,
			});
			await ThalesDeployed.approve(StakingThalesDeployed.address, 1000, { from: first });
			await StakingThalesDeployed.stake(1000, { from: first });

			for (let n = 0; n < periods.length; n++) {
				for (let i = 0; i < periods[n]; i++) {
					await fastForward(WEEK + SECOND);
					// await StakingThalesDeployed.depositFees(5555, { from: owner });
					await ThalesFeeDeployed.transfer(StakingThalesDeployed.address, 5555, {
						from: owner,
					});
					await sUSDSynth.issue(initialCreator, sUSD);
					await sUSDSynth.transfer(StakingThalesDeployed.address, sUSD, { from: initialCreator });

					await StakingThalesDeployed.closePeriod({ from: second });
				}
				answer = await StakingThalesDeployed.claimReward({ from: first });
			}
			answer = await EscrowThalesDeployed.claimable.call(first);
			let answer2 = await EscrowThalesDeployed.claimable.call(first);
			let claimable = web3.utils.toDecimal(answer2);
			console.log('Current claimable: ' + claimable);
			assert.equal(web3.utils.toDecimal(answer), web3.utils.toDecimal(answer2));
		});

		it('Claim rewards first user: 0, 21 periods', async () => {
			let periods = [1, 20];
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
				'Staking period has not started'
			);
			await ThalesDeployed.transfer(first, 1500, { from: owner });
			let answer = await StakingThalesDeployed.startStakingPeriod({ from: owner });
			await ThalesDeployed.transfer(StakingThalesDeployed.address, 5500000, {
				from: owner,
			});
			await ThalesFeeDeployed.transfer(StakingThalesDeployed.address, 5555, {
				from: owner,
			});
			await sUSDSynth.issue(initialCreator, sUSD);
			await sUSDSynth.transfer(StakingThalesDeployed.address, sUSD, { from: initialCreator });

			await ThalesDeployed.approve(StakingThalesDeployed.address, 1000, { from: first });
			await StakingThalesDeployed.stake(1000, { from: first });

			for (let n = 0; n < periods.length; n++) {
				for (let i = 0; i < periods[n]; i++) {
					await fastForward(WEEK + SECOND);
					// await StakingThalesDeployed.depositFees(5555, { from: owner });
					await ThalesFeeDeployed.transfer(StakingThalesDeployed.address, 5555, {
						from: owner,
					});
					await sUSDSynth.issue(initialCreator, sUSD);
					await sUSDSynth.transfer(StakingThalesDeployed.address, sUSD, { from: initialCreator });

					await StakingThalesDeployed.closePeriod({ from: second });
				}
				answer = await StakingThalesDeployed.claimReward({ from: first });
			}
			answer = await EscrowThalesDeployed.claimable.call(first);
			let answer2 = await EscrowThalesDeployed.claimable.call(first);
			let claimable = web3.utils.toDecimal(answer2);
			console.log('Current claimable: ' + claimable);
			assert.equal(web3.utils.toDecimal(answer), web3.utils.toDecimal(answer2));
		});
		it('Claim rewards first user: 0, 9, 21, 30 periods', async () => {
			let periods = [1, 8, 12, 9];
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
				'Staking period has not started'
			);
			await ThalesDeployed.transfer(first, 1500, { from: owner });
			let answer = await StakingThalesDeployed.startStakingPeriod({ from: owner });
			await ThalesDeployed.transfer(StakingThalesDeployed.address, 5500000, {
				from: owner,
			});
			await ThalesFeeDeployed.transfer(StakingThalesDeployed.address, 5555, {
				from: owner,
			});
			await ThalesDeployed.approve(StakingThalesDeployed.address, 1000, { from: first });
			await StakingThalesDeployed.stake(1000, { from: first });

			for (let n = 0; n < periods.length; n++) {
				for (let i = 0; i < periods[n]; i++) {
					await fastForward(WEEK + SECOND);
					// await StakingThalesDeployed.depositFees(5555, { from: owner });
					await ThalesFeeDeployed.transfer(StakingThalesDeployed.address, 5555, {
						from: owner,
					});
					await sUSDSynth.issue(initialCreator, sUSDQty);
					await sUSDSynth.transfer(StakingThalesDeployed.address, sUSDQty, {
						from: initialCreator,
					});

					await StakingThalesDeployed.closePeriod({ from: second });
				}
				answer = await StakingThalesDeployed.claimReward({ from: first });
				answer = await EscrowThalesDeployed.claimable.call(first);
			}

			answer = await EscrowThalesDeployed.claimable.call(first);
			let answer2 = await EscrowThalesDeployed.claimable.call(first);
			let claimable = web3.utils.toDecimal(answer2);
			// console.log('Current claimable: ' + claimable);
			assert.equal(web3.utils.toDecimal(answer), web3.utils.toDecimal(answer2));
		});
		it('Claim rewards first user: 0, 9, 21, 31 periods', async () => {
			let periods = [1, 8, 12, 10];
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
				'Staking period has not started'
			);
			await ThalesDeployed.transfer(first, 1500, { from: owner });
			let answer = await StakingThalesDeployed.startStakingPeriod({ from: owner });
			await ThalesDeployed.transfer(StakingThalesDeployed.address, 5500000, {
				from: owner,
			});
			await ThalesFeeDeployed.transfer(StakingThalesDeployed.address, 5555, {
				from: owner,
			});
			await ThalesDeployed.approve(StakingThalesDeployed.address, 1000, { from: first });
			await StakingThalesDeployed.stake(1000, { from: first });

			for (let n = 0; n < periods.length; n++) {
				for (let i = 0; i < periods[n]; i++) {
					await fastForward(WEEK + SECOND);
					// await StakingThalesDeployed.depositFees(5555, { from: owner });
					await ThalesFeeDeployed.transfer(StakingThalesDeployed.address, 5555, {
						from: owner,
					});
					await sUSDSynth.issue(initialCreator, sUSDQty);
					await sUSDSynth.transfer(StakingThalesDeployed.address, sUSDQty, {
						from: initialCreator,
					});

					await StakingThalesDeployed.closePeriod({ from: second });
				}
				answer = await StakingThalesDeployed.claimReward({ from: first });
				answer = await EscrowThalesDeployed.claimable.call(first);
			}
			answer = await EscrowThalesDeployed.claimable.call(first);
			let answer2 = await EscrowThalesDeployed.claimable.call(first);
			let claimable = web3.utils.toDecimal(answer2);
			// console.log('Current claimable: ' + claimable);
			assert.equal(web3.utils.toDecimal(answer), web3.utils.toDecimal(answer2));
		});
	});
	describe('Airdrop start, then StakingThales:', () => {
		it('Airdrop starts Escrow', async () => {
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
				'Staking period has not started'
			);

			let periodsVesting = await EscrowThalesDeployed.currentVestingPeriod.call();
			// console.log("Staking periods: ", web3.utils.toDecimal(periodsVesting));

			await EscrowThalesDeployed.setAirdropContract(OngoingAirdropDeployed.address, {
				from: owner,
			});
			await OngoingAirdropDeployed.setEscrow(EscrowThalesDeployed.address, { from: owner });

			await OngoingAirdropDeployed.setRoot(toBytes32('start'), { from: owner });

			periodsVesting = await EscrowThalesDeployed.currentVestingPeriod.call();
			console.log('Staking periods: ', web3.utils.toDecimal(periodsVesting));

			for (let n = 0; n < 5; n++) {
				fastForward(WEEK + SECOND);
				await OngoingAirdropDeployed.setRoot(toBytes32('start'), { from: owner });
			}

			periodsVesting = await EscrowThalesDeployed.currentVestingPeriod.call();
			console.log('Staking periods: ', web3.utils.toDecimal(periodsVesting));
		});
		it('Airdrop starts Escrow, then StakingThales starts', async () => {
			let periods = [1, 8, 12, 10];
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
				'Staking period has not started'
			);

			let periodsVesting = await EscrowThalesDeployed.currentVestingPeriod.call();
			console.log('Staking periods: ', web3.utils.toDecimal(periodsVesting));

			await EscrowThalesDeployed.setAirdropContract(OngoingAirdropDeployed.address, {
				from: owner,
			});
			await OngoingAirdropDeployed.setEscrow(EscrowThalesDeployed.address, { from: owner });

			await OngoingAirdropDeployed.setRoot(toBytes32('start'), { from: owner });

			periodsVesting = await EscrowThalesDeployed.currentVestingPeriod.call();
			// console.log("Staking periods: ", web3.utils.toDecimal(periodsVesting));

			for (let n = 0; n < 5; n++) {
				fastForward(WEEK + SECOND);
				await OngoingAirdropDeployed.setRoot(toBytes32('start'), { from: owner });
			}

			periodsVesting = await EscrowThalesDeployed.currentVestingPeriod.call();
			console.log('StakingThales starts staking in: ', web3.utils.toDecimal(periodsVesting));

			await ThalesDeployed.transfer(first, 1500, { from: owner });
			let answer = await StakingThalesDeployed.startStakingPeriod({ from: owner });
			await ThalesDeployed.transfer(StakingThalesDeployed.address, 5500000, {
				from: owner,
			});
			await ThalesFeeDeployed.transfer(StakingThalesDeployed.address, 5555, {
				from: owner,
			});
			await ThalesDeployed.approve(StakingThalesDeployed.address, 1000, { from: first });
			await StakingThalesDeployed.stake(1000, { from: first });

			for (let n = 0; n < periods.length; n++) {
				for (let i = 0; i < periods[n]; i++) {
					fastForward(WEEK + SECOND);
					// await StakingThalesDeployed.depositFees(5555, { from: owner });
					await ThalesFeeDeployed.transfer(StakingThalesDeployed.address, 5555, {
						from: owner,
					});
					await sUSDSynth.issue(initialCreator, sUSDQty);
					await sUSDSynth.transfer(StakingThalesDeployed.address, sUSDQty, {
						from: initialCreator,
					});

					await StakingThalesDeployed.closePeriod({ from: second });
				}
				answer = await StakingThalesDeployed.claimReward({ from: first });
				answer = await EscrowThalesDeployed.claimable.call(first);
				periodsVesting = await EscrowThalesDeployed.currentVestingPeriod.call();
				console.log('Staking periods: ', web3.utils.toDecimal(periodsVesting));
			}
		});
		it('Airdrop starts Escrow, StakingThales continues, User claims rewards in periods 0, 9, 21, 31', async () => {
			let periods = [1, 8, 12, 10];
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
				'Staking period has not started'
			);

			let periodsVesting = await EscrowThalesDeployed.currentVestingPeriod.call();
			console.log('Staking periods: ', web3.utils.toDecimal(periodsVesting));

			await EscrowThalesDeployed.setAirdropContract(OngoingAirdropDeployed.address, {
				from: owner,
			});
			await OngoingAirdropDeployed.setEscrow(EscrowThalesDeployed.address, { from: owner });

			await OngoingAirdropDeployed.setRoot(toBytes32('start'), { from: owner });

			periodsVesting = await EscrowThalesDeployed.currentVestingPeriod.call();

			for (let n = 0; n < 5; n++) {
				fastForward(WEEK + SECOND);
				await OngoingAirdropDeployed.setRoot(toBytes32('start'), { from: owner });
			}

			periodsVesting = await EscrowThalesDeployed.currentVestingPeriod.call();
			console.log('Staking periods: ', web3.utils.toDecimal(periodsVesting));

			await ThalesDeployed.transfer(first, 1500, { from: owner });
			let answer = await StakingThalesDeployed.startStakingPeriod({ from: owner });
			await ThalesDeployed.transfer(StakingThalesDeployed.address, 5500000, {
				from: owner,
			});
			await ThalesFeeDeployed.transfer(StakingThalesDeployed.address, 5555, {
				from: owner,
			});
			await ThalesDeployed.approve(StakingThalesDeployed.address, 1000, { from: first });
			await StakingThalesDeployed.stake(1000, { from: first });

			for (let n = 0; n < periods.length; n++) {
				for (let i = 0; i < periods[n]; i++) {
					fastForward(WEEK + SECOND);
					// await StakingThalesDeployed.depositFees(5555, { from: owner });
					await ThalesFeeDeployed.transfer(StakingThalesDeployed.address, 5555, {
						from: owner,
					});
					await sUSDSynth.issue(initialCreator, sUSDQty);
					await sUSDSynth.transfer(StakingThalesDeployed.address, sUSDQty, {
						from: initialCreator,
					});

					await StakingThalesDeployed.closePeriod({ from: second });
				}
				answer = await StakingThalesDeployed.claimReward({ from: first });
				answer = await EscrowThalesDeployed.claimable.call(first);
			}
			answer = await EscrowThalesDeployed.claimable.call(first);
			let answer2 = await EscrowThalesDeployed.claimable.call(first);
			let claimable = web3.utils.toDecimal(answer2);
			// console.log('Current claimable: ' + claimable);
			assert.equal(web3.utils.toDecimal(answer), web3.utils.toDecimal(answer2));

			answer = await StakingThalesDeployed.startUnstake(
				await StakingThalesDeployed.stakedBalanceOf(first),
				{ from: first }
			);

			fastForward(WEEK + 5 * SECOND);
			// await StakingThalesDeployed.depositFees(1000, { from: owner });
			await ThalesFeeDeployed.transfer(StakingThalesDeployed.address, 1000, {
				from: owner,
			});
			await sUSDSynth.issue(initialCreator, sUSDQty);
			await sUSDSynth.transfer(StakingThalesDeployed.address, sUSDQty, { from: initialCreator });

			await StakingThalesDeployed.closePeriod({ from: second });

			answer = await StakingThalesDeployed.unstake({ from: first });

			answer = await EscrowThalesDeployed.claimable.call(first);
			console.log('Claimable: ', web3.utils.toDecimal(answer));

			answer = await EscrowThalesDeployed.vest(claimable, { from: first });

			answer = await EscrowThalesDeployed.claimable.call(first);
			console.log('Vested. Current Claimable: ', web3.utils.toDecimal(answer));

			periodsVesting = await EscrowThalesDeployed.currentVestingPeriod.call();

			for (let n = 0; n < 5; n++) {
				fastForward(WEEK + SECOND);
				await OngoingAirdropDeployed.setRoot(toBytes32('start'), { from: owner });
			}

			periodsVesting = await EscrowThalesDeployed.currentVestingPeriod.call();
			console.log('Staking periods: ', web3.utils.toDecimal(periodsVesting));
		});
	});
});
