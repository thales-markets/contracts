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
	let AddressManager;

	let ThalesSixDecimal;

	let CCIPCollector;
	let CCIPRouter;
	let StakingThalesBonusRewardsManager;

	let initializeStalkingData, initializeEscrowData;

	let EscrowImplementation, StakingImplementation;

	const sUSDQty = toUnit(5555);
	const SECOND = 1000;
	const HOUR = 1000 * 60 * 60;
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
			let ThalesSixDecimalContract = artifacts.require('ThalesSixDecimal');
			ThalesSixDecimal = await ThalesSixDecimalContract.new({ from: owner });

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
		StakingImplementation = await StakingThales.new({ from: owner, gasLimit: 20 * 1e6 });
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
		await StakingThalesDeployed.setStakingParameters(true, true, WEEK, WEEK, true, false, true, {
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
		let CCIPRouterContract = artifacts.require('MockCCIPRouter');
		CCIPRouter = await CCIPRouterContract.new();
		let CCIPCollectorContract = artifacts.require('CrossChainCollector');
		CCIPCollector = await CCIPCollectorContract.new();
		let StakingThalesBonusRewardsManagerContract = artifacts.require(
			'StakingThalesBonusRewardsManager'
		);
		StakingThalesBonusRewardsManager = await StakingThalesBonusRewardsManagerContract.new();
		await StakingThalesBonusRewardsManager.initialize(owner, StakingThalesDeployed.address);
		await CCIPCollector.initialize(CCIPRouter.address, true, 5, 5, { from: owner });

		// await CCIPCollector.setStakingThales(StakingThalesDeployed.address, { from: owner });
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
		let AddressManagerContract = artifacts.require('AddressManager');
		AddressManager = await AddressManagerContract.new();
		await AddressManager.initialize(
			owner,
			ZERO_ADDRESS,
			ZERO_ADDRESS,
			ZERO_ADDRESS,
			ZERO_ADDRESS,
			ZERO_ADDRESS,
			ZERO_ADDRESS
		);
		await AddressManager.setAddressInAddressBook('StakingThales', StakingThalesDeployed.address, {
			from: owner,
		});
		await CCIPCollector.setAddressManager(AddressManager.address, { from: owner });
		// await AddressManager.setAddressInAddressBook("CrossChainCollector", CCIPCollector.address, {from: owner});
		await StakingThalesDeployed.setAddresses(
			dummy,
			dummy,
			dummy,
			PriceFeedInstance.address,
			ThalesStakingRewardsPoolDeployed.address,
			AddressManager.address,
			StakingThalesBonusRewardsManager.address,
			{ from: owner }
		);
	});

	describe('Staking:', () => {
		// it('Close staking period after period without funds in StakingThales', async () => {
		// 	await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
		// 		from: owner,
		// 	});
		// 	await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
		// 		'Staking period has not started'
		// 	);
		// });

		// it('Close staking period with low funds (99,999) in StakingThales and claim single user ', async () => {
		// 	let deposit = toUnit(100000);
		// 	let lowerDeposit = toUnit(500);
		// 	await ThalesDeployed.transfer(first, toUnit(2), { from: owner });
		// 	await StakingThalesDeployed.setStakingRewardsParameters(deposit, 100000, false, {
		// 		from: owner,
		// 	});
		// 	await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
		// 		from: owner,
		// 	});
		// 	await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
		// 		'Staking period has not started'
		// 	);
		// 	await ThalesDeployed.transfer(ThalesStakingRewardsPoolDeployed.address, lowerDeposit, {
		// 		from: owner,
		// 	});
		// 	await StakingThalesDeployed.startStakingPeriod({ from: owner });
		// 	await ThalesDeployed.approve(StakingThalesDeployed.address, toUnit(1), { from: first });
		// 	await StakingThalesDeployed.stake(toUnit(1), { from: first });
		// 	await fastForward(WEEK + SECOND);
		// 	await StakingThalesDeployed.closePeriod({ from: second });
		// 	await StakingThalesDeployed.getRewardsAvailable(first);
		// 	expect(StakingThalesDeployed.claimReward({ from: first })).to.be.revertedWith(
		// 		'SafeERC20: low-level call failed'
		// 	);
		// });

		// it('Close staking period with enough funds (100,000) in StakingThales and claim single user ', async () => {
		// 	let deposit = toUnit(100000);
		// 	await ThalesDeployed.transfer(first, toUnit(2), { from: owner });
		// 	await StakingThalesDeployed.setStakingRewardsParameters(deposit, 100000, false, {
		// 		from: owner,
		// 	});
		// 	await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
		// 		from: owner,
		// 	});
		// 	await sUSDSynth.issue(initialCreator, deposit);
		// 	await sUSDSynth.transfer(StakingThalesDeployed.address, deposit, { from: initialCreator });
		// 	await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
		// 		'Staking period has not started'
		// 	);
		// 	await ThalesDeployed.transfer(ThalesStakingRewardsPoolDeployed.address, deposit, {
		// 		from: owner,
		// 	});
		// 	await StakingThalesDeployed.startStakingPeriod({ from: owner });
		// 	await ThalesDeployed.approve(StakingThalesDeployed.address, toUnit(1), { from: first });
		// 	await StakingThalesDeployed.stake(toUnit(1), { from: first });
		// 	await fastForward(WEEK + SECOND);
		// 	await StakingThalesDeployed.closePeriod({ from: second });
		// 	let answer = await StakingThalesDeployed.getRewardsAvailable(first);
		// 	await StakingThalesDeployed.claimReward({ from: first });
		// 	await fastForward(WEEK + SECOND);
		// 	await StakingThalesDeployed.closePeriod({ from: second });
		// 	let answer2 = await EscrowThalesDeployed.getStakedEscrowedBalanceForRewards(first);
		// 	assert.bnEqual(answer, answer2);
		// });
		// it('UPDATE volume - Close staking period with enough funds (100,000) in StakingThales and claim single user ', async () => {
		// 	let deposit = toUnit(100000);
		// 	await ThalesDeployed.transfer(first, toUnit(2), { from: owner });
		// 	await StakingThalesDeployed.setStakingRewardsParameters(deposit, 100000, false, {
		// 		from: owner,
		// 	});
		// 	await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
		// 		from: owner,
		// 	});
		// 	await sUSDSynth.issue(initialCreator, deposit);
		// 	await sUSDSynth.transfer(StakingThalesDeployed.address, deposit, { from: initialCreator });
		// 	await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
		// 		'Staking period has not started'
		// 	);
		// 	await ThalesDeployed.transfer(ThalesStakingRewardsPoolDeployed.address, deposit, {
		// 		from: owner,
		// 	});
		// 	await StakingThalesDeployed.startStakingPeriod({ from: owner });
		// 	await ThalesDeployed.approve(StakingThalesDeployed.address, toUnit(1), { from: first });
		// 	await StakingThalesDeployed.stake(toUnit(1), { from: first });
		// 	await fastForward(WEEK + SECOND);
		// 	await StakingThalesDeployed.setAddresses(
		// 		third,
		// 		dummy,
		// 		dummy,
		// 		PriceFeedInstance.address,
		// 		ThalesStakingRewardsPoolDeployed.address,
		// 		AddressManager.address,
		// 		ZERO_ADDRESS,
		// 		{ from: owner }
		// 	);
		// 	await AddressManager.setAddressInAddressBook('ThalesAMM', third, {
		// 		from: owner,
		// 	});
		// 	await AddressManager.setAddressInAddressBook('ThalesRangedAMM', dummy, {
		// 		from: owner,
		// 	});
		// 	await AddressManager.setAddressInAddressBook('SportsAMM', dummy, {
		// 		from: owner,
		// 	});
		// 	await StakingThalesDeployed.closePeriod({ from: second });
		// 	let answer = await StakingThalesDeployed.getRewardsAvailable(first);
		// 	await StakingThalesDeployed.claimReward({ from: first });
		// 	await fastForward(WEEK + SECOND);
		// 	await StakingThalesDeployed.closePeriod({ from: second });
		// 	await StakingThalesDeployed.updateVolume(first, 10000, { from: third });
		// 	let answer2 = await EscrowThalesDeployed.getStakedEscrowedBalanceForRewards(first);
		// 	assert.bnEqual(answer, answer2);
		// });

		// it('Close staking period after period with funds (100001) in StakingThales ', async () => {
		// 	await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
		// 		from: owner,
		// 	});
		// 	await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
		// 		'Staking period has not started'
		// 	);
		// 	let answer = await StakingThalesDeployed.startStakingPeriod({ from: owner });
		// 	await ThalesDeployed.transfer(ThalesStakingRewardsPoolDeployed.address, 100001, {
		// 		from: owner,
		// 	});
		// 	await ThalesFeeDeployed.transfer(StakingThalesDeployed.address, 10000, {
		// 		from: owner,
		// 	});

		// 	await sUSDSynth.issue(initialCreator, sUSDQty);
		// 	await sUSDSynth.transfer(StakingThalesDeployed.address, sUSDQty, { from: initialCreator });

		// 	await fastForward(WEEK + SECOND);
		// 	await StakingThalesDeployed.closePeriod({ from: second });
		// 	answer = await StakingThalesDeployed.getContractRewardFunds.call({ from: owner });
		// 	assert.equal(web3.utils.toDecimal(answer), 100001);
		// });

		// it('Stake with first account with NO THALES funds and fees ', async () => {
		// 	await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
		// 		from: owner,
		// 	});
		// 	await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
		// 		'Staking period has not started'
		// 	);
		// 	await StakingThalesDeployed.startStakingPeriod({ from: owner });

		// 	await ThalesDeployed.transfer(ThalesStakingRewardsPoolDeployed.address, 70001, {
		// 		from: owner,
		// 	});
		// });

		// it('Stake with first account', async () => {
		// 	let stake = toUnit(1500);
		// 	let fixedReward = toUnit(100000);
		// 	await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
		// 		from: owner,
		// 	});
		// 	await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
		// 		'Staking period has not started'
		// 	);

		// 	await ThalesDeployed.transfer(first, stake, { from: owner });
		// 	let answer = await ThalesDeployed.balanceOf.call(first);
		// 	assert.bnEqual(answer, stake);
		// 	answer = await StakingThalesDeployed.startStakingPeriod({ from: owner });
		// 	await ThalesDeployed.transfer(ThalesStakingRewardsPoolDeployed.address, fixedReward, {
		// 		from: owner,
		// 	});

		// 	await ThalesDeployed.approve(StakingThalesDeployed.address, stake, { from: first });
		// 	await StakingThalesDeployed.stake(stake, { from: first });
		// 	answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
		// 	assert.bnEqual(answer, stake);
		// });

		// it('Stake with first account and claim reward (but no fees available)', async () => {
		// 	let deposit = toUnit(100000);
		// 	let stake = toUnit(1500);
		// 	await ThalesDeployed.transfer(first, stake, { from: owner });
		// 	await StakingThalesDeployed.setStakingRewardsParameters(deposit, 100000, false, {
		// 		from: owner,
		// 	});
		// 	await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
		// 		from: owner,
		// 	});
		// 	let answer = await StakingThalesDeployed.getContractFeeFunds();
		// 	assert.bnEqual(answer, 0);
		// 	await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
		// 		'Staking period has not started'
		// 	);
		// 	await ThalesDeployed.transfer(ThalesStakingRewardsPoolDeployed.address, deposit, {
		// 		from: owner,
		// 	});
		// 	await StakingThalesDeployed.startStakingPeriod({ from: owner });
		// 	await ThalesDeployed.approve(StakingThalesDeployed.address, stake, { from: first });
		// 	await StakingThalesDeployed.stake(stake, { from: first });
		// 	await fastForward(WEEK + SECOND);
		// 	await StakingThalesDeployed.closePeriod({ from: second });
		// 	answer = await StakingThalesDeployed.getRewardsAvailable(first);
		// 	await StakingThalesDeployed.claimReward({ from: first });
		// 	await fastForward(WEEK + SECOND);
		// 	await StakingThalesDeployed.closePeriod({ from: second });
		// 	let answer2 = await EscrowThalesDeployed.getStakedEscrowedBalanceForRewards(first);
		// 	assert.bnEqual(answer, answer2);
		// });

		// it('Change timestamp', async () => {
		// 	let deposit = toUnit(100000);
		// 	let stake = toUnit(1500);
		// 	await ThalesDeployed.transfer(first, stake, { from: owner });
		// 	await StakingThalesDeployed.setStakingRewardsParameters(deposit, 100000, false, {
		// 		from: owner,
		// 	});
		// 	await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
		// 		from: owner,
		// 	});
		// 	let answer = await StakingThalesDeployed.getContractFeeFunds();
		// 	assert.bnEqual(answer, 0);
		// 	await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
		// 		'Staking period has not started'
		// 	);
		// 	await ThalesDeployed.transfer(ThalesStakingRewardsPoolDeployed.address, deposit, {
		// 		from: owner,
		// 	});
		// 	await StakingThalesDeployed.startStakingPeriod({ from: owner });
		// 	await ThalesDeployed.approve(StakingThalesDeployed.address, stake, { from: first });
		// 	await StakingThalesDeployed.stake(stake, { from: first });
		// 	await fastForward(WEEK + SECOND);
		// 	await StakingThalesDeployed.closePeriod({ from: second });
		// 	answer = await StakingThalesDeployed.getRewardsAvailable(first);
		// 	await StakingThalesDeployed.claimReward({ from: first });
		// 	await fastForward(WEEK + SECOND);
		// 	await StakingThalesDeployed.closePeriod({ from: second });
		// 	let answer2 = await EscrowThalesDeployed.getStakedEscrowedBalanceForRewards(first);
		// 	assert.bnEqual(answer, answer2);
		// 	let lastTimeStamp = await StakingThalesDeployed.lastPeriodTimeStamp();
		// 	console.log('lastPeriodTimeStamp: ', lastTimeStamp.toString());
		// 	let newTimestamp = parseInt(lastTimeStamp.toString()) - 4 * 60 * 60;
		// 	console.log('newTimestamp: ', newTimestamp.toString());
		// 	await StakingThalesDeployed.setLastPeriodTimestamp(newTimestamp.toString(), { from: owner });
		// 	lastTimeStamp = await StakingThalesDeployed.lastPeriodTimeStamp();
		// 	console.log('lastPeriodTimeStamp: ', lastTimeStamp.toString());
		// });

		// it('Stake with first account and claim reward - readOnlyMode', async () => {
		// 	let deposit = toUnit(100000);
		// 	let stake = toUnit(1500);
		// 	await StakingThalesDeployed.setStakingParameters(true, true, WEEK, WEEK, true, true, true, {
		// 		from: owner,
		// 	});
		// 	await ThalesDeployed.transfer(first, stake, { from: owner });
		// 	await StakingThalesDeployed.setStakingRewardsParameters(deposit, 100000, false, {
		// 		from: owner,
		// 	});
		// 	await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
		// 		from: owner,
		// 	});
		// 	let answer = await StakingThalesDeployed.getContractFeeFunds();
		// 	assert.bnEqual(answer, 0);
		// 	await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
		// 		'Staking period has not started'
		// 	);
		// 	await ThalesDeployed.transfer(ThalesStakingRewardsPoolDeployed.address, deposit, {
		// 		from: owner,
		// 	});
		// 	await AddressManager.setAddressInAddressBook('CrossChainCollector', CCIPCollector.address, {
		// 		from: owner,
		// 	});
		// 	await AddressManager.setAddressInAddressBook('SafeBoxBuffer', SafeBoxBuffer.address, {
		// 		from: owner,
		// 	});
		// 	// await StakingThalesDeployed.setCrossChainCollector(
		// 	// 	CCIPCollector.address,
		// 	// 	SafeBoxBuffer.address,
		// 	// 	{ from: owner }
		// 	// );
		// 	await StakingThalesDeployed.startStakingPeriod({ from: owner });
		// 	await ThalesDeployed.approve(StakingThalesDeployed.address, stake, { from: first });
		// 	await StakingThalesDeployed.stake(stake, { from: first });
		// 	await fastForward(WEEK + SECOND);
		// 	await StakingThalesDeployed.closePeriod({ from: second });
		// 	answer = await StakingThalesDeployed.getRewardsAvailable(first);
		// 	await StakingThalesDeployed.claimReward({ from: first });
		// 	await fastForward(WEEK + SECOND);
		// 	await StakingThalesDeployed.closePeriod({ from: second });
		// 	let answer2 = await EscrowThalesDeployed.getStakedEscrowedBalanceForRewards(first);
		// 	assert.bnEqual(answer, answer2);
		// });

		// it('Stake with first account and claim reward (but no fees available), then activate CCIP and close period, Staking paused', async () => {
		// 	let deposit = toUnit(100000);
		// 	let stake = toUnit(1500);
		// 	await ThalesDeployed.transfer(first, stake, { from: owner });
		// 	await StakingThalesDeployed.setStakingRewardsParameters(deposit, 100000, false, {
		// 		from: owner,
		// 	});
		// 	await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
		// 		from: owner,
		// 	});
		// 	let answer = await StakingThalesDeployed.getContractFeeFunds();
		// 	assert.bnEqual(answer, 0);
		// 	await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
		// 		'Staking period has not started'
		// 	);
		// 	await ThalesDeployed.transfer(ThalesStakingRewardsPoolDeployed.address, deposit, {
		// 		from: owner,
		// 	});
		// 	await StakingThalesDeployed.startStakingPeriod({ from: owner });
		// 	await ThalesDeployed.approve(StakingThalesDeployed.address, stake, { from: first });
		// 	await StakingThalesDeployed.stake(stake, { from: first });
		// 	await fastForward(WEEK + SECOND);
		// 	await StakingThalesDeployed.closePeriod({ from: second });
		// 	answer = await StakingThalesDeployed.getRewardsAvailable(first);
		// 	await StakingThalesDeployed.claimReward({ from: first });
		// 	await fastForward(WEEK + SECOND);
		// 	await StakingThalesDeployed.closePeriod({ from: second });
		// 	let answer2 = await EscrowThalesDeployed.getStakedEscrowedBalanceForRewards(first);
		// 	assert.bnEqual(answer, answer2);
		// 	await AddressManager.setAddressInAddressBook('CrossChainCollector', CCIPCollector.address, {
		// 		from: owner,
		// 	});
		// 	await AddressManager.setAddressInAddressBook('SafeBoxBuffer', SafeBoxBuffer.address, {
		// 		from: owner,
		// 	});
		// 	// await StakingThalesDeployed.setCrossChainCollector(
		// 	// 	CCIPCollector.address,
		// 	// 	SafeBoxBuffer.address,
		// 	// 	{ from: owner }
		// 	// );
		// 	await fastForward(WEEK + SECOND);
		// 	await StakingThalesDeployed.closePeriod({ from: second });
		// 	assert.equal(await StakingThalesDeployed.paused(), true);
		// 	await expect(StakingThalesDeployed.claimReward({ from: first })).to.be.revertedWith(
		// 		'This action cannot be performed while the contract is paused'
		// 	);
		// });

		// it('Stake with first, claim reward, activate CCIP, close period, staking paused, update rewards, claim reward', async () => {
		// 	let deposit = toUnit(100000);
		// 	let stake = toUnit(1500);
		// 	await ThalesDeployed.transfer(first, stake, { from: owner });
		// 	await StakingThalesDeployed.setStakingRewardsParameters(deposit, 100000, false, {
		// 		from: owner,
		// 	});
		// 	await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
		// 		from: owner,
		// 	});
		// 	let answer = await StakingThalesDeployed.getContractFeeFunds();
		// 	assert.bnEqual(answer, 0);
		// 	await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
		// 		'Staking period has not started'
		// 	);
		// 	await ThalesDeployed.transfer(ThalesStakingRewardsPoolDeployed.address, toUnit(200000), {
		// 		from: owner,
		// 	});
		// 	await StakingThalesDeployed.startStakingPeriod({ from: owner });
		// 	await ThalesDeployed.approve(StakingThalesDeployed.address, stake, { from: first });
		// 	await StakingThalesDeployed.stake(stake, { from: first });
		// 	await fastForward(WEEK + SECOND);
		// 	await StakingThalesDeployed.closePeriod({ from: second });
		// 	answer = await StakingThalesDeployed.getRewardsAvailable(first);
		// 	await StakingThalesDeployed.claimReward({ from: first });
		// 	await fastForward(WEEK + SECOND);
		// 	await StakingThalesDeployed.closePeriod({ from: second });
		// 	let answer2 = await EscrowThalesDeployed.getStakedEscrowedBalanceForRewards(first);
		// 	assert.bnEqual(answer, answer2);
		// 	await AddressManager.setAddressInAddressBook('CrossChainCollector', CCIPCollector.address, {
		// 		from: owner,
		// 	});
		// 	await AddressManager.setAddressInAddressBook('SafeBoxBuffer', SafeBoxBuffer.address, {
		// 		from: owner,
		// 	});
		// 	// await StakingThalesDeployed.setCrossChainCollector(
		// 	// 	CCIPCollector.address,
		// 	// 	SafeBoxBuffer.address,
		// 	// 	{ from: owner }
		// 	// );
		// 	await fastForward(WEEK + SECOND);
		// 	await StakingThalesDeployed.closePeriod({ from: second });
		// 	assert.equal(await StakingThalesDeployed.paused(), true);
		// 	await expect(StakingThalesDeployed.claimReward({ from: first })).to.be.revertedWith(
		// 		'This action cannot be performed while the contract is paused'
		// 	);
		// 	await AddressManager.setAddressInAddressBook('CrossChainCollector', second, { from: owner });
		// 	await AddressManager.setAddressInAddressBook('SafeBoxBuffer', SafeBoxBuffer.address, {
		// 		from: owner,
		// 	});
		// 	// await StakingThalesDeployed.setCrossChainCollector(second, SafeBoxBuffer.address, {
		// 	// 	from: owner,
		// 	// });
		// 	let totalStaked = await StakingThalesDeployed.totalStakedLastPeriodEnd();
		// 	let totalEscrowed = await StakingThalesDeployed.totalEscrowedLastPeriodEnd();
		// 	await expect(
		// 		StakingThalesDeployed.updateStakingRewards(deposit, 100000, 1000, { from: third })
		// 	).to.be.revertedWith('InvCCIP');
		// 	await sUSDSynth.transfer(StakingThalesDeployed.address, 1001, { from: initialCreator });
		// 	// await ThalesFeeDeployed.transfer(StakingThalesDeployed.address, 1001, {
		// 	// 	from: owner,
		// 	// });
		// 	await StakingThalesDeployed.updateStakingRewards(deposit, 100000, 1000, { from: second });
		// 	assert.equal(await StakingThalesDeployed.paused(), false);
		// 	await StakingThalesDeployed.claimReward({ from: first });
		// });
		// it('Use 6 decimals: Stake with first, claim reward, activate CCIP, close period, staking paused, update rewards, claim reward', async () => {
		// 	let StakingThales = artifacts.require('StakingThales');
		// 	StakingThalesDeployed = await StakingThales.new({ from: managerOwner });
		// 	await StakingThalesDeployed.initialize(
		// 		owner,
		// 		EscrowThalesDeployed.address,
		// 		ThalesDeployed.address,
		// 		ThalesSixDecimal.address,
		// 		WEEK,
		// 		WEEK,
		// 		SNXRewardsDeployed.address
		// 	);

		// 	await StakingThalesDeployed.setAddresses(
		// 		dummy,
		// 		dummy,
		// 		dummy,
		// 		PriceFeedInstance.address,
		// 		ThalesStakingRewardsPoolDeployed.address,
		// 		AddressManager.address,
		// 		StakingThalesBonusRewardsManager.address,
		// 		{ from: owner }
		// 	);
		// 	await StakingThalesDeployed.setStakingParameters(true, true, WEEK, WEEK, true, false, true, {
		// 		from: owner,
		// 	});
		// 	await AddressManager.setAddressInAddressBook('StakingThales', StakingThalesDeployed.address, {
		// 		from: owner,
		// 	});
		// 	let deposit = toUnit(100000);
		// 	let stake = toUnit(1500);
		// 	await ThalesDeployed.transfer(first, stake, { from: owner });
		// 	await StakingThalesDeployed.setStakingRewardsParameters(deposit, 100000, true, {
		// 		from: owner,
		// 	});
		// 	await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
		// 		from: owner,
		// 	});
		// 	await EscrowThalesDeployed.setThalesStakingRewardsPool(
		// 		ThalesStakingRewardsPoolDeployed.address,
		// 		{ from: owner }
		// 	);
		// 	await ThalesStakingRewardsPoolDeployed.setStakingThalesContract(
		// 		StakingThalesDeployed.address,
		// 		{ from: owner }
		// 	);
		// 	let answer = await StakingThalesDeployed.getContractFeeFunds();
		// 	assert.bnEqual(answer, 0);
		// 	await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
		// 		'Staking period has not started'
		// 	);
		// 	await ThalesDeployed.transfer(ThalesStakingRewardsPoolDeployed.address, toUnit(200000), {
		// 		from: owner,
		// 	});
		// 	await ThalesSixDecimal.transfer(StakingThalesDeployed.address, 100 * 1e6, { from: owner });
		// 	await StakingThalesDeployed.startStakingPeriod({ from: owner });
		// 	await ThalesDeployed.approve(StakingThalesDeployed.address, stake, { from: first });
		// 	await StakingThalesDeployed.stake(stake, { from: first });
		// 	await fastForward(WEEK + SECOND);
		// 	let balanceOfStakingFees = await ThalesSixDecimal.balanceOf(StakingThalesDeployed.address);
		// 	console.log('Balance of StakingFees: ', balanceOfStakingFees.toString());
		// 	await StakingThalesDeployed.closePeriod({ from: second });
		// 	answer = await StakingThalesDeployed.getRewardFeesAvailable(first);
		// 	console.log('Available fees to claim: ', answer.toString());
		// 	answer = await StakingThalesDeployed.getRewardsAvailable(first);
		// 	console.log('Available rewards to claim: ', fromUnit(answer));
		// 	await StakingThalesDeployed.claimReward({ from: first });
		// 	let balanceOfUser = await ThalesSixDecimal.balanceOf(first);
		// 	console.log('Balance of User: ', balanceOfUser.toString());
		// 	assert.equal(balanceOfUser.toString(), balanceOfStakingFees.toString());
		// 	await fastForward(WEEK + SECOND);
		// 	await StakingThalesDeployed.closePeriod({ from: second });
		// 	let answer2 = await EscrowThalesDeployed.getStakedEscrowedBalanceForRewards(first);
		// 	assert.bnEqual(answer, answer2);
		// 	await AddressManager.setAddressInAddressBook('CrossChainCollector', CCIPCollector.address, {
		// 		from: owner,
		// 	});
		// 	await AddressManager.setAddressInAddressBook('SafeBoxBuffer', SafeBoxBuffer.address, {
		// 		from: owner,
		// 	});
		// 	// await StakingThalesDeployed.setCrossChainCollector(
		// 	// 	CCIPCollector.address,
		// 	// 	SafeBoxBuffer.address,
		// 	// 	{ from: owner }
		// 	// );
		// 	await ThalesSixDecimal.transfer(StakingThalesDeployed.address, 200 * 1e6, { from: owner });
		// 	await fastForward(WEEK + SECOND);
		// 	await StakingThalesDeployed.closePeriod({ from: second });
		// 	assert.equal(await StakingThalesDeployed.paused(), true);
		// 	await expect(StakingThalesDeployed.claimReward({ from: first })).to.be.revertedWith(
		// 		'This action cannot be performed while the contract is paused'
		// 	);
		// 	await AddressManager.setAddressInAddressBook('CrossChainCollector', second, { from: owner });
		// 	await AddressManager.setAddressInAddressBook('SafeBoxBuffer', SafeBoxBuffer.address, {
		// 		from: owner,
		// 	});
		// 	// await StakingThalesDeployed.setCrossChainCollector(second, SafeBoxBuffer.address, {
		// 	// 	from: owner,
		// 	// });
		// 	let totalStaked = await StakingThalesDeployed.totalStakedLastPeriodEnd();
		// 	let totalEscrowed = await StakingThalesDeployed.totalEscrowedLastPeriodEnd();
		// 	await ThalesSixDecimal.transfer(SafeBoxBuffer.address, 100000 * 1e6, { from: owner });
		// 	await expect(
		// 		StakingThalesDeployed.updateStakingRewards(deposit, 100000, 1000, { from: third })
		// 	).to.be.revertedWith('InvCCIP');
		// 	await sUSDSynth.transfer(StakingThalesDeployed.address, 1001, { from: initialCreator });
		// 	// await ThalesFeeDeployed.transfer(StakingThalesDeployed.address, 1001, {
		// 	// 	from: owner,
		// 	// });
		// 	await StakingThalesDeployed.updateStakingRewards(deposit, 100000, toUnit(10), {
		// 		from: second,
		// 	});
		// 	assert.equal(await StakingThalesDeployed.paused(), false);
		// 	balanceOfUser = await ThalesSixDecimal.balanceOf(first);
		// 	answer = await StakingThalesDeployed.getRewardFeesAvailable(first);
		// 	console.log('Available fees to claim: ', answer.toString());
		// 	assert.equal(answer.toString(), '10000000'); // 10 usd with 6 decimals
		// 	await StakingThalesDeployed.claimReward({ from: first });
		// 	let newBalance = await ThalesSixDecimal.balanceOf(first);
		// 	console.log('Balance initially: ', balanceOfUser.toString());
		// 	console.log('Balance after: ', newBalance.toString());
		// });

		// it('Stake with first, claim reward, activate CCIP, close period, staking paused, update rewards, SafeBoxBuffer is address(0)', async () => {
		// 	let deposit = toUnit(100000);
		// 	let stake = toUnit(1500);
		// 	await ThalesDeployed.transfer(first, stake, { from: owner });
		// 	await StakingThalesDeployed.setStakingRewardsParameters(deposit, 100000, false, {
		// 		from: owner,
		// 	});
		// 	await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
		// 		from: owner,
		// 	});
		// 	let answer = await StakingThalesDeployed.getContractFeeFunds();
		// 	assert.bnEqual(answer, 0);
		// 	await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
		// 		'Staking period has not started'
		// 	);
		// 	await ThalesDeployed.transfer(ThalesStakingRewardsPoolDeployed.address, toUnit(200000), {
		// 		from: owner,
		// 	});
		// 	await StakingThalesDeployed.startStakingPeriod({ from: owner });
		// 	await ThalesDeployed.approve(StakingThalesDeployed.address, stake, { from: first });
		// 	await StakingThalesDeployed.stake(stake, { from: first });
		// 	await fastForward(WEEK + SECOND);
		// 	await StakingThalesDeployed.closePeriod({ from: second });
		// 	answer = await StakingThalesDeployed.getRewardsAvailable(first);
		// 	await StakingThalesDeployed.claimReward({ from: first });
		// 	await fastForward(WEEK + SECOND);
		// 	await StakingThalesDeployed.closePeriod({ from: second });
		// 	let answer2 = await EscrowThalesDeployed.getStakedEscrowedBalanceForRewards(first);
		// 	assert.bnEqual(answer, answer2);
		// 	await AddressManager.setAddressInAddressBook('CrossChainCollector', CCIPCollector.address, {
		// 		from: owner,
		// 	});
		// 	await AddressManager.setAddressInAddressBook('SafeBoxBuffer', SafeBoxBuffer.address, {
		// 		from: owner,
		// 	});
		// 	// await StakingThalesDeployed.setCrossChainCollector(
		// 	// 	CCIPCollector.address,
		// 	// 	SafeBoxBuffer.address,
		// 	// 	{ from: owner }
		// 	// );
		// 	await fastForward(WEEK + SECOND);
		// 	await StakingThalesDeployed.closePeriod({ from: second });

		// 	let closingPeriodInProgress = await StakingThalesDeployed.closingPeriodInProgress();
		// 	assert.equal(await StakingThalesDeployed.paused(), true);
		// 	await expect(StakingThalesDeployed.claimReward({ from: first })).to.be.revertedWith(
		// 		'This action cannot be performed while the contract is paused'
		// 	);
		// 	await AddressManager.setAddressInAddressBook('CrossChainCollector', second, { from: owner });
		// 	await AddressManager.setAddressInAddressBook('SafeBoxBuffer', SafeBoxBuffer.address, {
		// 		from: owner,
		// 	});
		// 	// await StakingThalesDeployed.setCrossChainCollector(second, SafeBoxBuffer.address, {
		// 	// 	from: owner,
		// 	// });
		// 	let totalStaked = await StakingThalesDeployed.totalStakedLastPeriodEnd();
		// 	let totalEscrowed = await StakingThalesDeployed.totalEscrowedLastPeriodEnd();
		// 	await expect(
		// 		StakingThalesDeployed.updateStakingRewards(deposit, 100000, 1000, { from: third })
		// 	).to.be.revertedWith('InvCCIP');
		// 	await AddressManager.setAddressInAddressBook('CrossChainCollector', second, { from: owner });
		// 	await AddressManager.setAddressInAddressBook('SafeBoxBuffer', dummy, { from: owner });
		// 	await AddressManager.resetAddressForContract('SafeBoxBuffer', {
		// 		from: owner,
		// 	});
		// 	// await StakingThalesDeployed.setCrossChainCollector(second, ZERO_ADDRESS, {
		// 	// 	from: owner,
		// 	// });
		// 	totalStaked = await StakingThalesDeployed.totalStakedLastPeriodEnd();
		// 	totalEscrowed = await StakingThalesDeployed.totalEscrowedLastPeriodEnd();
		// 	await StakingThalesDeployed.updateStakingRewards(deposit, 100000, 1000, { from: second });
		// 	let paused = await StakingThalesDeployed.paused();
		// 	assert.equal(paused, true);
		// 	await sUSDSynth.transfer(StakingThalesDeployed.address, 1001, { from: initialCreator });
		// 	// await ThalesFeeDeployed.transfer(StakingThalesDeployed.address, 1001, {
		// 	// 	from: owner,
		// 	// });
		// 	await AddressManager.setAddressInAddressBook('CrossChainCollector', second, { from: owner });
		// 	await AddressManager.setAddressInAddressBook('SafeBoxBuffer', SafeBoxBuffer.address, {
		// 		from: owner,
		// 	});
		// 	// await AddressManager.resetAddressForContract(toBytes32('SafeBoxBuffer'), {
		// 	// 	from: owner,
		// 	// });
		// 	// await StakingThalesDeployed.setCrossChainCollector(second, SafeBoxBuffer.address, {
		// 	// 	from: owner,
		// 	// });
		// 	await expect(
		// 		StakingThalesDeployed.updateStakingRewards(deposit, 100000, 1000, { from: second })
		// 	).to.be.revertedWith('NotInClosePeriod');
		// 	assert.equal(await StakingThalesDeployed.paused(), true);
		// 	await StakingThalesDeployed.setPaused(false, { from: owner });
		// 	await StakingThalesDeployed.claimReward({ from: first });
		// });

		// it('Stake with first, claim reward, activate CCIP, close period, staking paused, staking unpaused, update rewards', async () => {
		// 	let deposit = toUnit(100000);
		// 	let stake = toUnit(1500);
		// 	await ThalesDeployed.transfer(first, stake, { from: owner });
		// 	await StakingThalesDeployed.setStakingRewardsParameters(deposit, 100000, false, {
		// 		from: owner,
		// 	});
		// 	await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
		// 		from: owner,
		// 	});
		// 	let answer = await StakingThalesDeployed.getContractFeeFunds();
		// 	assert.bnEqual(answer, 0);
		// 	await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
		// 		'Staking period has not started'
		// 	);
		// 	await ThalesDeployed.transfer(ThalesStakingRewardsPoolDeployed.address, toUnit(200000), {
		// 		from: owner,
		// 	});
		// 	await StakingThalesDeployed.startStakingPeriod({ from: owner });
		// 	await ThalesDeployed.approve(StakingThalesDeployed.address, stake, { from: first });
		// 	await StakingThalesDeployed.stake(stake, { from: first });
		// 	await fastForward(WEEK + SECOND);
		// 	await StakingThalesDeployed.closePeriod({ from: second });
		// 	answer = await StakingThalesDeployed.getRewardsAvailable(first);
		// 	await StakingThalesDeployed.claimReward({ from: first });
		// 	await fastForward(WEEK + SECOND);
		// 	await StakingThalesDeployed.closePeriod({ from: second });
		// 	let answer2 = await EscrowThalesDeployed.getStakedEscrowedBalanceForRewards(first);
		// 	assert.bnEqual(answer, answer2);
		// 	await AddressManager.setAddressInAddressBook('CrossChainCollector', CCIPCollector.address, {
		// 		from: owner,
		// 	});
		// 	await AddressManager.setAddressInAddressBook('SafeBoxBuffer', SafeBoxBuffer.address, {
		// 		from: owner,
		// 	});
		// 	// await StakingThalesDeployed.setCrossChainCollector(
		// 	// 	CCIPCollector.address,
		// 	// 	SafeBoxBuffer.address,
		// 	// 	{ from: owner }
		// 	// );
		// 	await fastForward(WEEK + SECOND);
		// 	await StakingThalesDeployed.closePeriod({ from: second });

		// 	let closingPeriodInProgress = await StakingThalesDeployed.closingPeriodInProgress();
		// 	assert.equal(await StakingThalesDeployed.paused(), true);
		// 	await expect(StakingThalesDeployed.claimReward({ from: first })).to.be.revertedWith(
		// 		'This action cannot be performed while the contract is paused'
		// 	);
		// 	await AddressManager.setAddressInAddressBook('CrossChainCollector', second, { from: owner });
		// 	await AddressManager.setAddressInAddressBook('SafeBoxBuffer', SafeBoxBuffer.address, {
		// 		from: owner,
		// 	});
		// 	// await StakingThalesDeployed.setCrossChainCollector(second, SafeBoxBuffer.address, {
		// 	// 	from: owner,
		// 	// });
		// 	let totalStaked = await StakingThalesDeployed.totalStakedLastPeriodEnd();
		// 	let totalEscrowed = await StakingThalesDeployed.totalEscrowedLastPeriodEnd();
		// 	await expect(
		// 		StakingThalesDeployed.updateStakingRewards(deposit, 100000, 1000, { from: third })
		// 	).to.be.revertedWith('InvCCIP');
		// 	await AddressManager.setAddressInAddressBook('CrossChainCollector', second, { from: owner });
		// 	await AddressManager.setAddressInAddressBook('SafeBoxBuffer', dummy, { from: owner });
		// 	await AddressManager.resetAddressForContract('SafeBoxBuffer', {
		// 		from: owner,
		// 	});
		// 	// await StakingThalesDeployed.setCrossChainCollector(second, ZERO_ADDRESS, {
		// 	// 	from: owner,
		// 	// });
		// 	await fastForward(10 * SECOND);
		// 	await StakingThalesDeployed.setPaused(false, { from: owner });
		// 	let paused = await StakingThalesDeployed.paused();
		// 	assert.equal(paused, false);
		// 	totalStaked = await StakingThalesDeployed.totalStakedLastPeriodEnd();
		// 	totalEscrowed = await StakingThalesDeployed.totalEscrowedLastPeriodEnd();
		// 	await StakingThalesDeployed.updateStakingRewards(deposit, 100000, 1000, { from: second });
		// 	paused = await StakingThalesDeployed.paused();
		// 	assert.equal(paused, true);
		// 	await sUSDSynth.transfer(StakingThalesDeployed.address, 1001, { from: initialCreator });
		// 	// await ThalesFeeDeployed.transfer(StakingThalesDeployed.address, 1001, {
		// 	// 	from: owner,
		// 	// });
		// 	await AddressManager.setAddressInAddressBook('CrossChainCollector', second, { from: owner });
		// 	await AddressManager.setAddressInAddressBook('SafeBoxBuffer', SafeBoxBuffer.address, {
		// 		from: owner,
		// 	});
		// 	// await StakingThalesDeployed.setCrossChainCollector(second, SafeBoxBuffer.address, {
		// 	// 	from: owner,
		// 	// });
		// 	await expect(
		// 		StakingThalesDeployed.updateStakingRewards(deposit, 100000, 1000, { from: second })
		// 	).to.be.revertedWith('NotInClosePeriod');
		// });

		// it('Stake with first, claim reward, activate CCIP, close period, staking paused, staking unpaused, update rewards, claim Rewards', async () => {
		// 	let deposit = toUnit(100000);
		// 	let stake = toUnit(1500);
		// 	await ThalesDeployed.transfer(first, stake, { from: owner });
		// 	await StakingThalesDeployed.setStakingRewardsParameters(deposit, 100000, false, {
		// 		from: owner,
		// 	});
		// 	await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
		// 		from: owner,
		// 	});
		// 	let answer = await StakingThalesDeployed.getContractFeeFunds();
		// 	assert.bnEqual(answer, 0);
		// 	await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
		// 		'Staking period has not started'
		// 	);
		// 	await ThalesDeployed.transfer(ThalesStakingRewardsPoolDeployed.address, toUnit(200000), {
		// 		from: owner,
		// 	});
		// 	await StakingThalesDeployed.startStakingPeriod({ from: owner });
		// 	await ThalesDeployed.approve(StakingThalesDeployed.address, stake, { from: first });
		// 	await StakingThalesDeployed.stake(stake, { from: first });
		// 	await fastForward(WEEK + SECOND);
		// 	await StakingThalesDeployed.closePeriod({ from: second });
		// 	answer = await StakingThalesDeployed.getRewardsAvailable(first);
		// 	await StakingThalesDeployed.claimReward({ from: first });
		// 	await fastForward(WEEK + SECOND);
		// 	await StakingThalesDeployed.closePeriod({ from: second });
		// 	let answer2 = await EscrowThalesDeployed.getStakedEscrowedBalanceForRewards(first);
		// 	assert.bnEqual(answer, answer2);
		// 	// await StakingThalesDeployed.setCrossChainCollector(
		// 	// 	CCIPCollector.address,
		// 	// 	SafeBoxBuffer.address,
		// 	// 	{ from: owner }
		// 	// );
		// 	await AddressManager.setAddressInAddressBook('CrossChainCollector', CCIPCollector.address, {
		// 		from: owner,
		// 	});
		// 	await AddressManager.setAddressInAddressBook('SafeBoxBuffer', SafeBoxBuffer.address, {
		// 		from: owner,
		// 	});
		// 	await fastForward(WEEK + SECOND);
		// 	await StakingThalesDeployed.closePeriod({ from: second });
		// 	await sUSDSynth.transfer(StakingThalesDeployed.address, 1001, { from: initialCreator });
		// 	let closingPeriodInProgress = await StakingThalesDeployed.closingPeriodInProgress();
		// 	assert.equal(await StakingThalesDeployed.paused(), true);
		// 	await expect(StakingThalesDeployed.claimReward({ from: first })).to.be.revertedWith(
		// 		'This action cannot be performed while the contract is paused'
		// 	);
		// 	await AddressManager.setAddressInAddressBook('CrossChainCollector', second, {
		// 		from: owner,
		// 	});
		// 	await AddressManager.setAddressInAddressBook('SafeBoxBuffer', SafeBoxBuffer.address, {
		// 		from: owner,
		// 	});
		// 	// await StakingThalesDeployed.setCrossChainCollector(second, SafeBoxBuffer.address, {
		// 	// 	from: owner,
		// 	// });
		// 	let paused = await StakingThalesDeployed.paused();
		// 	assert.equal(paused, true);
		// 	let totalStaked = await StakingThalesDeployed.totalStakedLastPeriodEnd();
		// 	let totalEscrowed = await StakingThalesDeployed.totalEscrowedLastPeriodEnd();
		// 	let checkIfContractExists = await AddressManager.checkIfContractExists('SafeBoxBuffer');
		// 	console.log('CONTRACT EXISTS: ', checkIfContractExists);
		// 	await StakingThalesDeployed.updateStakingRewards(deposit, 100000, 1000, { from: second });
		// 	let availableRewards = await StakingThalesDeployed.getRewardsAvailable(first);
		// 	assert.equal(fromUnit(availableRewards), 100000);
		// 	await StakingThalesDeployed.claimReward({ from: first });
		// });

		// it('Stake with first, claim reward, activate CCIP, close period, staking paused, staking unpaused, update rewards different amount, claim Rewards', async () => {
		// 	let deposit = toUnit(100000);
		// 	let stake = toUnit(1500);
		// 	await ThalesDeployed.transfer(first, stake, { from: owner });
		// 	await StakingThalesDeployed.setStakingRewardsParameters(deposit, 100000, false, {
		// 		from: owner,
		// 	});
		// 	await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
		// 		from: owner,
		// 	});
		// 	let answer = await StakingThalesDeployed.getContractFeeFunds();
		// 	assert.bnEqual(answer, 0);
		// 	await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
		// 		'Staking period has not started'
		// 	);
		// 	await ThalesDeployed.transfer(ThalesStakingRewardsPoolDeployed.address, toUnit(200000), {
		// 		from: owner,
		// 	});
		// 	await StakingThalesDeployed.startStakingPeriod({ from: owner });
		// 	await ThalesDeployed.approve(StakingThalesDeployed.address, stake, { from: first });
		// 	await StakingThalesDeployed.stake(stake, { from: first });
		// 	await fastForward(WEEK + SECOND);
		// 	await StakingThalesDeployed.closePeriod({ from: second });
		// 	answer = await StakingThalesDeployed.getRewardsAvailable(first);
		// 	await StakingThalesDeployed.claimReward({ from: first });
		// 	await fastForward(WEEK + SECOND);
		// 	await StakingThalesDeployed.closePeriod({ from: second });
		// 	let answer2 = await EscrowThalesDeployed.getStakedEscrowedBalanceForRewards(first);
		// 	assert.bnEqual(answer, answer2);
		// 	await AddressManager.setAddressInAddressBook('CrossChainCollector', CCIPCollector.address, {
		// 		from: owner,
		// 	});
		// 	await AddressManager.setAddressInAddressBook('SafeBoxBuffer', SafeBoxBuffer.address, {
		// 		from: owner,
		// 	});
		// 	// await StakingThalesDeployed.setCrossChainCollector(
		// 	// 	CCIPCollector.address,
		// 	// 	SafeBoxBuffer.address,
		// 	// 	{ from: owner }
		// 	// );
		// 	await fastForward(WEEK + SECOND);
		// 	await StakingThalesDeployed.closePeriod({ from: second });
		// 	await sUSDSynth.transfer(StakingThalesDeployed.address, 1001, { from: initialCreator });
		// 	let closingPeriodInProgress = await StakingThalesDeployed.closingPeriodInProgress();
		// 	assert.equal(await StakingThalesDeployed.paused(), true);
		// 	await expect(StakingThalesDeployed.claimReward({ from: first })).to.be.revertedWith(
		// 		'This action cannot be performed while the contract is paused'
		// 	);
		// 	await AddressManager.setAddressInAddressBook('CrossChainCollector', second, {
		// 		from: owner,
		// 	});
		// 	await AddressManager.setAddressInAddressBook('SafeBoxBuffer', SafeBoxBuffer.address, {
		// 		from: owner,
		// 	});
		// 	// await StakingThalesDeployed.setCrossChainCollector(second, SafeBoxBuffer.address, {
		// 	// 	from: owner,
		// 	// });
		// 	let paused = await StakingThalesDeployed.paused();
		// 	assert.equal(paused, true);
		// 	let totalStaked = await StakingThalesDeployed.totalStakedLastPeriodEnd();
		// 	let totalEscrowed = await StakingThalesDeployed.totalEscrowedLastPeriodEnd();
		// 	await StakingThalesDeployed.setStakingRewardsParameters(toUnit(1000000), 100000, false, {
		// 		from: owner,
		// 	});
		// 	await StakingThalesDeployed.updateStakingRewards(toUnit(1000000), 1000000, 1000, {
		// 		from: second,
		// 	});
		// 	let availableRewards = await StakingThalesDeployed.getRewardsAvailable(first);
		// 	assert.equal(fromUnit(availableRewards), 1000000);
		// 	await expect(StakingThalesDeployed.claimReward({ from: first })).to.be.revertedWith(
		// 		'revert SafeERC20: low-level call failed'
		// 	);
		// 	await ThalesDeployed.transfer(ThalesStakingRewardsPoolDeployed.address, toUnit(1000000), {
		// 		from: owner,
		// 	});
		// 	await StakingThalesDeployed.claimReward({ from: first });
		// });

		// it('Stake with first account and claim reward', async () => {
		// 	let deposit = toUnit(100000);
		// 	let stake = toUnit(1500);
		// 	await ThalesDeployed.transfer(first, stake, { from: owner });
		// 	await StakingThalesDeployed.setStakingRewardsParameters(deposit, 100000, false, {
		// 		from: owner,
		// 	});
		// 	await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
		// 		from: owner,
		// 	});
		// 	await sUSDSynth.issue(initialCreator, deposit);
		// 	await sUSDSynth.transfer(StakingThalesDeployed.address, deposit, { from: initialCreator });
		// 	let answer = await StakingThalesDeployed.getContractFeeFunds();
		// 	assert.bnEqual(answer, deposit);
		// 	await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
		// 		'Staking period has not started'
		// 	);
		// 	await ThalesDeployed.transfer(ThalesStakingRewardsPoolDeployed.address, deposit, {
		// 		from: owner,
		// 	});
		// 	await StakingThalesDeployed.startStakingPeriod({ from: owner });
		// 	await ThalesDeployed.approve(StakingThalesDeployed.address, stake, { from: first });
		// 	await StakingThalesDeployed.stake(stake, { from: first });
		// 	await fastForward(WEEK + SECOND);
		// 	await StakingThalesDeployed.closePeriod({ from: second });
		// 	answer = await StakingThalesDeployed.getRewardsAvailable(first);
		// 	await StakingThalesDeployed.claimReward({ from: first });
		// 	await fastForward(WEEK + SECOND);
		// 	await StakingThalesDeployed.closePeriod({ from: second });
		// 	let answer2 = await EscrowThalesDeployed.getStakedEscrowedBalanceForRewards(first);
		// 	assert.bnEqual(answer, answer2);
		// });

		it('Stake with first, claim reward, activate CCIP, close period, staking paused, staking unpaused, update rewards, claim Rewards, deactivate CCIP, deactivate feeRewards, set feeRewards to 1 THALES, claim rewards', async () => {
			let deposit = toUnit(100000);
			let stake = toUnit(1500);
			await ThalesDeployed.transfer(first, stake, { from: owner });
			await StakingThalesDeployed.setStakingRewardsParameters(deposit, 100000, false, {
				from: owner,
			});
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
			// await StakingThalesDeployed.setCrossChainCollector(
			// 	CCIPCollector.address,
			// 	SafeBoxBuffer.address,
			// 	{ from: owner }
			// );
			await AddressManager.setAddressInAddressBook('CrossChainCollector', CCIPCollector.address, {
				from: owner,
			});
			await AddressManager.setAddressInAddressBook('SafeBoxBuffer', SafeBoxBuffer.address, {
				from: owner,
			});
			await fastForward(WEEK + SECOND);
			await StakingThalesDeployed.closePeriod({ from: second });
			await sUSDSynth.transfer(StakingThalesDeployed.address, 1001, { from: initialCreator });
			let closingPeriodInProgress = await StakingThalesDeployed.closingPeriodInProgress();
			assert.equal(await StakingThalesDeployed.paused(), true);
			await expect(StakingThalesDeployed.claimReward({ from: first })).to.be.revertedWith(
				'This action cannot be performed while the contract is paused'
			);
			await AddressManager.setAddressInAddressBook('CrossChainCollector', second, {
				from: owner,
			});
			await AddressManager.setAddressInAddressBook('SafeBoxBuffer', SafeBoxBuffer.address, {
				from: owner,
			});
			// await StakingThalesDeployed.setCrossChainCollector(second, SafeBoxBuffer.address, {
			// 	from: owner,
			// });
			let paused = await StakingThalesDeployed.paused();
			assert.equal(paused, true);
			let totalStaked = await StakingThalesDeployed.totalStakedLastPeriodEnd();
			let totalEscrowed = await StakingThalesDeployed.totalEscrowedLastPeriodEnd();
			let checkIfContractExists = await AddressManager.checkIfContractExists('SafeBoxBuffer');
			console.log('CONTRACT EXISTS: ', checkIfContractExists);
			await StakingThalesDeployed.updateStakingRewards(deposit, 100000, 1000, { from: second });
			let availableRewards = await StakingThalesDeployed.getRewardsAvailable(first);
			assert.equal(fromUnit(availableRewards), 100000);
			await StakingThalesDeployed.claimReward({ from: first });
			// Deactivate CCIP
			await StakingThalesDeployed.setStakingParameters(
				true,
				false,
				WEEK,
				WEEK,
				true,
				false,
				false,
				{
					from: owner,
				}
			);
			// await AddressManager.resetAddressForContract('CrossChainCollector', { from: owner });
			// await AddressManager.resetAddressForContract('SafeBoxBuffer', { from: owner });

			// Deactivate fee rewards and set to 1 THALES
			await StakingThalesDeployed.setStakingRewardsParameters(toUnit(1), 100000, false, {
				from: owner,
			});
			await ThalesDeployed.transfer(ThalesStakingRewardsPoolDeployed.address, toUnit(1), {
				from: owner,
			});

			// Close period and claim with new parameters
			await fastForward(WEEK + SECOND);
			await StakingThalesDeployed.closePeriod({ from: second });

			// Verify final rewards
			let finalRewards = await StakingThalesDeployed.getRewardsAvailable(first);
			console.log('FINAL REWARDS: ', fromUnit(finalRewards));
			assert.equal(fromUnit(finalRewards), 1);
			await StakingThalesDeployed.claimReward({ from: first });
		});

		it('Stake with first, claim reward, activate CCIP, close period, staking paused, update rewards, claim reward, deactivate CCIP, deactivate feeRewards, set feeRewards to 1 THALES, claim rewards', async () => {
			let deposit = toUnit(100000);
			let stake = toUnit(1500);
			await ThalesDeployed.transfer(first, stake, { from: owner });
			await StakingThalesDeployed.setStakingRewardsParameters(deposit, 100000, false, {
				from: owner,
			});
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
			await AddressManager.setAddressInAddressBook('CrossChainCollector', CCIPCollector.address, {
				from: owner,
			});
			await AddressManager.setAddressInAddressBook('SafeBoxBuffer', SafeBoxBuffer.address, {
				from: owner,
			});
			// await StakingThalesDeployed.setCrossChainCollector(
			// 	CCIPCollector.address,
			// 	SafeBoxBuffer.address,
			// 	{ from: owner }
			// );
			await fastForward(WEEK + SECOND);
			await StakingThalesDeployed.closePeriod({ from: second });
			assert.equal(await StakingThalesDeployed.paused(), true);
			await expect(StakingThalesDeployed.claimReward({ from: first })).to.be.revertedWith(
				'This action cannot be performed while the contract is paused'
			);
			await AddressManager.setAddressInAddressBook('CrossChainCollector', second, { from: owner });
			await AddressManager.setAddressInAddressBook('SafeBoxBuffer', SafeBoxBuffer.address, {
				from: owner,
			});
			// await StakingThalesDeployed.setCrossChainCollector(second, SafeBoxBuffer.address, {
			// 	from: owner,
			// });
			let totalStaked = await StakingThalesDeployed.totalStakedLastPeriodEnd();
			let totalEscrowed = await StakingThalesDeployed.totalEscrowedLastPeriodEnd();
			await expect(
				StakingThalesDeployed.updateStakingRewards(deposit, 100000, 1000, { from: third })
			).to.be.revertedWith('InvCCIP');
			await sUSDSynth.transfer(StakingThalesDeployed.address, 1001, { from: initialCreator });
			// await ThalesFeeDeployed.transfer(StakingThalesDeployed.address, 1001, {
			// 	from: owner,
			// });
			await StakingThalesDeployed.updateStakingRewards(deposit, 100000, 1000, { from: second });
			assert.equal(await StakingThalesDeployed.paused(), false);
			await StakingThalesDeployed.claimReward({ from: first });

			// Deactivate CCIP and deactivate fee rewards
			await StakingThalesDeployed.setStakingParameters(
				true,
				false,
				WEEK,
				WEEK,
				true,
				false,
				false,
				{
					from: owner,
				}
			);
			// Deactivate fee rewards and set to 1 THALES
			await StakingThalesDeployed.setStakingRewardsParameters(toUnit(1), 100000, false, {
				from: owner,
			});
			await ThalesDeployed.transfer(ThalesStakingRewardsPoolDeployed.address, toUnit(1), {
				from: owner,
			});

			// Close period and claim with new parameters
			await fastForward(WEEK + SECOND);
			await StakingThalesDeployed.closePeriod({ from: second });

			let finalRewards = await StakingThalesDeployed.getRewardsAvailable(first);
			console.log('FINAL REWARDS: ', fromUnit(finalRewards));
			assert.equal(fromUnit(finalRewards), 1);
			await StakingThalesDeployed.claimReward({ from: first });
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

			await sUSDSynth.issue(initialCreator, deposit);
			await sUSDSynth.transfer(StakingThalesDeployed.address, deposit, { from: initialCreator });
			assert.equal((await sUSDSynth.balanceOf(StakingThalesDeployed.address)) >= deposit, true);
			// Deactivate CCIP and deactivate fee rewards
			await StakingThalesDeployed.setStakingParameters(
				true,
				false,
				WEEK,
				WEEK,
				true,
				false,
				false,
				{
					from: owner,
				}
			);

			// Withdraw collateral
			await StakingThalesDeployed.withdrawCollateral(sUSDSynth.address, first, deposit, {
				from: owner,
			});

			assert.equal(await sUSDSynth.balanceOf(StakingThalesDeployed.address), 0);
			// Deactivate fee rewards and set to 1 THALES
			await StakingThalesDeployed.setStakingRewardsParameters(toUnit(1), 100000, false, {
				from: owner,
			});
			await ThalesDeployed.transfer(ThalesStakingRewardsPoolDeployed.address, toUnit(1), {
				from: owner,
			});

			// Close period and claim with new parameters
			await fastForward(WEEK + SECOND);
			await StakingThalesDeployed.closePeriod({ from: second });

			let finalRewards = await StakingThalesDeployed.getRewardsAvailable(first);
			console.log('FINAL REWARDS: ', fromUnit(finalRewards));
			assert.equal(fromUnit(finalRewards), 1);
			await StakingThalesDeployed.claimReward({ from: first });
		});
	});
	describe('withdrawCollateral', () => {
		// Test that the owner can successfully withdraw collateral tokens from the pool
		it('should allow the owner to withdraw collateral tokens from the pool', async () => {
			// For this test, we assume that ThalesDeployed is the ERC20 reward token used as collateral.
			// Transfer collateral tokens to the ThalesStakingRewardsPool contract.
			const collateralAmount = toUnit(1000);
			await ThalesDeployed.transfer(ThalesStakingRewardsPoolDeployed.address, collateralAmount, {
				from: owner,
			});

			// Record the initial balance of the recipient (using the "first" account as recipient).
			const initialRecipientBalance = await ThalesDeployed.balanceOf(first);

			// Owner calls withdrawCollateral to transfer the entire collateral balance to the recipient.
			await ThalesStakingRewardsPoolDeployed.withdrawCollateral(ThalesDeployed.address, first, {
				from: owner,
			});

			// Verify the recipient's balance has increased by the transferred amount.
			const finalRecipientBalance = await ThalesDeployed.balanceOf(first);
			assert.bnEqual(
				finalRecipientBalance,
				initialRecipientBalance.add(collateralAmount),
				'Recipient should receive the collateral amount'
			);

			// Verify that the pool's collateral balance is now zero.
			const poolFinalBalance = await ThalesDeployed.balanceOf(
				ThalesStakingRewardsPoolDeployed.address
			);
			assert.bnEqual(poolFinalBalance, toUnit(0), 'Pool balance should be zero after withdrawal');
		});

		// Test that a non-owner attempting to withdraw collateral causes a revert.
		it('should revert when a non-owner tries to call withdrawCollateral', async () => {
			// Transfer collateral tokens to the pool.
			const collateralAmount = toUnit(500);
			await ThalesDeployed.transfer(ThalesStakingRewardsPoolDeployed.address, collateralAmount, {
				from: owner,
			});

			// Attempt to withdraw collateral using a non-owner account (using "second" in this case).
			await assert.revert(
				ThalesStakingRewardsPoolDeployed.withdrawCollateral(ThalesDeployed.address, second, {
					from: second,
				}),
				'Only the contract owner may perform this action'
			);
		});
	});
});
