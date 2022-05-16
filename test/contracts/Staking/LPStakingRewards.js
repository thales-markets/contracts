'use strict';

const { artifacts, contract } = require('hardhat');
const { toBN } = require('web3-utils');

const { assert } = require('../../utils/common');

const { fastForward, toUnit, currentTime } = require('../../utils')();

const { onlyGivenAddressCanInvoke, encodeCall } = require('../../utils/helpers');

contract('LPStakingDoubleRewards', accounts => {
	const [owner, initialCreator, mockRewardsDistributionAddress] = accounts;
	let rewardsToken,
		secondRewardsToken,
		stakingToken,
		LPStakingRewardsImplementation,
		LPStakingRewardsDeployed;

	let initializeLPData;
	let ProxyLPStakingRewardsDeployed;

	const WEEK = 604800;
	const DAY = 86400;

	beforeEach(async () => {
		let Thales = artifacts.require('Thales');
		let StakingToken = artifacts.require('MockSafeThales');
		let LPStakingRewards = artifacts.require('LPStakingDoubleRewards');
		let OwnedUpgradeabilityProxy = artifacts.require('OwnedUpgradeabilityProxy');

		rewardsToken = await Thales.new({ from: owner });
		secondRewardsToken = await Thales.new({ from: owner });
		stakingToken = await StakingToken.new({ from: owner });

		ProxyLPStakingRewardsDeployed = await OwnedUpgradeabilityProxy.new({ from: initialCreator });
		LPStakingRewardsImplementation = await LPStakingRewards.new({ from: owner });

		LPStakingRewardsDeployed = await LPStakingRewards.at(ProxyLPStakingRewardsDeployed.address);

		initializeLPData = encodeCall(
			'initialize',
			['address', 'address', 'address', 'address', 'uint'],
			[owner, rewardsToken.address, secondRewardsToken.address, stakingToken.address, DAY * 7]
		);
		await ProxyLPStakingRewardsDeployed.upgradeToAndCall(
			LPStakingRewardsImplementation.address,
			initializeLPData,
			{
				from: initialCreator,
			}
		);
		await LPStakingRewardsDeployed.setSecondRewardsToken(secondRewardsToken.address);

		await stakingToken.transfer(mockRewardsDistributionAddress, toUnit(5000), { from: owner });
		await stakingToken.approve(mockRewardsDistributionAddress, toUnit(5000), { from: owner });
	});

	describe('Constructor & Settings', () => {
		it('should set rewards token on constructor', async () => {
			assert.equal(await LPStakingRewardsDeployed.rewardsToken(), rewardsToken.address);
		});

		it('should set owner on constructor', async () => {
			const ownerAddress = await LPStakingRewardsDeployed.owner();
			assert.equal(ownerAddress, owner);
		});
	});

	describe('Function permissions', () => {
		const rewardValue = toUnit(1.0);
		const secondRewardValue = toUnit(2.0);

		before(async () => {
			await rewardsToken.transfer(LPStakingRewardsDeployed.address, rewardValue, { from: owner });
		});

		it('only owner can call notifyRewardAmount', async () => {
			let REVERT = 'Only the contract owner may perform this action';
			await assert.revert(
				LPStakingRewardsDeployed.notifyRewardAmount(rewardValue, secondRewardValue, {
					from: mockRewardsDistributionAddress,
				}),
				REVERT
			);
		});

		it('only owner address can call setRewardsDuration', async () => {
			await fastForward(DAY * 7);
			let REVERT = 'Only the contract owner may perform this action';
			await assert.revert(
				LPStakingRewardsDeployed.setRewardsDuration(70, { from: mockRewardsDistributionAddress }),
				REVERT
			);
		});

		it('only owner address can call setPaused', async () => {
			await onlyGivenAddressCanInvoke({
				fnc: LPStakingRewardsDeployed.setPaused,
				args: [true],
				address: owner,
				accounts,
			});
		});
	});

	describe('lastTimeRewardApplicable()', () => {
		it('should return 0', async () => {
			assert.equal((await LPStakingRewardsDeployed.lastTimeRewardApplicable()).toString(), 0);
		});

		describe('when updated', () => {
			it('should equal current timestamp', async () => {
				const rewardValue = toUnit(5000.0);
				const secondRewardValue = toUnit(1000.0);
				await rewardsToken.transfer(LPStakingRewardsDeployed.address, rewardValue, { from: owner });
				await secondRewardsToken.transfer(LPStakingRewardsDeployed.address, secondRewardValue, {
					from: owner,
				});

				await LPStakingRewardsDeployed.notifyRewardAmount(toUnit(1.0), toUnit(2.0), {
					from: owner,
				});

				const cur = await currentTime();
				const lastTimeReward = await LPStakingRewardsDeployed.lastTimeRewardApplicable();

				assert.equal(cur.toString(), lastTimeReward.toString());
			});
		});
	});

	describe('rewardPerToken()', () => {
		it('should return 0', async () => {
			let rewards = await LPStakingRewardsDeployed.rewardPerToken();
			assert.equal(rewards.reward, 0);
			assert.equal(rewards.secondReward, 0);
		});

		it('should return > 0', async () => {
			let totalSupply = await LPStakingRewardsDeployed.totalSupply();
			assert.equal(totalSupply.toString(), 0);

			await stakingToken.approve(LPStakingRewardsDeployed.address, toUnit(100), {
				from: mockRewardsDistributionAddress,
			});
			await LPStakingRewardsDeployed.stake(toUnit(100), { from: mockRewardsDistributionAddress });

			totalSupply = await LPStakingRewardsDeployed.totalSupply();
			assert.equal(totalSupply.toString(), toUnit(100));

			const rewardValue = toUnit(5000);
			const secondRewardValue = toUnit(1000);
			await rewardsToken.transfer(LPStakingRewardsDeployed.address, rewardValue, { from: owner });
			await secondRewardsToken.transfer(LPStakingRewardsDeployed.address, secondRewardValue, {
				from: owner,
			});
			await LPStakingRewardsDeployed.notifyRewardAmount(toUnit(5), toUnit(1), {
				from: owner,
			});

			await LPStakingRewardsDeployed.addReward(toUnit(5), { from: owner });
			await LPStakingRewardsDeployed.addSecondReward(toUnit(1), { from: owner });

			await fastForward(DAY);

			const rewards = await LPStakingRewardsDeployed.rewardPerToken();

			assert.ok(rewards.reward > 0);
			assert.ok(rewards.secondReward > 0);

			await fastForward(DAY);

			const newRewards = await LPStakingRewardsDeployed.rewardPerToken();

			assert.ok(newRewards.reward > rewards.reward);
			assert.ok(newRewards.secondReward > rewards.reward);
		});
	});

	describe('stake()', () => {
		it('increases staking balance', async () => {
			const initialStakeBal = await LPStakingRewardsDeployed.balanceOf(
				mockRewardsDistributionAddress
			);
			assert.equal(initialStakeBal, 0);

			await stakingToken.approve(LPStakingRewardsDeployed.address, toUnit(100), {
				from: mockRewardsDistributionAddress,
			});
			await LPStakingRewardsDeployed.stake(toUnit(100), { from: mockRewardsDistributionAddress });

			const postStakeBal = await LPStakingRewardsDeployed.balanceOf(mockRewardsDistributionAddress);

			assert.equal(postStakeBal.toString(), toUnit(100).toString());
		});
	});

	describe('earned()', () => {
		it('should be 0 when not staking', async () => {
			let earned = await LPStakingRewardsDeployed.earned(mockRewardsDistributionAddress);
			assert.equal(earned.earnedFirstToken, 0);
			assert.equal(earned.earnedSecondToken, 0);
		});

		it('should be > 0 when staking', async () => {
			await stakingToken.approve(LPStakingRewardsDeployed.address, toUnit(100), {
				from: mockRewardsDistributionAddress,
			});
			await LPStakingRewardsDeployed.stake(toUnit(100), { from: mockRewardsDistributionAddress });

			const rewardValue = toUnit(5000);
			const secondRewardValue = toUnit(1000);
			await rewardsToken.transfer(LPStakingRewardsDeployed.address, rewardValue, { from: owner });
			await secondRewardsToken.transfer(LPStakingRewardsDeployed.address, secondRewardValue, {
				from: owner,
			});
			await LPStakingRewardsDeployed.notifyRewardAmount(toUnit(5), toUnit(1), {
				from: owner,
			});

			await LPStakingRewardsDeployed.addReward(toUnit(5), { from: owner });
			await LPStakingRewardsDeployed.addSecondReward(toUnit(1), { from: owner });

			await fastForward(DAY);

			const earned = await LPStakingRewardsDeployed.earned(mockRewardsDistributionAddress);

			assert.ok(earned.earnedFirstToken > 0);
			assert.ok(earned.earnedSecondToken > 0);
		});

		it('rewardRate should increase if new rewards come before DURATION ends', async () => {
			const totalToDistribute = toUnit('5000');
			const totalToDistributeSecond = toUnit('1000');

			await rewardsToken.transfer(LPStakingRewardsDeployed.address, totalToDistribute, {
				from: owner,
			});
			await secondRewardsToken.transfer(LPStakingRewardsDeployed.address, totalToDistributeSecond, {
				from: owner,
			});
			await LPStakingRewardsDeployed.notifyRewardAmount(toUnit(5), toUnit(1), {
				from: owner,
			});

			await LPStakingRewardsDeployed.addReward(toUnit(5), { from: owner });
			await LPStakingRewardsDeployed.addSecondReward(toUnit(1), { from: owner });

			const rewardRateInitial = await LPStakingRewardsDeployed.rewardRate();
			const secondRewardRateInitial = await LPStakingRewardsDeployed.secondRewardRate();

			await rewardsToken.transfer(LPStakingRewardsDeployed.address, totalToDistribute, {
				from: owner,
			});
			await secondRewardsToken.transfer(LPStakingRewardsDeployed.address, totalToDistributeSecond, {
				from: owner,
			});

			await LPStakingRewardsDeployed.notifyRewardAmount(toUnit(5), toUnit(1), {
				from: owner,
			});

			await LPStakingRewardsDeployed.addBothRewards(toUnit(5), toUnit(1), { from: owner });

			const rewardRateLater = await LPStakingRewardsDeployed.rewardRate();
			const secondRewardRateLater = await LPStakingRewardsDeployed.secondRewardRate();

			assert.ok(rewardRateInitial > 0);
			assert.ok(secondRewardRateInitial > 0);
			assert.ok(rewardRateLater > rewardRateInitial);
			assert.ok(secondRewardRateLater > secondRewardRateInitial);
		});
	});

	describe('getReward()', () => {
		it('should increase rewards token balance', async () => {
			const totalToDistribute = toUnit('5000');
			const totalToDistributeSecond = toUnit('1000');

			await stakingToken.approve(LPStakingRewardsDeployed.address, toUnit(100), {
				from: mockRewardsDistributionAddress,
			});
			await LPStakingRewardsDeployed.stake(toUnit(100), { from: mockRewardsDistributionAddress });

			await rewardsToken.transfer(LPStakingRewardsDeployed.address, totalToDistribute, {
				from: owner,
			});
			await secondRewardsToken.transfer(LPStakingRewardsDeployed.address, totalToDistributeSecond, {
				from: owner,
			});
			await LPStakingRewardsDeployed.notifyRewardAmount(toUnit(5), toUnit(1), {
				from: owner,
			});
			await LPStakingRewardsDeployed.addReward(toUnit(5), { from: owner });
			await LPStakingRewardsDeployed.addSecondReward(toUnit(1), { from: owner });

			await fastForward(DAY);

			const initialRewardBal = await rewardsToken.balanceOf(mockRewardsDistributionAddress);
			const initialEarnedBal = await LPStakingRewardsDeployed.earned(
				mockRewardsDistributionAddress
			);

			await LPStakingRewardsDeployed.getReward({ from: mockRewardsDistributionAddress });

			const postRewardBal = await rewardsToken.balanceOf(mockRewardsDistributionAddress);
			const postEarnedBal = await LPStakingRewardsDeployed.earned(mockRewardsDistributionAddress);

			assert.ok(postEarnedBal.earnedFirstToken < initialEarnedBal);
			assert.ok(postEarnedBal.earnedSecondToken < initialEarnedBal);
			assert.ok(postRewardBal > initialRewardBal);
		});
	});

	describe('setRewardsDuration()', () => {
		const sevenDays = DAY * 7;
		const seventyDays = DAY * 70;

		it('should increase rewards duration before starting distribution', async () => {
			const defaultDuration = await LPStakingRewardsDeployed.rewardsDuration();
			assert.equal(defaultDuration, sevenDays);

			await LPStakingRewardsDeployed.setRewardsDuration(seventyDays, { from: owner });
			const newDuration = await LPStakingRewardsDeployed.rewardsDuration();
			assert.equal(newDuration, seventyDays);
		});

		it('should revert when setting setRewardsDuration before the period has finished', async () => {
			const totalToDistribute = toUnit('5000');
			const totalToDistributeSecond = toUnit('1000');

			await stakingToken.approve(LPStakingRewardsDeployed.address, toUnit(100), {
				from: mockRewardsDistributionAddress,
			});
			await LPStakingRewardsDeployed.stake(toUnit(100), { from: mockRewardsDistributionAddress });

			await rewardsToken.transfer(LPStakingRewardsDeployed.address, totalToDistribute, {
				from: owner,
			});
			await secondRewardsToken.transfer(LPStakingRewardsDeployed.address, totalToDistributeSecond, {
				from: owner,
			});
			await LPStakingRewardsDeployed.notifyRewardAmount(toUnit(5), toUnit(1), {
				from: owner,
			});
			await LPStakingRewardsDeployed.addReward(toUnit(5), { from: owner });
			await LPStakingRewardsDeployed.addSecondReward(toUnit(1), { from: owner });

			await fastForward(DAY);

			await assert.revert(
				LPStakingRewardsDeployed.setRewardsDuration(seventyDays, { from: owner }),
				'Previous rewards period must be complete before changing the duration for the new period'
			);
		});
		it('should update when setting setRewardsDuration after the period has finished', async () => {
			const totalToDistribute = toUnit('5000');
			const totalToDistributeSecond = toUnit('1000');
			await stakingToken.approve(LPStakingRewardsDeployed.address, toUnit(100), {
				from: mockRewardsDistributionAddress,
			});
			await LPStakingRewardsDeployed.stake(toUnit(100), { from: mockRewardsDistributionAddress });

			await rewardsToken.transfer(LPStakingRewardsDeployed.address, totalToDistribute, {
				from: owner,
			});
			await secondRewardsToken.transfer(LPStakingRewardsDeployed.address, totalToDistributeSecond, {
				from: owner,
			});
			await LPStakingRewardsDeployed.notifyRewardAmount(toUnit(5), toUnit(1), {
				from: owner,
			});
			await LPStakingRewardsDeployed.addReward(toUnit(5), { from: owner });
			await LPStakingRewardsDeployed.addSecondReward(toUnit(1), { from: owner });

			await rewardsToken.transfer(LPStakingRewardsDeployed.address, totalToDistribute, {
				from: owner,
			});
			await secondRewardsToken.transfer(LPStakingRewardsDeployed.address, totalToDistributeSecond, {
				from: owner,
			});
			await LPStakingRewardsDeployed.notifyRewardAmount(toUnit(5), toUnit(1), {
				from: owner,
			});
			await LPStakingRewardsDeployed.addReward(toUnit(5), { from: owner });
			await LPStakingRewardsDeployed.addSecondReward(toUnit(1), { from: owner });

			await fastForward(DAY * 8);

			const transaction = await LPStakingRewardsDeployed.setRewardsDuration(seventyDays, {
				from: owner,
			});
			assert.eventEqual(transaction, 'RewardsDurationUpdated', {
				newDuration: seventyDays,
			});

			const newDuration = await LPStakingRewardsDeployed.rewardsDuration();
			assert.equal(newDuration, seventyDays);

			await rewardsToken.transfer(LPStakingRewardsDeployed.address, totalToDistribute, {
				from: owner,
			});
			await secondRewardsToken.transfer(LPStakingRewardsDeployed.address, totalToDistributeSecond, {
				from: owner,
			});
			await LPStakingRewardsDeployed.notifyRewardAmount(toUnit(5), toUnit(1), {
				from: owner,
			});
			await LPStakingRewardsDeployed.addReward(toUnit(5), { from: owner });
			await LPStakingRewardsDeployed.addSecondReward(toUnit(1), { from: owner });
		});

		it('should update when setting setRewardsDuration after the period has finished', async () => {
			const totalToDistribute = toUnit('5000');
			const totalToDistributeSecond = toUnit('1000');
			await stakingToken.approve(LPStakingRewardsDeployed.address, toUnit(100), {
				from: mockRewardsDistributionAddress,
			});
			await LPStakingRewardsDeployed.stake(toUnit(100), { from: mockRewardsDistributionAddress });

			await rewardsToken.transfer(LPStakingRewardsDeployed.address, totalToDistribute, {
				from: owner,
			});
			await secondRewardsToken.transfer(LPStakingRewardsDeployed.address, totalToDistributeSecond, {
				from: owner,
			});
			await LPStakingRewardsDeployed.notifyRewardAmount(toUnit(5), toUnit(1), {
				from: owner,
			});
			await LPStakingRewardsDeployed.addReward(toUnit(5), { from: owner });
			await LPStakingRewardsDeployed.addSecondReward(toUnit(1), { from: owner });

			await fastForward(DAY * 4);
			await LPStakingRewardsDeployed.getReward({ from: mockRewardsDistributionAddress });
			await fastForward(DAY * 4);

			// New Rewards period much lower
			await rewardsToken.transfer(LPStakingRewardsDeployed.address, totalToDistribute, {
				from: owner,
			});
			await secondRewardsToken.transfer(LPStakingRewardsDeployed.address, totalToDistributeSecond, {
				from: owner,
			});
			const transaction = await LPStakingRewardsDeployed.setRewardsDuration(seventyDays, {
				from: owner,
			});
			assert.eventEqual(transaction, 'RewardsDurationUpdated', {
				newDuration: seventyDays,
			});

			const newDuration = await LPStakingRewardsDeployed.rewardsDuration();
			assert.bnEqual(newDuration, seventyDays);

			await LPStakingRewardsDeployed.notifyRewardAmount(toUnit(1), toUnit(5), {
				from: owner,
			});
			await LPStakingRewardsDeployed.addSecondReward(toUnit(1), { from: owner });
			await LPStakingRewardsDeployed.addReward(toUnit(5), { from: owner });

			await fastForward(DAY * 71);
			await LPStakingRewardsDeployed.getReward({ from: mockRewardsDistributionAddress });
		});
	});

	describe('getRewardForDuration()', () => {
		it('should increase rewards token balance', async () => {
			const totalToDistribute = toUnit('5000');
			const totalToDistributeSecond = toUnit('5000');
			await rewardsToken.transfer(LPStakingRewardsDeployed.address, totalToDistribute, {
				from: owner,
			});
			await secondRewardsToken.transfer(LPStakingRewardsDeployed.address, totalToDistributeSecond, {
				from: owner,
			});
			await LPStakingRewardsDeployed.notifyRewardAmount(toUnit(5), toUnit(1), {
				from: owner,
			});
			await LPStakingRewardsDeployed.addReward(toUnit(5), { from: owner });
			await LPStakingRewardsDeployed.addSecondReward(toUnit(1), { from: owner });

			const rewardForDuration = await LPStakingRewardsDeployed.getRewardForDuration();
			const secondRewardForDuration = await LPStakingRewardsDeployed.getSecondRewardForDuration();

			const duration = await LPStakingRewardsDeployed.rewardsDuration();
			const rewardRate = await LPStakingRewardsDeployed.rewardRate();
			const secondRewardRate = await LPStakingRewardsDeployed.secondRewardRate();

			assert.ok(rewardForDuration > 0);
			assert.ok(secondRewardForDuration > 0);
			assert.equal(rewardForDuration.toString(), duration.mul(rewardRate).toString());
			assert.equal(secondRewardForDuration.toString(), duration.mul(secondRewardRate).toString());
		});
	});

	describe('withdraw()', () => {
		it('should increases lp token balance and decreases staking balance', async () => {
			const totalToStake = toUnit(1);

			await stakingToken.approve(LPStakingRewardsDeployed.address, totalToStake, {
				from: mockRewardsDistributionAddress,
			});
			await LPStakingRewardsDeployed.stake(totalToStake, { from: mockRewardsDistributionAddress });

			await fastForward(300);

			const initialStakeBal = await LPStakingRewardsDeployed.balanceOf(
				mockRewardsDistributionAddress
			);

			await LPStakingRewardsDeployed.withdraw(toUnit(0.5), {
				from: mockRewardsDistributionAddress,
			});

			const postStakeBal = await LPStakingRewardsDeployed.balanceOf(mockRewardsDistributionAddress);

			assert.bnEqual(postStakeBal.add(toBN(toUnit(0.5))).toString(), initialStakeBal.toString());
		});
	});

	describe('exit()', () => {
		it('should retrieve all earned and increase rewards bal', async () => {
			const totalToDistribute = toUnit('5000');
			const totalToDistributeSecond = toUnit('1000');
			await stakingToken.approve(LPStakingRewardsDeployed.address, toUnit(100), {
				from: mockRewardsDistributionAddress,
			});
			await LPStakingRewardsDeployed.stake(toUnit(100), { from: mockRewardsDistributionAddress });

			await rewardsToken.transfer(LPStakingRewardsDeployed.address, totalToDistribute, {
				from: owner,
			});
			await secondRewardsToken.transfer(LPStakingRewardsDeployed.address, totalToDistributeSecond, {
				from: owner,
			});
			await LPStakingRewardsDeployed.notifyRewardAmount(toUnit(5), toUnit(1), {
				from: owner,
			});
			await LPStakingRewardsDeployed.addReward(toUnit(5), { from: owner });
			await LPStakingRewardsDeployed.addSecondReward(toUnit(1), { from: owner });

			await fastForward(DAY);

			const initialRewardBal = await rewardsToken.balanceOf(mockRewardsDistributionAddress);
			const initialEarnedBal = await LPStakingRewardsDeployed.earned(
				mockRewardsDistributionAddress
			);

			await LPStakingRewardsDeployed.exit({ from: mockRewardsDistributionAddress });

			const postRewardBal = await rewardsToken.balanceOf(mockRewardsDistributionAddress);
			const postEarnedBal = await LPStakingRewardsDeployed.earned(mockRewardsDistributionAddress);

			assert.ok(postEarnedBal.earnedFirstToken < initialEarnedBal.earnedFirstToken);
			assert.ok(postEarnedBal.earnedSecondToken < initialEarnedBal.earnedSecondToken);
			assert.ok(postRewardBal > initialRewardBal);
			assert.equal(postEarnedBal.earnedFirstToken, 0);
			assert.equal(postEarnedBal.earnedSecondToken, 0);
		});
	});

	describe('notifyRewardAmount()', () => {
		it('Reverts if the provided reward is greater than the balance.', async () => {
			const rewardValue = toUnit(1000);
			await rewardsToken.transfer(LPStakingRewardsDeployed.address, rewardValue, { from: owner });
			await secondRewardsToken.transfer(LPStakingRewardsDeployed.address, rewardValue, {
				from: owner,
			});
			await assert.revert(
				LPStakingRewardsDeployed.notifyRewardAmount(
					rewardValue.add(toUnit(0.1)),
					rewardValue.add(toUnit(0.2)),
					{
						from: owner,
					}
				),
				'Provided reward too high'
			);
		});

		it('Reverts if the provided reward is greater than the balance, plus rolled-over balance.', async () => {
			const rewardValue = toUnit(1000);
			await rewardsToken.transfer(LPStakingRewardsDeployed.address, rewardValue, { from: owner });
			await secondRewardsToken.transfer(LPStakingRewardsDeployed.address, rewardValue, {
				from: owner,
			});
			await LPStakingRewardsDeployed.notifyRewardAmount(rewardValue, rewardValue, {
				from: owner,
			});
			await rewardsToken.transfer(LPStakingRewardsDeployed.address, rewardValue, { from: owner });
			await secondRewardsToken.transfer(LPStakingRewardsDeployed.address, rewardValue, {
				from: owner,
			});
			// Now take into account any leftover quantity.
			await assert.revert(
				LPStakingRewardsDeployed.notifyRewardAmount(
					rewardValue.add(toUnit(0.1)),
					rewardValue.add(toUnit(0.2)),
					{
						from: owner,
					}
				),
				'Provided reward too high'
			);
		});
	});
});
