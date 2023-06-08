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

contract('StakingThalesBonusRewardsManager', (accounts) => {
	const [firstVault, firstLP, firstAMM, owner] = accounts;
	const [staker, secondStaker, thirdStaker, dummy] = accounts;

	describe('Test StakingThalesBonusRewardsManager ', () => {
		it('deploy and test', async () => {
			let StakingThalesBonusRewardsManager = artifacts.require('StakingThalesBonusRewardsManager');
			let stakingThalesBonusRewardsManager = await StakingThalesBonusRewardsManager.new();

			let StakingThalesMock = artifacts.require('StakingThalesMock');
			let stakingThalesMock = await StakingThalesMock.new();

			await stakingThalesBonusRewardsManager.initialize(owner, stakingThalesMock.address);

			await stakingThalesMock.setStakingThalesBonusRewardsManager(
				stakingThalesBonusRewardsManager.address,
				{ from: owner }
			);
			await stakingThalesMock.stake(toUnit(100000), {
				from: staker,
			});

			await stakingThalesMock.stake(toUnit(200000), {
				from: secondStaker,
			});

			await stakingThalesMock.stake(toUnit(500000), {
				from: thirdStaker,
			});

			await stakingThalesBonusRewardsManager.setStakingBaseDivider(100000, { from: owner });

			await stakingThalesBonusRewardsManager.setMaxStakingMultiplier(toUnit(4), { from: owner });

			let stakerMultiplier = await stakingThalesBonusRewardsManager.getStakingMultiplier(staker);
			console.log('stakerMultiplier: ' + stakerMultiplier / 1e18);

			let secondStakerMultiplier = await stakingThalesBonusRewardsManager.getStakingMultiplier(
				secondStaker
			);
			console.log('secondStakerMultiplier: ' + secondStakerMultiplier / 1e18);

			let thirdStakerMultiplier = await stakingThalesBonusRewardsManager.getStakingMultiplier(
				thirdStaker
			);
			console.log('thirdStakerMultiplier: ' + thirdStakerMultiplier / 1e18);

			await stakingThalesBonusRewardsManager.setMultipliers(toUnit(0.25), toUnit(0.5), toUnit(1), {
				from: owner,
			});

			await assert.revert(
				stakingThalesMock.updateVolumeWithOrigin(staker, toUnit(1), firstVault, {
					from: owner,
				}),
				'Only allowed for known origin'
			);

			await stakingThalesBonusRewardsManager.setKnownVault(firstVault, true, { from: owner });

			await stakingThalesMock.updateVolumeWithOrigin(staker, toUnit(10), firstVault, {
				from: owner,
			});

			let stakerVolume = await stakingThalesBonusRewardsManager.userRoundBonusPoints(staker, 0);
			console.log('stakerVolume: ' + stakerVolume / 1e18);

			let totalRoundBonusPoints = await stakingThalesBonusRewardsManager.totalRoundBonusPoints(0);
			console.log('totalRoundBonusPoints: ' + totalRoundBonusPoints / 1e18);

			let stakerVaultBaseVolume =
				await stakingThalesBonusRewardsManager.userVaultBasePointsPerRound(staker, 0);
			console.log('stakerVaultBaseVolume: ' + stakerVaultBaseVolume / 1e18);

			let totalVaultBasePointsPerRound =
				await stakingThalesBonusRewardsManager.totalVaultBasePointsPerRound(0);
			console.log('totalVaultBasePointsPerRound: ' + totalVaultBasePointsPerRound / 1e18);

			await stakingThalesBonusRewardsManager.setKnownLiquidityPool(firstLP, true, { from: owner });

			await stakingThalesMock.updateVolumeWithOrigin(secondStaker, toUnit(10), firstLP, {
				from: owner,
			});

			let secondStakerPoints = await stakingThalesBonusRewardsManager.userRoundBonusPoints(
				secondStaker,
				0
			);
			console.log('secondStakerPoints: ' + secondStakerPoints / 1e18);

			totalRoundBonusPoints = await stakingThalesBonusRewardsManager.totalRoundBonusPoints(0);
			console.log('totalRoundBonusPoints: ' + totalRoundBonusPoints / 1e18);

			await stakingThalesBonusRewardsManager.setKnownTradingAMM(firstAMM, true, { from: owner });

			await stakingThalesMock.updateVolumeWithOrigin(thirdStaker, toUnit(10), firstAMM, {
				from: owner,
			});

			let thirdStakerPoints = await stakingThalesBonusRewardsManager.userRoundBonusPoints(
				thirdStaker,
				0
			);
			console.log('thirdStakerPoints: ' + thirdStakerPoints / 1e18);

			totalRoundBonusPoints = await stakingThalesBonusRewardsManager.totalRoundBonusPoints(0);
			console.log('totalRoundBonusPoints: ' + totalRoundBonusPoints / 1e18);

			await stakingThalesMock.updateVolumeWithOrigin(secondStaker, toUnit(10), firstAMM, {
				from: owner,
			});

			secondStakerPoints = await stakingThalesBonusRewardsManager.userRoundBonusPoints(
				secondStaker,
				0
			);
			console.log('secondStakerPoints: ' + secondStakerPoints / 1e18);

			totalRoundBonusPoints = await stakingThalesBonusRewardsManager.totalRoundBonusPoints(0);
			console.log('totalRoundBonusPoints: ' + totalRoundBonusPoints / 1e18);

			let firstStakerShare = await stakingThalesBonusRewardsManager.getUserRoundBonusShare(
				staker,
				0
			);
			console.log('firstStakerShare: ' + firstStakerShare / 1e18);

			let secondStakerShare = await stakingThalesBonusRewardsManager.getUserRoundBonusShare(
				secondStaker,
				0
			);
			console.log('secondStakerShare: ' + secondStakerShare / 1e18);

			let thirdStakerShare = await stakingThalesBonusRewardsManager.getUserRoundBonusShare(
				thirdStaker,
				0
			);
			console.log('thirdStakerShare: ' + thirdStakerShare / 1e18);

			let thirdStakerRewards = await stakingThalesMock.getRewards(thirdStaker);
			console.log('thirdStakerRewards: ' + thirdStakerRewards / 1e18);
		});
	});
});
