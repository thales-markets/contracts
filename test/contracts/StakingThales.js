'use strict';

const { artifacts, contract, web3 } = require('hardhat');
const { toBN, fromBN } = web3.utils;

const { assert, addSnapshotBeforeRestoreAfterEach } = require('./common');

const { toBytes32 } = require('../..');
const { expect } = require('chai');
const { toDecimal } = require('web3-utils');
const { ethers } = require('ethers');



const ZERO_ADDRESS = '0x' + '0'.repeat(40);

const {
	fastForward,
	toUnit,
	currentTime,
	multiplyDecimalRound,
	divideDecimalRound,
} = require('../utils')();

contract('StakingThales', accounts => {
	const [first, second, third, owner] = accounts;
    let ThalesDeployed, StakingThalesDeployed, EscrowThalesDeployed;

    const SECOND = 1000;
	const DAY = 86400;
	const WEEK = 604800;
	const YEAR = 31556926;

    
	describe('Deploy Staking Thales', () => {
        it('deploy all Contracts', async () => {
            let Thales = artifacts.require('Thales');
            let EscrowThales = artifacts.require('EscrowThales');
            let StakingThales = artifacts.require('StakingThales');
            ThalesDeployed = await Thales.new({from: owner});
            EscrowThalesDeployed = await EscrowThales.new(
                owner,
                ThalesDeployed.address,
                owner,
                {from: owner}
                );
                
            StakingThalesDeployed = await StakingThales.new(
                owner,
                EscrowThalesDeployed.address,
                ThalesDeployed.address,
                first,
                {from: owner}
                );
            });
                
    });

    beforeEach(async () => {
        let Thales = artifacts.require('Thales');
        let EscrowThales = artifacts.require('EscrowThales');
        let StakingThales = artifacts.require('StakingThales');
        ThalesDeployed = await Thales.new({from: owner});
        EscrowThalesDeployed = await EscrowThales.new(
            owner,
            ThalesDeployed.address,
            owner,
            {from: owner}
            );
            
            StakingThalesDeployed = await StakingThales.new(
                owner,
                EscrowThalesDeployed.address,
                ThalesDeployed.address,
                ThalesDeployed.address,
                {from: owner}
                );
    });
            
    
    
    describe('EscrowThales basic check', () => {
        it('get if StakingThales address in EscrowThales is equal to owner', async () => {
            let getStakingAddress = await EscrowThalesDeployed.getStakingThalesContract.call({from:owner});
            // console.log("Staking Thaless address: " + getStakingAddress);
            // console.log("Owner address: " + owner);
            assert.equal(owner, getStakingAddress);
            
		});
		
        it('set StakingThales address in EscrowThales to the actual contract ', async () => {
            let setStakingAddress = await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address,{from:owner});
            let getStakingAddress = await EscrowThalesDeployed.getStakingThalesContract.call({from:owner});
            // console.log("NEW Staking Thaless address: " + getStakingAddress);
            // console.log("StakingThalesDeployed address: " + StakingThalesDeployed.address);
            assert.equal(StakingThalesDeployed.address, getStakingAddress);
		});
        
        it('get if CurrentStakingWeek is 0', async () => {
            let stakingWeek = await EscrowThalesDeployed.getCurrentWeek.call({from:owner});
            assert.equal(0, stakingWeek);
		});
        it('set CurrentStakingWeek to 20 and check', async () => {
            let setStakingAddress = await EscrowThalesDeployed.setStakingThalesContract(first,{from:owner});
            let getStakingAddress = await EscrowThalesDeployed.getStakingThalesContract.call({from:owner});
            assert.equal(first, getStakingAddress);

            let setWeek = await EscrowThalesDeployed.updateCurrentWeek("20",{from:first});
            let stakingWeek = await EscrowThalesDeployed.getCurrentWeek.call();
            assert.equal(20, stakingWeek);
		});
        
        it('check claimable function', async () => {
            let answer = await EscrowThalesDeployed.claimable.call(second);
            assert.equal(answer, 0)
		});

        it('check ZERO address usage for external functions', async () => {
            await expect(EscrowThalesDeployed.claimable.call(ZERO_ADDRESS)).to.be.revertedWith("Invalid address");
            await expect(EscrowThalesDeployed.addToEscrow(ZERO_ADDRESS,0)).to.be.revertedWith("Invalid address");
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
            answer = await StakingThalesDeployed.getContractRewardFunds.call({from:owner});
            assert.equal(answer, 0);
            answer = await StakingThalesDeployed.getContractFeeFunds.call({from:owner});
            assert.equal(answer, 0);
            await expect(StakingThalesDeployed.getRewardsAvailable.call(first)).to.be.revertedWith("Account is not a staker");
            await expect(StakingThalesDeployed.getRewardFeesAvailable.call(first)).to.be.revertedWith("Account is not a staker");
            
		});
		
        it('Deposit funds to the StakingThales', async () => {
            await StakingThalesDeployed.depositRewards(10, {from:owner});
            await StakingThalesDeployed.depositFees(10, {from:owner});
            let answer = await StakingThalesDeployed.getContractRewardFunds.call({from:owner});
            assert.equal(answer, 10);
            answer = await StakingThalesDeployed.getContractFeeFunds.call({from:owner});
            assert.equal(answer, 10);

		});

        it('Start staking period', async () => {
            // console.log(toDecimal(await StakingThalesDeployed.startTime.call()));
            assert.equal(toDecimal(await StakingThalesDeployed.startTime.call()), 0);
            let answer = await StakingThalesDeployed.startStakingPeriod({from:owner});
            assert.isAbove(toDecimal(await StakingThalesDeployed.startTime.call()), 0);
            assert.equal(toDecimal(await StakingThalesDeployed.startTime.call()), toDecimal(await StakingThalesDeployed.lastPeriod.call()));
            // console.log(toDecimal(await StakingThalesDeployed.startTime.call()));
            
		});
        
        it('Close staking period before 1)staking started and 2) before a week passes', async () => {
            await expect(StakingThalesDeployed.closePeriod({from:owner})).to.be.revertedWith("Staking period has not started");
            let answer = await StakingThalesDeployed.startStakingPeriod({from:owner});
            fastForward(3*DAY);
            await expect(StakingThalesDeployed.closePeriod({from:owner})).to.be.revertedWith("7 days has not passed since the last closed period");
		});

        
        it('Close staking period after week without funds in StakingThales', async () => {
            // const [ETHfund] = await ethers.getSigners();
            // await web3.sendTransaction({from:owner, to:StakingThalesDeployed.address, value: web3.utils.toWei("10")});
            // const transactionHash = await ETHfund.sendTransaction({to:StakingThalesDeployed.address, value: ethers.utils.parseEther("1.0")});
            await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address,{from:owner});
            await expect(StakingThalesDeployed.closePeriod({from:first})).to.be.revertedWith("Staking period has not started");
            let answer = await StakingThalesDeployed.startStakingPeriod({from:owner});
            fastForward(WEEK+SECOND);
            await expect(StakingThalesDeployed.closePeriod({from:second})).to.be.revertedWith("Low THALES balance in the Smart-contract");
            // answer = await StakingThalesDeployed.closePeriod({from:owner});
            // assert.isAbove(toDecimal(await StakingThalesDeployed.lastPeriod.call()), WEEK);

		});

        it('Stake with first and second account', async () => {
            // console.log(toDecimal(await StakingThalesDeployed.startTime.call()));
            // assert.equal(toDecimal(await StakingThalesDeployed.startTime.call()), 0);
            let answer = await StakingThalesDeployed.startStakingPeriod({from:owner});
            // assert.isAbove(toDecimal(await StakingThalesDeployed.startTime.call()), 0);
            // assert.equal(toDecimal(await StakingThalesDeployed.startTime.call()), toDecimal(await StakingThalesDeployed.lastPeriod.call()));
            // console.log(toDecimal(await StakingThalesDeployed.startTime.call()));

		});
	});

    describe('Staking:', () => {
        it('Close staking period after week without funds in StakingThales', async () => {
            await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address,{from:owner});
            await expect(StakingThalesDeployed.closePeriod({from:first})).to.be.revertedWith("Staking period has not started");
            let answer = await StakingThalesDeployed.startStakingPeriod({from:owner});
            fastForward(WEEK+SECOND);
            await expect(StakingThalesDeployed.closePeriod({from:second})).to.be.revertedWith("Low THALES balance in the Smart-contract");
            // answer = await StakingThalesDeployed.closePeriod({from:owner});
            // assert.isAbove(toDecimal(await StakingThalesDeployed.lastPeriod.call()), WEEK);

		});

        it('Close staking period after week with low funds (69999) in StakingThales', async () => {
            await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address,{from:owner});
            await expect(StakingThalesDeployed.closePeriod({from:first})).to.be.revertedWith("Staking period has not started");
            let answer = await StakingThalesDeployed.startStakingPeriod({from:owner});
            await StakingThalesDeployed.depositRewards(69999, {from:owner});
            fastForward(WEEK+SECOND);
            await expect(StakingThalesDeployed.closePeriod({from:second})).to.be.revertedWith("Low THALES balance in the Smart-contract");
            answer = await StakingThalesDeployed.getContractRewardFunds.call({from:owner});
            assert.equal(answer, 69999);
            // let answer = await StakingThalesDeployed.startStakingPeriod({from:owner});
            // assert.isAbove(toDecimal(await StakingThalesDeployed.startTime.call()), 0);
            // assert.equal(toDecimal(await StakingThalesDeployed.startTime.call()), toDecimal(await StakingThalesDeployed.lastPeriod.call()));
            // console.log(toDecimal(await StakingThalesDeployed.startTime.call()));

		});
        
        it('Close staking period after week with funds (70001) in StakingThales', async () => {
            await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address,{from:owner});
            await expect(StakingThalesDeployed.closePeriod({from:first})).to.be.revertedWith("Staking period has not started");
            let answer = await StakingThalesDeployed.startStakingPeriod({from:owner});
            await StakingThalesDeployed.depositRewards(70001, {from:owner});
            fastForward(WEEK+SECOND);
            await StakingThalesDeployed.closePeriod({from:second});
            answer = await StakingThalesDeployed.getContractRewardFunds.call({from:owner});
            assert.equal(answer, 70001);
            // let answer = await StakingThalesDeployed.startStakingPeriod({from:owner});
            // assert.isAbove(toDecimal(await StakingThalesDeployed.startTime.call()), 0);
            // assert.equal(toDecimal(await StakingThalesDeployed.startTime.call()), toDecimal(await StakingThalesDeployed.lastPeriod.call()));
            // console.log(toDecimal(await StakingThalesDeployed.startTime.call()));

		});
        
        
    });
});
