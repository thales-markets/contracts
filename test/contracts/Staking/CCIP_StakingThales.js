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

contract('CCIP Staking', (accounts) => {
	const [firstVault, firstLP, firstAMM, owner] = accounts;
	const [staker, secondStaker, thirdStaker, dummy] = accounts;

	let CCIPCollectorA;
	let CCIPCollectorB;

	let StakingMockA;
	let StakingMockB;

	let StakingThalesBonusRewardsManagerA;
	let StakingThalesBonusRewardsManagerB;

	let CCIPRouter;

	describe('Test CCIP solution ', () => {
		beforeEach(async () => {
			let CCIPCollectorContract = artifacts.require('CrossChainCollector');
			CCIPCollectorA = CCIPCollectorContract.new();
			CCIPCollectorB = CCIPCollectorContract.new();

			let StakingThalesMockContract = artifacts.require('StakingThalesMock');
			StakingMockA = await StakingThalesMockContract.new();
			StakingMockB = await StakingThalesMockContract.new();

			let CCIPRouterContract = artifacts.require('MockCCIPRouter');
			CCIPRouter = await CCIPRouterContract.new();

			let StakingThalesBonusRewardsManagerContract = artifacts.require(
				'StakingThalesBonusRewardsManager'
			);
			StakingThalesBonusRewardsManagerA = await StakingThalesBonusRewardsManagerContract.new();
			StakingThalesBonusRewardsManagerB = await StakingThalesBonusRewardsManagerContract.new();

			await StakingThalesBonusRewardsManagerA.initialize(owner, StakingMockA.address);
			await StakingThalesBonusRewardsManagerB.initialize(owner, StakingMockB.address);

			await StakingMockA.setStakingThalesBonusRewardsManager(
				StakingThalesBonusRewardsManagerA.address,
				{ from: owner }
			);
			await StakingMockB.setStakingThalesBonusRewardsManager(
				StakingThalesBonusRewardsManagerB.address,
				{ from: owner }
			);

			await StakingMockA.stake(toUnit(100000), {
				from: staker,
			});

			await StakingMockA.stake(toUnit(200000), {
				from: secondStaker,
			});

			await StakingMockA.stake(toUnit(500000), {
				from: thirdStaker,
			});

			await StakingThalesBonusRewardsManagerA.setStakingBaseDivider(100000, { from: owner });
			await StakingThalesBonusRewardsManagerA.setMaxStakingMultiplier(toUnit(4), { from: owner });

			await StakingMockB.stake(toUnit(100000), {
				from: staker,
			});

			await StakingMockB.stake(toUnit(200000), {
				from: secondStaker,
			});

			await StakingMockB.stake(toUnit(500000), {
				from: thirdStaker,
			});

			await StakingThalesBonusRewardsManagerB.setStakingBaseDivider(100000, { from: owner });
			await StakingThalesBonusRewardsManagerB.setMaxStakingMultiplier(toUnit(4), { from: owner });
		});
		it('deploy and test', async () => {
			let stakerMultiplier = await StakingThalesBonusRewardsManagerA.getStakingMultiplier(staker);
			console.log('stakerMultiplier: ' + stakerMultiplier / 1e18);

			let secondStakerMultiplier = await StakingThalesBonusRewardsManagerA.getStakingMultiplier(
				secondStaker
			);
			console.log('secondStakerMultiplier: ' + secondStakerMultiplier / 1e18);

			let thirdStakerMultiplier = await StakingThalesBonusRewardsManagerA.getStakingMultiplier(
				thirdStaker
			);
			console.log('thirdStakerMultiplier: ' + thirdStakerMultiplier / 1e18);

			await StakingThalesBonusRewardsManagerA.setMultipliers(toUnit(0.25), toUnit(0.5), toUnit(1), {
				from: owner,
			});

			await assert.revert(
				StakingMockA.updateVolumeWithOrigin(staker, toUnit(1), firstVault, {
					from: owner,
				}),
				'Only allowed for known origin'
			);

			await StakingThalesBonusRewardsManagerA.setKnownVault(firstVault, true, { from: owner });

			await StakingMockA.updateVolumeWithOrigin(staker, toUnit(10), firstVault, {
				from: owner,
			});

			let stakerVolume = await StakingThalesBonusRewardsManagerA.userRoundBonusPoints(staker, 0);
			console.log('stakerVolume: ' + stakerVolume / 1e18);

			let totalRoundBonusPoints = await StakingThalesBonusRewardsManagerA.totalRoundBonusPoints(0);
			console.log('totalRoundBonusPoints: ' + totalRoundBonusPoints / 1e18);

			let stakerVaultBaseVolume =
				await StakingThalesBonusRewardsManagerA.userVaultBasePointsPerRound(staker, 0);
			console.log('stakerVaultBaseVolume: ' + stakerVaultBaseVolume / 1e18);

			let totalVaultBasePointsPerRound =
				await StakingThalesBonusRewardsManagerA.totalVaultBasePointsPerRound(0);
			console.log('totalVaultBasePointsPerRound: ' + totalVaultBasePointsPerRound / 1e18);

			await StakingThalesBonusRewardsManagerA.setKnownLiquidityPool(firstLP, true, { from: owner });

			await StakingMockA.updateVolumeWithOrigin(secondStaker, toUnit(10), firstLP, {
				from: owner,
			});

			let secondStakerPoints = await StakingThalesBonusRewardsManagerA.userRoundBonusPoints(
				secondStaker,
				0
			);
			console.log('secondStakerPoints: ' + secondStakerPoints / 1e18);

			totalRoundBonusPoints = await StakingThalesBonusRewardsManagerA.totalRoundBonusPoints(0);
			console.log('totalRoundBonusPoints: ' + totalRoundBonusPoints / 1e18);

			await StakingThalesBonusRewardsManagerA.setKnownTradingAMM(firstAMM, true, { from: owner });

			await StakingMockA.updateVolumeWithOrigin(thirdStaker, toUnit(10), firstAMM, {
				from: owner,
			});

			let thirdStakerPoints = await StakingThalesBonusRewardsManagerA.userRoundBonusPoints(
				thirdStaker,
				0
			);
			console.log('thirdStakerPoints: ' + thirdStakerPoints / 1e18);

			totalRoundBonusPoints = await StakingThalesBonusRewardsManagerA.totalRoundBonusPoints(0);
			console.log('totalRoundBonusPoints: ' + totalRoundBonusPoints / 1e18);

			await StakingMockA.updateVolumeWithOrigin(secondStaker, toUnit(10), firstAMM, {
				from: owner,
			});

			secondStakerPoints = await StakingThalesBonusRewardsManagerA.userRoundBonusPoints(
				secondStaker,
				0
			);
			console.log('secondStakerPoints: ' + secondStakerPoints / 1e18);

			totalRoundBonusPoints = await StakingThalesBonusRewardsManagerA.totalRoundBonusPoints(0);
			console.log('totalRoundBonusPoints: ' + totalRoundBonusPoints / 1e18);

			let firstStakerShare = await StakingThalesBonusRewardsManagerA.getUserRoundBonusShare(
				staker,
				0
			);
			console.log('firstStakerShare: ' + firstStakerShare / 1e18);

			let secondStakerShare = await StakingThalesBonusRewardsManagerA.getUserRoundBonusShare(
				secondStaker,
				0
			);
			console.log('secondStakerShare: ' + secondStakerShare / 1e18);

			let thirdStakerShare = await StakingThalesBonusRewardsManagerA.getUserRoundBonusShare(
				thirdStaker,
				0
			);
			console.log('thirdStakerShare: ' + thirdStakerShare / 1e18);

			let thirdStakerRewards = await StakingMockA.getRewards(thirdStaker);
			console.log('thirdStakerRewards: ' + thirdStakerRewards / 1e18);
		});
	});
});
