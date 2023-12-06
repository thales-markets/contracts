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
	let SafeBoxBuffer;

	let CCIPCollector;
	let CCIPRouter;
	let StakingThalesBonusRewardsManager;

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
		let CCIPRouterContract = artifacts.require('MockCCIPRouter');
		CCIPRouter = await CCIPRouterContract.new();
		let CCIPCollectorContract = artifacts.require('CrossChainCollector');
		CCIPCollector = await CCIPCollectorContract.new();
		let StakingThalesBonusRewardsManagerContract = artifacts.require(
			'StakingThalesBonusRewardsManager'
		);
		StakingThalesBonusRewardsManager = await StakingThalesBonusRewardsManagerContract.new();
		await StakingThalesBonusRewardsManager.initialize(owner, StakingThalesDeployed.address);
		await CCIPCollector.initialize(CCIPRouter.address, true, 5, { from: owner });
		await CCIPCollector.setStakingThales(StakingThalesDeployed.address, { from: owner });
		let SafeBoxContract = artifacts.require('SafeBoxBuffer');
		SafeBoxBuffer = await SafeBoxContract.new();
		await SafeBoxBuffer.initialize(StakingThalesDeployed.address, ThalesFeeDeployed.address, {
			from: owner,
		});

		await StakingThalesBonusRewardsManager.setStakingBaseDivider(100000, { from: owner });
		await StakingThalesBonusRewardsManager.setMaxStakingMultiplier(toUnit(4), { from: owner });
		await StakingThalesBonusRewardsManager.setMultipliers(toUnit(0.25), toUnit(0.5), toUnit(1), {
			from: owner,
		});
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
			StakingThalesBonusRewardsManager.address,
			{ from: owner }
		);
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

		it('Stake with first account and claim reward (but no fees available), then activate CCIP and close period, Staking paused', async () => {
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

			await StakingThalesDeployed.setCrossChainCollector(
				CCIPCollector.address,
				SafeBoxBuffer.address,
				{ from: owner }
			);
			await fastForward(WEEK + SECOND);
			await StakingThalesDeployed.closePeriod({ from: second });
			assert.equal(await StakingThalesDeployed.paused(), true);
			await expect(StakingThalesDeployed.claimReward({ from: first })).to.be.revertedWith(
				'This action cannot be performed while the contract is paused'
			);
		});

		it('Stake with first, claim reward, activate CCIP, close period, staking paused, update rewards, claim reward', async () => {
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
			await ThalesDeployed.transfer(ThalesStakingRewardsPoolDeployed.address, toUnit(200000), {
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
			await StakingThalesDeployed.setCrossChainCollector(
				CCIPCollector.address,
				SafeBoxBuffer.address,
				{ from: owner }
			);
			await fastForward(WEEK + SECOND);
			await StakingThalesDeployed.closePeriod({ from: second });
			assert.equal(await StakingThalesDeployed.paused(), true);
			await expect(StakingThalesDeployed.claimReward({ from: first })).to.be.revertedWith(
				'This action cannot be performed while the contract is paused'
			);
			await StakingThalesDeployed.setCrossChainCollector(second, SafeBoxBuffer.address, {
				from: owner,
			});
			let totalStaked = await StakingThalesDeployed.totalStakedLastPeriodEnd();
			let totalEscrowed = await StakingThalesDeployed.totalEscrowedLastPeriodEnd();
			await expect(
				StakingThalesDeployed.updateStakingRewards(
					deposit,
					100000,
					totalStaked.toString(),
					totalEscrowed.toString(),
					1000,
					{ from: owner }
				)
			).to.be.revertedWith('InvCCIP');
			await sUSDSynth.transfer(StakingThalesDeployed.address, 1001, { from: initialCreator });
			// await ThalesFeeDeployed.transfer(StakingThalesDeployed.address, 1001, {
			// 	from: owner,
			// });
			await StakingThalesDeployed.updateStakingRewards(
				deposit,
				100000,
				totalStaked.toString(),
				totalEscrowed.toString(),
				1000,
				{ from: second }
			);
			assert.equal(await StakingThalesDeployed.paused(), false);
			await StakingThalesDeployed.claimReward({ from: first });
		});

		it('Stake with first, claim reward, activate CCIP, close period, staking paused, update rewards, SafeBoxBuffer is address(0)', async () => {
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
			await ThalesDeployed.transfer(ThalesStakingRewardsPoolDeployed.address, toUnit(200000), {
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
			await StakingThalesDeployed.setCrossChainCollector(
				CCIPCollector.address,
				SafeBoxBuffer.address,
				{ from: owner }
			);
			await fastForward(WEEK + SECOND);
			await StakingThalesDeployed.closePeriod({ from: second });
			assert.equal(await StakingThalesDeployed.paused(), true);
			await expect(StakingThalesDeployed.claimReward({ from: first })).to.be.revertedWith(
				'This action cannot be performed while the contract is paused'
			);
			await StakingThalesDeployed.setCrossChainCollector(second, SafeBoxBuffer.address, {
				from: owner,
			});
			let totalStaked = await StakingThalesDeployed.totalStakedLastPeriodEnd();
			let totalEscrowed = await StakingThalesDeployed.totalEscrowedLastPeriodEnd();
			await expect(
				StakingThalesDeployed.updateStakingRewards(
					deposit,
					100000,
					totalStaked.toString(),
					totalEscrowed.toString(),
					1000,
					{ from: owner }
				)
			).to.be.revertedWith('InvCCIP');
			await StakingThalesDeployed.setCrossChainCollector(second, ZERO_ADDRESS, {
				from: owner,
			});
			totalStaked = await StakingThalesDeployed.totalStakedLastPeriodEnd();
			totalEscrowed = await StakingThalesDeployed.totalEscrowedLastPeriodEnd();
			await StakingThalesDeployed.updateStakingRewards(
				deposit,
				100000,
				totalStaked.toString(),
				totalEscrowed.toString(),
				1000,
				{ from: second }
			);
			let paused = await StakingThalesDeployed.paused();
			assert.equal(paused, true);
			await sUSDSynth.transfer(StakingThalesDeployed.address, 1001, { from: initialCreator });
			// await ThalesFeeDeployed.transfer(StakingThalesDeployed.address, 1001, {
			// 	from: owner,
			// });

			await StakingThalesDeployed.setCrossChainCollector(second, SafeBoxBuffer.address, {
				from: owner,
			});
			await StakingThalesDeployed.updateStakingRewards(
				deposit,
				100000,
				totalStaked.toString(),
				totalEscrowed.toString(),
				1000,
				{ from: second }
			);
			assert.equal(await StakingThalesDeployed.paused(), false);
			await StakingThalesDeployed.claimReward({ from: first });
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
	});
});
