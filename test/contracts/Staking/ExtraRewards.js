'use strict';

const { artifacts, contract, web3, ethers } = require('hardhat');
const { toBN, fromBN } = web3.utils;

const { assert, addSnapshotBeforeRestoreAfterEach } = require('../../utils/common');

const { toBytes32 } = require('../../../index');
const { expect } = require('chai');
const { toDecimal, toWei, fromWei } = require('web3-utils');
// const { ethers } = require('ethers');
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
    const [first, second, third] = accounts;
	const [initialCreator, managerOwner, minter, dummy, exersicer, secondCreator] = accounts;
    
    let owner, firstSigner, secondSigner;
	let ThalesDeployed,
		ThalesFeeDeployed,
		StakingThalesDeployed,
		EscrowThalesDeployed,
		OngoingAirdropDeployed,
		SNXRewardsDeployed,
		ThalesRoyaleDeployed,
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

		manager.setBinaryOptionsMarketFactory(factory.address, { from: managerOwner });

		factory.setBinaryOptionMarketManager(manager.address, { from: managerOwner });
		factory.setBinaryOptionMarketMastercopy(binaryOptionMarketMastercopy.address, {
			from: managerOwner,
		});
		factory.setBinaryOptionMastercopy(binaryOptionMastercopy.address, { from: managerOwner });

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
        const signers = await ethers.getSigners();
        // console.log("num Signers: ", signers.length);
        [owner, firstSigner, secondSigner] = signers;

		let Thales = artifacts.require('Thales');
        let EscrowThales = await ethers.getContractFactory('EscrowThales');
        let StakingThales = await ethers.getContractFactory('StakingThales');
        let OngoingAirdrop = artifacts.require('OngoingAirdrop');
        let SNXRewards = artifacts.require('SNXRewards');
        let ThalesRoyale = artifacts.require('TestThalesRoyale');
        let OwnedUpgradeabilityProxy = artifacts.require('OwnedUpgradeabilityProxy');
        ThalesDeployed = await Thales.new({ from: owner.address });
        ThalesFeeDeployed = await Thales.new({ from: owner.address });
		SNXRewardsDeployed = await SNXRewards.new();
		ThalesRoyaleDeployed = await ThalesRoyale.new();
        OngoingAirdropDeployed = await OngoingAirdrop.new(
            owner.address,
            ThalesDeployed.address,
            toBytes32('random'),
            { from:  owner.address }
        );
        
        EscrowThalesDeployed = await upgrades.deployProxy(EscrowThales, [
            owner.address,
            ThalesDeployed.address
        ]); 
        
        StakingThalesDeployed = await upgrades.deployProxy(StakingThales, [
            owner.address,
            EscrowThalesDeployed.address,
            ThalesDeployed.address,
            ThalesFeeDeployed.address,
            WEEK,
            WEEK,
			SNXRewardsDeployed.address
        ]); 
       
		await StakingThalesDeployed.connect(owner).setDistributeFeesEnabled(true);
		await StakingThalesDeployed.connect(owner).setClaimEnabled(true);
		await StakingThalesDeployed.connect(owner).setFixedPeriodReward(100000);
		await StakingThalesDeployed.connect(owner).setThalesRoyale(ThalesRoyaleDeployed.address);
	});

	
	describe('Without Extra rewards :', () => {
		beforeEach(async () => {
			await SNXRewardsDeployed.setAccountDebtRatio(firstSigner.address, toWei('99', 'ether'));
			await SNXRewardsDeployed.setAccountDebtRatio(secondSigner.address, toWei('100', 'ether'));
			await SNXRewardsDeployed.setFeesClaimable(firstSigner.address, true);
			await SNXRewardsDeployed.setFeesClaimable(secondSigner.address, false);			
			let stake = [100, 100];
			let users = [firstSigner, secondSigner];
			let weeks = 11;
			let deposit = 200;
			let answer;
	
			await StakingThalesDeployed.connect(owner).setFixedPeriodReward(toWei(deposit.toString(), "ether"));
			await EscrowThalesDeployed.connect(owner).setStakingThalesContract(StakingThalesDeployed.address);
			await sUSDSynth.issue(initialCreator, toWei((deposit*weeks).toString(), "ether"));
			await sUSDSynth.transfer(StakingThalesDeployed.address, toWei((deposit*weeks).toString(), "ether"), {
				from: initialCreator,
			});
			await ThalesDeployed.transfer(StakingThalesDeployed.address, toWei((deposit*weeks).toString(), "ether"), {
				from: owner.address,
			});
			await StakingThalesDeployed.connect(owner).startStakingPeriod();
			for (let i = 0; i < users.length; i++) {
				await ThalesDeployed.transfer(users[i].address, toWei(stake[i].toString(), "ether"), { from: owner.address });
				await ThalesDeployed.approve(StakingThalesDeployed.address, toWei(stake[i].toString(), "ether"), { from: users[i].address });
				await StakingThalesDeployed.connect(users[i]).stake(toWei(stake[i].toString(), "ether"));
			}
	
			await fastForward(WEEK + SECOND);
			await StakingThalesDeployed.connect(secondSigner).closePeriod();

		});
		it('Claimable rewards, after week of staking', async () => {

			let answer;
			answer = await StakingThalesDeployed.connect(firstSigner).getRewardsAvailable(firstSigner.address);
			assert.equal(answer.toString(), toWei('100', 'ether').toString());
			// console.log("User 1 claimable: ", answer.toString());
			
			answer = await StakingThalesDeployed.connect(secondSigner).getRewardsAvailable(secondSigner.address);
			assert.equal(answer.toString(), toWei('100', 'ether').toString());
			// console.log("User 2 claimable: ", answer.toString());

		});
	
	});
	describe('With Extra rewards :', () => {
		let stakeUsed;
		let debtratioUsed;
		let rewardPerUser; 
		
		beforeEach(async () => {
			// await SNXRewardsDeployed.setAccountDebtRatio(firstSigner.address, toWei('100', 'ether'));
			// await SNXRewardsDeployed.setAccountDebtRatio(secondSigner.address, toWei('100', 'ether'));
			// await SNXRewardsDeployed.setFeesClaimable(firstSigner.address, true);
			// await SNXRewardsDeployed.setFeesClaimable(secondSigner.address, false);			
			await SNXRewardsDeployed.setFeesClaimable(firstSigner.address, true);
			let stake = [100, 100];
			let users = [firstSigner, secondSigner];
			let weeks = 11;
			let deposit = 200;
			let answer;
			stakeUsed = stake[0];
			rewardPerUser = [(stake[0]/(stake[0]+stake[1]))*deposit, (stake[1]/(stake[0]+stake[1]))*deposit];

			await StakingThalesDeployed.connect(owner).setFixedPeriodReward(toWei(deposit.toString(), "ether"));
			await EscrowThalesDeployed.connect(owner).setStakingThalesContract(StakingThalesDeployed.address);
			await sUSDSynth.issue(initialCreator, toWei((deposit*weeks).toString(), "ether"));
			await sUSDSynth.transfer(StakingThalesDeployed.address, toWei((deposit*weeks).toString(), "ether"), {
				from: initialCreator,
			});
			await ThalesDeployed.transfer(StakingThalesDeployed.address, toWei((deposit*weeks).toString(), "ether"), {
				from: owner.address,
			});
			await StakingThalesDeployed.connect(owner).startStakingPeriod();
			for (let i = 0; i < users.length; i++) {
				await ThalesDeployed.transfer(users[i].address, toWei(stake[i].toString(), "ether"), { from: owner.address });
				await ThalesDeployed.approve(StakingThalesDeployed.address, toWei(stake[i].toString(), "ether"), { from: users[i].address });
				await StakingThalesDeployed.connect(users[i]).stake(toWei(stake[i].toString(), "ether"));
			}
	
			await fastForward(WEEK + SECOND);
			await StakingThalesDeployed.connect(secondSigner).closePeriod();
			// await StakingThalesDeployed.connect(owner).setExtraRewards(true);

		});
		it('Only SNX extra reward, fees not claimable -> c-ratio high', async () => {
			let answer;
			let baseReward;
			let result;
			answer = await StakingThalesDeployed.connect(firstSigner).getRewardsAvailable(firstSigner.address);
			baseReward = fromWei(answer.toString(), "ether");
			assert.equal(baseReward.toString(), rewardPerUser[0].toString());
			
			await StakingThalesDeployed.connect(owner).setExtraRewards(true);
			await SNXRewardsDeployed.setFeesClaimable(firstSigner.address, false);

			answer = await StakingThalesDeployed.connect(firstSigner).getRewardsAvailable(firstSigner.address);
			assert.equal(fromWei(answer.toString(), "ether").toString(), baseReward.toString());
		});
		it('Only SNX extra reward, debtratio lower than staked', async () => {
			let answer;
			let baseReward;
			let result;
			answer = await StakingThalesDeployed.connect(firstSigner).getRewardsAvailable(firstSigner.address);
			baseReward = fromWei(answer.toString(), "ether");
			assert.equal(baseReward.toString(), rewardPerUser[0].toString());
			// console.log("Base reward:", parseInt(baseReward.toString()));
			debtratioUsed = stakeUsed-1;
			await StakingThalesDeployed.connect(owner).setExtraRewards(true);
			await SNXRewardsDeployed.setAccountDebtRatio(firstSigner.address, toWei(debtratioUsed.toString(), 'ether'));
			
			answer = await StakingThalesDeployed.connect(firstSigner).getRewardsAvailable(firstSigner.address);
			result = Math.floor((100 + (debtratioUsed*15)/parseInt(baseReward.toString())) * parseInt(baseReward.toString()) / 100);
			// console.log("Extra reward:", result);
			assert.equal(fromWei(answer.toString(), "ether").toString(), result.toString());
			// console.log("Claimable rewards (first user): ", fromWei(answer.toString(), "ether"));			
			// answer = await StakingThalesDeployed.connect(secondSigner).getRewardsAvailable(secondSigner.address);
		});
		it('Only SNX extra reward, debtratio equal or higher than staked', async () => {
			let answer;
			let baseReward;
			let result;
			answer = await StakingThalesDeployed.connect(firstSigner).getRewardsAvailable(firstSigner.address);
			baseReward = fromWei(answer.toString(), "ether");
			assert.equal(baseReward.toString(), rewardPerUser[0].toString());			
			await StakingThalesDeployed.connect(owner).setExtraRewards(true);
			debtratioUsed = stakeUsed;
			await SNXRewardsDeployed.setAccountDebtRatio(firstSigner.address, toWei(debtratioUsed.toString(), 'ether'));
			answer = await StakingThalesDeployed.connect(firstSigner).getRewardsAvailable(firstSigner.address);
			result = Math.floor((100 + (debtratioUsed*15)/parseInt(baseReward.toString())) * parseInt(baseReward.toString()) / 100);
			assert.equal(fromWei(answer.toString(), "ether").toString(), result.toString());
		});
		it('Only Royale extra reward', async () => {
			let answer;
			let baseReward;
			let result;
			answer = await StakingThalesDeployed.connect(firstSigner).getRewardsAvailable(firstSigner.address);
			baseReward = fromWei(answer.toString(), "ether");
			assert.equal(baseReward.toString(), rewardPerUser[0].toString());
			// console.log("Reward per user", rewardPerUser[0]);
			await StakingThalesDeployed.connect(owner).setExtraRewards(true);
			
			await SNXRewardsDeployed.setAccountDebtRatio(firstSigner.address, toWei('0', 'ether'));
			answer = await ThalesRoyaleDeployed.hasParticipatedInCurrentOrLastRoyale(firstSigner.address);
			assert.equal(answer, false);
			
			await ThalesRoyaleDeployed.setParticipatedInLastRoyale(true);
			answer = await ThalesRoyaleDeployed.hasParticipatedInCurrentOrLastRoyale(firstSigner.address);
			assert.equal(answer, true);
											
			answer = await StakingThalesDeployed.connect(firstSigner).getRewardsAvailable(firstSigner.address);
			result = Math.floor((103* parseInt(baseReward.toString())) / 100);
			assert.equal(fromWei(answer.toString(), "ether"), result.toString());
		});
		
		it('Only AMM volume extra reward, volume equal to 10x base reward (single period)', async () => {
			let answer;
			let baseReward;
			let result;
			answer = await StakingThalesDeployed.connect(firstSigner).getRewardsAvailable(firstSigner.address);
			baseReward = fromWei(answer.toString(), "ether");
			assert.equal(baseReward.toString(), rewardPerUser[0].toString());
			await StakingThalesDeployed.connect(owner).setExtraRewards(true);
			await SNXRewardsDeployed.setAccountDebtRatio(firstSigner.address, toWei('0', 'ether'));
			await StakingThalesDeployed.setThalesAMM(owner.address);
			await StakingThalesDeployed.updateVolume(firstSigner.address, toWei((baseReward*10).toString(), 'ether'))
			
			answer = await StakingThalesDeployed.connect(firstSigner).getRewardsAvailable(firstSigner.address);
			result = Math.floor((112* parseInt(baseReward.toString())) / 100);

			assert.equal(fromWei(answer.toString(), "ether"), result.toString());
			// console.log("Claimable rewards (first user): ", fromWei(answer.toString(), "ether"));
			// console.log("Claimable rewards (first user): ", answer.toString());

		});
		it('Only AMM volume extra reward, volume lower than 10x base reward (single period)', async () => {
			let answer;
			let baseReward;
			let result;
			answer = await StakingThalesDeployed.connect(firstSigner).getRewardsAvailable(firstSigner.address);
			baseReward = fromWei(answer.toString(), "ether");
			assert.equal(baseReward.toString(), rewardPerUser[0].toString());
			await StakingThalesDeployed.connect(owner).setExtraRewards(true);
			await SNXRewardsDeployed.setAccountDebtRatio(firstSigner.address, toWei('0', 'ether'));
			await StakingThalesDeployed.setThalesAMM(owner.address);
			await StakingThalesDeployed.updateVolume(firstSigner.address, toWei(((baseReward-1)*10).toString(), 'ether'))
			
			answer = await StakingThalesDeployed.connect(firstSigner).getRewardsAvailable(firstSigner.address);
			result = 100+Math.floor(12*((baseReward-1)/(4*baseReward)));

			assert.equal(fromWei(answer.toString(), "ether"), result.toString());
			// console.log("Claimable rewards (first user): ", fromWei(answer.toString(), "ether"));
			// console.log("Calculated rewards (first user): ", result.toString());
			// console.log("Claimable rewards (first user): ", answer.toString());

		});
	
	});
});
