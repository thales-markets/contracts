'use strict';

const { artifacts, contract, web3 } = require('hardhat');
const { toBN } = web3.utils;

const { assert, addSnapshotBeforeRestoreAfterEach } = require('./common');

const { toBytes32 } = require('../..');

const {
	fastForward,
	toUnit,
	currentTime,
	multiplyDecimalRound,
	divideDecimalRound,
} = require('../utils')();

contract('StakingThales', accounts => {
	const [first, owner] = accounts;
    let ThalesDeployed, StakingThalesDeployed, EscrowThalesDeployed;

    before(async () => {
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

	describe('Deploy Staking Thales', () => {
		it('deploy all', async () => {

            let ownerBalance = await ThalesDeployed.balanceOf(owner);
            console.log("Owner balance: " + ownerBalance);
            
		});



	});


    describe('EscrowThales check', () => {
		it('get if StakingThales address in EscrowThales is equal to owner', async () => {

            
            let getStakingAddress = await EscrowThalesDeployed.getStakingThalesContract.call({from:owner});
            console.log("Staking Thaless address: " + getStakingAddress);
            console.log("Owner address: " + owner);
            assert.equal(owner, getStakingAddress);
            
		});
		
        it('set StakingThales address in EscrowThales to the actual contract ', async () => {
            
            
            let setStakingAddress = await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address,{from:owner});
            let getStakingAddress = await EscrowThalesDeployed.getStakingThalesContract.call({from:owner});
            console.log("NEW Staking Thaless address: " + getStakingAddress);
            console.log("StakingThalesDeployed address: " + StakingThalesDeployed.address);
            assert.equal(StakingThalesDeployed.address, getStakingAddress);
            
		});

        

	});
});
