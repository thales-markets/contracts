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

	describe('Deploy ProxyStaking Thales', () => {
		it('deploy all Contracts', async () => {
			let Thales = artifacts.require('Thales');
			let EscrowThales = artifacts.require('EscrowThales');
			let StakingThales = artifacts.require('StakingThales');
			let OwnedUpgradeabilityProxy = artifacts.require('OwnedUpgradeabilityProxy');
			let SNXRewards = artifacts.require('SNXRewards');
			SNXRewardsDeployed = await SNXRewards.new();
			ThalesDeployed = await Thales.new({ from: owner });
			ThalesFeeDeployed = await Thales.new({ from: owner });

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
			await ProxyEscrowDeployed.upgradeToAndCall(
				EscrowImplementation.address,
				initializeEscrowData,
				{
					from: initialCreator,
				}
			);

			initializeStalkingData = encodeCall(
				'initialize',
				['address', 'address', 'address', 'address', 'uint256', 'uint256', 'address'],
				[
					owner,
					EscrowThalesDeployed.address,
					ThalesDeployed.address,
					sUSDSynth.address,
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
				EscrowThalesDeployed.address,
				{ from: owner }
			);
		});
	});

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
				sUSDSynth.address,
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
		await StakingThalesDeployed.setStakingParameters(true, true, WEEK, WEEK, true, { from: owner });
		await StakingThalesDeployed.setStakingRewardsParameters(
			100000,
			100000,
			false,
			'15',
			'12',
			'3',
			'1',
			'10',
			{ from: owner }
		);
		await StakingThalesDeployed.setAddresses(
			SNXRewardsDeployed.address,
			dummy,
			dummy,
			dummy,
			PriceFeedInstance.address,
			ThalesStakingRewardsPoolDeployed.address,
			AddressResolverDeployed.address,
			ZERO_ADDRESS,
			ZERO_ADDRESS,
			ZERO_ADDRESS,
			ZERO_ADDRESS,
			{ from: owner }
		);
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
			await EscrowThalesDeployed.setStakingThalesContract(first, {
				from: owner,
			});
			let getStakingAddress = await EscrowThalesDeployed.iStakingThales();
			assert.equal(first, getStakingAddress);

			await EscrowThalesDeployed.updateCurrentPeriod({ from: first });
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
			answer = await StakingThalesDeployed.getContractRewardFunds.call({ from: owner });
			assert.equal(answer, 0);
			answer = await StakingThalesDeployed.getContractFeeFunds.call({ from: owner });
			assert.equal(answer, 0);
			answer = await StakingThalesDeployed.getRewardsAvailable(first);
			assert.equal(answer, 0);
			answer = await StakingThalesDeployed.getRewardFeesAvailable(first);
			assert.equal(answer, 0);
		});

		it('Deposit funds to the StakingThales', async () => {
			let deposit = toUnit(10);
			await ThalesDeployed.transfer(ThalesStakingRewardsPoolDeployed.address, deposit, {
				from: owner,
			});
			await ThalesFeeDeployed.transfer(StakingThalesDeployed.address, deposit, {
				from: owner,
			});
			let answer = await StakingThalesDeployed.getContractRewardFunds.call({ from: owner });
			assert.bnEqual(answer, deposit);
			await sUSDSynth.issue(initialCreator, deposit);
			await sUSDSynth.transfer(StakingThalesDeployed.address, deposit, { from: initialCreator });
			answer = await StakingThalesDeployed.getContractFeeFunds.call({ from: owner });
			assert.bnEqual(answer, deposit);
		});

		it('Start staking period', async () => {
			assert.equal(toDecimal(await StakingThalesDeployed.startTimeStamp.call()), 0);
			await StakingThalesDeployed.startStakingPeriod({ from: owner });
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
			await StakingThalesDeployed.startStakingPeriod({ from: owner });
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

		it('Close staking period with low funds (99,999) in StakingThales and claim single user ', async () => {
			let deposit = toUnit(100000);
			let lowerDeposit = toUnit(500);
			await ThalesDeployed.transfer(first, toUnit(2), { from: owner });
			await StakingThalesDeployed.setStakingRewardsParameters(
				deposit,
				100000,
				false,
				'15',
				'12',
				'3',
				'1',
				'10',
				{ from: owner }
			);
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
				'Staking period has not started'
			);
			await ThalesDeployed.transfer(ThalesStakingRewardsPoolDeployed.address, lowerDeposit, {
				from: owner,
			});
			await StakingThalesDeployed.startStakingPeriod({ from: owner });
			await ThalesDeployed.approve(StakingThalesDeployed.address, toUnit(1), { from: first });
			await StakingThalesDeployed.stake(toUnit(1), { from: first });
			await fastForward(WEEK + SECOND);
			await StakingThalesDeployed.closePeriod({ from: second });
			await StakingThalesDeployed.getRewardsAvailable(first);
			expect(StakingThalesDeployed.claimReward({ from: first })).to.be.revertedWith(
				'SafeERC20: low-level call failed'
			);
		});

		it('Close staking period with enough funds (100,000) in StakingThales and claim single user ', async () => {
			let deposit = toUnit(100000);
			await ThalesDeployed.transfer(first, toUnit(2), { from: owner });
			await StakingThalesDeployed.setStakingRewardsParameters(
				deposit,
				100000,
				false,
				'15',
				'12',
				'3',
				'1',
				'10',
				{ from: owner }
			);
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await sUSDSynth.issue(initialCreator, deposit);
			await sUSDSynth.transfer(StakingThalesDeployed.address, deposit, { from: initialCreator });
			await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
				'Staking period has not started'
			);
			await ThalesDeployed.transfer(ThalesStakingRewardsPoolDeployed.address, deposit, {
				from: owner,
			});
			await StakingThalesDeployed.startStakingPeriod({ from: owner });
			await ThalesDeployed.approve(StakingThalesDeployed.address, toUnit(1), { from: first });
			await StakingThalesDeployed.stake(toUnit(1), { from: first });
			await fastForward(WEEK + SECOND);
			await StakingThalesDeployed.closePeriod({ from: second });
			let answer = await StakingThalesDeployed.getRewardsAvailable(first);
			await StakingThalesDeployed.claimReward({ from: first });
			await fastForward(WEEK + SECOND);
			await StakingThalesDeployed.closePeriod({ from: second });
			let answer2 = await EscrowThalesDeployed.getStakedEscrowedBalanceForRewards(first);
			assert.bnEqual(answer, answer2);
		});

		it('Close staking period after period with funds (100001) in StakingThales ', async () => {
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
				'Staking period has not started'
			);
			let answer = await StakingThalesDeployed.startStakingPeriod({ from: owner });
			await ThalesDeployed.transfer(ThalesStakingRewardsPoolDeployed.address, 100001, {
				from: owner,
			});
			await ThalesFeeDeployed.transfer(StakingThalesDeployed.address, 10000, {
				from: owner,
			});

			await sUSDSynth.issue(initialCreator, sUSDQty);
			await sUSDSynth.transfer(StakingThalesDeployed.address, sUSDQty, { from: initialCreator });

			await fastForward(WEEK + SECOND);
			await StakingThalesDeployed.closePeriod({ from: second });
			answer = await StakingThalesDeployed.getContractRewardFunds.call({ from: owner });
			assert.equal(web3.utils.toDecimal(answer), 100001);
		});

		it('Stake with first account with NO THALES funds and fees ', async () => {
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
				'Staking period has not started'
			);
			await StakingThalesDeployed.startStakingPeriod({ from: owner });

			await ThalesDeployed.transfer(ThalesStakingRewardsPoolDeployed.address, 70001, {
				from: owner,
			});
		});

		it('Stake with first account', async () => {
			let stake = toUnit(1500);
			let fixedReward = toUnit(100000);
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
				'Staking period has not started'
			);

			await ThalesDeployed.transfer(first, stake, { from: owner });
			let answer = await ThalesDeployed.balanceOf.call(first);
			assert.bnEqual(answer, stake);
			answer = await StakingThalesDeployed.startStakingPeriod({ from: owner });
			await ThalesDeployed.transfer(ThalesStakingRewardsPoolDeployed.address, fixedReward, {
				from: owner,
			});

			await ThalesDeployed.approve(StakingThalesDeployed.address, stake, { from: first });
			await StakingThalesDeployed.stake(stake, { from: first });
			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.bnEqual(answer, stake);
		});

		it('Stake with first account and claim reward (but no fees available)', async () => {
			let deposit = toUnit(100000);
			let stake = toUnit(1500);
			await ThalesDeployed.transfer(first, stake, { from: owner });
			await StakingThalesDeployed.setStakingRewardsParameters(
				deposit,
				100000,
				false,
				'15',
				'12',
				'3',
				'1',
				'10',
				{ from: owner }
			);
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			let answer = await StakingThalesDeployed.getContractFeeFunds();
			assert.bnEqual(answer, 0);
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

		it('Stake with first account and claim reward', async () => {
			let deposit = toUnit(100000);
			let stake = toUnit(1500);
			await ThalesDeployed.transfer(first, stake, { from: owner });
			await StakingThalesDeployed.setStakingRewardsParameters(
				deposit,
				100000,
				false,
				'15',
				'12',
				'3',
				'1',
				'10',
				{ from: owner }
			);
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await sUSDSynth.issue(initialCreator, deposit);
			await sUSDSynth.transfer(StakingThalesDeployed.address, deposit, { from: initialCreator });
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

		it('Stake with first account, claim reward, then unstake WITHOUT periodClose', async () => {
			let deposit = toUnit(100000);
			let lowerDeposit = toUnit(500);
			let stake = toUnit(1500);
			await ThalesDeployed.transfer(first, stake, { from: owner });
			await StakingThalesDeployed.setStakingRewardsParameters(
				deposit,
				100000,
				false,
				'15',
				'12',
				'3',
				'1',
				'10',
				{ from: owner }
			);
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await sUSDSynth.issue(initialCreator, deposit);
			await sUSDSynth.transfer(StakingThalesDeployed.address, deposit, { from: initialCreator });
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

			await fastForward(WEEK + 5 * SECOND);
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
		it('Stake, claim reward twice, then (claim at) unstake ', async () => {
			let deposit = toUnit(100000);
			let lowerDeposit = toUnit(500);
			let stake = toUnit(1500);
			await ThalesDeployed.transfer(first, stake, { from: owner });
			await StakingThalesDeployed.setStakingRewardsParameters(
				deposit,
				100000,
				false,
				'15',
				'12',
				'3',
				'1',
				'10',
				{ from: owner }
			);
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await sUSDSynth.issue(initialCreator, deposit);
			await sUSDSynth.transfer(StakingThalesDeployed.address, deposit, { from: initialCreator });
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
			// CLAIM 1
			await StakingThalesDeployed.claimReward({ from: first });
			await fastForward(WEEK + SECOND);
			await StakingThalesDeployed.closePeriod({ from: second });
			let answer2 = await EscrowThalesDeployed.getStakedEscrowedBalanceForRewards(first);
			assert.bnEqual(answer, answer2);

			await fastForward(WEEK + 5 * SECOND);
			await StakingThalesDeployed.closePeriod({ from: second });
			answer = await StakingThalesDeployed.getRewardsAvailable(first);
			// CLAIM 2
			await ThalesDeployed.transfer(ThalesStakingRewardsPoolDeployed.address, deposit, {
				from: owner,
			});
			await StakingThalesDeployed.claimReward({ from: first });
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

		it('Stake with first account, set canClaimOnBehalf, claim on behalf of first account with second account', async () => {
			let deposit = toUnit(100000);
			let stake = toUnit(1500);

			await StakingThalesDeployed.setStakingRewardsParameters(
				deposit,
				100000,
				false,
				'15',
				'12',
				'3',
				'1',
				'10',
				{ from: owner }
			);
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await sUSDSynth.issue(initialCreator, deposit.mul(toBN(2)));
			await sUSDSynth.transfer(StakingThalesDeployed.address, deposit.mul(toBN(2)), {
				from: initialCreator,
			});
			await ThalesDeployed.transfer(
				ThalesStakingRewardsPoolDeployed.address,
				deposit.mul(toBN(2)),
				{
					from: owner,
				}
			);
			await StakingThalesDeployed.startStakingPeriod({ from: owner });
			await ThalesDeployed.transfer(first, stake, { from: owner });
			await ThalesDeployed.approve(StakingThalesDeployed.address, stake, { from: first });
			await StakingThalesDeployed.stake(stake, { from: first });
			await fastForward(WEEK + SECOND);
			await StakingThalesDeployed.closePeriod({ from: second });
			let answer = await StakingThalesDeployed.getRewardsAvailable(first);

			await expect(
				StakingThalesDeployed.claimRewardOnBehalf(first, { from: second })
			).to.be.revertedWith('Cannot claim on behalf');
			await expect(
				StakingThalesDeployed.claimRewardOnBehalf(first, { from: first })
			).to.be.revertedWith('Invalid address');
			await expect(
				StakingThalesDeployed.setCanClaimOnBehalf(first, true, { from: first })
			).to.be.revertedWith('Invalid address');

			await StakingThalesDeployed.setCanClaimOnBehalf(second, true, { from: first });
			let canClaimOnBehalf = await StakingThalesDeployed.canClaimOnBehalf(first, second);
			assert.bnEqual(canClaimOnBehalf, true);

			await StakingThalesDeployed.claimRewardOnBehalf(first, { from: second });
			await fastForward(WEEK + SECOND);
			await StakingThalesDeployed.closePeriod({ from: second });
			let answer2 = await EscrowThalesDeployed.getStakedEscrowedBalanceForRewards(first);
			assert.bnEqual(answer, answer2);

			await StakingThalesDeployed.setCanClaimOnBehalf(second, false, { from: first });
			canClaimOnBehalf = await StakingThalesDeployed.canClaimOnBehalf(first, second);
			assert.bnEqual(canClaimOnBehalf, false);
			await expect(
				StakingThalesDeployed.claimRewardOnBehalf(first, { from: second })
			).to.be.revertedWith('Cannot claim on behalf');
		});
	});

	describe('Vesting:', () => {
		it('Claimable ', async () => {
			let deposit = toUnit(100000);
			let stake = toUnit(1500);
			let weeks = 10;
			await ThalesDeployed.transfer(first, stake, { from: owner });
			await StakingThalesDeployed.setStakingRewardsParameters(
				deposit,
				100000,
				false,
				'15',
				'12',
				'3',
				'1',
				'10',
				{ from: owner }
			);
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await sUSDSynth.issue(initialCreator, deposit.mul(toBN(weeks + 1)));
			await sUSDSynth.transfer(StakingThalesDeployed.address, deposit.mul(toBN(weeks + 1)), {
				from: initialCreator,
			});
			let answer = await StakingThalesDeployed.getContractFeeFunds();
			assert.bnEqual(answer, deposit.mul(toBN(weeks + 1)));
			await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
				'Staking period has not started'
			);
			await ThalesDeployed.transfer(
				ThalesStakingRewardsPoolDeployed.address,
				deposit.mul(toBN(weeks + 1)),
				{
					from: owner,
				}
			);
			await StakingThalesDeployed.startStakingPeriod({ from: owner });
			await ThalesDeployed.approve(StakingThalesDeployed.address, stake, { from: first });
			await StakingThalesDeployed.stake(stake, { from: first });
			let period = 0;
			while (period < weeks) {
				await fastForward(WEEK + SECOND);
				await StakingThalesDeployed.closePeriod({ from: second });
				await StakingThalesDeployed.claimReward({ from: first });
				period++;
			}

			await fastForward(WEEK - DAY);
			await expect(StakingThalesDeployed.closePeriod({ from: second })).to.be.revertedWith(
				'A full period has not passed since the last closed period'
			);
			await fastForward(DAY + SECOND);
			await StakingThalesDeployed.closePeriod({ from: second });
			answer = await EscrowThalesDeployed.claimable(first);
			assert.bnEqual(answer, deposit);
			// 11th week
			await fastForward(WEEK + SECOND);
			await StakingThalesDeployed.closePeriod({ from: second });
			answer = await EscrowThalesDeployed.claimable(first);
			assert.bnEqual(answer, deposit.mul(toBN(2)));
		});

		it('Vest first user ', async () => {
			let deposit = toUnit(100000);
			let stake = toUnit(1500);
			let weeks = 11;
			await ThalesDeployed.transfer(first, stake, { from: owner });
			await StakingThalesDeployed.setStakingRewardsParameters(
				deposit,
				100000,
				false,
				'15',
				'12',
				'3',
				'1',
				'10',
				{ from: owner }
			);
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
			while (period < weeks) {
				await fastForward(WEEK + SECOND);
				await StakingThalesDeployed.closePeriod({ from: second });
				await StakingThalesDeployed.claimReward({ from: first });
				period++;
			}
			await fastForward(WEEK + SECOND);
			await StakingThalesDeployed.closePeriod({ from: second });
			let answer = await EscrowThalesDeployed.claimable(first);
			assert.bnEqual(answer, deposit.mul(toBN(2)));
			await EscrowThalesDeployed.vest(deposit, { from: first });
			answer = await ThalesDeployed.balanceOf(first);
			assert.bnEqual(answer, deposit);
		});

		it('Staking & vesting with 2 users ', async () => {
			let deposit = toUnit(100000);
			let stake = [toUnit(1500), toUnit(1500)];
			let users = [first, second];
			let weeks = 11;

			await StakingThalesDeployed.setStakingRewardsParameters(
				deposit,
				100000,
				false,
				'15',
				'12',
				'3',
				'1',
				'10',
				{ from: owner }
			);
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
			while (period < weeks) {
				await fastForward(WEEK + SECOND);
				await StakingThalesDeployed.closePeriod({ from: second });
				for (let i = 0; i < users.length; i++) {
					await StakingThalesDeployed.claimReward({ from: users[i] });
				}
				period++;
			}
			await fastForward(WEEK + SECOND);
			await StakingThalesDeployed.closePeriod({ from: second });
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

			await StakingThalesDeployed.setStakingRewardsParameters(
				deposit,
				100000,
				false,
				'15',
				'12',
				'3',
				'1',
				'10',
				{ from: owner }
			);
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
			while (period < weeks) {
				await fastForward(WEEK + SECOND);
				await StakingThalesDeployed.closePeriod({ from: second });
				for (let i = 0; i < users.length; i++) {
					await StakingThalesDeployed.claimReward({ from: users[i] });
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
			await StakingThalesDeployed.setStakingRewardsParameters(
				deposit,
				100000,
				false,
				'15',
				'12',
				'3',
				'1',
				'10',
				{ from: owner }
			);
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

		it('Vesting at 20th week, after claiming first user in weeks: 5, 9, 13 ', async () => {
			let periods = [5, 9, 13];
			let deposit = toUnit(100000);
			let stake = toUnit(1500);
			let weeks = 21;
			await ThalesDeployed.transfer(first, stake, { from: owner });
			await StakingThalesDeployed.setStakingRewardsParameters(
				deposit,
				100000,
				false,
				'15',
				'12',
				'3',
				'1',
				'10',
				{ from: owner }
			);
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
			await EscrowThalesDeployed.vest(deposit.mul(toBN(2)), { from: first });
			answer = await ThalesDeployed.balanceOf(first);
			assert.bnEqual(answer, deposit.mul(toBN(2)));
		});

		it('Continous vesting trial for 35 weeks; first user claims rewards in 2, 21, 31 weeks ', async () => {
			let periods = [1, 20, 30];
			let deposit = toUnit(100000);
			let stake = toUnit(1500);
			let weeks = 35;
			await ThalesDeployed.transfer(first, stake, { from: owner });
			await StakingThalesDeployed.setStakingRewardsParameters(
				deposit,
				100000,
				false,
				'15',
				'12',
				'3',
				'1',
				'10',
				{ from: owner }
			);
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
			let vested = toBN(0);
			while (period < weeks) {
				await fastForward(WEEK + SECOND);
				await StakingThalesDeployed.closePeriod({ from: second });
				if (periods.includes(period)) {
					await StakingThalesDeployed.claimReward({ from: first });
				}
				answer = await EscrowThalesDeployed.claimable(first);
				if (fromUnit(answer) > 0) {
					vested = vested.add(answer);
					await EscrowThalesDeployed.vest(answer, { from: first });
					let answer2 = await ThalesDeployed.balanceOf(first);
					assert.bnEqual(vested, answer2);
				} else {
					try {
						await expect(EscrowThalesDeployed.vest(deposit, { from: first })).to.be.revertedWith(
							'Vesting rewards still not available'
						);
					} catch {
						await expect(EscrowThalesDeployed.vest(deposit, { from: first })).to.be.revertedWith(
							'Amount exceeds the claimable rewards'
						);
					}
				}
				period++;
			}
		});

		it('Staking 2 users 1500 stake, vest all on week 11, unstake with one user 1499, vest again ', async () => {
			let deposit = toUnit(100000);
			let stake = [toUnit(1500), toUnit(1500)];
			let users = [first, second];
			let weeks = 22;
			let unstakeAmount = toUnit(1499);

			await StakingThalesDeployed.setStakingRewardsParameters(
				deposit,
				100000,
				false,
				'15',
				'12',
				'3',
				'1',
				'10',
				{ from: owner }
			);
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
			while (period < weeks / 2) {
				await fastForward(WEEK + SECOND);
				await StakingThalesDeployed.closePeriod({ from: second });
				for (let i = 0; i < users.length; i++) {
					await StakingThalesDeployed.claimReward({ from: users[i] });
				}
				period++;
				let answer = await EscrowThalesDeployed.claimable(users[0]);
				let answer2 = await EscrowThalesDeployed.claimable(users[1]);
				// console.log("in",period, answer.toString(), answer2.toString());
			}

			let answer = await EscrowThalesDeployed.claimable(users[0]);
			let answer2 = await EscrowThalesDeployed.claimable(users[1]);
			// console.log(period, answer.toString(), answer2.toString(), "before vest");

			let vested = toBN(0);
			for (let i = 0; i < users.length; i++) {
				let answer = await EscrowThalesDeployed.claimable(users[i]);
				assert.bnEqual(answer, deposit.div(toBN(users.length)));
				await EscrowThalesDeployed.vest(deposit.div(toBN(users.length)), { from: users[i] });
				answer = await ThalesDeployed.balanceOf(users[i]);
				assert.bnEqual(answer, deposit.div(toBN(users.length)));
			}

			vested = deposit.div(toBN(users.length));
			await StakingThalesDeployed.startUnstake(stake[0].sub(unstakeAmount), { from: users[0] });
			await StakingThalesDeployed.claimReward({ from: users[1] });
			await fastForward(WEEK + SECOND);
			await StakingThalesDeployed.closePeriod({ from: second });
			period++;
			answer = await EscrowThalesDeployed.claimable(users[0]);
			answer2 = await EscrowThalesDeployed.claimable(users[1]);
			// console.log(period, answer.toString(), answer2.toString(), "vested:", vested.toString());

			await StakingThalesDeployed.unstake({ from: users[0] });
			await StakingThalesDeployed.claimReward({ from: users[0] });
			await StakingThalesDeployed.claimReward({ from: users[1] });
			answer = await ThalesDeployed.balanceOf(users[0]);
			let balanceUser = answer;
			assert.bnEqual(answer, vested.add(stake[0].sub(unstakeAmount)));
			await fastForward(WEEK + SECOND);
			await StakingThalesDeployed.closePeriod({ from: second });
			let rewardsAvailable11week = await StakingThalesDeployed.getRewardsAvailable(users[0]);
			let rewardsAvailable2 = await StakingThalesDeployed.getRewardsAvailable(users[1]);
			// console.log("rewardsAvailable", period, rewardsAvailable11week.toString(), rewardsAvailable2.toString());
			await StakingThalesDeployed.claimReward({ from: users[0] });
			await StakingThalesDeployed.claimReward({ from: users[1] });
			period++;
			answer = await EscrowThalesDeployed.claimable(users[0]);
			answer2 = await EscrowThalesDeployed.claimable(users[1]);
			// console.log(period, answer.toString(), answer2.toString(), "after unstake");

			while (period < weeks) {
				await fastForward(WEEK + SECOND);
				await StakingThalesDeployed.closePeriod({ from: second });
				for (let i = 0; i < users.length; i++) {
					await StakingThalesDeployed.claimReward({ from: users[i] });
				}
				period++;
				answer = await EscrowThalesDeployed.claimable(users[0]);
				answer2 = await EscrowThalesDeployed.claimable(users[1]);
				// console.log("in",period, answer.toString(), answer2.toString());
			}

			answer = await EscrowThalesDeployed.claimable(users[0]);
			answer2 = await EscrowThalesDeployed.claimable(users[1]);
			// console.log(
			// 	'period:',
			// 	period,
			// 	'| claimable U1:',
			// 	answer.toString(),
			// 	'| claimable U2:',
			// 	answer2.toString()
			// );
			// for (let i = 0; i < users.length; i++) {
			answer = await EscrowThalesDeployed.claimable(users[0]);
			assert.bnEqual(
				answer,
				toBN(10)
					.mul(deposit.div(toBN(users.length)))
					.add(rewardsAvailable11week)
			);
			let vestAmount = toBN(10)
				.mul(deposit.div(toBN(users.length)))
				.add(rewardsAvailable11week);
			await EscrowThalesDeployed.vest(vestAmount, { from: users[0] });
			answer = await ThalesDeployed.balanceOf(users[0]);
			assert.bnEqual(answer, balanceUser.add(vestAmount));
			// }
		});
	});

	describe('Account merging:', () => {
		it('Account merging with first account staker', async () => {
			let deposit = toUnit(100000);
			let stake = toUnit(1500);
			let weeks = 11;

			await StakingThalesDeployed.setStakingRewardsParameters(
				deposit,
				100000,
				false,
				'15',
				'12',
				'3',
				'1',
				'10',
				{ from: owner }
			);
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
			await ThalesDeployed.transfer(first, stake, { from: owner });
			await ThalesDeployed.approve(StakingThalesDeployed.address, stake, { from: first });
			await StakingThalesDeployed.stake(stake, { from: first });
			let period = 0;
			while (period < weeks - 1) {
				await fastForward(WEEK + SECOND);
				await StakingThalesDeployed.closePeriod({ from: second });
				await StakingThalesDeployed.claimReward({ from: first });
				period++;
			}
			await fastForward(WEEK + SECOND);
			await StakingThalesDeployed.closePeriod({ from: second });

			await StakingThalesDeployed.setStakingParameters(true, true, WEEK, WEEK, false, {
				from: owner,
			});
			await expect(StakingThalesDeployed.mergeAccount(second, { from: first })).to.be.revertedWith(
				'Merge account is disabled'
			);
			await StakingThalesDeployed.setStakingParameters(true, true, WEEK, WEEK, true, {
				from: owner,
			});

			await expect(StakingThalesDeployed.mergeAccount(second, { from: first })).to.be.revertedWith(
				'Cannot merge, claim rewards on both accounts before merging'
			);
			await StakingThalesDeployed.claimReward({ from: first });

			await StakingThalesDeployed.startUnstake(await StakingThalesDeployed.stakedBalanceOf(first), {
				from: first,
			});
			await expect(StakingThalesDeployed.mergeAccount(second, { from: first })).to.be.revertedWith(
				'Cannot merge, cancel unstaking on both accounts before merging'
			);
			await StakingThalesDeployed.cancelUnstake({
				from: first,
			});

			await StakingThalesDeployed.mergeAccount(second, { from: first });

			let stakedBalance = await StakingThalesDeployed.stakedBalanceOf(second);
			assert.bnEqual(stakedBalance, stake);
			stakedBalance = await StakingThalesDeployed.stakedBalanceOf(first);
			assert.bnEqual(stakedBalance, toUnit(0));

			let totalAccountEscrowedAmount = await EscrowThalesDeployed.totalAccountEscrowedAmount(
				second
			);
			assert.bnEqual(totalAccountEscrowedAmount, deposit.mul(toBN(weeks)));
			totalAccountEscrowedAmount = await EscrowThalesDeployed.totalAccountEscrowedAmount(first);
			assert.bnEqual(totalAccountEscrowedAmount, toUnit(0));

			let claimable = await EscrowThalesDeployed.claimable(second);
			assert.bnEqual(claimable, deposit);
			claimable = await EscrowThalesDeployed.claimable(first);
			assert.bnEqual(claimable, toUnit(0));

			let vestingEntryAmount = await EscrowThalesDeployed.getStakerAmounts(second, 0);
			assert.bnEqual(vestingEntryAmount, deposit);
			vestingEntryAmount = await EscrowThalesDeployed.getStakerAmounts(first, 0);
			assert.bnEqual(vestingEntryAmount, toUnit(0));

			vestingEntryAmount = await EscrowThalesDeployed.getStakerAmounts(second, 5);
			assert.bnEqual(vestingEntryAmount, deposit);
			vestingEntryAmount = await EscrowThalesDeployed.getStakerAmounts(first, 5);
			assert.bnEqual(vestingEntryAmount, toUnit(0));

			let vestingEntryPeriod = await EscrowThalesDeployed.getStakerPeriod(second, 0);
			assert.bnEqual(vestingEntryPeriod, 20);
			vestingEntryPeriod = await EscrowThalesDeployed.getStakerPeriod(first, 0);
			assert.bnEqual(vestingEntryPeriod, toUnit(0));

			vestingEntryPeriod = await EscrowThalesDeployed.getStakerPeriod(second, 5);
			assert.bnEqual(vestingEntryPeriod, 15);
			vestingEntryPeriod = await EscrowThalesDeployed.getStakerPeriod(first, 5);
			assert.bnEqual(vestingEntryPeriod, toUnit(0));
		});

		it('Account merging with both accounts stakers', async () => {
			let deposit = toUnit(100000);
			let stake = [toUnit(1500), toUnit(500)];
			let users = [first, second];
			let weeks = 11;

			await StakingThalesDeployed.setStakingRewardsParameters(
				deposit,
				100000,
				false,
				'15',
				'12',
				'3',
				'1',
				'10',
				{ from: owner }
			);
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
			while (period < weeks) {
				await fastForward(WEEK + SECOND);
				await StakingThalesDeployed.closePeriod({ from: second });
				for (let i = 0; i < users.length; i++) {
					await StakingThalesDeployed.claimReward({ from: users[i] });
				}
				period++;
			}

			await StakingThalesDeployed.mergeAccount(second, { from: first });

			let stakedBalance = await StakingThalesDeployed.stakedBalanceOf(second);
			assert.bnEqual(stakedBalance, stake[0].add(stake[1]));
			stakedBalance = await StakingThalesDeployed.stakedBalanceOf(first);
			assert.bnEqual(stakedBalance, toUnit(0));

			let totalAccountEscrowedAmount = await EscrowThalesDeployed.totalAccountEscrowedAmount(
				second
			);
			assert.bnEqual(totalAccountEscrowedAmount, deposit.mul(toBN(weeks)));
			totalAccountEscrowedAmount = await EscrowThalesDeployed.totalAccountEscrowedAmount(first);
			assert.bnEqual(totalAccountEscrowedAmount, toUnit(0));

			let claimable = await EscrowThalesDeployed.claimable(second);
			assert.bnEqual(claimable, deposit);
			claimable = await EscrowThalesDeployed.claimable(first);
			assert.bnEqual(claimable, toUnit(0));

			let vestingEntryAmount = await EscrowThalesDeployed.getStakerAmounts(second, 0);
			assert.bnEqual(vestingEntryAmount, deposit);
			vestingEntryAmount = await EscrowThalesDeployed.getStakerAmounts(first, 0);
			assert.bnEqual(vestingEntryAmount, toUnit(0));

			vestingEntryAmount = await EscrowThalesDeployed.getStakerAmounts(second, 5);
			assert.bnEqual(vestingEntryAmount, deposit);
			vestingEntryAmount = await EscrowThalesDeployed.getStakerAmounts(first, 5);
			assert.bnEqual(vestingEntryAmount, toUnit(0));

			let vestingEntryPeriod = await EscrowThalesDeployed.getStakerPeriod(second, 0);
			assert.bnEqual(vestingEntryPeriod, 20);
			vestingEntryPeriod = await EscrowThalesDeployed.getStakerPeriod(first, 0);
			assert.bnEqual(vestingEntryPeriod, toUnit(0));

			vestingEntryPeriod = await EscrowThalesDeployed.getStakerPeriod(second, 5);
			assert.bnEqual(vestingEntryPeriod, 15);
			vestingEntryPeriod = await EscrowThalesDeployed.getStakerPeriod(first, 5);
			assert.bnEqual(vestingEntryPeriod, toUnit(0));
		});

		it('Account merging with first account staker, second account only escrow', async () => {
			let deposit = toUnit(100000);
			let stake = [toUnit(1500), toUnit(500)];
			let users = [first, second];
			let weeks = 11;

			await StakingThalesDeployed.setStakingRewardsParameters(
				deposit,
				100000,
				false,
				'15',
				'12',
				'3',
				'1',
				'10',
				{ from: owner }
			);
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
			while (period < weeks) {
				await fastForward(WEEK + SECOND);
				await StakingThalesDeployed.closePeriod({ from: second });
				for (let i = 0; i < users.length; i++) {
					await StakingThalesDeployed.claimReward({ from: users[i] });
				}
				period++;
			}

			await StakingThalesDeployed.startUnstake(
				await StakingThalesDeployed.stakedBalanceOf(second),
				{ from: second }
			);

			let totalEscrowBalanceNotIncludedInStaking =
				await EscrowThalesDeployed.totalEscrowBalanceNotIncludedInStaking();
			assert.bnEqual(totalEscrowBalanceNotIncludedInStaking, deposit.mul(toBN(weeks)).div(toBN(4)));

			await fastForward(WEEK + 5 * SECOND);

			StakingThalesDeployed.unstake({ from: second });

			await StakingThalesDeployed.mergeAccount(second, { from: first });

			let stakedBalance = await StakingThalesDeployed.stakedBalanceOf(second);
			assert.bnEqual(stakedBalance, stake[0]);
			stakedBalance = await StakingThalesDeployed.stakedBalanceOf(first);
			assert.bnEqual(stakedBalance, toUnit(0));

			let totalAccountEscrowedAmount = await EscrowThalesDeployed.totalAccountEscrowedAmount(
				second
			);
			assert.bnEqual(totalAccountEscrowedAmount, deposit.mul(toBN(weeks)));
			totalAccountEscrowedAmount = await EscrowThalesDeployed.totalAccountEscrowedAmount(first);
			assert.bnEqual(totalAccountEscrowedAmount, toUnit(0));

			let claimable = await EscrowThalesDeployed.claimable(second);
			assert.bnEqual(claimable, deposit);
			claimable = await EscrowThalesDeployed.claimable(first);
			assert.bnEqual(claimable, toUnit(0));

			totalEscrowBalanceNotIncludedInStaking =
				await EscrowThalesDeployed.totalEscrowBalanceNotIncludedInStaking();
			assert.bnEqual(totalEscrowBalanceNotIncludedInStaking, toUnit(0));

			let vestingEntryAmount = await EscrowThalesDeployed.getStakerAmounts(second, 0);
			assert.bnEqual(vestingEntryAmount, deposit);
			vestingEntryAmount = await EscrowThalesDeployed.getStakerAmounts(first, 0);
			assert.bnEqual(vestingEntryAmount, toUnit(0));

			vestingEntryAmount = await EscrowThalesDeployed.getStakerAmounts(second, 5);
			assert.bnEqual(vestingEntryAmount, deposit);
			vestingEntryAmount = await EscrowThalesDeployed.getStakerAmounts(first, 5);
			assert.bnEqual(vestingEntryAmount, toUnit(0));

			let vestingEntryPeriod = await EscrowThalesDeployed.getStakerPeriod(second, 0);
			assert.bnEqual(vestingEntryPeriod, 20);
			vestingEntryPeriod = await EscrowThalesDeployed.getStakerPeriod(first, 0);
			assert.bnEqual(vestingEntryPeriod, toUnit(0));

			vestingEntryPeriod = await EscrowThalesDeployed.getStakerPeriod(second, 5);
			assert.bnEqual(vestingEntryPeriod, 15);
			vestingEntryPeriod = await EscrowThalesDeployed.getStakerPeriod(first, 5);
			assert.bnEqual(vestingEntryPeriod, toUnit(0));
		});

		it('Account merging with first account only escrow, second account staker', async () => {
			let deposit = toUnit(100000);
			let stake = [toUnit(1500), toUnit(500)];
			let users = [first, second];
			let weeks = 11;

			await StakingThalesDeployed.setStakingRewardsParameters(
				deposit,
				100000,
				false,
				'15',
				'12',
				'3',
				'1',
				'10',
				{ from: owner }
			);
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
			while (period < weeks) {
				await fastForward(WEEK + SECOND);
				await StakingThalesDeployed.closePeriod({ from: second });
				for (let i = 0; i < users.length; i++) {
					await StakingThalesDeployed.claimReward({ from: users[i] });
				}
				period++;
			}

			await StakingThalesDeployed.startUnstake(await StakingThalesDeployed.stakedBalanceOf(first), {
				from: first,
			});

			let totalEscrowBalanceNotIncludedInStaking =
				await EscrowThalesDeployed.totalEscrowBalanceNotIncludedInStaking();
			assert.bnEqual(
				totalEscrowBalanceNotIncludedInStaking,
				deposit.mul(toBN(weeks)).div(toBN(4)).mul(toBN(3))
			);

			await fastForward(WEEK + 5 * SECOND);

			StakingThalesDeployed.unstake({ from: first });

			await StakingThalesDeployed.mergeAccount(second, { from: first });

			let stakedBalance = await StakingThalesDeployed.stakedBalanceOf(second);
			assert.bnEqual(stakedBalance, stake[1]);
			stakedBalance = await StakingThalesDeployed.stakedBalanceOf(first);
			assert.bnEqual(stakedBalance, toUnit(0));

			let totalAccountEscrowedAmount = await EscrowThalesDeployed.totalAccountEscrowedAmount(
				second
			);
			assert.bnEqual(totalAccountEscrowedAmount, deposit.mul(toBN(weeks)));
			totalAccountEscrowedAmount = await EscrowThalesDeployed.totalAccountEscrowedAmount(first);
			assert.bnEqual(totalAccountEscrowedAmount, toUnit(0));

			let claimable = await EscrowThalesDeployed.claimable(second);
			assert.bnEqual(claimable, deposit);
			claimable = await EscrowThalesDeployed.claimable(first);
			assert.bnEqual(claimable, toUnit(0));

			totalEscrowBalanceNotIncludedInStaking =
				await EscrowThalesDeployed.totalEscrowBalanceNotIncludedInStaking();
			assert.bnEqual(totalEscrowBalanceNotIncludedInStaking, toUnit(0));

			let vestingEntryAmount = await EscrowThalesDeployed.getStakerAmounts(second, 0);
			assert.bnEqual(vestingEntryAmount, deposit);
			vestingEntryAmount = await EscrowThalesDeployed.getStakerAmounts(first, 0);
			assert.bnEqual(vestingEntryAmount, toUnit(0));

			vestingEntryAmount = await EscrowThalesDeployed.getStakerAmounts(second, 5);
			assert.bnEqual(vestingEntryAmount, deposit);
			vestingEntryAmount = await EscrowThalesDeployed.getStakerAmounts(first, 5);
			assert.bnEqual(vestingEntryAmount, toUnit(0));

			let vestingEntryPeriod = await EscrowThalesDeployed.getStakerPeriod(second, 0);
			assert.bnEqual(vestingEntryPeriod, 20);
			vestingEntryPeriod = await EscrowThalesDeployed.getStakerPeriod(first, 0);
			assert.bnEqual(vestingEntryPeriod, toUnit(0));

			vestingEntryPeriod = await EscrowThalesDeployed.getStakerPeriod(second, 5);
			assert.bnEqual(vestingEntryPeriod, 15);
			vestingEntryPeriod = await EscrowThalesDeployed.getStakerPeriod(first, 5);
			assert.bnEqual(vestingEntryPeriod, toUnit(0));
		});

		it('Account merging with both accounts only escrow', async () => {
			let deposit = toUnit(100000);
			let stake = [toUnit(1500), toUnit(500)];
			let users = [first, second];
			let weeks = 11;

			await StakingThalesDeployed.setStakingRewardsParameters(
				deposit,
				100000,
				false,
				'15',
				'12',
				'3',
				'1',
				'10',
				{ from: owner }
			);
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
			while (period < weeks) {
				await fastForward(WEEK + SECOND);
				await StakingThalesDeployed.closePeriod({ from: second });
				for (let i = 0; i < users.length; i++) {
					await StakingThalesDeployed.claimReward({ from: users[i] });
				}
				period++;
			}

			for (let i = 0; i < users.length; i++) {
				await StakingThalesDeployed.startUnstake(
					await StakingThalesDeployed.stakedBalanceOf(users[i]),
					{
						from: users[i],
					}
				);
			}

			let totalEscrowBalanceNotIncludedInStaking =
				await EscrowThalesDeployed.totalEscrowBalanceNotIncludedInStaking();
			assert.bnEqual(totalEscrowBalanceNotIncludedInStaking, deposit.mul(toBN(weeks)));

			await fastForward(WEEK + 5 * SECOND);

			for (let i = 0; i < users.length; i++) {
				await StakingThalesDeployed.unstake({ from: users[i] });
			}

			await StakingThalesDeployed.mergeAccount(second, { from: first });

			let stakedBalance = await StakingThalesDeployed.stakedBalanceOf(second);
			assert.bnEqual(stakedBalance, toUnit(0));
			stakedBalance = await StakingThalesDeployed.stakedBalanceOf(first);
			assert.bnEqual(stakedBalance, toUnit(0));

			let totalAccountEscrowedAmount = await EscrowThalesDeployed.totalAccountEscrowedAmount(
				second
			);
			assert.bnEqual(totalAccountEscrowedAmount, deposit.mul(toBN(weeks)));
			totalAccountEscrowedAmount = await EscrowThalesDeployed.totalAccountEscrowedAmount(first);
			assert.bnEqual(totalAccountEscrowedAmount, toUnit(0));

			let claimable = await EscrowThalesDeployed.claimable(second);
			assert.bnEqual(claimable, deposit);
			claimable = await EscrowThalesDeployed.claimable(first);
			assert.bnEqual(claimable, toUnit(0));

			totalEscrowBalanceNotIncludedInStaking =
				await EscrowThalesDeployed.totalEscrowBalanceNotIncludedInStaking();
			assert.bnEqual(totalEscrowBalanceNotIncludedInStaking, deposit.mul(toBN(weeks)));

			let vestingEntryAmount = await EscrowThalesDeployed.getStakerAmounts(second, 0);
			assert.bnEqual(vestingEntryAmount, deposit);
			vestingEntryAmount = await EscrowThalesDeployed.getStakerAmounts(first, 0);
			assert.bnEqual(vestingEntryAmount, toUnit(0));

			vestingEntryAmount = await EscrowThalesDeployed.getStakerAmounts(second, 5);
			assert.bnEqual(vestingEntryAmount, deposit);
			vestingEntryAmount = await EscrowThalesDeployed.getStakerAmounts(first, 5);
			assert.bnEqual(vestingEntryAmount, toUnit(0));

			let vestingEntryPeriod = await EscrowThalesDeployed.getStakerPeriod(second, 0);
			assert.bnEqual(vestingEntryPeriod, 20);
			vestingEntryPeriod = await EscrowThalesDeployed.getStakerPeriod(first, 0);
			assert.bnEqual(vestingEntryPeriod, toUnit(0));

			vestingEntryPeriod = await EscrowThalesDeployed.getStakerPeriod(second, 5);
			assert.bnEqual(vestingEntryPeriod, 15);
			vestingEntryPeriod = await EscrowThalesDeployed.getStakerPeriod(first, 5);
			assert.bnEqual(vestingEntryPeriod, toUnit(0));
		});

		it('Account merging with both accounts stakers, both claim rewards in random weeks', async () => {
			let claimPeriodsFirst = [5, 6, 7, 12, 14, 18, 20];
			let claimPeriodsSecond = [1, 4, 7, 8, 13, 14, 16, 20];
			let deposit = toUnit(500);
			let stake = [toUnit(750), toUnit(500)];
			let users = [first, second];
			let weeks = 21;
			let numOfPeriods = 10;

			await StakingThalesDeployed.setStakingRewardsParameters(
				deposit,
				100000,
				false,
				'15',
				'12',
				'3',
				'1',
				'10',
				{ from: owner }
			);
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
			while (period < weeks) {
				await fastForward(WEEK + SECOND);
				await StakingThalesDeployed.closePeriod({ from: second });
				if (claimPeriodsFirst.includes(period)) {
					await StakingThalesDeployed.claimReward({ from: first });
				}
				if (claimPeriodsSecond.includes(period)) {
					await StakingThalesDeployed.claimReward({ from: second });
				}
				period++;
			}

			let vestingEntriesFirst = [];
			let vestingEntriesSecond = [];
			for (let i = 0; i < numOfPeriods; i++) {
				let vestingEntryAmountFirst = await EscrowThalesDeployed.getStakerAmounts(first, i);
				let vestingEntryAmountSecond = await EscrowThalesDeployed.getStakerAmounts(second, i);
				vestingEntriesFirst.push(vestingEntryAmountFirst);
				vestingEntriesSecond.push(vestingEntryAmountSecond);
			}

			let totalAccountEscrowedAmountFirst = await EscrowThalesDeployed.totalAccountEscrowedAmount(
				first
			);
			let totalAccountEscrowedAmountSecond = await EscrowThalesDeployed.totalAccountEscrowedAmount(
				second
			);

			let claimableFirst = await EscrowThalesDeployed.claimable(first);
			let claimableSecond = await EscrowThalesDeployed.claimable(second);

			await StakingThalesDeployed.mergeAccount(second, { from: first });

			let stakedBalance = await StakingThalesDeployed.stakedBalanceOf(second);
			assert.bnEqual(stakedBalance, stake[0].add(stake[1]));
			stakedBalance = await StakingThalesDeployed.stakedBalanceOf(first);
			assert.bnEqual(stakedBalance, toUnit(0));

			let totalAccountEscrowedAmount = await EscrowThalesDeployed.totalAccountEscrowedAmount(
				second
			);
			assert.bnEqual(
				totalAccountEscrowedAmount,
				totalAccountEscrowedAmountFirst.add(totalAccountEscrowedAmountSecond)
			);
			totalAccountEscrowedAmount = await EscrowThalesDeployed.totalAccountEscrowedAmount(first);
			assert.bnEqual(totalAccountEscrowedAmount, toUnit(0));

			let claimable = await EscrowThalesDeployed.claimable(second);
			assert.bnEqual(claimable, claimableFirst.add(claimableSecond));
			claimable = await EscrowThalesDeployed.claimable(first);
			assert.bnEqual(claimable, toUnit(0));

			let vestingEntryAmount = await EscrowThalesDeployed.getStakerAmounts(second, 0);
			assert.bnEqual(vestingEntryAmount, toUnit(0));
			vestingEntryAmount = await EscrowThalesDeployed.getStakerAmounts(second, 1);
			assert.bnEqual(vestingEntryAmount, vestingEntriesFirst[1].add(vestingEntriesSecond[1]));
			vestingEntryAmount = await EscrowThalesDeployed.getStakerAmounts(second, 2);
			assert.bnEqual(vestingEntryAmount, toUnit(0));
			vestingEntryAmount = await EscrowThalesDeployed.getStakerAmounts(second, 3);
			assert.bnEqual(vestingEntryAmount, vestingEntriesFirst[3]);
			vestingEntryAmount = await EscrowThalesDeployed.getStakerAmounts(second, 4);
			assert.bnEqual(vestingEntryAmount, vestingEntriesSecond[4]);
			vestingEntryAmount = await EscrowThalesDeployed.getStakerAmounts(second, 5);
			assert.bnEqual(vestingEntryAmount, vestingEntriesFirst[5].add(vestingEntriesSecond[5]));
			vestingEntryAmount = await EscrowThalesDeployed.getStakerAmounts(second, 6);
			assert.bnEqual(vestingEntryAmount, toUnit(0));
			vestingEntryAmount = await EscrowThalesDeployed.getStakerAmounts(second, 7);
			assert.bnEqual(vestingEntryAmount, vestingEntriesSecond[7]);
			vestingEntryAmount = await EscrowThalesDeployed.getStakerAmounts(second, 8);
			assert.bnEqual(vestingEntryAmount, toUnit(0));
			vestingEntryAmount = await EscrowThalesDeployed.getStakerAmounts(second, 9);
			assert.bnEqual(vestingEntryAmount, vestingEntriesFirst[9]);

			vestingEntryAmount = await EscrowThalesDeployed.getStakerAmounts(first, 0);
			assert.bnEqual(vestingEntryAmount, toUnit(0));
			vestingEntryAmount = await EscrowThalesDeployed.getStakerAmounts(first, 5);
			assert.bnEqual(vestingEntryAmount, toUnit(0));

			let vestingEntryPeriod = await EscrowThalesDeployed.getStakerPeriod(second, 0);
			assert.bnEqual(vestingEntryPeriod, 30);
			vestingEntryPeriod = await EscrowThalesDeployed.getStakerPeriod(first, 0);
			assert.bnEqual(vestingEntryPeriod, toUnit(0));
			vestingEntryPeriod = await EscrowThalesDeployed.getStakerPeriod(second, 1);
			assert.bnEqual(vestingEntryPeriod, 31);
			vestingEntryPeriod = await EscrowThalesDeployed.getStakerPeriod(first, 1);
			assert.bnEqual(vestingEntryPeriod, toUnit(0));
			vestingEntryPeriod = await EscrowThalesDeployed.getStakerPeriod(second, 6);
			assert.bnEqual(vestingEntryPeriod, 26);
			vestingEntryPeriod = await EscrowThalesDeployed.getStakerPeriod(first, 6);
			assert.bnEqual(vestingEntryPeriod, toUnit(0));
		});
	});
});
