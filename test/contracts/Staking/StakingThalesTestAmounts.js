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
		// await StakingThalesDeployed.setFixedPeriodReward(100000, { from: owner });
		await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
			from: owner,
		});
		await StakingThalesDeployed.startStakingPeriod({ from: owner });
	});

	describe('Staking:', () => {
		let weeksOfStakingToTest = 5;
		let userStake = 875;
		let fixedReward = 333;
		let stakedEscrowed = 0;
		it(
			'Single user: stake ' +
				userStake +
				', ' +
				weeksOfStakingToTest +
				' weeks of claiming, fixed reward: ' +
				fixedReward,
			async () => {
				let period = 0;

				await ThalesDeployed.transfer(first, userStake, { from: owner });
				let answer = await ThalesDeployed.balanceOf.call(first);
				assert.equal(answer, userStake);

				// Set amounts in account and StakingThales
				await ThalesDeployed.transfer(
					StakingThalesDeployed.address,
					fixedReward * weeksOfStakingToTest,
					{
						from: owner,
					}
				);

				await sUSDSynth.issue(initialCreator, sUSD);
				await sUSDSynth.transfer(StakingThalesDeployed.address, sUSD, { from: initialCreator });
				answer = await StakingThalesDeployed.fixedPeriodReward.call();
				assert.equal(web3.utils.toDecimal(answer), 0);
				await StakingThalesDeployed.setFixedPeriodReward(fixedReward, { from: owner });
				answer = await StakingThalesDeployed.fixedPeriodReward.call();
				assert.equal(web3.utils.toDecimal(answer), fixedReward);

				answer = await StakingThalesDeployed.getContractRewardFunds.call({ from: owner });
				assert.equal(web3.utils.toDecimal(answer), fixedReward * weeksOfStakingToTest);

				//Staking
				answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
				assert.equal(answer, 0);
				await ThalesDeployed.approve(StakingThalesDeployed.address, userStake, { from: first });
				await StakingThalesDeployed.stake(userStake, { from: first });
				answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
				assert.equal(answer, userStake);

				await expect(StakingThalesDeployed.getRewardsAvailable.call(first)).to.be.revertedWith(
					'Rewards already claimed for last period'
				);

				await fastForward(WEEK + 5 * SECOND);
				answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
				assert.equal(answer, userStake);

				answer = await StakingThalesDeployed.getContractRewardFunds.call({ from: owner });
				assert.equal(web3.utils.toDecimal(answer), userStake + fixedReward * weeksOfStakingToTest);

				answer = await StakingThalesDeployed.periodsOfStaking.call();
				assert.equal(web3.utils.toDecimal(answer), period);

				while (period < weeksOfStakingToTest) {
					await fastForward(WEEK + SECOND);
					await StakingThalesDeployed.closePeriod({ from: second });
					period++;
					answer = await StakingThalesDeployed.periodsOfStaking.call();
					assert.equal(web3.utils.toDecimal(answer), period);

					answer = await StakingThalesDeployed.getRewardsAvailable(first);
					assert.equal(web3.utils.toDecimal(answer), fixedReward);

					await StakingThalesDeployed.claimReward({ from: first });

					answer = await StakingThalesDeployed.getAlreadyClaimedRewards(first);
					assert.equal(web3.utils.toDecimal(answer), period * fixedReward);

					//Check if total Escrowed are equal to AlreadyClaimedRewards
					let answer2 = await EscrowThalesDeployed.getStakedEscrowedBalanceForRewards(first);
					assert.equal(web3.utils.toDecimal(stakedEscrowed), web3.utils.toDecimal(answer2));
					// the claimed rewards from period are compared with StakedEscrowedRewards in period+1
					stakedEscrowed = answer;
				}
			}
		);
		weeksOfStakingToTest = 28;
		userStake = 888;
		fixedReward = 333;
		let partialUnstake = 888;
		it(
			'Single user: stake ' +
				userStake +
				', ' +
				weeksOfStakingToTest +
				' weeks of claiming, fixed reward: ' +
				fixedReward +
				', ustakes: ' +
				partialUnstake,
			async () => {
				let period = 0;

				await ThalesDeployed.transfer(first, userStake, { from: owner });
				let answer = await ThalesDeployed.balanceOf.call(first);
				assert.equal(answer, userStake);

				// Set amounts in account and StakingThales
				await ThalesDeployed.transfer(
					StakingThalesDeployed.address,
					fixedReward * weeksOfStakingToTest,
					{
						from: owner,
					}
				);

				await sUSDSynth.issue(initialCreator, sUSD);
				await sUSDSynth.transfer(StakingThalesDeployed.address, sUSD, { from: initialCreator });
				answer = await StakingThalesDeployed.fixedPeriodReward.call();
				assert.equal(web3.utils.toDecimal(answer), 0);
				await StakingThalesDeployed.setFixedPeriodReward(fixedReward, { from: owner });
				answer = await StakingThalesDeployed.fixedPeriodReward.call();
				assert.equal(web3.utils.toDecimal(answer), fixedReward);

				answer = await StakingThalesDeployed.getContractRewardFunds.call({ from: owner });
				assert.equal(web3.utils.toDecimal(answer), fixedReward * weeksOfStakingToTest);

				//Staking
				answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
				assert.equal(answer, 0);
				await ThalesDeployed.approve(StakingThalesDeployed.address, userStake, { from: first });
				await StakingThalesDeployed.stake(userStake, { from: first });
				answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
				assert.equal(answer, userStake);

				await expect(StakingThalesDeployed.getRewardsAvailable.call(first)).to.be.revertedWith(
					'Rewards already claimed for last period'
				);

				await fastForward(WEEK + 5 * SECOND);
				answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
				assert.equal(answer, userStake);

				answer = await StakingThalesDeployed.getContractRewardFunds.call({ from: owner });
				assert.equal(web3.utils.toDecimal(answer), userStake + fixedReward * weeksOfStakingToTest);

				answer = await StakingThalesDeployed.periodsOfStaking.call();
				assert.equal(web3.utils.toDecimal(answer), period);

				stakedEscrowed = 0;

				while (period < weeksOfStakingToTest) {
					await fastForward(WEEK + SECOND);
					await StakingThalesDeployed.closePeriod({ from: second });
					period++;
					answer = await StakingThalesDeployed.periodsOfStaking.call();
					assert.equal(web3.utils.toDecimal(answer), period);

					answer = await StakingThalesDeployed.getRewardsAvailable(first);
					assert.equal(web3.utils.toDecimal(answer), fixedReward);

					await StakingThalesDeployed.claimReward({ from: first });

					answer = await StakingThalesDeployed.getAlreadyClaimedRewards(first);
					assert.equal(web3.utils.toDecimal(answer), period * fixedReward);

					//Check if total Escrowed are equal to AlreadyClaimedRewards
					let answer2 = await EscrowThalesDeployed.getStakedEscrowedBalanceForRewards(first);
					assert.equal(web3.utils.toDecimal(stakedEscrowed), web3.utils.toDecimal(answer2));
					// the claimed rewards from period are compared with StakedEscrowedRewards in period+1
					stakedEscrowed = answer;
				}

				await fastForward(WEEK + SECOND);
				period++;

				answer = StakingThalesDeployed.startUnstake(partialUnstake, { from: first });
				let unstakeCooldown = period + 7;
				await expect(StakingThalesDeployed.unstake({ from: first })).to.be.revertedWith(
					'Cannot unstake yet, cooldown not expired.'
				);

				await fastForward(WEEK + SECOND);

				answer = await ThalesDeployed.balanceOf(first);
				assert.equal(web3.utils.toDecimal(answer), 0);
				await StakingThalesDeployed.unstake({ from: first });
				answer = await ThalesDeployed.balanceOf(first);
				assert.equal(web3.utils.toDecimal(answer), partialUnstake);
			}
		);

		weeksOfStakingToTest = 78;
		fixedReward = 4563;
		let users = [first, second, third];
		let stakes = [12331, 2121, 32123];
		let partialUnstakes = [3565, 1560, 30463];
		let stakedEscrowedBalances = [0, 0, 0];
		let stakePortions = [0, 0, 0];

		it(
			users.length +
				' users: stakes [' +
				stakes +
				'], ' +
				weeksOfStakingToTest +
				' weeks of claiming, fixed reward: ' +
				fixedReward +
				', ustakes: [' +
				partialUnstakes +
				']',
			async () => {
				let period = 0;

				await ThalesDeployed.transfer(
					StakingThalesDeployed.address,
					fixedReward * weeksOfStakingToTest,
					{
						from: owner,
					}
				);
				await sUSDSynth.issue(initialCreator, sUSD);
				await sUSDSynth.transfer(StakingThalesDeployed.address, sUSD, { from: initialCreator });
				let answer = await StakingThalesDeployed.fixedPeriodReward.call();
				assert.equal(web3.utils.toDecimal(answer), 0);
				await StakingThalesDeployed.setFixedPeriodReward(fixedReward, { from: owner });
				answer = await StakingThalesDeployed.fixedPeriodReward.call();
				assert.equal(web3.utils.toDecimal(answer), fixedReward);

				answer = await StakingThalesDeployed.getContractRewardFunds.call({ from: owner });
				assert.equal(web3.utils.toDecimal(answer), fixedReward * weeksOfStakingToTest);

				for (let i = 0; i < users.length; i++) {
					await ThalesDeployed.transfer(users[i], stakes[i], { from: owner });
					answer = await ThalesDeployed.balanceOf.call(users[i]);
					assert.equal(answer, stakes[i]);

					answer = await StakingThalesDeployed.stakedBalanceOf.call(users[i]);
					assert.equal(answer, 0);
					await ThalesDeployed.approve(StakingThalesDeployed.address, stakes[i], {
						from: users[i],
					});
					await StakingThalesDeployed.stake(stakes[i], { from: users[i] });
					answer = await StakingThalesDeployed.stakedBalanceOf.call(users[i]);
					assert.equal(answer, stakes[i]);

					await expect(StakingThalesDeployed.getRewardsAvailable.call(users[i])).to.be.revertedWith(
						'Rewards already claimed for last period'
					);
				}

				await fastForward(WEEK + 5 * SECOND);
				let totalStaked = 0;
				for (let i = 0; i < users.length; i++) {
					answer = await StakingThalesDeployed.stakedBalanceOf.call(users[i]);
					assert.equal(answer, stakes[i]);
					totalStaked = totalStaked + stakes[i];
				}
				answer = await StakingThalesDeployed.getContractRewardFunds.call({ from: owner });
				assert.equal(
					web3.utils.toDecimal(answer),
					totalStaked + fixedReward * weeksOfStakingToTest
				);

				answer = await StakingThalesDeployed.periodsOfStaking.call();
				assert.equal(web3.utils.toDecimal(answer), period);

				let totalEscrowed = 0;
				let alreadyClaimed = [0, 0, 0];
				for (let i = 0; i < users.length; i++) {
					stakePortions[i] = stakes[i] / totalStaked;
				}
				while (period < weeksOfStakingToTest) {
					await fastForward(WEEK + SECOND);
					await StakingThalesDeployed.closePeriod({ from: second });
					period++;
					answer = await StakingThalesDeployed.periodsOfStaking.call();
					assert.equal(web3.utils.toDecimal(answer), period);
					totalEscrowed = 0;
					for (let i = 0; i < users.length; i++) {
						totalEscrowed = totalEscrowed + web3.utils.toDecimal(stakedEscrowedBalances[i]);
						// console.log("period, total, escrowed: ",period, totalEscrowed, web3.utils.toDecimal(stakedEscrowedBalances[i]));
					}

					for (let i = 0; i < users.length; i++) {
						answer = await StakingThalesDeployed.getRewardsAvailable(users[i]);
						let portion =
							(stakes[i] / totalStaked +
								web3.utils.toDecimal(stakedEscrowedBalances[i]) / totalEscrowed) /
							2;
						if (totalEscrowed == 0) {
							portion = stakes[i] / totalStaked;
						}
						// console.log(period, portion*fixedReward, web3.utils.toDecimal(answer))
						assert.approximately(web3.utils.toDecimal(answer), portion * fixedReward, 2);
						await StakingThalesDeployed.claimReward({ from: users[i] });
						alreadyClaimed[i] += web3.utils.toDecimal(answer);

						answer = await StakingThalesDeployed.getAlreadyClaimedRewards(users[i]);
						assert.approximately(web3.utils.toDecimal(answer), alreadyClaimed[i], 2);

						//Check if total Escrowed are equal to AlreadyClaimedRewards
						let answer2 = await EscrowThalesDeployed.getStakedEscrowedBalanceForRewards(users[i]);
						assert.equal(
							web3.utils.toDecimal(stakedEscrowedBalances[i]),
							web3.utils.toDecimal(answer2)
						);
						// the claimed rewards from period are compared with StakedEscrowedRewards in period+1
						stakedEscrowedBalances[i] = answer;
					}
				}

				await fastForward(WEEK + SECOND);
				period++;
				for (let i = 0; i < users.length; i++) {
					answer = StakingThalesDeployed.startUnstake(partialUnstakes[i], { from: users[i] });

					await expect(StakingThalesDeployed.unstake({ from: users[i] })).to.be.revertedWith(
						'Cannot unstake yet, cooldown not expired.'
					);
				}

				await fastForward(WEEK + SECOND);

				for (let i = 0; i < users.length; i++) {
					answer = await ThalesDeployed.balanceOf(users[i]);
					assert.equal(web3.utils.toDecimal(answer), 0);
					await StakingThalesDeployed.unstake({ from: users[i] });
					answer = await ThalesDeployed.balanceOf(users[i]);
					assert.equal(web3.utils.toDecimal(answer), partialUnstakes[i]);
				}
			}
		);
	});
});
