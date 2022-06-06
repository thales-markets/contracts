'use strict';

const { artifacts, contract, web3 } = require('hardhat');
const { toBN } = web3.utils;

const { assert } = require('../../utils/common');

const { toBytes32 } = require('../../../index');
const { expect } = require('chai');
const { setupAllContracts } = require('../../utils/setup');

const { fastForward, toUnit } = require('../../utils')();

const { encodeCall } = require('../../utils/helpers');

contract('StakingThales', accounts => {
	const [first, second, third, owner] = accounts;
	const [initialCreator, managerOwner, minter, dummy] = accounts;
	let ThalesDeployed,
		ThalesFeeDeployed,
		StakingThalesDeployed,
		EscrowThalesDeployed,
		OngoingAirdropDeployed,
		SNXRewardsDeployed,
		AddressResolverDeployed,
		ProxyEscrowDeployed,
		ProxyStakingDeployed,
		ThalesStakingRewardsPoolDeployed;
	let ThalesStakingRewardsPool;

	let initializeStalkingData, initializeEscrowData;

	let EscrowImplementation, StakingImplementation;

	const sUSDQty = toUnit(5555);
	const sUSD = 5555;
	const SECOND = 1000;
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
		let Thales = artifacts.require('Thales');
		let EscrowThales = artifacts.require('EscrowThales');
		let StakingThales = artifacts.require('StakingThales');
		let OngoingAirdrop = artifacts.require('OngoingAirdrop');
		let OwnedUpgradeabilityProxy = artifacts.require('OwnedUpgradeabilityProxy');
		let SNXRewards = artifacts.require('SNXRewards');
		SNXRewardsDeployed = await SNXRewards.new();
		let AddressResolver = artifacts.require('AddressResolverHelper');
		AddressResolverDeployed = await AddressResolver.new();
		await AddressResolverDeployed.setSNXRewardsAddress(SNXRewardsDeployed.address);
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
		EscrowImplementation = await EscrowThales.new({ from: owner });
		StakingImplementation = await StakingThales.new({ from: owner });
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
		await StakingThalesDeployed.setThalesStakingRewardsPool(
			ThalesStakingRewardsPoolDeployed.address,
			{ from: owner }
		);
		await EscrowThalesDeployed.setThalesStakingRewardsPool(
			ThalesStakingRewardsPoolDeployed.address,
			{ from: owner }
		);

		await StakingThalesDeployed.setDistributeFeesEnabled(true, { from: owner });
		await StakingThalesDeployed.setClaimEnabled(true, { from: owner });
		await StakingThalesDeployed.setAddressResolver(AddressResolverDeployed.address, {
			from: owner,
		});

		await EscrowThalesDeployed.setStakingThalesContract(StakingThalesDeployed.address, {
			from: owner,
		});
		await StakingThalesDeployed.startStakingPeriod({ from: owner });
	});

	describe('ProxyStaking:', () => {
		let weeksOfStakingToTest = toBN(25);
		let fixedReward = toUnit(1000);
		let userStake = toUnit(875);
		let stakedEscrowed = toBN(0);
		it(
			'Single user: stake ' +
				userStake +
				', ' +
				weeksOfStakingToTest +
				' weeks of claiming, fixed reward: ' +
				fixedReward + ' [ @cov-skip ] ',
			async () => {
				let period = 0;

				await ThalesDeployed.transfer(first, userStake, { from: owner });
				let answer = await ThalesDeployed.balanceOf.call(first);
				assert.bnEqual(answer, userStake);

				// Set amounts in account and StakingThales
				await ThalesDeployed.transfer(
					ThalesStakingRewardsPoolDeployed.address,
					fixedReward.mul(weeksOfStakingToTest),
					{
						from: owner,
					}
				);

				await sUSDSynth.issue(initialCreator, toUnit(sUSD));
				await sUSDSynth.transfer(StakingThalesDeployed.address, toUnit(sUSD), {
					from: initialCreator,
				});
				answer = await StakingThalesDeployed.fixedPeriodReward.call();
				assert.bnEqual(answer, toUnit(70000));
				await StakingThalesDeployed.setFixedPeriodReward(fixedReward, { from: owner });
				answer = await StakingThalesDeployed.fixedPeriodReward.call();
				assert.bnEqual(answer, fixedReward);

				answer = await StakingThalesDeployed.getContractRewardFunds.call({ from: owner });
				assert.bnEqual(answer, fixedReward.mul(weeksOfStakingToTest));

				//Staking
				answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
				assert.bnEqual(answer, 0);
				await ThalesDeployed.approve(StakingThalesDeployed.address, userStake, {
					from: first,
				});
				await StakingThalesDeployed.stake(userStake, { from: first });
				answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
				assert.bnEqual(answer, userStake);

				answer = await StakingThalesDeployed.getRewardsAvailable(first);
				assert.equal(answer, 0);
				answer = await StakingThalesDeployed.getRewardFeesAvailable(first);
				assert.equal(answer, 0);

				await fastForward(WEEK + 5 * SECOND);
				answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
				assert.bnEqual(answer, userStake);

				answer = await StakingThalesDeployed.getContractRewardFunds.call({ from: owner });
				assert.bnEqual(answer, fixedReward.mul(weeksOfStakingToTest));

				answer = await StakingThalesDeployed.periodsOfStaking.call();
				assert.bnEqual(answer, period);

				while (period < weeksOfStakingToTest) {
					await fastForward(WEEK + SECOND);
					await StakingThalesDeployed.closePeriod({ from: second });
					period++;
					answer = await StakingThalesDeployed.periodsOfStaking.call();
					assert.bnEqual(answer, period);

					answer = await StakingThalesDeployed.getRewardsAvailable(first);
					assert.bnEqual(answer, fixedReward);

					await StakingThalesDeployed.claimReward({ from: first });

					answer = await StakingThalesDeployed.getAlreadyClaimedRewards(first);
					assert.bnEqual(answer, fixedReward.mul(toBN(period)));

					//Check if total Escrowed are bnEqual to AlreadyClaimedRewards
					let answer2 = await EscrowThalesDeployed.getStakedEscrowedBalanceForRewards(first);
					assert.bnEqual(stakedEscrowed, answer2);
					// the claimed rewards from period are compared with StakedEscrowedRewards in period+1
					stakedEscrowed = answer;
				}
			}
		);
		weeksOfStakingToTest = toBN(28);
		userStake = toUnit(888);
		fixedReward = toUnit(333);
		let partialUnstake = toUnit(888);
		it(
			'Single user: stake ' +
				userStake +
				', ' +
				weeksOfStakingToTest +
				' weeks of claiming, fixed reward: ' +
				fixedReward +
				', ustakes: ' +
				partialUnstake + ' [ @cov-skip ]',
			async () => {
				let period = 0;

				await ThalesDeployed.transfer(first, userStake, { from: owner });
				let answer = await ThalesDeployed.balanceOf.call(first);
				assert.bnEqual(answer, userStake);

				// Set amounts in account and StakingThales
				await ThalesDeployed.transfer(
					ThalesStakingRewardsPoolDeployed.address,
					fixedReward.mul(weeksOfStakingToTest),
					{
						from: owner,
					}
				);

				await sUSDSynth.issue(initialCreator, toUnit(sUSD));
				await sUSDSynth.transfer(StakingThalesDeployed.address, toUnit(sUSD), {
					from: initialCreator,
				});
				answer = await StakingThalesDeployed.fixedPeriodReward.call();
				assert.bnEqual(answer, toUnit(70000));
				await StakingThalesDeployed.setFixedPeriodReward(fixedReward, { from: owner });
				answer = await StakingThalesDeployed.fixedPeriodReward.call();
				assert.bnEqual(answer, fixedReward);

				answer = await StakingThalesDeployed.getContractRewardFunds.call({ from: owner });
				assert.bnEqual(answer, fixedReward.mul(weeksOfStakingToTest));

				//Staking
				answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
				assert.bnEqual(answer, 0);
				await ThalesDeployed.approve(StakingThalesDeployed.address, userStake, {
					from: first,
				});
				await StakingThalesDeployed.stake(userStake, { from: first });
				answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
				assert.bnEqual(answer, userStake);

				answer = await StakingThalesDeployed.getRewardsAvailable(first);
				assert.equal(answer, 0);
				answer = await StakingThalesDeployed.getRewardFeesAvailable(first);
				assert.equal(answer, 0);

				await fastForward(WEEK + 5 * SECOND);
				answer = await StakingThalesDeployed.stakedBalanceOf.call(first);
				assert.bnEqual(answer, userStake);

				answer = await StakingThalesDeployed.getContractRewardFunds.call({ from: owner });
				assert.bnEqual(answer, fixedReward.mul(weeksOfStakingToTest));

				answer = await StakingThalesDeployed.periodsOfStaking.call();
				assert.bnEqual(answer, period);

				let stakedEscrowed = toUnit(0);

				while (period < weeksOfStakingToTest) {
					await fastForward(WEEK + SECOND);
					await StakingThalesDeployed.closePeriod({ from: second });
					period++;
					answer = await StakingThalesDeployed.periodsOfStaking.call();
					assert.bnEqual(answer, period);

					answer = await StakingThalesDeployed.getRewardsAvailable(first);
					assert.bnEqual(answer, fixedReward);

					await StakingThalesDeployed.claimReward({ from: first });

					answer = await StakingThalesDeployed.getAlreadyClaimedRewards(first);
					assert.bnEqual(answer, fixedReward.mul(toBN(period)));

					//Check if total Escrowed are bnEqual to AlreadyClaimedRewards
					let answer2 = await EscrowThalesDeployed.getStakedEscrowedBalanceForRewards(first);
					assert.bnEqual(stakedEscrowed, answer2);
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
				assert.bnEqual(answer, 0);
				await StakingThalesDeployed.unstake({ from: first });
				answer = await ThalesDeployed.balanceOf(first);
				assert.bnEqual(answer, partialUnstake);
			}
		);
		//3___________________________________________________________________________________________________
		weeksOfStakingToTest = toBN(45);
		fixedReward = toUnit(4563);
		let users = [first, second, third];
		let stakes = [toUnit(12331), toUnit(2121), toUnit(32123)];
		let partialUnstakes = [toUnit(3565), toUnit(1560), toUnit(30463)];
		let stakedEscrowedBalances = [toUnit(0), toUnit(0), toUnit(0)];
		let stakePortions = [toUnit(0), toUnit(0), toUnit(0)];

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
				'] [ @cov-skip ]',
			async () => {
				let period = 0;

				await ThalesDeployed.transfer(
					ThalesStakingRewardsPoolDeployed.address,
					fixedReward.mul(weeksOfStakingToTest),
					{
						from: owner,
					}
				);
				await sUSDSynth.issue(initialCreator, sUSD);
				await sUSDSynth.transfer(StakingThalesDeployed.address, sUSD, { from: initialCreator });
				let answer = await StakingThalesDeployed.fixedPeriodReward.call();
				assert.bnEqual(answer, toUnit(70000));
				await StakingThalesDeployed.setFixedPeriodReward(fixedReward, { from: owner });
				answer = await StakingThalesDeployed.fixedPeriodReward.call();
				assert.bnEqual(answer, fixedReward);

				answer = await StakingThalesDeployed.getContractRewardFunds.call({ from: owner });
				assert.bnEqual(answer, fixedReward.mul(weeksOfStakingToTest));

				for (let i = 0; i < users.length; i++) {
					await ThalesDeployed.transfer(users[i], stakes[i], { from: owner });
					answer = await ThalesDeployed.balanceOf.call(users[i]);
					assert.bnEqual(answer, stakes[i]);

					answer = await StakingThalesDeployed.stakedBalanceOf.call(users[i]);
					assert.bnEqual(answer, 0);
					await ThalesDeployed.approve(StakingThalesDeployed.address, stakes[i], {
						from: users[i],
					});
					await StakingThalesDeployed.stake(stakes[i], { from: users[i] });
					answer = await StakingThalesDeployed.stakedBalanceOf.call(users[i]);
					assert.bnEqual(answer, stakes[i]);

					answer = await StakingThalesDeployed.getRewardsAvailable(first);
					assert.equal(answer, 0);
					answer = await StakingThalesDeployed.getRewardFeesAvailable(first);
					assert.equal(answer, 0);
				}

				await fastForward(WEEK + 5 * SECOND);
				let totalStaked = toBN(0);
				for (let i = 0; i < users.length; i++) {
					answer = await StakingThalesDeployed.stakedBalanceOf.call(users[i]);
					assert.bnEqual(answer, stakes[i]);
					totalStaked = totalStaked.add(stakes[i]);
				}
				answer = await StakingThalesDeployed.getContractRewardFunds.call({ from: owner });
				let sum_rewards = toBN(0);
				sum_rewards = fixedReward.mul(weeksOfStakingToTest);
				// sum_rewards = sum_rewards.add(totalStaked);
				assert.bnEqual(answer, sum_rewards);

				answer = await StakingThalesDeployed.periodsOfStaking.call();
				assert.bnEqual(answer, period);

				let totalEscrowed = toBN(0);
				let alreadyClaimed = [toUnit(0), toUnit(0), toUnit(0)];
				for (let i = 0; i < users.length; i++) {
					stakePortions[i] = stakes[i] / totalStaked;
				}
				let claimableFirstWeek = [toUnit(0), toUnit(0), toUnit(0)];
				while (period < weeksOfStakingToTest) {
					await fastForward(WEEK + SECOND);
					await StakingThalesDeployed.closePeriod({ from: second });
					period++;
					answer = await StakingThalesDeployed.periodsOfStaking.call();
					assert.bnEqual(answer, period);
					totalEscrowed = toBN(0);

					for (let i = 0; i < users.length; i++) {
						totalEscrowed = totalEscrowed.add(stakedEscrowedBalances[i]);
					}

					for (let i = 0; i < users.length; i++) {
						answer = await StakingThalesDeployed.getRewardsAvailable(users[i]);
						// console.log("rewards available:", answer.toNumber());
						let reward = toBN(0);
						reward = stakes[i]
							.add(stakedEscrowedBalances[i])
							.mul(fixedReward)
							.div(totalStaked.add(totalEscrowed));
						// console.log("period|portion: ",period, portion*fixedReward )
						assert.bnEqual(answer, reward);
						await StakingThalesDeployed.claimReward({ from: users[i] });

						alreadyClaimed[i] = alreadyClaimed[i].add(reward);
						answer = await StakingThalesDeployed.getAlreadyClaimedRewards(users[i]);
						assert.bnEqual(answer, alreadyClaimed[i]);

						//Check if total Escrowed are bnEqual to AlreadyClaimedRewards
						let answer2 = await EscrowThalesDeployed.getStakedEscrowedBalanceForRewards(users[i]);
						assert.bnEqual(stakedEscrowedBalances[i], answer2);
						stakedEscrowedBalances[i] = stakedEscrowedBalances[i].add(reward);
					}
				}

				await fastForward(WEEK + SECOND);
				period++;
				for (let i = 0; i < users.length; i++) {
					answer = StakingThalesDeployed.startUnstake(partialUnstakes[i], {
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
					assert.bnEqual(answer, partialUnstakes[i]);
				}
			}
		);

		//4 _____________________________________________________________________________________________________
		weeksOfStakingToTest = toBN(25);
		fixedReward = toUnit(1000);
		users = [first, second, third];
		stakes = [toUnit(200), toUnit(200), toUnit(200)];
		partialUnstakes = [toUnit(110), toUnit(90), toUnit(200)];
		stakedEscrowedBalances = [toUnit(0), toUnit(0), toUnit(0)];
		stakePortions = [toUnit(0), toUnit(0), toUnit(0)];
		it(
			users.length +
				' users: stakes [' +
				stakes +
				'], ' +
				weeksOfStakingToTest +
				' weeks of claiming, checkClaimable: up to 11th week, fixed reward: ' +
				fixedReward +
				' vesting 1st week, ' +
				'unstakes: [' +
				partialUnstakes +
				'] [ @cov-skip ]',
			async () => {
				let period = 0;
				if (weeksOfStakingToTest < 10) {
					//console.log('Please put at least 10 weeks of staking for testing');
				} else {
					await ThalesDeployed.transfer(
						ThalesStakingRewardsPoolDeployed.address,
						fixedReward.mul(weeksOfStakingToTest),
						{
							from: owner,
						}
					);
					await sUSDSynth.issue(initialCreator, sUSD);
					await sUSDSynth.transfer(StakingThalesDeployed.address, sUSD, { from: initialCreator });
					let answer = await StakingThalesDeployed.fixedPeriodReward.call();
					assert.bnEqual(answer, toUnit(70000));
					await StakingThalesDeployed.setFixedPeriodReward(fixedReward, { from: owner });
					answer = await StakingThalesDeployed.fixedPeriodReward.call();
					assert.bnEqual(answer, fixedReward);

					answer = await StakingThalesDeployed.getContractRewardFunds.call({ from: owner });
					assert.bnEqual(answer, fixedReward.mul(weeksOfStakingToTest));

					for (let i = 0; i < users.length; i++) {
						await ThalesDeployed.transfer(users[i], stakes[i], { from: owner });
						answer = await ThalesDeployed.balanceOf.call(users[i]);
						assert.bnEqual(answer, stakes[i]);

						answer = await StakingThalesDeployed.stakedBalanceOf.call(users[i]);
						assert.bnEqual(answer, 0);
						await ThalesDeployed.approve(StakingThalesDeployed.address, stakes[i], {
							from: users[i],
						});
						await StakingThalesDeployed.stake(stakes[i], { from: users[i] });
						answer = await StakingThalesDeployed.stakedBalanceOf.call(users[i]);
						assert.bnEqual(answer, stakes[i]);

						answer = await StakingThalesDeployed.getRewardsAvailable(first);
						assert.equal(answer, 0);
						answer = await StakingThalesDeployed.getRewardFeesAvailable(first);
						assert.equal(answer, 0);
					}

					await fastForward(WEEK + 5 * SECOND);
					let totalStaked = toBN(0);
					for (let i = 0; i < users.length; i++) {
						answer = await StakingThalesDeployed.stakedBalanceOf.call(users[i]);
						assert.bnEqual(answer, stakes[i]);
						totalStaked = totalStaked.add(stakes[i]);
						// console.log(stakes[i].toString())
					}
					answer = await StakingThalesDeployed.getContractRewardFunds.call({ from: owner });
					let sum_rewards = toBN(0);
					sum_rewards = fixedReward.mul(weeksOfStakingToTest);
					// sum_rewards = sum_rewards.add(totalStaked);
					assert.bnEqual(answer, sum_rewards);

					answer = await StakingThalesDeployed.periodsOfStaking.call();
					assert.bnEqual(answer, period);

					let totalEscrowed = toBN(0);
					let alreadyClaimed = [toUnit(0), toUnit(0), toUnit(0)];
					for (let i = 0; i < users.length; i++) {
						stakePortions[i] = stakes[i] / totalStaked;
					}
					stakedEscrowedBalances = [toUnit(0), toUnit(0), toUnit(0)];
					let claimableFirstWeek = [toUnit(0), toUnit(0), toUnit(0)];
					while (period < 10) {
						await fastForward(WEEK + SECOND);
						await StakingThalesDeployed.closePeriod({ from: second });
						period++;
						answer = await StakingThalesDeployed.periodsOfStaking.call();
						assert.bnEqual(answer, period);
						totalEscrowed = toBN(0);

						for (let i = 0; i < users.length; i++) {
							totalEscrowed = totalEscrowed.add(stakedEscrowedBalances[i]);
						}

						for (let i = 0; i < users.length; i++) {
							answer = await StakingThalesDeployed.getRewardsAvailable(users[i]);
							// console.log("rewards available:", answer.toNumber());
							let reward = toBN(0);
							reward = stakes[i]
								.add(stakedEscrowedBalances[i])
								.mul(fixedReward)
								.div(totalStaked.add(totalEscrowed));
							// console.log("period|portion: ",period, portion*fixedReward )
							assert.bnEqual(answer, reward);
							await StakingThalesDeployed.claimReward({ from: users[i] });

							alreadyClaimed[i] = alreadyClaimed[i].add(reward);
							answer = await StakingThalesDeployed.getAlreadyClaimedRewards(users[i]);
							assert.bnEqual(answer, alreadyClaimed[i]);

							//Check if total Escrowed are bnEqual to AlreadyClaimedRewards
							let answer2 = await EscrowThalesDeployed.getStakedEscrowedBalanceForRewards(users[i]);
							assert.bnEqual(stakedEscrowedBalances[i], answer2);
							stakedEscrowedBalances[i] = stakedEscrowedBalances[i].add(reward);
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
						assert.bnEqual(answer, claimableFirstWeek[i]);
					}
					//11th WEEK:
					await fastForward(WEEK + SECOND);
					await StakingThalesDeployed.closePeriod({ from: second });
					period++;
					answer = await StakingThalesDeployed.periodsOfStaking.call();
					assert.bnEqual(answer, period);
					let vested = [toUnit(0), toUnit(0), toUnit(0)];
					for (let i = 0; i < users.length; i++) {
						answer = await EscrowThalesDeployed.claimable(users[i], { from: second });
						assert.bnEqual(answer, claimableFirstWeek[i].mul(toBN(2)));
						await EscrowThalesDeployed.vest(answer, { from: users[i] });
						let answer2 = await ThalesDeployed.balanceOf.call(users[i], { from: second });
						assert.bnEqual(answer, answer2);
						vested[i] = answer;
					}

					for (let i = 0; i < users.length; i++) {
						stakedEscrowedBalances[i] = stakedEscrowedBalances[i].sub(vested[i]);
					}

					while (period < weeksOfStakingToTest) {
						await fastForward(WEEK + SECOND);
						await StakingThalesDeployed.closePeriod({ from: second });
						period++;
						answer = await StakingThalesDeployed.periodsOfStaking.call();
						assert.bnEqual(answer, period);
						totalEscrowed = toBN(0);

						for (let i = 0; i < users.length; i++) {
							totalEscrowed = totalEscrowed.add(stakedEscrowedBalances[i]);
						}

						for (let i = 0; i < users.length; i++) {
							answer = await StakingThalesDeployed.getRewardsAvailable(users[i]);
							// console.log("rewards available:", answer.toNumber());
							let reward = toBN(0);
							reward = stakes[i]
								.add(stakedEscrowedBalances[i])
								.mul(fixedReward)
								.div(totalStaked.add(totalEscrowed));
							// console.log("period|portion: ",period, portion*fixedReward )
							assert.bnEqual(answer, reward);
							await StakingThalesDeployed.claimReward({ from: users[i] });

							alreadyClaimed[i] = alreadyClaimed[i].add(reward);
							answer = await StakingThalesDeployed.getAlreadyClaimedRewards(users[i]);
							assert.bnEqual(answer, alreadyClaimed[i]);

							//Check if total Escrowed are bnEqual to AlreadyClaimedRewards
							let answer2 = await EscrowThalesDeployed.getStakedEscrowedBalanceForRewards(users[i]);
							assert.bnEqual(stakedEscrowedBalances[i], answer2);
							stakedEscrowedBalances[i] = stakedEscrowedBalances[i].add(reward);
						}
					}

					await fastForward(WEEK + SECOND);
					period++;
					for (let i = 0; i < users.length; i++) {
						answer = StakingThalesDeployed.startUnstake(partialUnstakes[i], {
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
						assert.bnEqual(answer, partialUnstakes[i].add(vested[i]));
					}
				}
			}
		);
	});
});
