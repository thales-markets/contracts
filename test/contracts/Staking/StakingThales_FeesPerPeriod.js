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
	const [first, second, third, owner] = accounts;
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
	});

	describe('Staking:', () => {
		it('Fee token checks', async () => {
			let balanceOfOwner = await ThalesFeeDeployed.balanceOf(owner);
			console.log('Balance of owner fees token: ', fromUnit(balanceOfOwner));
			assert.equal(fromUnit(balanceOfOwner), '100000000');
		});

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
			await fastForward(WEEK + SECOND);
			let currentFees = await StakingThalesDeployed.currentPeriodFees();
			await StakingThalesDeployed.closePeriod({ from: second });
			currentFees = await StakingThalesDeployed.currentPeriodFees();
			let balaceFirstBefore = await ThalesFeeDeployed.balanceOf(first);
			let baseRewards = await StakingThalesDeployed.getBaseReward(first);
			answer = await StakingThalesDeployed.getRewardsAvailable(first);
			let feesAvailable = await StakingThalesDeployed.getRewardFeesAvailable(first);
			await StakingThalesDeployed.claimReward({ from: first });
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

	describe('Vesting:', () => {
		it('Staking & vesting with 2 users ', async () => {
			let deposit = toUnit(100000);
			let stake = [toUnit(1500), toUnit(1500)];
			let users = [first, second];
			let weeks = 11;

			await StakingThalesDeployed.setStakingRewardsParameters(deposit, 100000, false, {
				from: owner,
			});
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await ThalesFeeDeployed.transfer(StakingThalesDeployed.address, deposit, { from: owner });
			await ThalesDeployed.transfer(
				ThalesStakingRewardsPoolDeployed.address,
				deposit.mul(toBN(weeks)),
				{
					from: owner,
				}
			);
			await StakingThalesDeployed.startStakingPeriod({ from: owner });
			for (let i = 0; i < users.length; i++) {
				await ThalesDeployed.transfer(users[i], stake[i], { from: owner });
				await ThalesDeployed.approve(StakingThalesDeployed.address, stake[i], { from: users[i] });
				await StakingThalesDeployed.stake(stake[i], { from: users[i] });
			}
			let period = 0;
			let balanceBefore = 0;
			let balanceAfter = 0;
			while (period < weeks) {
				await fastForward(WEEK + SECOND);
				await StakingThalesDeployed.closePeriod({ from: second });
				await ThalesFeeDeployed.transfer(StakingThalesDeployed.address, deposit, { from: owner });
				for (let i = 0; i < users.length; i++) {
					balanceBefore = await ThalesFeeDeployed.balanceOf(users[i]);
					await StakingThalesDeployed.claimReward({ from: users[i] });
					balanceAfter = await ThalesFeeDeployed.balanceOf(users[i]);
					assert.equal(fromUnit(balanceAfter.sub(balanceBefore)), fromUnit(deposit) / users.length);
				}
				period++;
			}
			await fastForward(WEEK + SECOND);
			await StakingThalesDeployed.closePeriod({ from: second });
			await ThalesFeeDeployed.transfer(StakingThalesDeployed.address, deposit, { from: owner });
			for (let i = 0; i < users.length; i++) {
				let answer = await EscrowThalesDeployed.claimable(users[i]);
				assert.bnEqual(answer, deposit);
				await EscrowThalesDeployed.vest(deposit.div(toBN(users.length)), { from: users[i] });
				answer = await ThalesDeployed.balanceOf(users[i]);
				assert.bnEqual(answer, deposit.div(toBN(users.length)));
			}
		});

		it('Staking & vesting with 3 users ', async () => {
			let deposit = toUnit(100000);
			let stake = [toUnit(1500), toUnit(1500), toUnit(1500)];
			let users = [first, second, third];
			let weeks = 11;

			await StakingThalesDeployed.setStakingRewardsParameters(deposit, 100000, false, {
				from: owner,
			});
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await sUSDSynth.issue(initialCreator, deposit.mul(toBN(weeks)));
			await sUSDSynth.transfer(StakingThalesDeployed.address, deposit.mul(toBN(weeks)), {
				from: initialCreator,
			});
			await ThalesDeployed.transfer(
				ThalesStakingRewardsPoolDeployed.address,
				deposit.mul(toBN(weeks)),
				{
					from: owner,
				}
			);
			await StakingThalesDeployed.startStakingPeriod({ from: owner });
			for (let i = 0; i < users.length; i++) {
				await ThalesDeployed.transfer(users[i], stake[i], { from: owner });
				await ThalesDeployed.approve(StakingThalesDeployed.address, stake[i], { from: users[i] });
				await StakingThalesDeployed.stake(stake[i], { from: users[i] });
			}
			let period = 0;
			let balanceBefore = 0;
			let balanceAfter = 0;
			while (period < weeks) {
				await fastForward(WEEK + SECOND);
				await ThalesFeeDeployed.transfer(StakingThalesDeployed.address, deposit, { from: owner });
				await StakingThalesDeployed.closePeriod({ from: second });
				for (let i = 0; i < users.length; i++) {
					balanceBefore = await ThalesFeeDeployed.balanceOf(users[i]);
					await StakingThalesDeployed.claimReward({ from: users[i] });
					balanceAfter = await ThalesFeeDeployed.balanceOf(users[i]);
					assert.equal(fromUnit(balanceAfter.sub(balanceBefore)), fromUnit(deposit) / users.length);
				}
				period++;
			}
			await fastForward(WEEK + SECOND);
			await StakingThalesDeployed.closePeriod({ from: second });
			for (let i = 0; i < users.length; i++) {
				let answer = await EscrowThalesDeployed.claimable(users[i]);
				assert.bnEqual(answer, deposit.mul(toBN(2)).div(toBN(users.length)));
				await EscrowThalesDeployed.vest(deposit.div(toBN(users.length)), { from: users[i] });
				answer = await ThalesDeployed.balanceOf(users[i]);
				assert.bnEqual(answer, deposit.div(toBN(users.length)));
			}
		});

		it('Vesting at 19th week, after claiming first user in weeks: 5, 9, 13 ', async () => {
			let periods = [5, 9, 13];
			let deposit = toUnit(100000);
			let stake = toUnit(1500);
			let weeks = 20;
			await ThalesDeployed.transfer(first, stake, { from: owner });
			await StakingThalesDeployed.setStakingRewardsParameters(deposit, 100000, false, {
				from: owner,
			});
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await sUSDSynth.issue(initialCreator, deposit.mul(toBN(weeks)));
			await sUSDSynth.transfer(StakingThalesDeployed.address, deposit.mul(toBN(weeks)), {
				from: initialCreator,
			});
			await ThalesDeployed.transfer(
				ThalesStakingRewardsPoolDeployed.address,
				deposit.mul(toBN(weeks)),
				{
					from: owner,
				}
			);
			await StakingThalesDeployed.startStakingPeriod({ from: owner });
			await ThalesDeployed.approve(StakingThalesDeployed.address, stake, { from: first });
			await StakingThalesDeployed.stake(stake, { from: first });
			let period = 0;
			let answer = await EscrowThalesDeployed.claimable(first);
			while (period < weeks) {
				await fastForward(WEEK + SECOND);
				await StakingThalesDeployed.closePeriod({ from: second });
				if (periods.includes(period)) {
					await StakingThalesDeployed.claimReward({ from: first });
				}
				period++;
			}
			answer = await EscrowThalesDeployed.claimable(first);
			assert.bnEqual(answer, deposit.mul(toBN(2)));
			await EscrowThalesDeployed.vest(deposit, { from: first });
			answer = await ThalesDeployed.balanceOf(first);
			assert.bnEqual(answer, deposit);
		});
	});
});
