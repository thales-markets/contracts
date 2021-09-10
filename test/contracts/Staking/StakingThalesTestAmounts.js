'use strict';

const { artifacts, contract, web3 } = require('hardhat');
const { toBN } = web3.utils;

const { assert, addSnapshotBeforeRestoreAfterEach } = require('../../utils/common');

const { toBytes32 } = require('../../../index');
const { expect } = require('chai');
const { toDecimal, fromBN, fromWei } = require('web3-utils');
const { ethers } = require('ethers');
const { setupContract, setupAllContracts } = require('../../utils/setup');

const ZERO_ADDRESS = '0x' + '0'.repeat(40);

const {
	fastForward,
	toUnit,
	fromUnit,
	toPreciseUnit,
	fromPreciseUnit,
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

				await ThalesDeployed.transfer(first, toUnit(userStake), { from: owner });
				let answer = await ThalesDeployed.balanceOf.call(first);
				assert.bnEqual(answer, toUnit(userStake));

				// Set amounts in account and StakingThales
				await ThalesDeployed.transfer(
					StakingThalesDeployed.address,
					toUnit(fixedReward * weeksOfStakingToTest),
					{
						from: owner,
					}
				);

				await sUSDSynth.issue(initialCreator, toUnit(sUSD));
				await sUSDSynth.transfer(StakingThalesDeployed.address, toUnit(sUSD), {
					from: initialCreator,
				});
				answer = await StakingThalesDeployed.fixedPeriodReward.call();
				assert.bnEqual(answer, toUnit(100000));
				await StakingThalesDeployed.setFixedPeriodReward(toUnit(fixedReward), { from: owner });
				answer = await StakingThalesDeployed.fixedPeriodReward.call();
				assert.bnEqual(answer, toUnit(fixedReward));

				answer = await StakingThalesDeployed.getContractRewardFunds.call({ from: owner });
				assert.bnEqual(answer, toUnit(fixedReward * weeksOfStakingToTest));

				//Staking
				answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
				assert.bnEqual(answer, 0);
				await ThalesDeployed.approve(StakingThalesDeployed.address, toUnit(userStake), {
					from: first,
				});
				await StakingThalesDeployed.stake(toUnit(userStake), { from: first });
				answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
				assert.bnEqual(answer, toUnit(userStake));

				answer = await StakingThalesDeployed.getRewardsAvailable(first);
				assert.equal(answer, 0);
				answer = await StakingThalesDeployed.getRewardFeesAvailable(first);
				assert.equal(answer, 0);

				await fastForward(WEEK + 5 * SECOND);
				answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
				assert.bnEqual(answer, toUnit(userStake));

				answer = await StakingThalesDeployed.getContractRewardFunds.call({ from: owner });
				assert.bnEqual(answer, toUnit(userStake + fixedReward * weeksOfStakingToTest));

				answer = await StakingThalesDeployed.periodsOfStaking.call();
				assert.bnEqual(answer, period);

				while (period < weeksOfStakingToTest) {
					await fastForward(WEEK + SECOND);
					await StakingThalesDeployed.closePeriod({ from: second });
					period++;
					answer = await StakingThalesDeployed.periodsOfStaking.call();
					assert.bnEqual(answer, period);

					answer = await StakingThalesDeployed.getRewardsAvailable(first);
					assert.bnEqual(answer, toUnit(fixedReward));

					await StakingThalesDeployed.claimReward({ from: first });

					answer = await StakingThalesDeployed.getAlreadyClaimedRewards(first);
					assert.bnEqual(answer, toUnit(period * fixedReward));

					//Check if total Escrowed are bnEqual to AlreadyClaimedRewards
					let answer2 = await EscrowThalesDeployed.getStakedEscrowedBalanceForRewards(first);
					assert.bnEqual(stakedEscrowed, answer2);
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

				await ThalesDeployed.transfer(first, toUnit(userStake), { from: owner });
				let answer = await ThalesDeployed.balanceOf.call(first);
				assert.bnEqual(answer, toUnit(userStake));

				// Set amounts in account and StakingThales
				await ThalesDeployed.transfer(
					StakingThalesDeployed.address,
					toUnit(fixedReward * weeksOfStakingToTest),
					{
						from: owner,
					}
				);

				await sUSDSynth.issue(initialCreator, toUnit(sUSD));
				await sUSDSynth.transfer(StakingThalesDeployed.address, toUnit(sUSD), {
					from: initialCreator,
				});
				answer = await StakingThalesDeployed.fixedPeriodReward.call();
				assert.bnEqual(answer, toUnit(100000));
				await StakingThalesDeployed.setFixedPeriodReward(toUnit(fixedReward), { from: owner });
				answer = await StakingThalesDeployed.fixedPeriodReward.call();
				assert.bnEqual(answer, toUnit(fixedReward));

				answer = await StakingThalesDeployed.getContractRewardFunds.call({ from: owner });
				assert.bnEqual(answer, toUnit(fixedReward * weeksOfStakingToTest));

				//Staking
				answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
				assert.bnEqual(answer, 0);
				await ThalesDeployed.approve(StakingThalesDeployed.address, toUnit(userStake), {
					from: first,
				});
				await StakingThalesDeployed.stake(toUnit(userStake), { from: first });
				answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
				assert.bnEqual(answer, toUnit(userStake));

				answer = await StakingThalesDeployed.getRewardsAvailable(first);
				assert.equal(answer, 0);
				answer = await StakingThalesDeployed.getRewardFeesAvailable(first);
				assert.equal(answer, 0);

				await fastForward(WEEK + 5 * SECOND);
				answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
				assert.bnEqual(answer, toUnit(userStake));

				answer = await StakingThalesDeployed.getContractRewardFunds.call({ from: owner });
				assert.bnEqual(answer, toUnit(userStake + fixedReward * weeksOfStakingToTest));

				answer = await StakingThalesDeployed.periodsOfStaking.call();
				assert.bnEqual(answer, period);

				stakedEscrowed = 0;

				while (period < weeksOfStakingToTest) {
					await fastForward(WEEK + SECOND);
					await StakingThalesDeployed.closePeriod({ from: second });
					period++;
					answer = await StakingThalesDeployed.periodsOfStaking.call();
					assert.bnEqual(answer, period);

					answer = await StakingThalesDeployed.getRewardsAvailable(first);
					assert.bnEqual(answer, toUnit(fixedReward));

					await StakingThalesDeployed.claimReward({ from: first });

					answer = await StakingThalesDeployed.getAlreadyClaimedRewards(first);
					assert.bnEqual(answer, toUnit(period * fixedReward));

					//Check if total Escrowed are bnEqual to AlreadyClaimedRewards
					let answer2 = await EscrowThalesDeployed.getStakedEscrowedBalanceForRewards(first);
					assert.bnEqual(stakedEscrowed, answer2);
					// the claimed rewards from period are compared with StakedEscrowedRewards in period+1
					stakedEscrowed = answer;
				}

				await fastForward(WEEK + SECOND);
				period++;

				answer = StakingThalesDeployed.startUnstake(toUnit(partialUnstake), { from: first });
				let unstakeCooldown = period + 7;
				await expect(StakingThalesDeployed.unstake({ from: first })).to.be.revertedWith(
					'Cannot unstake yet, cooldown not expired.'
				);

				await fastForward(WEEK + SECOND);

				answer = await ThalesDeployed.balanceOf(first);
				assert.bnEqual(answer, 0);
				await StakingThalesDeployed.unstake({ from: first });
				answer = await ThalesDeployed.balanceOf(first);
				assert.bnEqual(answer, toUnit(partialUnstake));
			}
		);

		weeksOfStakingToTest = 45;
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
					toUnit(fixedReward * weeksOfStakingToTest),
					{
						from: owner,
					}
				);
				await sUSDSynth.issue(initialCreator, sUSD);
				await sUSDSynth.transfer(StakingThalesDeployed.address, sUSD, { from: initialCreator });
				let answer = await StakingThalesDeployed.fixedPeriodReward.call();
				assert.bnEqual(answer, toUnit(100000));
				await StakingThalesDeployed.setFixedPeriodReward(fixedReward, { from: owner });
				answer = await StakingThalesDeployed.fixedPeriodReward.call();
				assert.bnEqual(answer, fixedReward);

				answer = await StakingThalesDeployed.getContractRewardFunds.call({ from: owner });
				assert.bnEqual(answer, toUnit(fixedReward * weeksOfStakingToTest));

				for (let i = 0; i < users.length; i++) {
					await ThalesDeployed.transfer(users[i], toUnit(stakes[i]), { from: owner });
					answer = await ThalesDeployed.balanceOf.call(users[i]);
					assert.bnEqual(answer, toUnit(stakes[i]));

					answer = await StakingThalesDeployed.stakedBalanceOf.call(users[i]);
					assert.bnEqual(answer, 0);
					await ThalesDeployed.approve(StakingThalesDeployed.address, toUnit(stakes[i]), {
						from: users[i],
					});
					await StakingThalesDeployed.stake(toUnit(stakes[i]), { from: users[i] });
					answer = await StakingThalesDeployed.stakedBalanceOf.call(users[i]);
					assert.bnEqual(answer, toUnit(stakes[i]));

					answer = await StakingThalesDeployed.getRewardsAvailable(first);
					assert.equal(answer, 0);
					answer = await StakingThalesDeployed.getRewardFeesAvailable(first);
					assert.equal(answer, 0);
				}

				await fastForward(WEEK + 5 * SECOND);
				let totalStaked = 0;
				for (let i = 0; i < users.length; i++) {
					answer = await StakingThalesDeployed.stakedBalanceOf.call(users[i]);
					assert.bnEqual(answer, toUnit(stakes[i]));
					totalStaked = totalStaked + stakes[i];
				}
				answer = await StakingThalesDeployed.getContractRewardFunds.call({ from: owner });
				assert.bnEqual(answer, toUnit(totalStaked + fixedReward * weeksOfStakingToTest));

				answer = await StakingThalesDeployed.periodsOfStaking.call();
				assert.bnEqual(answer, period);

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
					assert.bnEqual(answer, period);
					totalEscrowed = 0;
					for (let i = 0; i < users.length; i++) {
						totalEscrowed = totalEscrowed + stakedEscrowedBalances[i];
					}

					for (let i = 0; i < users.length; i++) {
						answer = await StakingThalesDeployed.getRewardsAvailable(users[i]);
						let portion = (stakes[i] / totalStaked + stakedEscrowedBalances[i] / totalEscrowed) / 2;
						if (totalEscrowed == 0) {
							portion = stakes[i] / totalStaked;
						}
						// console.log("period|portion: ",period, portion*fixedReward )
						assert.bnEqual(answer, Math.floor(portion * fixedReward));
						await StakingThalesDeployed.claimReward({ from: users[i] });

						alreadyClaimed[i] += Math.floor(portion * fixedReward);
						answer = await StakingThalesDeployed.getAlreadyClaimedRewards(users[i]);
						assert.bnEqual(answer, alreadyClaimed[i]);

						//Check if total Escrowed are bnEqual to AlreadyClaimedRewards
						let answer2 = await EscrowThalesDeployed.getStakedEscrowedBalanceForRewards(users[i]);
						assert.bnEqual(stakedEscrowedBalances[i], answer2);
						stakedEscrowedBalances[i] += Math.floor(portion * fixedReward);
					}
				}

				await fastForward(WEEK + SECOND);
				period++;
				for (let i = 0; i < users.length; i++) {
					answer = StakingThalesDeployed.startUnstake(toUnit(partialUnstakes[i]), {
						from: users[i],
					});

					await expect(StakingThalesDeployed.unstake({ from: users[i] })).to.be.revertedWith(
						'Cannot unstake yet, cooldown not expired.'
					);
				}

				await fastForward(WEEK + SECOND);

				for (let i = 0; i < users.length; i++) {
					answer = await ThalesDeployed.balanceOf(users[i]);
					assert.bnEqual(web3.utils.toDecimal(answer), 0);
					await StakingThalesDeployed.unstake({ from: users[i] });
					answer = await ThalesDeployed.balanceOf(users[i]);
					assert.bnEqual(answer, toUnit(partialUnstakes[i]));
				}
			}
		);
		//4_______________________________________________________________
		weeksOfStakingToTest = 25;
		fixedReward = 24563;
		users = [first, second, third];
		stakes = [2113, 23141, 3214123];
		partialUnstakes = [1241, 15260, 130463];
		stakedEscrowedBalances = [0, 0, 0];
		stakePortions = [0, 0, 0];
		it(
			users.length +
				' users: stakes [' +
				stakes +
				'], ' +
				weeksOfStakingToTest +
				' weeks of claiming, checkClaimable: up to 11th week, fixed reward: ' +
				fixedReward +
				', ustakes: [' +
				partialUnstakes +
				']',
			async () => {
				let period = 0;
				if (weeksOfStakingToTest < 10) {
					console.log('Please put at least 10 weeks of staking for testing');
				} else {
					await ThalesDeployed.transfer(
						StakingThalesDeployed.address,
						toUnit(fixedReward * weeksOfStakingToTest),
						{
							from: owner,
						}
					);
					await sUSDSynth.issue(initialCreator, sUSD);
					await sUSDSynth.transfer(StakingThalesDeployed.address, sUSD, { from: initialCreator });
					let answer = await StakingThalesDeployed.fixedPeriodReward.call();
					assert.bnEqual(answer, toUnit(100000));
					await StakingThalesDeployed.setFixedPeriodReward(fixedReward, { from: owner });
					answer = await StakingThalesDeployed.fixedPeriodReward.call();
					assert.bnEqual(answer, fixedReward);

					answer = await StakingThalesDeployed.getContractRewardFunds.call({ from: owner });
					assert.bnEqual(answer, toUnit(fixedReward * weeksOfStakingToTest));

					for (let i = 0; i < users.length; i++) {
						await ThalesDeployed.transfer(users[i], toUnit(stakes[i]), { from: owner });
						answer = await ThalesDeployed.balanceOf.call(users[i]);
						assert.bnEqual(answer, toUnit(stakes[i]));

						answer = await StakingThalesDeployed.stakedBalanceOf.call(users[i]);
						assert.bnEqual(answer, 0);
						await ThalesDeployed.approve(StakingThalesDeployed.address, toUnit(stakes[i]), {
							from: users[i],
						});
						await StakingThalesDeployed.stake(toUnit(stakes[i]), { from: users[i] });
						answer = await StakingThalesDeployed.stakedBalanceOf.call(users[i]);
						assert.bnEqual(answer, toUnit(stakes[i]));

						answer = await StakingThalesDeployed.getRewardsAvailable(first);
						assert.equal(answer, 0);
						answer = await StakingThalesDeployed.getRewardFeesAvailable(first);
						assert.equal(answer, 0);
					}

					await fastForward(WEEK + 5 * SECOND);
					let totalStaked = 0;
					for (let i = 0; i < users.length; i++) {
						answer = await StakingThalesDeployed.stakedBalanceOf.call(users[i]);
						assert.bnEqual(answer, toUnit(stakes[i]));
						totalStaked = totalStaked + stakes[i];
					}
					answer = await StakingThalesDeployed.getContractRewardFunds.call({ from: owner });
					assert.bnEqual(answer, toUnit(totalStaked + fixedReward * weeksOfStakingToTest));

					answer = await StakingThalesDeployed.periodsOfStaking.call();
					assert.bnEqual(answer, period);

					let totalEscrowed = 0;
					let alreadyClaimed = [0, 0, 0];
					for (let i = 0; i < users.length; i++) {
						stakePortions[i] = stakes[i] / totalStaked;
					}
					let claimableFirstWeek = [0, 0, 0];
					stakedEscrowedBalances = [0, 0, 0];
					while (period < 10) {
						await fastForward(WEEK + SECOND);
						await StakingThalesDeployed.closePeriod({ from: second });
						period++;
						answer = await StakingThalesDeployed.periodsOfStaking.call();
						assert.bnEqual(answer, period);
						totalEscrowed = 0;

						for (let i = 0; i < users.length; i++) {
							totalEscrowed = totalEscrowed + stakedEscrowedBalances[i];
						}

						for (let i = 0; i < users.length; i++) {
							answer = await StakingThalesDeployed.getRewardsAvailable(users[i]);
							let portion =
								(stakes[i] / totalStaked + stakedEscrowedBalances[i] / totalEscrowed) / 2;
							if (totalEscrowed == 0) {
								portion = stakes[i] / totalStaked;
							}
							// console.log("period|portion: ",period, portion*fixedReward )
							assert.bnEqual(answer, Math.floor(portion * fixedReward));
							await StakingThalesDeployed.claimReward({ from: users[i] });

							alreadyClaimed[i] += Math.floor(portion * fixedReward);
							answer = await StakingThalesDeployed.getAlreadyClaimedRewards(users[i]);
							assert.bnEqual(answer, alreadyClaimed[i]);

							//Check if total Escrowed are bnEqual to AlreadyClaimedRewards
							let answer2 = await EscrowThalesDeployed.getStakedEscrowedBalanceForRewards(users[i]);
							assert.bnEqual(stakedEscrowedBalances[i], answer2);
							stakedEscrowedBalances[i] += Math.floor(portion * fixedReward);
							if (period == 1) {
								claimableFirstWeek[i] = stakedEscrowedBalances[i];
							}
							answer = await EscrowThalesDeployed.claimable(users[i], { from: second });
							assert.bnEqual(answer, 0);
						}
					}
					//10th WEEK
					await fastForward(WEEK + SECOND);
					await StakingThalesDeployed.closePeriod({ from: second });
					period++;
					answer = await StakingThalesDeployed.periodsOfStaking.call();
					assert.bnEqual(answer, period);
					for (let i = 0; i < users.length; i++) {
						answer = await EscrowThalesDeployed.claimable(users[i], { from: second });
						assert.bnEqual(answer, 0);
					}
					//11th WEEK:
					await fastForward(WEEK + SECOND);
					await StakingThalesDeployed.closePeriod({ from: second });
					period++;
					answer = await StakingThalesDeployed.periodsOfStaking.call();
					assert.bnEqual(answer, period);
					for (let i = 0; i < users.length; i++) {
						answer = await EscrowThalesDeployed.claimable(users[i], { from: second });
						assert.bnEqual(answer, claimableFirstWeek[i]);
					}

					while (period < weeksOfStakingToTest) {
						await fastForward(WEEK + SECOND);
						await StakingThalesDeployed.closePeriod({ from: second });
						period++;
						answer = await StakingThalesDeployed.periodsOfStaking.call();
						assert.bnEqual(answer, period);
						totalEscrowed = 0;

						for (let i = 0; i < users.length; i++) {
							totalEscrowed = totalEscrowed + stakedEscrowedBalances[i];
						}

						for (let i = 0; i < users.length; i++) {
							answer = await StakingThalesDeployed.getRewardsAvailable(users[i]);
							let portion =
								(stakes[i] / totalStaked + stakedEscrowedBalances[i] / totalEscrowed) / 2;
							if (totalEscrowed == 0) {
								portion = stakes[i] / totalStaked;
							}
							// console.log("period|portion: ",period, portion*fixedReward )
							assert.bnEqual(answer, Math.floor(portion * fixedReward));
							await StakingThalesDeployed.claimReward({ from: users[i] });

							alreadyClaimed[i] += Math.floor(portion * fixedReward);
							answer = await StakingThalesDeployed.getAlreadyClaimedRewards(users[i]);
							assert.bnEqual(answer, alreadyClaimed[i]);

							//Check if total Escrowed are bnEqual to AlreadyClaimedRewards
							let answer2 = await EscrowThalesDeployed.getStakedEscrowedBalanceForRewards(users[i]);
							assert.bnEqual(stakedEscrowedBalances[i], answer2);
							stakedEscrowedBalances[i] += Math.floor(portion * fixedReward);
						}
					}

					await fastForward(WEEK + SECOND);
					period++;
					for (let i = 0; i < users.length; i++) {
						answer = StakingThalesDeployed.startUnstake(toUnit(partialUnstakes[i]), {
							from: users[i],
						});

						await expect(StakingThalesDeployed.unstake({ from: users[i] })).to.be.revertedWith(
							'Cannot unstake yet, cooldown not expired.'
						);
					}

					await fastForward(WEEK + SECOND);

					for (let i = 0; i < users.length; i++) {
						answer = await ThalesDeployed.balanceOf(users[i]);
						assert.bnEqual(web3.utils.toDecimal(answer), 0);
						await StakingThalesDeployed.unstake({ from: users[i] });
						answer = await ThalesDeployed.balanceOf(users[i]);
						assert.bnEqual(answer, toUnit(partialUnstakes[i]));
					}
				}
			}
		);

		//5 _____________________________________________________________________________________________________
		weeksOfStakingToTest = 25;
		fixedReward = 1000;
		users = [first, second, third];
		stakes = [200, 200, 200];
		partialUnstakes = [110, 90, 200];
		stakedEscrowedBalances = [0, 0, 0];
		stakePortions = [0, 0, 0];
		it(
			users.length +
				' users: stakes [' +
				stakes +
				'], ' +
				weeksOfStakingToTest +
				' weeks of claiming, checkClaimable: up to 11th week, fixed reward: ' +
				fixedReward +
				' vesting 1st week, ',
			// ustakes: [' +partialUnstakes +				']'
			async () => {
				let period = 0;
				if (weeksOfStakingToTest < 10) {
					console.log('Please put at least 10 weeks of staking for testing');
				} else {
					await ThalesDeployed.transfer(
						StakingThalesDeployed.address,
						toUnit(fixedReward * weeksOfStakingToTest),
						{
							from: owner,
						}
					);
					await sUSDSynth.issue(initialCreator, sUSD);
					await sUSDSynth.transfer(StakingThalesDeployed.address, sUSD, { from: initialCreator });
					let answer = await StakingThalesDeployed.fixedPeriodReward.call();
					assert.bnEqual(answer, toUnit(100000));
					await StakingThalesDeployed.setFixedPeriodReward(fixedReward, { from: owner });
					answer = await StakingThalesDeployed.fixedPeriodReward.call();
					assert.bnEqual(answer, fixedReward);

					answer = await StakingThalesDeployed.getContractRewardFunds.call({ from: owner });
					assert.bnEqual(answer, toUnit(fixedReward * weeksOfStakingToTest));

					for (let i = 0; i < users.length; i++) {
						await ThalesDeployed.transfer(users[i], toUnit(stakes[i]), { from: owner });
						answer = await ThalesDeployed.balanceOf.call(users[i]);
						assert.bnEqual(answer, toUnit(stakes[i]));

						answer = await StakingThalesDeployed.stakedBalanceOf.call(users[i]);
						assert.bnEqual(answer, 0);
						await ThalesDeployed.approve(StakingThalesDeployed.address, toUnit(stakes[i]), {
							from: users[i],
						});
						await StakingThalesDeployed.stake(toUnit(stakes[i]), { from: users[i] });
						answer = await StakingThalesDeployed.stakedBalanceOf.call(users[i]);
						assert.bnEqual(answer, toUnit(stakes[i]));

						answer = await StakingThalesDeployed.getRewardsAvailable(first);
						assert.equal(answer, 0);
						answer = await StakingThalesDeployed.getRewardFeesAvailable(first);
						assert.equal(answer, 0);
					}

					await fastForward(WEEK + 5 * SECOND);
					let totalStaked = 0;
					for (let i = 0; i < users.length; i++) {
						answer = await StakingThalesDeployed.stakedBalanceOf.call(users[i]);
						assert.bnEqual(answer, toUnit(stakes[i]));
						totalStaked = totalStaked + stakes[i];
					}
					answer = await StakingThalesDeployed.getContractRewardFunds.call({ from: owner });
					assert.bnEqual(answer, toUnit(totalStaked + fixedReward * weeksOfStakingToTest));

					answer = await StakingThalesDeployed.periodsOfStaking.call();
					assert.bnEqual(answer, period);

					let totalEscrowed = 0;
					let alreadyClaimed = [0, 0, 0];
					for (let i = 0; i < users.length; i++) {
						stakePortions[i] = stakes[i] / totalStaked;
					}
					let claimableFirstWeek = [0, 0, 0];
					stakedEscrowedBalances = [0, 0, 0];
					while (period < 10) {
						await fastForward(WEEK + SECOND);
						await StakingThalesDeployed.closePeriod({ from: second });
						period++;
						answer = await StakingThalesDeployed.periodsOfStaking.call();
						assert.bnEqual(answer, period);
						totalEscrowed = 0;

						for (let i = 0; i < users.length; i++) {
							totalEscrowed = totalEscrowed + stakedEscrowedBalances[i];
						}

						for (let i = 0; i < users.length; i++) {
							answer = await StakingThalesDeployed.getRewardsAvailable(users[i]);
							// console.log("rewards available:", answer.toNumber());
							let portion =
								(stakes[i] / totalStaked + stakedEscrowedBalances[i] / totalEscrowed) / 2;
							if (totalEscrowed == 0) {
								portion = stakes[i] / totalStaked;
							}
							// console.log("period|portion: ",period, portion*fixedReward )
							assert.bnEqual(answer, Math.floor(portion * fixedReward));
							await StakingThalesDeployed.claimReward({ from: users[i] });

							alreadyClaimed[i] += Math.floor(portion * fixedReward);
							answer = await StakingThalesDeployed.getAlreadyClaimedRewards(users[i]);
							assert.bnEqual(answer, alreadyClaimed[i]);

							//Check if total Escrowed are bnEqual to AlreadyClaimedRewards
							let answer2 = await EscrowThalesDeployed.getStakedEscrowedBalanceForRewards(users[i]);
							assert.bnEqual(stakedEscrowedBalances[i], answer2);
							stakedEscrowedBalances[i] += Math.floor(portion * fixedReward);
							if (period == 1) {
								claimableFirstWeek[i] = stakedEscrowedBalances[i];
							}
							answer = await EscrowThalesDeployed.claimable(users[i], { from: second });
							assert.bnEqual(answer, 0);
						}
					}
					//10th WEEK
					await fastForward(WEEK + SECOND);
					await StakingThalesDeployed.closePeriod({ from: second });
					period++;
					answer = await StakingThalesDeployed.periodsOfStaking.call();
					assert.bnEqual(answer, period);
					for (let i = 0; i < users.length; i++) {
						answer = await EscrowThalesDeployed.claimable(users[i], { from: second });
						assert.bnEqual(answer, 0);
					}
					//11th WEEK:
					await fastForward(WEEK + SECOND);
					await StakingThalesDeployed.closePeriod({ from: second });
					period++;
					answer = await StakingThalesDeployed.periodsOfStaking.call();
					assert.bnEqual(answer, period);
					let vested = [0, 0, 0];
					for (let i = 0; i < users.length; i++) {
						answer = await EscrowThalesDeployed.claimable(users[i], { from: second });
						assert.bnEqual(answer, claimableFirstWeek[i]);
						await EscrowThalesDeployed.vest(answer, { from: users[i] });
						let answer2 = await ThalesDeployed.balanceOf.call(users[i], { from: second });
						assert.bnEqual(answer, answer2);
						vested[i] = answer;
						// console.log(vested[i].toNumber());
					}

					for (let i = 0; i < users.length; i++) {
						// console.log("vested:",vested[i].toNumber());
						// console.log("escrowedOLD:",stakedEscrowedBalances[i]);
						stakedEscrowedBalances[i] = stakedEscrowedBalances[i] - vested[i].toNumber();
						// console.log("escrowedNEW:",stakedEscrowedBalances[i]);
					}

					while (period < weeksOfStakingToTest) {
						await fastForward(WEEK + SECOND);
						await StakingThalesDeployed.closePeriod({ from: second });
						period++;
						answer = await StakingThalesDeployed.periodsOfStaking.call();
						assert.bnEqual(answer, period);
						totalEscrowed = 0;

						for (let i = 0; i < users.length; i++) {
							totalEscrowed = totalEscrowed + stakedEscrowedBalances[i];
						}

						for (let i = 0; i < users.length; i++) {
							answer = await StakingThalesDeployed.getRewardsAvailable(users[i]);
							let portion =
								(stakes[i] / totalStaked + stakedEscrowedBalances[i] / totalEscrowed) / 2;
							if (totalEscrowed == 0) {
								portion = stakes[i] / totalStaked;
							}
							// console.log("period|portion: ",period, portion*fixedReward )
							assert.bnEqual(answer, Math.floor(portion * fixedReward));
							await StakingThalesDeployed.claimReward({ from: users[i] });

							alreadyClaimed[i] += Math.floor(portion * fixedReward);
							answer = await StakingThalesDeployed.getAlreadyClaimedRewards(users[i]);
							assert.bnEqual(answer, alreadyClaimed[i]);

							//Check if total Escrowed are bnEqual to AlreadyClaimedRewards
							let answer2 = await EscrowThalesDeployed.getStakedEscrowedBalanceForRewards(users[i]);
							assert.bnEqual(stakedEscrowedBalances[i], answer2);
							stakedEscrowedBalances[i] += Math.floor(portion * fixedReward);
						}
					}

					await fastForward(WEEK + SECOND);
					period++;
					for (let i = 0; i < users.length; i++) {
						answer = StakingThalesDeployed.startUnstake(toUnit(partialUnstakes[i]), {
							from: users[i],
						});

						await expect(StakingThalesDeployed.unstake({ from: users[i] })).to.be.revertedWith(
							'Cannot unstake yet, cooldown not expired.'
						);
					}

					await fastForward(WEEK + SECOND);

					for (let i = 0; i < users.length; i++) {
						answer = await ThalesDeployed.balanceOf(users[i]);
						assert.bnEqual(answer, vested[i]);
						await StakingThalesDeployed.unstake({ from: users[i] });
						answer = await ThalesDeployed.balanceOf(users[i]);
						// assert.bnEqual(answer, toUnit(partialUnstakes[i])+vested[i]);
					}
				}
			}
		);
	});
});
