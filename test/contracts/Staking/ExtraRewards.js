'use strict';

const { artifacts, contract, ethers } = require('hardhat');

const { assert } = require('../../utils/common');

const { toBytes32 } = require('../../../index');
const { toWei, fromWei } = require('web3-utils');
const { setupAllContracts } = require('../../utils/setup');

const { fastForward, toUnit, currentTime } = require('../../utils')();

const { convertToDecimals } = require('../../utils/helpers');
const MockAggregator = artifacts.require('MockAggregatorV2V3');

contract('StakingThales', accounts => {
	const [initialCreator, managerOwner, minter, dummy] = accounts;

	let owner, firstSigner, secondSigner;
	let ThalesDeployed,
		ThalesFeeDeployed,
		StakingThalesDeployed,
		OngoingAirdropDeployed,
		EscrowThalesDeployed,
		SNXRewardsDeployed,
		AddressResolverDeployed,
		ThalesRoyaleDeployed;

	const sUSDQty = toUnit(5555);
	const SECOND = 1000;
	const WEEK = 604800;

	let manager, factory, addressResolver;
	let sUSDSynth, PositionalMarketMastercopy, PositionMastercopy, stakeUsed;

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

		const signers = await ethers.getSigners();
		// console.log("num Signers: ", signers.length);
		[owner, firstSigner, secondSigner] = signers;

		aggregatorSNX = await MockAggregator.new({ from: managerOwner });
		await aggregatorSNX.setDecimals('8');

		await manager.connect(owner).setPositionalMarketFactory(factory.address);

		await factory.connect(firstSigner).setPositionalMarketManager(manager.address);
		await factory
			.connect(firstSigner)
			.setPositionalMarketMastercopy(PositionalMarketMastercopy.address);
		await factory.connect(firstSigner).setPositionMastercopy(PositionMastercopy.address);

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
		let AddressResolver = artifacts.require('AddressResolverHelper');
		let ThalesRoyale = artifacts.require('TestThalesRoyale');

		ThalesDeployed = await Thales.new({ from: owner.address });
		ThalesFeeDeployed = await Thales.new({ from: owner.address });
		SNXRewardsDeployed = await SNXRewards.new();
		AddressResolverDeployed = await AddressResolver.new();
		await AddressResolverDeployed.setSNXRewardsAddress(SNXRewardsDeployed.address);
		ThalesRoyaleDeployed = await ThalesRoyale.new();
		OngoingAirdropDeployed = await OngoingAirdrop.new(
			owner.address,
			ThalesDeployed.address,
			toBytes32('random'),
			{ from: owner.address }
		);
		//Price feed setup
		await PriceFeedInstance.connect(firstSigner).addAggregator(SNX, aggregatorSNX.address);
		timestamp = await currentTime();

		await aggregatorSNX.setLatestAnswer(convertToDecimals(newRate, 8), timestamp);

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
		await StakingThalesDeployed.connect(owner).setStakingParameters(true, true, WEEK, WEEK);
		await StakingThalesDeployed.connect(owner).setStakingRewardsParameters(
			toWei('70000', 'ether'),
			toWei('21000', 'ether'),
			false,
			'15',
			'12',
			'3',
			'1',
			'10'
		);
		await StakingThalesDeployed.connect(owner).setAddresses(
			SNXRewardsDeployed.address,
			ThalesRoyaleDeployed.address,
			dummy,
			dummy,
			dummy,
			dummy,
			PriceFeedInstance.address,
			dummy,
			AddressResolverDeployed.address
		);
	});

	describe('Without Extra rewards :', () => {
		beforeEach(async () => {
			let stake = [100, 100];
			let users = [firstSigner, secondSigner];
			let weeks = 11;
			let deposit = 200;

			await StakingThalesDeployed.connect(owner).setStakingRewardsParameters(
				toWei(deposit.toString(), 'ether'),
				toWei('21000', 'ether'),
				false,
				'15',
				'12',
				'3',
				'1',
				'10'
			);
			await EscrowThalesDeployed.connect(owner).setStakingThalesContract(
				StakingThalesDeployed.address
			);
			await sUSDSynth.issue(initialCreator, toWei((deposit * weeks).toString(), 'ether'));
			await sUSDSynth.transfer(
				StakingThalesDeployed.address,
				toWei((deposit * weeks).toString(), 'ether'),
				{
					from: initialCreator,
				}
			);
			await ThalesDeployed.transfer(
				StakingThalesDeployed.address,
				toWei((deposit * weeks).toString(), 'ether'),
				{
					from: owner.address,
				}
			);
			await StakingThalesDeployed.connect(owner).startStakingPeriod();
			for (let i = 0; i < users.length; i++) {
				await ThalesDeployed.transfer(users[i].address, toWei(stake[i].toString(), 'ether'), {
					from: owner.address,
				});
				await ThalesDeployed.approve(
					StakingThalesDeployed.address,
					toWei(stake[i].toString(), 'ether'),
					{ from: users[i].address }
				);
				await StakingThalesDeployed.connect(users[i]).stake(toWei(stake[i].toString(), 'ether'));
			}

			await fastForward(WEEK + SECOND);
			await StakingThalesDeployed.connect(secondSigner).closePeriod();
		});
		it('Claimable rewards, after week of staking', async () => {
			let answer;
			answer = await StakingThalesDeployed.getRewardsAvailable(firstSigner.address);
			assert.equal(answer.toString(), toWei('100', 'ether').toString());
			// console.log("User 1 claimable: ", answer.toString());

			answer = await StakingThalesDeployed.getRewardsAvailable(secondSigner.address);
			assert.equal(answer.toString(), toWei('100', 'ether').toString());
			// console.log("User 2 claimable: ", answer.toString());
		});
	});
	describe('With Extra rewards :', () => {
		beforeEach(async () => {
			let stake = [1, 99];
			let users = [firstSigner, secondSigner];
			let weeks = 11;
			let deposit = 1;
			let answer;
			stakeUsed = stake[0];
			let rewardPerUser = [
				(stake[0] / (stake[0] + stake[1])) * deposit,
				(stake[1] / (stake[0] + stake[1])) * deposit,
			];

			await StakingThalesDeployed.connect(owner).setStakingRewardsParameters(
				toWei(deposit.toString(), 'ether'),
				toWei('21000', 'ether'),
				false,
				'15',
				'12',
				'3',
				'1',
				'10'
			);
			await EscrowThalesDeployed.connect(owner).setStakingThalesContract(
				StakingThalesDeployed.address
			);
			await sUSDSynth.issue(initialCreator, toWei((deposit * weeks).toString(), 'ether'));
			await sUSDSynth.transfer(
				StakingThalesDeployed.address,
				toWei((deposit * weeks).toString(), 'ether'),
				{
					from: initialCreator,
				}
			);
			await ThalesDeployed.transfer(
				StakingThalesDeployed.address,
				toWei((deposit * weeks).toString(), 'ether'),
				{
					from: owner.address,
				}
			);
			await StakingThalesDeployed.connect(owner).startStakingPeriod();
			for (let i = 0; i < users.length; i++) {
				await ThalesDeployed.transfer(users[i].address, toWei(stake[i].toString(), 'ether'), {
					from: owner.address,
				});
				await ThalesDeployed.approve(
					StakingThalesDeployed.address,
					toWei(stake[i].toString(), 'ether'),
					{ from: users[i].address }
				);
				await StakingThalesDeployed.connect(users[i]).stake(toWei(stake[i].toString(), 'ether'));
			}

			await fastForward(WEEK + SECOND);
			await StakingThalesDeployed.connect(secondSigner).closePeriod();
		});
		it('get SNX bonus; cRatio = 0, debt = 7241', async () => {
			let answer;
			let baseReward;
			let result;
			let cRatio = '218420216987802884';
			let debt = '7235152509672315095375';
			let issuanceRatio = '1666666666666666666';
			let targetRatio = (1000 * 100 * 1e18) / 1666666666666666660;
			let finalCratio = (100 * 100 * 1e18) / cRatio;
			let SNXrate = '4797000000000000000';

			await StakingThalesDeployed.connect(owner).setStakingRewardsParameters(
				toWei('70000', 'ether'),
				toWei('21000', 'ether'),
				true,
				'15',
				'12',
				'3',
				'1',
				'10'
			);

			await SNXRewardsDeployed.setCRatio(firstSigner.address, cRatio.toString());
			await SNXRewardsDeployed.setDebtBalance(firstSigner.address, debt.toString());
			await SNXRewardsDeployed.setIssuanceRatio(issuanceRatio.toString());

			answer = await StakingThalesDeployed.connect(firstSigner).getBaseReward(firstSigner.address);
			// console.log("Base reward:", fromWei(answer.toString(), "ether").toString());
			answer = await StakingThalesDeployed.getSNXBonusPercentage(firstSigner.address);
			//console.log("SNX percentage:", answer.toString());

			answer = await StakingThalesDeployed.getSNXBonus(firstSigner.address);
			//console.log("SNX bonus rewards:", fromWei(answer.toString(), "ether").toString());

			answer = await StakingThalesDeployed.getSNXTargetRatio();
			// console.log("Target ratio:", answer.toString());
			// console.log("Calculted Target ratio:", targetRatio.toString());
			answer = await StakingThalesDeployed.getSNXRateForCurrency();
			// console.log("SNX rate:", answer.toString());
			// console.log("Calculated SNX rate:", SNXrate);
			answer = await StakingThalesDeployed.getCRatio(firstSigner.address);
			// console.log("CRatio :", answer.toString());
			// console.log("calcuclated CRatio :", finalCratio.toString());
			answer = await StakingThalesDeployed.getSNXDebt(firstSigner.address);
			// console.log("SNX debt:", answer.toString());
			// console.log("calculated SNX debt:", debt);

			answer = await StakingThalesDeployed.getSNXStaked(firstSigner.address);
			//console.log("\nSNX staked:", fromWei(answer.toString(), "ether").toString());

			result = (finalCratio * finalCratio * debt) / (targetRatio * SNXrate * 10000);
			//console.log("Calculated:", result.toString());

			answer = await StakingThalesDeployed.getTotalBonus(firstSigner.address);
			//console.log("\nTotal Bonus:", fromWei(answer.toString(), "ether").toString());

			answer = await StakingThalesDeployed.getTotalBonusPercentage(firstSigner.address);
			//console.log("\nTotal Bonus Percentage:", fromWei(answer.toString(), "ether").toString());
		});
	});
});
