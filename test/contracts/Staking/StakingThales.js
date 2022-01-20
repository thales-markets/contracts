'use strict';

const { artifacts, contract, web3 } = require('hardhat');
const { toBN, fromBN } = web3.utils;

const { assert, addSnapshotBeforeRestoreAfterEach } = require('../../utils/common');

const { toBytes32 } = require('../../../index');
const { expect } = require('chai');
const { toDecimal } = require('web3-utils');
const { setupContract, setupAllContracts } = require('../../utils/setup');

const ZERO_ADDRESS = '0x' + '0'.repeat(40);

const {
	fastForward,
	toUnit,
	fromUnit,
	currentTime,
	multiplyDecimalRound,
	divideDecimalRound,
} = require('../../utils')();

const {
	onlyGivenAddressCanInvoke,
	convertToDecimals,
	encodeCall,
	assertRevert,
} = require('../../utils/helpers');

contract('StakingThales', accounts => {
	const [first, second, third, owner] = accounts;
	const [initialCreator, managerOwner, minter, dummy, exersicer, secondCreator] = accounts;
	let ThalesDeployed,
		ThalesFeeDeployed,
		StakingThalesDeployed,
		EscrowThalesDeployed,
		OngoingAirdropDeployed,
        ProxyEscrowDeployed,
        ProxyStakingDeployed;

    let initializeStalkingData,
        initializeEscrowData;

    let EscrowImplementation,
        StakingImplementation;
    
	let EscrowImplementationV2,
        StakingImplementationV2;
	let StakingThalesDeployedV2,
		EscrowThalesDeployedV2;

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
	let sUSDSynth, binaryOptionMarketMastercopy, binaryOptionMastercopy;

	describe('Deploy ProxyStaking Thales', () => {
		it('deploy all Contracts', async () => {
			let Thales = artifacts.require('Thales');
            let EscrowThales = artifacts.require('EscrowThales');
            let StakingThales = artifacts.require('StakingThales');
            let OngoingAirdrop = artifacts.require('OngoingAirdrop');
            let OwnedUpgradeabilityProxy = artifacts.require('OwnedUpgradeabilityProxy');
            ThalesDeployed = await Thales.new({ from: owner });
            ThalesFeeDeployed = await Thales.new({ from: owner });
            OngoingAirdropDeployed = await OngoingAirdrop.new(
                owner,
                ThalesDeployed.address,
                toBytes32('random'),
                { from: owner }
            );
            
            ProxyEscrowDeployed = await OwnedUpgradeabilityProxy.new({ from: initialCreator });
            ProxyStakingDeployed = await OwnedUpgradeabilityProxy.new({ from: initialCreator });
            EscrowImplementation = await EscrowThales.new({from:owner});
            StakingImplementation = await StakingThales.new({from:owner});
            EscrowThalesDeployed = await EscrowThales.at(ProxyEscrowDeployed.address);
            StakingThalesDeployed = await StakingThales.at(ProxyStakingDeployed.address);

            initializeEscrowData = encodeCall(
                'initialize',
                ['address', 'address'],
                [
                    owner,
                    ThalesDeployed.address
                ]
            );
            await ProxyEscrowDeployed.upgradeToAndCall(EscrowImplementation.address, initializeEscrowData, {
                from: initialCreator,
            });

            
            initializeStalkingData = encodeCall(
                'initialize',
                ['address', 'address', 'address', 'address', 'uint256', 'uint256'],
                [
                    owner,
                    EscrowThalesDeployed.address,
                    ThalesDeployed.address,
                    sUSDSynth.address,
                    WEEK,
                    WEEK
                ]
            );

            await ProxyStakingDeployed.upgradeToAndCall(StakingImplementation.address, initializeStalkingData, {
                from: initialCreator,
            });

		});
	});

	before(async () => {
		({
			BinaryOptionMarketManager: manager,
			BinaryOptionMarketFactory: factory,
			BinaryOptionMarketMastercopy: binaryOptionMarketMastercopy,
			BinaryOptionMastercopy: binaryOptionMastercopy,
			AddressResolver: addressResolver,
			SynthsUSD: sUSDSynth,
		} = await setupAllContracts({
			accounts,
			synths: ['sUSD'],
			contracts: [
				'FeePool',
				'BinaryOptionMarketMastercopy',
				'BinaryOptionMastercopy',
				'BinaryOptionMarketFactory',
			],
		}));

		const [creatorSigner, ownerSigner] = await ethers.getSigners();

		await manager.connect(creatorSigner).setBinaryOptionsMarketFactory(factory.address);

		await factory.connect(ownerSigner).setBinaryOptionMarketManager(manager.address);
		await factory.connect(ownerSigner).setBinaryOptionMarketMastercopy(binaryOptionMarketMastercopy.address);
		await factory.connect(ownerSigner).setBinaryOptionMastercopy(binaryOptionMastercopy.address);

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
        let OwnedUpgradeabilityProxy = artifacts.require('OwnedUpgradeabilityProxy');
		ThalesDeployed = await Thales.new({ from: owner });
		ThalesFeeDeployed = await Thales.new({ from: owner });
		OngoingAirdropDeployed = await OngoingAirdrop.new(
			owner,
			ThalesDeployed.address,
			toBytes32('random'),
			{ from: owner }
		);
        
        ProxyEscrowDeployed = await OwnedUpgradeabilityProxy.new({ from: initialCreator });
        ProxyStakingDeployed = await OwnedUpgradeabilityProxy.new({ from: initialCreator });
        EscrowImplementation = await EscrowThales.new({from:owner});
        StakingImplementation = await StakingThales.new({from:owner});
        EscrowThalesDeployed = await EscrowThales.at(ProxyEscrowDeployed.address);
        StakingThalesDeployed = await StakingThales.at(ProxyStakingDeployed.address);

        initializeEscrowData = encodeCall(
			'initialize',
			['address', 'address'],
			[
				owner,
				ThalesDeployed.address
			]
		);
        await ProxyEscrowDeployed.upgradeToAndCall(EscrowImplementation.address, initializeEscrowData, {
            from: initialCreator,
        });

		
        initializeStalkingData = encodeCall(
			'initialize',
			['address', 'address', 'address', 'address', 'uint256', 'uint256'],
			[
				owner,
                EscrowThalesDeployed.address,
                ThalesDeployed.address,
                sUSDSynth.address,
                WEEK,
                WEEK
			]
		);

        await ProxyStakingDeployed.upgradeToAndCall(StakingImplementation.address, initializeStalkingData, {
            from: initialCreator,
        });

		
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
			answer = await StakingThalesDeployed.getRewardsAvailable(first);
			assert.equal(answer, 0);
			answer = await StakingThalesDeployed.getRewardFeesAvailable(first);
			assert.equal(answer, 0);
		});

		it('Deposit funds to the StakingThales', async () => {
			// await StakingThalesDeployed.depositRewards(10, { from: owner });
			let deposit = toUnit(10);
			await ThalesDeployed.transfer(StakingThalesDeployed.address, deposit, { from: owner });
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

		it('Close staking period with low funds (99,999) in StakingThales and claim single user', async () => {
			let deposit = toUnit(100000);
			let lowerDeposit = toUnit(500);
			await ThalesDeployed.transfer(first, toUnit(2), { from: owner });
			await StakingThalesDeployed.setFixedPeriodReward(deposit, { from: owner });
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
				'Staking period has not started'
			);
			await ThalesDeployed.transfer(StakingThalesDeployed.address, lowerDeposit, { from: owner });
			await StakingThalesDeployed.startStakingPeriod({ from: owner });
			await ThalesDeployed.approve(StakingThalesDeployed.address, toUnit(1), { from: first });
			await StakingThalesDeployed.stake(toUnit(1), { from: first });
			await fastForward(WEEK + SECOND);
			await StakingThalesDeployed.closePeriod({ from: second });
			let answer = await StakingThalesDeployed.getRewardsAvailable(first);
			expect(StakingThalesDeployed.claimReward({ from: first })).to.be.revertedWith(
				'SafeERC20: low-level call failed'
			);
		});

		it('Close staking period with enough funds (100,000) in StakingThales and claim single user', async () => {
			let deposit = toUnit(100000);
			let lowerDeposit = toUnit(500);
			await ThalesDeployed.transfer(first, toUnit(2), { from: owner });
			await StakingThalesDeployed.setFixedPeriodReward(deposit, { from: owner });
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await sUSDSynth.issue(initialCreator, deposit);
			await sUSDSynth.transfer(StakingThalesDeployed.address, deposit, { from: initialCreator });
			await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
				'Staking period has not started'
			);
			await ThalesDeployed.transfer(StakingThalesDeployed.address, deposit, { from: owner });
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
			// expect(StakingThalesDeployed.claimReward({from:first})).to.be.revertedWith(
			// 	"SafeERC20: low-level call failed"
			// );
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
			await ThalesDeployed.transfer(StakingThalesDeployed.address, fixedReward, {
				from: owner,
			});
			// await StakingThalesDeployed.depositRewards(70001, { from: owner });
			await ThalesDeployed.approve(StakingThalesDeployed.address, stake, { from: first });
			await StakingThalesDeployed.stake(stake, { from: first });
			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.bnEqual(answer, stake);
		});

		it('Stake with first account and claim reward (but no fees available)', async () => {
			let deposit = toUnit(100000);
			let lowerDeposit = toUnit(500);
			let stake = toUnit(1500);
			await ThalesDeployed.transfer(first, stake, { from: owner });
			await StakingThalesDeployed.setFixedPeriodReward(deposit, { from: owner });
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			// await sUSDSynth.issue(initialCreator, deposit);
			// await sUSDSynth.transfer(StakingThalesDeployed.address, deposit, { from: initialCreator });
			let answer = await StakingThalesDeployed.getContractFeeFunds();
			assert.bnEqual(answer, 0);
			await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
				'Staking period has not started'
			);
			await ThalesDeployed.transfer(StakingThalesDeployed.address, deposit, { from: owner });
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
			let lowerDeposit = toUnit(500);
			let stake = toUnit(1500);
			await ThalesDeployed.transfer(first, stake, { from: owner });
			await StakingThalesDeployed.setFixedPeriodReward(deposit, { from: owner });
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
			await ThalesDeployed.transfer(StakingThalesDeployed.address, deposit, { from: owner });
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
			await StakingThalesDeployed.setFixedPeriodReward(deposit, { from: owner });
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
			await ThalesDeployed.transfer(StakingThalesDeployed.address, deposit, { from: owner });
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
			await ThalesDeployed.transfer(StakingThalesDeployed.address, deposit, { from: owner });
			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.bnEqual(answer, stake);
			answer = await StakingThalesDeployed.startUnstake(stake, { from: first });
			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.bnEqual(answer, 0);

			// answer = await ThalesDeployed.balanceOf.call(first);
			// console.log('First account Thales balance: ' + web3.utils.toDecimal(answer));
		});
		it('Stake, claim reward twice, then (claim at) unstake', async () => {
			let deposit = toUnit(100000);
			let lowerDeposit = toUnit(500);
			let stake = toUnit(1500);
			await ThalesDeployed.transfer(first, stake, { from: owner });
			await StakingThalesDeployed.setFixedPeriodReward(deposit, { from: owner });
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
			await ThalesDeployed.transfer(StakingThalesDeployed.address, deposit, { from: owner });
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
			await ThalesDeployed.transfer(StakingThalesDeployed.address, deposit, { from: owner });
			await StakingThalesDeployed.claimReward({ from: first });
			await fastForward(WEEK + SECOND);
			await StakingThalesDeployed.closePeriod({ from: second });
			answer2 = await EscrowThalesDeployed.getStakedEscrowedBalanceForRewards(first);
			assert.bnEqual(answer.mul(toBN(2)), answer2);
			// CLAIM 3
			expect(StakingThalesDeployed.startUnstake(stake, { from: first })).to.be.revertedWith(
				'SafeERC20: low-level call failed'
			);
			await ThalesDeployed.transfer(StakingThalesDeployed.address, deposit, { from: owner });
			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.bnEqual(answer, stake);
			answer = await StakingThalesDeployed.startUnstake(stake, { from: first });
			answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
			assert.bnEqual(answer, 0);
		});
	});
	describe('Vesting:', () => {
		it('Claimable', async () => {
			let deposit = toUnit(100000);
			let lowerDeposit = toUnit(500);
			let stake = toUnit(1500);
			let weeks = 10;
			await ThalesDeployed.transfer(first, stake, { from: owner });
			await StakingThalesDeployed.setFixedPeriodReward(deposit, { from: owner });
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
			await ThalesDeployed.transfer(StakingThalesDeployed.address, deposit.mul(toBN(weeks + 1)), {
				from: owner,
			});
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
			assert.bnEqual(answer, 0);
			// 11th week
			await fastForward(WEEK + SECOND);
			await StakingThalesDeployed.closePeriod({ from: second });
			answer = await EscrowThalesDeployed.claimable(first);
			assert.bnEqual(answer, deposit);
		});

		it('Vest first user', async () => {
			let deposit = toUnit(100000);
			let lowerDeposit = toUnit(500);
			let stake = toUnit(1500);
			let weeks = 11;
			await ThalesDeployed.transfer(first, stake, { from: owner });
			await StakingThalesDeployed.setFixedPeriodReward(deposit, { from: owner });
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await sUSDSynth.issue(initialCreator, deposit.mul(toBN(weeks)));
			await sUSDSynth.transfer(StakingThalesDeployed.address, deposit.mul(toBN(weeks)), {
				from: initialCreator,
			});
			await ThalesDeployed.transfer(StakingThalesDeployed.address, deposit.mul(toBN(weeks)), {
				from: owner,
			});
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
			assert.bnEqual(answer, deposit);
			await EscrowThalesDeployed.vest(deposit, { from: first });
			answer = await ThalesDeployed.balanceOf(first);
			assert.bnEqual(answer, deposit);
		});

		it('Staking & vesting with 2 users', async () => {
			let deposit = toUnit(100000);
			let stake = [toUnit(1500), toUnit(1500)];
			let users = [first, second];
			let weeks = 11;

			await StakingThalesDeployed.setFixedPeriodReward(deposit, { from: owner });
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await sUSDSynth.issue(initialCreator, deposit.mul(toBN(weeks)));
			await sUSDSynth.transfer(StakingThalesDeployed.address, deposit.mul(toBN(weeks)), {
				from: initialCreator,
			});
			await ThalesDeployed.transfer(StakingThalesDeployed.address, deposit.mul(toBN(weeks)), {
				from: owner,
			});
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
				assert.bnEqual(answer, deposit.div(toBN(users.length)));
				await EscrowThalesDeployed.vest(deposit.div(toBN(users.length)), { from: users[i] });
				answer = await ThalesDeployed.balanceOf(users[i]);
				assert.bnEqual(answer, deposit.div(toBN(users.length)));
			}
		});

		it('Staking & vesting with 3 users', async () => {
			let deposit = toUnit(100000);
			let stake = [toUnit(1500), toUnit(1500), toUnit(1500)];
			let users = [first, second, third];
			let weeks = 11;

			await StakingThalesDeployed.setFixedPeriodReward(deposit, { from: owner });
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await sUSDSynth.issue(initialCreator, deposit.mul(toBN(weeks)));
			await sUSDSynth.transfer(StakingThalesDeployed.address, deposit.mul(toBN(weeks)), {
				from: initialCreator,
			});
			await ThalesDeployed.transfer(StakingThalesDeployed.address, deposit.mul(toBN(weeks)), {
				from: owner,
			});
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
				assert.bnEqual(answer, deposit.div(toBN(users.length)));
				await EscrowThalesDeployed.vest(deposit.div(toBN(users.length)), { from: users[i] });
				answer = await ThalesDeployed.balanceOf(users[i]);
				assert.bnEqual(answer, deposit.div(toBN(users.length)));
			}
		});

		it('Vesting at 19th week, after claiming first user in weeks: 5, 9, 13', async () => {
			let periods = [5, 9, 13];
			let deposit = toUnit(100000);
			let lowerDeposit = toUnit(500);
			let stake = toUnit(1500);
			let weeks = 20;
			await ThalesDeployed.transfer(first, stake, { from: owner });
			await StakingThalesDeployed.setFixedPeriodReward(deposit, { from: owner });
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await sUSDSynth.issue(initialCreator, deposit.mul(toBN(weeks)));
			await sUSDSynth.transfer(StakingThalesDeployed.address, deposit.mul(toBN(weeks)), {
				from: initialCreator,
			});
			await ThalesDeployed.transfer(StakingThalesDeployed.address, deposit.mul(toBN(weeks)), {
				from: owner,
			});
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
			assert.bnEqual(answer, deposit);
			await EscrowThalesDeployed.vest(deposit, { from: first });
			answer = await ThalesDeployed.balanceOf(first);
			assert.bnEqual(answer, deposit);
		});

		it('Vesting at 20th week, after claiming first user in weeks: 5, 9, 13', async () => {
			let periods = [5, 9, 13];
			let deposit = toUnit(100000);
			let lowerDeposit = toUnit(500);
			let stake = toUnit(1500);
			let weeks = 21;
			await ThalesDeployed.transfer(first, stake, { from: owner });
			await StakingThalesDeployed.setFixedPeriodReward(deposit, { from: owner });
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await sUSDSynth.issue(initialCreator, deposit.mul(toBN(weeks)));
			await sUSDSynth.transfer(StakingThalesDeployed.address, deposit.mul(toBN(weeks)), {
				from: initialCreator,
			});
			await ThalesDeployed.transfer(StakingThalesDeployed.address, deposit.mul(toBN(weeks)), {
				from: owner,
			});
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

		it('Continous vesting trial for 35 weeks; first user claims rewards in 2, 21, 31 weeks', async () => {
			let periods = [1, 20, 30];
			let deposit = toUnit(100000);
			let lowerDeposit = toUnit(500);
			let stake = toUnit(1500);
			let weeks = 35;
			await ThalesDeployed.transfer(first, stake, { from: owner });
			await StakingThalesDeployed.setFixedPeriodReward(deposit, { from: owner });
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await sUSDSynth.issue(initialCreator, deposit.mul(toBN(weeks)));
			await sUSDSynth.transfer(StakingThalesDeployed.address, deposit.mul(toBN(weeks)), {
				from: initialCreator,
			});
			await ThalesDeployed.transfer(StakingThalesDeployed.address, deposit.mul(toBN(weeks)), {
				from: owner,
			});
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

		it('Staking 2 users 1500 stake, vest all on week 11, unstake with one user 1499, vest again', async () => {
			let deposit = toUnit(100000);
			let stake = [toUnit(1500), toUnit(1500)];
			let users = [first, second];
			let weeks = 22;
			let unstakeAmount = toUnit(1499);

			await StakingThalesDeployed.setFixedPeriodReward(deposit, { from: owner });
			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});
			await sUSDSynth.issue(initialCreator, deposit.mul(toBN(weeks)));
			await sUSDSynth.transfer(StakingThalesDeployed.address, deposit.mul(toBN(weeks)), {
				from: initialCreator,
			});
			await ThalesDeployed.transfer(StakingThalesDeployed.address, deposit.mul(toBN(weeks)), {
				from: owner,
			});
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
			console.log(
				'period:',
				period,
				'| claimable U1:',
				answer.toString(),
				'| claimable U2:',
				answer2.toString()
			);
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

	describe('Upgrade Implementation:', () => {
		
		it('reverts the call of new function at old implementation', async function() {
			try{
				await expect(StakingThalesDeployed.getVersion()).to.be.reverted;

			}
			catch(error) {
				// console.log("Error function does not exist");
			}
		
		});
		beforeEach(async () => {
			
			let EscrowThalesV2 = artifacts.require('ProxyEscrowThales_V2');
			let StakingThalesV2 = artifacts.require('ProxyStakingThales_V2');
			
			
			
			EscrowImplementationV2 = await EscrowThalesV2.new({from:owner});
			StakingImplementationV2 = await StakingThalesV2.new({from:owner});
			
			EscrowThalesDeployedV2 = await EscrowThalesV2.at(ProxyEscrowDeployed.address);
			StakingThalesDeployedV2 = await StakingThalesV2.at(ProxyStakingDeployed.address);
	
			
	
			await ProxyStakingDeployed.upgradeTo(StakingImplementationV2.address,{
				from: initialCreator,
			});
	
			await ProxyEscrowDeployed.upgradeTo(EscrowImplementationV2.address, {
				from: initialCreator,
			});

		});

		it('calls new function of new implementation', async function() {
			let tx = await StakingThalesDeployedV2.getVersion();
			assert.equal(tx.toString(), '0');
			tx = await EscrowThalesDeployedV2.getVersion();
			assert.equal(tx.toString(), '0');
		});
		it('set new value in new function of new implementation', async function() {
			let tx = await StakingThalesDeployedV2.setVersion(1, {from:owner});
			tx = await StakingThalesDeployedV2.getVersion();
			assert.equal(tx.toString(), '1');
			tx = await EscrowThalesDeployedV2.setVersion(10, {from:owner});
			tx = await EscrowThalesDeployedV2.getVersion();
			assert.equal(tx.toString(), '10');
		});
		
		it('set new value in new function of new implementation different owner', async function() {
			await expect(StakingThalesDeployedV2.setVersion(1, {from:initialCreator})).to.be.reverted;
			await expect(EscrowThalesDeployedV2.setVersion(10, {from:initialCreator})).to.be.reverted;
			
		});
	
	});
});
