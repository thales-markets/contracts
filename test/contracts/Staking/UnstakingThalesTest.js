'use strict';

const { artifacts, contract, web3 } = require('hardhat');
const { toBN, fromBN } = web3.utils;

const { assert, addSnapshotBeforeRestoreAfterEach } = require('../../utils/common');

const { toBytes32 } = require('../../../index');
const { expect } = require('chai');
const { toDecimal } = require('web3-utils');
const { ethers } = require('ethers');
const { setupContract, setupAllContracts } = require('../../utils/setup');

const ZERO_ADDRESS = '0x' + '0'.repeat(40);

const {
	fastForward,
	toUnit,
	currentTime,
	multiplyDecimalRound,
	divideDecimalRound,
} = require('../../utils')();

contract('StakingThales', accounts => {
	const [first, second, third, owner] = accounts;
	const [initialCreator, managerOwner, minter, dummy, exersicer, secondCreator] = accounts;
	let ThalesDeployed,
		ThalesFeeDeployed,
		StakingThalesDeployed,
		EscrowThalesDeployed,
		OngoingAirdropDeployed;

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
	let exchangeRates, oracle, sUSDSynth, binaryOptionMarketMastercopy, binaryOptionMastercopy;

	before(async () => {
		({
			BinaryOptionMarketManager: manager,
			BinaryOptionMarketFactory: factory,
			BinaryOptionMarketMastercopy: binaryOptionMarketMastercopy,
			BinaryOptionMastercopy: binaryOptionMastercopy,
			AddressResolver: addressResolver,
			ExchangeRates: exchangeRates,
			SynthsUSD: sUSDSynth,
		} = await setupAllContracts({
			accounts,
			synths: ['sUSD'],
			contracts: [
				'FeePool',
				'ExchangeRates',
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

		oracle = await exchangeRates.oracle();

		await exchangeRates.updateRates([sAUDKey], [toUnit(5)], await currentTime(), {
			from: oracle,
		});

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

		ThalesDeployed = await Thales.new({ from: owner });
		ThalesFeeDeployed = await Thales.new({ from: owner });
		OngoingAirdropDeployed = await OngoingAirdrop.new(
			owner,
			ThalesDeployed.address,
			toBytes32('random'),
			{ from: owner }
		);
		EscrowThalesDeployed = await EscrowThales.new(owner, ThalesDeployed.address, {
			from: owner,
		});

		StakingThalesDeployed = await StakingThales.new(
			owner,
			EscrowThalesDeployed.address,
			ThalesDeployed.address,
			sUSDSynth.address,
			WEEK,
			WEEK,
			{ from: owner }
		);

		await StakingThalesDeployed.setDistributeFeesEnabled(true, { from: owner });
		await StakingThalesDeployed.setClaimEnabled(true, { from: owner });
		await StakingThalesDeployed.setFixedPeriodReward(100000, { from: owner });
	});

	describe('Unstaking', () => {
		// it('User cant unstake if the cooldown period did not pass', async () => {
		// 	// await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
		// 	// 	'Staking period has not started'
		// 	// );
		//
		// 	await ThalesDeployed.transfer(first, 1500, { from: owner });
		// 	let answer = await StakingThalesDeployed.startStakingPeriod({ from: owner });
		// 	await ThalesDeployed.transfer(StakingThalesDeployed.address, 5500000, {
		// 		from: owner,
		// 	});
		// 	await ThalesFeeDeployed.transfer(StakingThalesDeployed.address, 5555, {
		// 		from: owner,
		// 	});
		// 	await ThalesDeployed.approve(StakingThalesDeployed.address, 1000, { from: first });
		// 	await StakingThalesDeployed.stake(1000, { from: first });
		//
		// 	fastForward(DAY + 5 * SECOND);
		// 	answer = await StakingThalesDeployed.startUnstake(
		// 		(await StakingThalesDeployed.stakedBalanceOf(first)) / 2,
		// 		{ from: first }
		// 	);
		//
		// 	fastForward(DAY + 5 * SECOND);
		//
		// 	await expect(StakingThalesDeployed.unstake({ from: first })).to.be.revertedWith(
		// 		'Cannot unstake yet, cooldown not expired'
		// 	);
		//
		// 	fastForward(WEEK);
		// 	await StakingThalesDeployed.unstake({ from: first });
		//
		// 	let balanceAfterFirstUnstake = await StakingThalesDeployed.stakedBalanceOf(first);
		// 	console.log('Balance after first unstake is ' + balanceAfterFirstUnstake);
		//
		// 	assert.equal(balanceAfterFirstUnstake, 500);
		//
		// 	answer = await StakingThalesDeployed.startUnstake(
		// 		(await StakingThalesDeployed.stakedBalanceOf(first)) / 2,
		// 		{ from: first }
		// 	);
		//
		// 	fastForward(DAY + 5 * SECOND);
		//
		// 	await expect(StakingThalesDeployed.unstake({ from: first })).to.be.revertedWith(
		// 		'Cannot unstake yet, cooldown not expired'
		// 	);
		//
		// 	fastForward(WEEK);
		// 	await StakingThalesDeployed.unstake({ from: first });
		//
		//
		// });

		it('Proper escrow calculation', async () => {
			// await expect(StakingThalesDeployed.closePeriod({ from: first })).to.be.revertedWith(
			// 	'Staking period has not started'
			// );

			await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
				from: owner,
			});

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

			await fastForward(WEEK + 5 * SECOND);
			await StakingThalesDeployed.closePeriod({ from: first });

			let rewardsAvailable = await StakingThalesDeployed.getRewardsAvailable(first);
			console.log('rewards available:' + rewardsAvailable);
			answer = await StakingThalesDeployed.claimReward({ from: first });

			let totalAccountEscrowedAmount = await EscrowThalesDeployed.totalAccountEscrowedAmount(first);
			console.log('totalAccountEscrowedAmount' + totalAccountEscrowedAmount);

			let totalEscrowBalanceNotIncludedInStaking = await EscrowThalesDeployed.totalEscrowBalanceNotIncludedInStaking();
			console.log(
				'totalEscrowBalanceNotIncludedInStaking ' + totalEscrowBalanceNotIncludedInStaking
			);

			let stakedBalanceOf = await StakingThalesDeployed.stakedBalanceOf(first);
			console.log('stakedBalanceOf before' + stakedBalanceOf);

			answer = await StakingThalesDeployed.startUnstake(
				await StakingThalesDeployed.stakedBalanceOf(first),
				{ from: first }
			);

			stakedBalanceOf = await StakingThalesDeployed.stakedBalanceOf(first);
			console.log('stakedBalanceOf after ' + stakedBalanceOf);

			totalEscrowBalanceNotIncludedInStaking = await EscrowThalesDeployed.totalEscrowBalanceNotIncludedInStaking();
			console.log(
				'totalEscrowBalanceNotIncludedInStaking ' + totalEscrowBalanceNotIncludedInStaking
			);

			await fastForward(WEEK + 5 * SECOND);

			answer = await StakingThalesDeployed.unstake({ from: first });

			for (var i = 0; i < 11; i++) {
				await fastForward(WEEK);
				await StakingThalesDeployed.closePeriod({ from: first });
			}

			let answer2 = await EscrowThalesDeployed.claimable.call(first);
			let claimable = web3.utils.toDecimal(answer2);
			console.log('claimable available:' + claimable);

			totalAccountEscrowedAmount = await EscrowThalesDeployed.totalAccountEscrowedAmount(first);
			console.log('totalAccountEscrowedAmount' + totalAccountEscrowedAmount);

			answer = await EscrowThalesDeployed.vest(claimable, { from: first });
		});
	});
});
