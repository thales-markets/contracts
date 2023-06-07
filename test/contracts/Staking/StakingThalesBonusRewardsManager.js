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
	const [firstVault, second, third, owner] = accounts;
	const [staker, managerOwner, minter, dummy] = accounts;

	describe('Deploy StakingThalesBonusRewardsManager ', () => {
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

			await stakingThalesBonusRewardsManager.setStakingBaseDivider(100000, { from: owner });

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
		});
	});
});
