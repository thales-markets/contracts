'use strict';

const { artifacts, contract, ethers } = require('hardhat');
const { assert } = require('../../utils/common');

const { toBytes32 } = require('../../../index');
const { expect } = require('chai');
const { setupAllContracts } = require('../../utils/setup');

const ZERO_ADDRESS = '0x' + '0'.repeat(40);

const { toUnit } = require('../../utils')();

contract('StakingThales', accounts => {
	const [first, second, third] = accounts;
	const [initialCreator, managerOwner, minter, dummy, exersicer, secondCreator] = accounts;

	let owner, firstSigner;
	let ThalesDeployed,
		ThalesFeeDeployed,
		OngoingAirdropDeployed,
		StakingThalesDeployed,
		EscrowThalesDeployed,
		SNXRewardsDeployed,
		AddressResolverDeployed;

	const sUSDQty = toUnit(5555);
	const WEEK = 604800;
	let manager, factory, addressResolver;
	let sUSDSynth, PositionalMarketMastercopy, PositionMastercopy;
	before(async () => {
		({
			PositionalMarketManager: manager,
			PositionalMarketFactory: factory,
			PositionalMarketMastercopy: PositionalMarketMastercopy,
			PositionMastercopy: PositionMastercopy,
			AddressResolver: addressResolver,
			SynthsUSD: sUSDSynth,
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
		const signers = await ethers.getSigners();
		owner = signers[0];
		firstSigner = signers[1];
		let Thales = artifacts.require('Thales');
		let EscrowThales = await ethers.getContractFactory('EscrowThales');
		let StakingThales = await ethers.getContractFactory('StakingThales');
		let OngoingAirdrop = artifacts.require('OngoingAirdrop');
		let SNXRewards = artifacts.require('SNXRewards');
		ThalesDeployed = await Thales.new({ from: owner.address });
		ThalesFeeDeployed = await Thales.new({ from: owner.address });
		SNXRewardsDeployed = await SNXRewards.new();
		let AddressResolver = artifacts.require('AddressResolverHelper');
		AddressResolverDeployed = await AddressResolver.new();
		await AddressResolverDeployed.setSNXRewardsAddress(SNXRewardsDeployed.address);
		OngoingAirdropDeployed = await OngoingAirdrop.new(
			owner.address,
			ThalesDeployed.address,
			toBytes32('random'),
			{ from: owner.address }
		);

		EscrowThalesDeployed = await upgrades.deployProxy(EscrowThales, [
			owner.address,
			ThalesDeployed.address,
		]);

		StakingThalesDeployed = await upgrades.deployProxy(StakingThales, [
			owner.address,
			EscrowThalesDeployed.address,
			ThalesDeployed.address,
			ThalesFeeDeployed.address,
			WEEK,
			WEEK,
			SNXRewardsDeployed.address,
		]);

		await StakingThalesDeployed.connect(owner).setDistributeFeesEnabled(true);
		await StakingThalesDeployed.connect(owner).setClaimEnabled(true);
		await StakingThalesDeployed.connect(owner).setFixedPeriodReward(100000);
		await StakingThalesDeployed.connect(owner).setAddressResolver(AddressResolverDeployed.address);
	});

	describe('EscrowThales basic check', () => {
		it('get if StakingThales address in EscrowThales is equal to ZERO address', async () => {
			let getStakingAddress = await EscrowThalesDeployed.iStakingThales();
			// console.log("Staking Thaless address: " + getStakingAddress);
			// console.log("Owner address: " + owner);
			assert.equal(ZERO_ADDRESS, getStakingAddress);
		});

		it('set StakingThales address in EscrowThales to the actual contract ', async () => {
			let setStakingAddress = await EscrowThalesDeployed.connect(owner).setStakingThalesContract(
				StakingThalesDeployed.address
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
			let setStakingAddress = await EscrowThalesDeployed.connect(owner).setStakingThalesContract(
				firstSigner.address
			);
			let getStakingAddress = await EscrowThalesDeployed.iStakingThales();
			assert.equal(firstSigner.address, getStakingAddress);

			let setPeriod = await EscrowThalesDeployed.connect(firstSigner).updateCurrentPeriod();
			let stakingPeriod = await EscrowThalesDeployed.currentVestingPeriod.call();
			assert.equal(1, stakingPeriod);
		});

		it('check claimable function', async () => {
			let answer = await EscrowThalesDeployed.claimable(second);
			assert.equal(answer, 0);
		});

		it('check ZERO address usage for external functions', async () => {
			await expect(EscrowThalesDeployed.claimable(ZERO_ADDRESS)).to.be.revertedWith(
				'Invalid address'
			);
			await expect(EscrowThalesDeployed.addToEscrow(ZERO_ADDRESS, 0)).to.be.revertedWith(
				'Invalid address'
			);
		});
	});

	describe('Change ownership:', () => {
		beforeEach(async () => {
			const signers = await ethers.getSigners();
			owner = signers[0];
			firstSigner = signers[1];
		});

		describe('to different ProxyAdmin:', () => {
			// it('Owner not changed, function reverted using Proxy Admin', async function() {
			// 	await upgrades.admin.transferProxyAdminOwnership(firstSigner.address);

			// 	await expect(
			// 		EscrowThalesDeployed.connect(firstSigner).setStakingThalesContract(owner.address)
			// 	).to.be.reverted;
			// });
			it('Owner not changed, function not reverted using old Owner', async function() {
				// console.log("Proxy Admin is: ",firstSigner.address);

				let answer = await EscrowThalesDeployed.connect(owner).owner();
				// console.log("Owner is: ",answer);
				let setStakingAddress = await EscrowThalesDeployed.connect(owner).setStakingThalesContract(
					firstSigner.address
				);
				let getStakingAddress = await EscrowThalesDeployed.iStakingThales();
				assert.equal(firstSigner.address, getStakingAddress);
			});
			it('Owner changed, function not reverted', async function() {
				// console.log("Proxy Admin is: ",firstSigner.address);
				let answer = await EscrowThalesDeployed.connect(owner).owner();
				// console.log("Owner is: ",answer);
				await EscrowThalesDeployed.connect(owner).nominateNewOwner(firstSigner.address);
				await EscrowThalesDeployed.connect(firstSigner).acceptOwnership();
				answer = await EscrowThalesDeployed.connect(owner).owner();
				// console.log("New owner is: ",answer);
				let setStakingAddress = await EscrowThalesDeployed.connect(
					firstSigner
				).setStakingThalesContract(owner.address);
				let getStakingAddress = await EscrowThalesDeployed.iStakingThales();
				assert.equal(owner.address, getStakingAddress);
			});
		});
	});
});
