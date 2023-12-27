'use strict';

const { artifacts, contract, web3 } = require('hardhat');

const { assert } = require('../../utils/common');

const { toBytes32 } = require('../../../index');
const { expect } = require('chai');
const { setupAllContracts } = require('../../utils/setup');

const { fastForward, toUnit, currentTime } = require('../../utils')();
const { encodeCall, convertToDecimals } = require('../../utils/helpers');
const MockAggregator = artifacts.require('MockAggregatorV2V3');

const ZERO_ADDRESS = '0x' + '0'.repeat(40);

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
	let manager, factory, addressResolver;
	let sUSDSynth, PositionalMarketMastercopy, PositionMastercopy;

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
		let OwnedUpgradeabilityProxy = artifacts.require('OwnedUpgradeabilityProxy');
		let SNXRewards = artifacts.require('SNXRewards');
		SNXRewardsDeployed = await SNXRewards.new();
		let AddressResolver = artifacts.require('AddressResolverHelper');
		AddressResolverDeployed = await AddressResolver.new();
		await AddressResolverDeployed.setSNXRewardsAddress(SNXRewardsDeployed.address);
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
		await StakingThalesDeployed.setStakingParameters(true, true, WEEK, WEEK, true, true, {
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

	describe('ProxyUnstaking', () => {
		it('User cant unstake if the cooldown period did not pass', async () => {
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

			fastForward(DAY + 5 * SECOND);
			answer = await StakingThalesDeployed.startUnstake(
				(await StakingThalesDeployed.stakedBalanceOf(first)) / 2,
				{ from: first }
			);

			fastForward(DAY + 5 * SECOND);

			await expect(StakingThalesDeployed.unstake({ from: first })).to.be.revertedWith(
				'Cannot unstake yet, cooldown not expired'
			);

			fastForward(WEEK);
			await StakingThalesDeployed.unstake({ from: first });

			let balanceAfterFirstUnstake = await StakingThalesDeployed.stakedBalanceOf(first);
			//console.log('Balance after first unstake is ' + balanceAfterFirstUnstake);

			assert.equal(balanceAfterFirstUnstake, 500);

			answer = await StakingThalesDeployed.startUnstake(
				(await StakingThalesDeployed.stakedBalanceOf(first)) / 2,
				{ from: first }
			);

			fastForward(DAY + 5 * SECOND);

			await expect(StakingThalesDeployed.unstake({ from: first })).to.be.revertedWith(
				'Cannot unstake yet, cooldown not expired'
			);

			fastForward(WEEK);
			await StakingThalesDeployed.unstake({ from: first });
		});

		it('Proper escrow calculation', async () => {
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});

			await ThalesDeployed.transfer(first, 1500, { from: owner });
			let answer = await StakingThalesDeployed.startStakingPeriod({ from: owner });
			await ThalesDeployed.transfer(ThalesStakingRewardsPoolDeployed.address, 5500000, {
				from: owner,
			});
			await ThalesFeeDeployed.transfer(StakingThalesDeployed.address, 5555, {
				from: owner,
			});
			await ThalesDeployed.approve(StakingThalesDeployed.address, 2000, { from: first });
			await StakingThalesDeployed.stake(1000, { from: first });

			await fastForward(WEEK + 5 * SECOND);
			await StakingThalesDeployed.closePeriod({ from: first });

			let rewardsAvailable = await StakingThalesDeployed.getRewardsAvailable(first);
			//console.log('rewards available:' + rewardsAvailable);
			await StakingThalesDeployed.stake(500, { from: first });
			answer = await StakingThalesDeployed.claimReward({ from: first });

			let totalAccountEscrowedAmount = await EscrowThalesDeployed.totalAccountEscrowedAmount(first);
			//console.log('totalAccountEscrowedAmount' + totalAccountEscrowedAmount);

			let totalEscrowBalanceNotIncludedInStaking =
				await EscrowThalesDeployed.totalEscrowBalanceNotIncludedInStaking();
			// console.log(
			// 	'totalEscrowBalanceNotIncludedInStaking ' + totalEscrowBalanceNotIncludedInStaking
			// );

			let stakedBalanceOf = await StakingThalesDeployed.stakedBalanceOf(first);
			//console.log('stakedBalanceOf before' + stakedBalanceOf);

			answer = await StakingThalesDeployed.startUnstake(
				await StakingThalesDeployed.stakedBalanceOf(first),
				{ from: first }
			);

			stakedBalanceOf = await StakingThalesDeployed.stakedBalanceOf(first);
			//console.log('stakedBalanceOf after ' + stakedBalanceOf);

			totalEscrowBalanceNotIncludedInStaking =
				await EscrowThalesDeployed.totalEscrowBalanceNotIncludedInStaking();
			// console.log(
			// 	'totalEscrowBalanceNotIncludedInStaking ' + totalEscrowBalanceNotIncludedInStaking
			// );

			await fastForward(WEEK + 5 * SECOND);

			answer = await StakingThalesDeployed.unstake({ from: first });

			for (var i = 0; i < 11; i++) {
				await fastForward(WEEK);
				await StakingThalesDeployed.closePeriod({ from: first });
			}

			let answerRewards = await StakingThalesDeployed.getRewardsAvailable(first);
			let answerRewardsthird = await StakingThalesDeployed.getRewardsAvailable(third);
			//console.log('answerRewards' + answerRewards);
			//console.log('answerRewardsthird' + answerRewardsthird);

			let answer2 = await EscrowThalesDeployed.claimable.call(first);
			let claimable = web3.utils.toDecimal(answer2);
			//console.log('claimable available:' + claimable);

			totalAccountEscrowedAmount = await EscrowThalesDeployed.totalAccountEscrowedAmount(first);
			//console.log('totalAccountEscrowedAmount' + totalAccountEscrowedAmount);

			answer = await EscrowThalesDeployed.vest(claimable, { from: first });
		});
	});
});
