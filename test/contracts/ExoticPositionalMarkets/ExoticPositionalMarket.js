'use strict';

const { artifacts, contract } = require('hardhat');

const { assert } = require('../../utils/common');

const { currentTime, toUnit, fastForward } = require('../../utils')();

const SECOND = 1;
const HOUR = 3600;
const DAY = 86400;

const ZERO_ADDRESS = '0x' + '0'.repeat(40);

// contracts
const ExoticPositionalMarketContract = artifacts.require('ExoticPositionalFixedMarket');
const ExoticPositionalOpenBidMarketContract = artifacts.require('ExoticPositionalOpenBidMarket');
const ExoticPositionalMarketManagerContract = artifacts.require('ExoticPositionalMarketManager');
const ThalesOracleCouncilContract = artifacts.require('ThalesOracleCouncil');
const ThalesContract = artifacts.require('contracts/Token/OpThales_L1.sol:OpThales');
const ThalesBondsContract = artifacts.require('ThalesBonds');
const ExoticPositionalTagsContract = artifacts.require('ExoticPositionalTags');
let ExoticPositionalMarket;
let ExoticPositionalOpenBidMarket;
let ExoticPositionalMarketManager;
let ExoticPositionalTags;
let ThalesOracleCouncil;
let Thales;
let ThalesBonds;
let answer;
let marketQuestion,
	marketSource,
	endOfPositioning,
	fixedTicketPrice,
	positionAmount1,
	positionAmount2,
	positionAmount3,
	withdrawalAllowed,
	paymentToken,
	tag,
	phrases = [],
	deployedMarket,
	deployedOpenBidMarket,
	fixedBondAmount,
	disputePrice,
	outcomePosition,
	outcomePosition2,
	outcomePosition3,
	totalAmount12,
	totalAmount13,
	totalAmount23,
	totalAmount123;

contract('Exotic Positional market', async accounts => {
	const [
		manager,
		owner,
		userOne,
		userTwo,
		userThree,
		councilOne,
		councilTwo,
		councilThree,
		safeBox,
	] = accounts;
	beforeEach(async () => {
		ExoticPositionalMarket = await ExoticPositionalMarketContract.new();
		ExoticPositionalOpenBidMarket = await ExoticPositionalOpenBidMarketContract.new();
		ExoticPositionalMarketManager = await ExoticPositionalMarketManagerContract.new();
		ThalesOracleCouncil = await ThalesOracleCouncilContract.new({ from: owner });
		Thales = await ThalesContract.new({ from: owner });
		ThalesBonds = await ThalesBondsContract.new();
		ExoticPositionalTags = await ExoticPositionalTagsContract.new();
		await ExoticPositionalTags.initialize(manager, { from: manager });
		await ThalesBonds.initialize(manager, { from: manager });

		await ExoticPositionalMarketManager.initialize(manager, { from: manager });
		fixedBondAmount = toUnit(100);
		disputePrice = toUnit(10);
		let maxOpenBidPositon = toUnit(1000);

		await ExoticPositionalMarketManager.setAddresses(
			ExoticPositionalMarket.address,
			ExoticPositionalOpenBidMarket.address,
			ThalesOracleCouncil.address,
			Thales.address,
			ExoticPositionalTags.address,
			owner,
			safeBox,
			owner,
			owner,
			{ from: manager }
		);

		await ExoticPositionalMarketManager.setPercentages('1', '1', '1', '6', '10', { from: manager });

		await ExoticPositionalMarketManager.setDurations('14400', '0', '28800', '172800', '86400', {
			from: manager,
		});

		await ExoticPositionalMarketManager.setLimits('1000', '1000', '60', '1000', '5', '5', '5', {
			from: manager,
		});

		await ExoticPositionalMarketManager.setAmounts(
			toUnit(10),
			toUnit(1000),
			disputePrice,
			fixedBondAmount,
			disputePrice,
			disputePrice,
			maxOpenBidPositon,
			{ from: manager }
		);

		await ExoticPositionalMarketManager.setFlags(false, true, { from: manager });

		await ExoticPositionalMarketManager.setThalesBonds(ThalesBonds.address);
		await ThalesBonds.setMarketManager(ExoticPositionalMarketManager.address, { from: manager });
		await Thales.transfer(userOne, toUnit('1000'), { from: owner });
		await Thales.transfer(userTwo, toUnit('1000'), { from: owner });
		await Thales.transfer(userThree, toUnit('1000'), { from: owner });

		await ExoticPositionalTags.addTag('Sport', '1');
		await ExoticPositionalTags.addTag('Football', '101');
		await ExoticPositionalTags.addTag('Basketball', '102');
		await ExoticPositionalTags.addTag('Crypto', '2');
		await ExoticPositionalTags.addTag('Bitcoin', '201');
		await ExoticPositionalTags.addTag('Politics', '3');
	});

	describe('initial deploy', function() {
		it('deployed', async function() {
			assert.notEqual(ExoticPositionalMarket.address, ZERO_ADDRESS);
		});
	});

	describe('create single market', function() {
		it('new market fixed', async function() {
			const timestamp = await currentTime();
			marketQuestion = 'Who will win the el clasico which will be played on 2022-02-22?';
			marketSource = 'http://www.realmadrid.com';
			endOfPositioning = (timestamp + DAY).toString();
			fixedTicketPrice = toUnit('10');
			withdrawalAllowed = true;
			tag = [1, 2, 3];
			paymentToken = Thales.address;
			phrases = ['Real Madrid', 'FC Barcelona', 'It will be a draw'];
			// phrases = ['Real Madrid', 'FC Barcelona', 'FC Barcelona'];
			outcomePosition = '1';

			answer = await Thales.increaseAllowance(
				ThalesBonds.address,
				fixedBondAmount.add(fixedTicketPrice),
				{
					from: owner,
				}
			);
			answer = await ExoticPositionalMarketManager.createExoticMarket(
				marketQuestion,
				marketSource,
				endOfPositioning,
				fixedTicketPrice,
				withdrawalAllowed,
				tag,
				phrases.length,
				['1'],
				phrases,
				{ from: owner }
			);

			answer = await ExoticPositionalMarketManager.getActiveMarketAddress('0');
			deployedMarket = await ExoticPositionalMarketContract.at(answer);
			answer = await deployedMarket.ticketType();
			assert.equal(answer.toString(), '0');
		});

		it('new market open bid', async function() {
			const timestamp = await currentTime();
			marketQuestion = 'Who will win the el clasico which will be played on 2022-02-22?';
			marketSource = 'http://www.realmadrid.com';
			endOfPositioning = (timestamp + DAY).toString();
			fixedTicketPrice = '0';
			let minFixedTicketPrice = toUnit('10');
			withdrawalAllowed = true;
			tag = [1, 2, 3];
			paymentToken = Thales.address;
			phrases = ['Real Madrid', 'FC Barcelona', 'It will be a draw'];
			outcomePosition = '1';
			outcomePosition2 = '2';
			outcomePosition3 = '3';

			answer = await Thales.increaseAllowance(
				ThalesBonds.address,
				fixedBondAmount.add(minFixedTicketPrice),
				{
					from: owner,
				}
			);
			answer = await ExoticPositionalMarketManager.createExoticMarket(
				marketQuestion,
				marketSource,
				endOfPositioning,
				fixedTicketPrice,
				withdrawalAllowed,
				tag,
				phrases.length,
				[toUnit('10'), '0', '0'],
				phrases,
				{ from: owner }
			);

			answer = await ExoticPositionalMarketManager.getActiveMarketAddress('0');
			deployedOpenBidMarket = await ExoticPositionalOpenBidMarketContract.at(answer);
			answer = await deployedOpenBidMarket.ticketType();
			assert.equal(answer.toString(), '1');
		});
	});

	describe('create Open bid Exotic market', function() {
		beforeEach(async () => {
			const timestamp = await currentTime();
			marketQuestion = 'Who will win the el clasico which will be played on 2022-02-22?';
			marketSource = 'http://www.realmadrid.com';
			endOfPositioning = (timestamp + DAY).toString();
			fixedTicketPrice = toUnit('0');
			let minFixedTicketPrice = toUnit('10');
			positionAmount1 = toUnit('100');
			positionAmount2 = toUnit('20');
			positionAmount3 = toUnit('50');
			totalAmount12 = positionAmount1.add(positionAmount2);
			totalAmount13 = positionAmount1.add(positionAmount3);
			totalAmount23 = positionAmount2.add(positionAmount3);
			totalAmount123 = positionAmount2.add(positionAmount3).add(positionAmount1);
			withdrawalAllowed = true;
			tag = [1, 2, 3];
			paymentToken = Thales.address;
			phrases = ['Real Madrid', 'Draw', 'FC Barcelona'];
			outcomePosition = '1';

			answer = await Thales.increaseAllowance(
				ThalesBonds.address,
				fixedBondAmount.add(minFixedTicketPrice),
				{
					from: owner,
				}
			);
			answer = await ExoticPositionalMarketManager.createExoticMarket(
				marketQuestion,
				marketSource,
				endOfPositioning,
				fixedTicketPrice,
				withdrawalAllowed,
				tag,
				phrases.length,
				[toUnit('10'), '0', '0'],
				phrases,
				{ from: owner }
			);

			answer = await ExoticPositionalMarketManager.getActiveMarketAddress('0');
			deployedOpenBidMarket = await ExoticPositionalOpenBidMarketContract.at(answer);
			answer = await deployedOpenBidMarket.ticketType();
			assert.equal(answer.toString(), '1');
		});
		it('new market', async function() {
			answer = await ExoticPositionalMarketManager.numberOfActiveMarkets();
			assert.equal(answer.toString(), '1');
		});

		it('market type: fixed Bid', async function() {
			answer = await deployedOpenBidMarket.ticketType();
			assert.equal(answer, '1');
		});

		it('new market is active?', async function() {
			answer = await ExoticPositionalMarketManager.isActiveMarket(deployedOpenBidMarket.address);
			assert.equal(answer, true);
			answer = await deployedOpenBidMarket.endOfPositioning();
			assert.equal(answer.toString(), endOfPositioning);
		});

		it('manager owner', async function() {
			answer = await ExoticPositionalMarketManager.owner();
			assert.equal(answer.toString(), manager);
		});

		it('manager is the market owner', async function() {
			answer = await deployedOpenBidMarket.owner();
			assert.equal(answer.toString(), ExoticPositionalMarketManager.address);
		});

		it('creator address match', async function() {
			answer = await ExoticPositionalMarketManager.creatorAddress(deployedOpenBidMarket.address);
			assert.equal(answer.toString(), owner);
		});

		it('can position', async function() {
			answer = await deployedOpenBidMarket.canUsersPlacePosition();
			assert.equal(answer, true);
		});

		it('tags match', async function() {
			answer = await deployedOpenBidMarket.getTagsCount();
			assert.equal(answer.toString(), tag.length.toString());
			for (let i = 0; i < tag.length; i++) {
				answer = await deployedOpenBidMarket.tags(i.toString());
				assert.equal(answer.toString(), tag[i].toString());
			}
		});

		it('total bond amount', async function() {
			answer = await ThalesBonds.getTotalDepositedBondAmountForMarket(
				deployedOpenBidMarket.address
			);
			assert.equal(answer.toString(), fixedBondAmount);
		});

		it('can not resolve', async function() {
			answer = await deployedOpenBidMarket.canMarketBeResolved();
			assert.equal(answer, false);
		});

		it('can resolve', async function() {
			await fastForward(DAY + SECOND);
			answer = await deployedOpenBidMarket.canMarketBeResolved();
			assert.equal(answer, true);
		});
		describe('position and resolve (no Council decision)', function() {
			beforeEach(async () => {
				let sumOfPositions = positionAmount1.add(positionAmount2).add(positionAmount3);
				answer = await Thales.increaseAllowance(ThalesBonds.address, sumOfPositions, {
					from: userOne,
				});
				answer = await Thales.increaseAllowance(ThalesBonds.address, sumOfPositions, {
					from: userTwo,
				});
			});

			describe('userOne takes position', async function() {
				beforeEach(async () => {
					answer = await deployedOpenBidMarket.takeOpenBidPositions(
						[outcomePosition],
						[positionAmount1],
						{ from: userOne }
					);
				});
				it('1 ticket holder', async function() {
					answer = await deployedOpenBidMarket.totalUsersTakenPositions();
					assert.equal(answer.toString(), '2');
				});
				it('ticket holder position match', async function() {
					answer = await deployedOpenBidMarket.getAllUserPositions(userOne);
					// assert.equal(answer.toString(), outcomePosition);
				});

				describe('resolve with ticket holder result', async function() {
					beforeEach(async () => {
						await fastForward(DAY + SECOND);
					});

					it('winning position is 0, not resolved', async function() {
						answer = await deployedOpenBidMarket.winningPosition();
						assert.equal(answer, '0');
					});

					it('market resolved', async function() {
						answer = await Thales.increaseAllowance(ThalesBonds.address, fixedBondAmount, {
							from: owner,
						});
						answer = await ExoticPositionalMarketManager.resolveMarket(
							deployedOpenBidMarket.address,
							'1',
							{ from: owner }
						);
						answer = await deployedOpenBidMarket.resolved();
						assert.equal(answer, true);
					});

					it('winning position match outcome position', async function() {
						answer = await Thales.increaseAllowance(ThalesBonds.address, fixedBondAmount, {
							from: owner,
						});
						answer = await ExoticPositionalMarketManager.resolveMarket(
							deployedOpenBidMarket.address,
							outcomePosition,
							{ from: owner }
						);
						answer = await deployedOpenBidMarket.winningPosition();
						assert.equal(answer.toString(), outcomePosition);
					});

					describe('market finalization', async function() {
						beforeEach(async () => {
							answer = await Thales.increaseAllowance(ThalesBonds.address, fixedBondAmount, {
								from: owner,
							});
							answer = await ExoticPositionalMarketManager.resolveMarket(
								deployedOpenBidMarket.address,
								outcomePosition,
								{ from: owner }
							);
						});
						it('ticket holders can not claim', async function() {
							answer = await deployedOpenBidMarket.canUsersClaim();
							assert.equal(answer, false);
						});
						it('ticket holders can not claim', async function() {
							await fastForward(DAY - 10 * SECOND);
							answer = await deployedOpenBidMarket.canUsersClaim();
							assert.equal(answer, false);
						});
						it('ticket holders can claim', async function() {
							await fastForward(DAY + SECOND);
							answer = await deployedOpenBidMarket.canUsersClaim();
							assert.equal(answer, true);
						});

						describe('claiming reward funds (3% total fees)', async function() {
							beforeEach(async () => {
								await fastForward(DAY + SECOND);
							});
							it('claimable amount', async function() {
								answer = await deployedOpenBidMarket.getUserClaimableAmount(userOne);
								let totalAmount = positionAmount1.add(toUnit('10'));
								let amount = positionAmount1.mul(totalAmount).div(totalAmount);
								let result = parseFloat(amount.toString()) * 0.97 - 10;
								// assert.equal(answer.toString(), result.toString());
							});
							it('claimed amount match', async function() {
								let result = await Thales.balanceOf(userOne);
								result =
									parseFloat(result.toString()) + parseFloat(positionAmount1.toString()) * 0.97;
								await deployedOpenBidMarket.claimWinningTicket({ from: userOne });
								answer = await Thales.balanceOf(userOne);
								// assert.approximately(answer.toString(), result.toString());
								answer = await deployedOpenBidMarket.getUserClaimableAmount(userOne);
								assert.equal(answer.toString(), '0');
							});
						});
					});
				});
			});

			describe('user takes two positions', async function() {
				beforeEach(async () => {
					answer = await deployedOpenBidMarket.takeOpenBidPositions(
						[outcomePosition, outcomePosition2],
						[positionAmount1, positionAmount2],
						{ from: userOne }
					);
				});
				it('1 ticket holder', async function() {
					answer = await deployedOpenBidMarket.totalUsersTakenPositions();
					assert.equal(answer, '2');
				});
				it('ticket holder position match', async function() {
					answer = await deployedOpenBidMarket.getAllUserPositions(userOne);
					assert.equal(answer[0].toString(), positionAmount1);
					assert.equal(answer[1].toString(), positionAmount2);
				});

				describe('resolve with ticket holder result', async function() {
					beforeEach(async () => {
						await fastForward(DAY + SECOND);
					});

					it('winning position is 0, not resolved', async function() {
						answer = await deployedOpenBidMarket.winningPosition();
						assert.equal(answer, '0');
					});

					it('market resolved', async function() {
						answer = await Thales.increaseAllowance(ThalesBonds.address, fixedBondAmount, {
							from: owner,
						});
						answer = await ExoticPositionalMarketManager.resolveMarket(
							deployedOpenBidMarket.address,
							'1',
							{ from: owner }
						);
						answer = await deployedOpenBidMarket.resolved();
						assert.equal(answer, true);
					});

					it('winning position match outcome position', async function() {
						answer = await Thales.increaseAllowance(ThalesBonds.address, fixedBondAmount, {
							from: owner,
						});
						answer = await ExoticPositionalMarketManager.resolveMarket(
							deployedOpenBidMarket.address,
							outcomePosition,
							{ from: owner }
						);
						answer = await deployedOpenBidMarket.winningPosition();
						assert.equal(answer.toString(), outcomePosition);
					});

					describe('market finalization', async function() {
						beforeEach(async () => {
							answer = await Thales.increaseAllowance(ThalesBonds.address, fixedBondAmount, {
								from: owner,
							});
							answer = await ExoticPositionalMarketManager.resolveMarket(
								deployedOpenBidMarket.address,
								outcomePosition,
								{ from: owner }
							);
						});
						it('ticket holders can not claim', async function() {
							answer = await deployedOpenBidMarket.canUsersClaim();
							assert.equal(answer, false);
						});
						it('ticket holders can not claim', async function() {
							await fastForward(DAY - 10 * SECOND);
							answer = await deployedOpenBidMarket.canUsersClaim();
							assert.equal(answer, false);
						});
						it('ticket holders can claim', async function() {
							await fastForward(DAY + SECOND);
							answer = await deployedOpenBidMarket.canUsersClaim();
							assert.equal(answer, true);
						});

						describe('claiming reward funds (3% total fees)', async function() {
							beforeEach(async () => {
								await fastForward(DAY + SECOND);
							});
							it('claimable amount', async function() {
								answer = await deployedOpenBidMarket.getUserClaimableAmount(userOne);
								let result = parseFloat(positionAmount1.add(positionAmount2).toString()) * 0.97;
								// assert.equal(answer.toString(), result.toString());
							});
							it('claimed amount match', async function() {
								let result = await Thales.balanceOf(userOne);
								result =
									parseFloat(result.toString()) +
									parseFloat(positionAmount1.add(positionAmount2).toString()) * 0.97;
								await deployedOpenBidMarket.claimWinningTicket({ from: userOne });
								answer = await Thales.balanceOf(userOne);
								// assert.equal(answer.toString(), result.toString());
								answer = await deployedOpenBidMarket.getUserClaimableAmount(userOne);
								assert.equal(answer.toString(), '0');
							});
						});
					});
				});
			});

			describe('two users take two different positions', async function() {
				beforeEach(async () => {
					answer = await deployedOpenBidMarket.takeOpenBidPositions(
						[outcomePosition, outcomePosition2],
						[positionAmount1, positionAmount2],
						{ from: userOne }
					);
					answer = await deployedOpenBidMarket.takeOpenBidPositions(
						[outcomePosition2, outcomePosition3],
						[positionAmount2, positionAmount3],
						{ from: userTwo }
					);
				});
				it('1 ticket holder', async function() {
					answer = await deployedOpenBidMarket.totalUsersTakenPositions();
					assert.equal(answer, '3');
				});
				it('ticket holder position match', async function() {
					answer = await deployedOpenBidMarket.getAllUserPositions(userOne);
					assert.equal(answer[0].toString(), positionAmount1);
					assert.equal(answer[1].toString(), positionAmount2);
					answer = await deployedOpenBidMarket.getAllUserPositions(userTwo);
					assert.equal(answer[1].toString(), positionAmount2);
					assert.equal(answer[2].toString(), positionAmount3);
				});

				describe('resolve with ticket holder result', async function() {
					beforeEach(async () => {
						await fastForward(DAY + SECOND);
					});

					it('winning position is 0, not resolved', async function() {
						answer = await deployedOpenBidMarket.winningPosition();
						assert.equal(answer.toString(), '0');
					});

					it('market resolved', async function() {
						answer = await Thales.increaseAllowance(ThalesBonds.address, fixedBondAmount, {
							from: owner,
						});
						answer = await ExoticPositionalMarketManager.resolveMarket(
							deployedOpenBidMarket.address,
							'1',
							{ from: owner }
						);
						answer = await deployedOpenBidMarket.resolved();
						assert.equal(answer, true);
					});

					it('winning position match outcome position', async function() {
						answer = await Thales.increaseAllowance(ThalesBonds.address, fixedBondAmount, {
							from: owner,
						});
						answer = await ExoticPositionalMarketManager.resolveMarket(
							deployedOpenBidMarket.address,
							outcomePosition,
							{ from: owner }
						);
						answer = await deployedOpenBidMarket.winningPosition();
						assert.equal(answer.toString(), outcomePosition);
					});

					describe('market finalization', async function() {
						beforeEach(async () => {
							answer = await Thales.increaseAllowance(ThalesBonds.address, fixedBondAmount, {
								from: owner,
							});
							answer = await ExoticPositionalMarketManager.resolveMarket(
								deployedOpenBidMarket.address,
								outcomePosition2,
								{ from: owner }
							);
						});
						it('ticket holders can not claim', async function() {
							answer = await deployedOpenBidMarket.canUsersClaim();
							assert.equal(answer, false);
						});
						it('ticket holders can not claim', async function() {
							await fastForward(DAY - 10 * SECOND);
							answer = await deployedOpenBidMarket.canUsersClaim();
							assert.equal(answer, false);
						});
						it('ticket holders can claim', async function() {
							await fastForward(DAY + SECOND);
							answer = await deployedOpenBidMarket.canUsersClaim();
							assert.equal(answer, true);
						});

						describe('claiming reward funds (3% total fees)', async function() {
							beforeEach(async () => {
								await fastForward(DAY + SECOND);
							});
							it('claimable amount', async function() {
								answer = await deployedOpenBidMarket.getUserClaimableAmount(userOne);
								let result =
									(parseFloat(
										positionAmount1
											.add(positionAmount2.add(positionAmount2))
											.add(positionAmount3)
											.toString()
									) *
										0.97) /
									2;
								// assert.equal(answer.toString(), result.toString());
							});
							it('claimed amount match', async function() {
								let result = await Thales.balanceOf(userOne);
								result =
									parseFloat(result.toString()) +
									(parseFloat(
										positionAmount1
											.add(positionAmount2.add(positionAmount2))
											.add(positionAmount3)
											.toString()
									) *
										0.97) /
										2;
								await deployedOpenBidMarket.claimWinningTicket({ from: userOne });
								answer = await Thales.balanceOf(userOne);
								// assert.equal(answer.toString(), result.toString());
								answer = await deployedOpenBidMarket.getUserClaimableAmount(userOne);
								assert.equal(answer.toString(), '0');
							});
						});
					});
				});
			});
		});
	});

	// /// FIXED TICKET MARKETS

	describe('create Fixed ticket Exotic market', function() {
		beforeEach(async () => {
			const timestamp = await currentTime();
			marketQuestion = 'Who will win the el clasico which will be played on 2022-02-22?';
			marketSource = 'http://www.realmadrid.com';
			endOfPositioning = (timestamp + DAY).toString();
			fixedTicketPrice = toUnit('10');
			withdrawalAllowed = true;
			tag = [1, 2, 3];
			paymentToken = Thales.address;
			phrases = ['Real Madrid', 'FC Barcelona', 'It will be a draw'];
			outcomePosition = '1';

			answer = await Thales.increaseAllowance(
				ThalesBonds.address,
				fixedBondAmount.add(fixedTicketPrice),
				{
					from: owner,
				}
			);
			answer = await ExoticPositionalMarketManager.createExoticMarket(
				marketQuestion,
				marketSource,
				endOfPositioning,
				fixedTicketPrice,
				withdrawalAllowed,
				tag,
				phrases.length,
				['1'],
				phrases,
				{ from: owner }
			);

			answer = await ExoticPositionalMarketManager.getActiveMarketAddress('0');
			deployedMarket = await ExoticPositionalMarketContract.at(answer);
		});
		it('new market', async function() {
			answer = await ExoticPositionalMarketManager.numberOfActiveMarkets();
			assert.equal(answer, '1');
		});

		it('new market is active?', async function() {
			answer = await ExoticPositionalMarketManager.isActiveMarket(deployedMarket.address);
			assert.equal(answer, true);
			answer = await deployedMarket.endOfPositioning();
			assert.equal(answer.toString(), endOfPositioning);
		});

		it('manager owner', async function() {
			answer = await ExoticPositionalMarketManager.owner();
			assert.equal(answer.toString(), manager);
		});

		it('manager is the market owner', async function() {
			answer = await deployedMarket.owner();
			assert.equal(answer.toString(), ExoticPositionalMarketManager.address);
		});

		it('creator address match', async function() {
			answer = await ExoticPositionalMarketManager.creatorAddress(deployedMarket.address);
			assert.equal(answer.toString(), owner);
		});

		it('can position', async function() {
			answer = await deployedMarket.canUsersPlacePosition();
			assert.equal(answer, true);
		});

		it('tags match', async function() {
			answer = await deployedMarket.getTagsCount();
			assert.equal(answer.toString(), tag.length.toString());
			for (let i = 0; i < tag.length; i++) {
				answer = await deployedMarket.tags(i.toString());
				assert.equal(answer.toString(), tag[i].toString());
			}
		});

		it('total bond amount', async function() {
			answer = await ThalesBonds.getTotalDepositedBondAmountForMarket(deployedMarket.address);
			assert.equal(answer.toString(), fixedBondAmount);
		});

		it('can not resolve', async function() {
			answer = await deployedMarket.canMarketBeResolved();
			assert.equal(answer, false);
		});

		it('can resolve', async function() {
			await fastForward(DAY + SECOND);
			answer = await deployedMarket.canMarketBeResolved();
			assert.equal(answer, true);
		});
		describe('position and resolve (no Council decision)', function() {
			beforeEach(async () => {
				answer = await Thales.increaseAllowance(ThalesBonds.address, fixedTicketPrice, {
					from: userOne,
				});
			});

			describe('userOne takes position', async function() {
				beforeEach(async () => {
					answer = await deployedMarket.takeAPosition(outcomePosition, { from: userOne });
				});
				it('1 ticket holder', async function() {
					answer = await deployedMarket.totalUsersTakenPositions();
					assert.equal(answer.toString(), '2');
				});
				it('ticket holder position match', async function() {
					answer = await deployedMarket.getUserPosition(userOne);
					assert.equal(answer.toString(), outcomePosition);
				});
				it('ticket holder position phrase match', async function() {
					answer = await deployedMarket.getUserPositionPhrase(userOne);
					assert.equal(answer.toString(), phrases[0]);
				});

				describe('resolve with ticket holder result', async function() {
					beforeEach(async () => {
						await fastForward(DAY + SECOND);
					});

					it('winning position is 0, not resolved', async function() {
						answer = await deployedMarket.winningPosition();
						assert.equal(answer, '0');
					});

					it('market resolved', async function() {
						answer = await Thales.increaseAllowance(ThalesBonds.address, fixedBondAmount, {
							from: owner,
						});
						answer = await ExoticPositionalMarketManager.resolveMarket(
							deployedMarket.address,
							'1',
							{ from: owner }
						);
						answer = await deployedMarket.resolved();
						assert.equal(answer, true);
					});

					it('winning position match outcome position', async function() {
						answer = await Thales.increaseAllowance(ThalesBonds.address, fixedBondAmount, {
							from: owner,
						});
						answer = await ExoticPositionalMarketManager.resolveMarket(
							deployedMarket.address,
							outcomePosition,
							{ from: owner }
						);
						answer = await deployedMarket.winningPosition();
						assert.equal(answer.toString(), outcomePosition);
					});

					describe('market finalization', async function() {
						beforeEach(async () => {
							answer = await Thales.increaseAllowance(ThalesBonds.address, fixedBondAmount, {
								from: owner,
							});
							answer = await ExoticPositionalMarketManager.resolveMarket(
								deployedMarket.address,
								outcomePosition,
								{ from: owner }
							);
						});
						it('ticket holders can not claim', async function() {
							answer = await deployedMarket.canUsersClaim();
							assert.equal(answer, false);
						});
						it('ticket holders can not claim', async function() {
							await fastForward(DAY - 10 * SECOND);
							answer = await deployedMarket.canUsersClaim();
							assert.equal(answer, false);
						});
						it('ticket holders can claim', async function() {
							await fastForward(DAY + SECOND);
							answer = await deployedMarket.canUsersClaim();
							assert.equal(answer, true);
						});

						describe('claiming reward funds (3% total fees)', async function() {
							beforeEach(async () => {
								await fastForward(DAY + SECOND);
							});
							it('claimable amount', async function() {
								answer = await deployedMarket.getUserClaimableAmount(userOne);
								let result = parseFloat(fixedTicketPrice.toString()) * 0.97;
								assert.equal(answer.toString(), result.toString());
							});

							it('claimable fee amount', async function() {
								answer = await deployedMarket.getTotalFeesAmount();
								let result = 2 * (parseFloat(fixedTicketPrice.toString()) * 0.03);
								// assert.equal(answer.toString(), "0");
								assert.equal(answer.toString(), result.toString());
							});

							it('claimed amount match', async function() {
								let result = await Thales.balanceOf(userOne);
								result =
									parseFloat(result.toString()) + parseFloat(fixedTicketPrice.toString()) * 0.97;
								await deployedMarket.claimWinningTicket({ from: userOne });
								answer = await Thales.balanceOf(userOne);
								assert.equal(answer.toString(), result.toString());
								answer = await deployedMarket.getUserClaimableAmount(userOne);
								assert.equal(answer.toString(), '0');
							});
						});
					});
				});
			});
		});

		describe('position and withdraw', function() {
			beforeEach(async () => {
				answer = await Thales.increaseAllowance(ThalesBonds.address, toUnit('100'), {
					from: userOne,
				});
			});

			describe('userOne takes position', async function() {
				beforeEach(async () => {
					answer = await deployedMarket.takeAPosition(outcomePosition, { from: userOne });
				});
				it('1 ticket holder', async function() {
					answer = await deployedMarket.totalUsersTakenPositions();
					assert.equal(answer.toString(), '2');
				});
				it('ticket holder position match', async function() {
					answer = await deployedMarket.getUserPosition(userOne);
					assert.equal(answer.toString(), outcomePosition);
				});
				it('ticket holder position phrase match', async function() {
					answer = await deployedMarket.getUserPositionPhrase(userOne);
					// console.log("Position phrase: ", answer.toString());
					assert.equal(answer.toString(), phrases[0]);
				});

				describe('withdraw (5%)', async function() {
					it('get withdrawal allowed', async function() {
						answer = await deployedMarket.withdrawalAllowed();
						assert.equal(answer, true);
					});

					it('withdrawal fee match', async function() {
						answer = await ExoticPositionalMarketManager.withdrawalPercentage();
						assert.equal(answer.toString(), '6');
					});

					it('userOne can withdraw', async function() {
						answer = await deployedMarket.canUserWithdraw(userOne);
						assert.equal(answer, true);
					});

					it('userTwo can NOT withdraw', async function() {
						answer = await deployedMarket.canUserWithdraw(userTwo);
						assert.equal(answer, false);
					});

					it('userOne withdraws', async function() {
						answer = await Thales.balanceOf(userOne);
						let balance = parseInt(answer.toString());
						let fixedTicket = parseInt(fixedTicketPrice.toString());
						balance = balance + fixedTicket * 0.94;
						answer = await deployedMarket.withdraw({ from: userOne });
						answer = await Thales.balanceOf(userOne);
						assert.equal(answer.toString(), balance.toString());
					});

					it('creator receives withdrawal fee', async function() {
						answer = await Thales.balanceOf(owner);
						let balance = parseInt(answer.toString());
						let fixedTicket = parseInt(fixedTicketPrice.toString());
						balance = balance + Math.floor(parseFloat(fixedTicket) * 0.025);
						//console.log(balance.toString());
						answer = await deployedMarket.withdraw({ from: userOne });
						answer = await Thales.balanceOf(owner);
						assert.isAtLeast(parseFloat(answer.toString()), balance);
					});
				});
			});
		});

		describe('Oracle Council', function() {
			beforeEach(async () => {
				await ThalesOracleCouncil.initialize(manager, ExoticPositionalMarketManager.address, {
					from: manager,
				});
			});

			it('No Oracle Council members', async function() {
				answer = await ThalesOracleCouncil.councilMemberCount();
				assert.equal(answer.toString(), '0');
			});
			it('Add an Oracle Council member', async function() {
				answer = await ThalesOracleCouncil.addOracleCouncilMember(userOne, { from: manager });
				answer = await ThalesOracleCouncil.councilMemberCount();
				assert.equal(answer.toString(), '1');
				answer = await ThalesOracleCouncil.councilMemberAddress('1');
				assert.equal(answer, userOne);
			});
			it('Remove an Oracle Council member', async function() {
				answer = await ThalesOracleCouncil.addOracleCouncilMember(userOne, { from: manager });
				answer = await ThalesOracleCouncil.removeOracleCouncilMember(userOne, { from: manager });
				answer = await ThalesOracleCouncil.councilMemberCount();
				assert.equal(answer.toString(), '0');
			});

			it('Get Council members count', async function() {
				await ThalesOracleCouncil.addOracleCouncilMember(councilOne, { from: manager });
				await ThalesOracleCouncil.addOracleCouncilMember(councilTwo, { from: manager });
				await ThalesOracleCouncil.addOracleCouncilMember(councilThree, { from: manager });
				answer = await ThalesOracleCouncil.councilMemberCount();
				assert.equal(answer.toString(), '3');
			});

			describe('dispute', function() {
				beforeEach(async () => {
					await ThalesOracleCouncil.addOracleCouncilMember(councilOne, { from: manager });
					await ThalesOracleCouncil.addOracleCouncilMember(councilTwo, { from: manager });
					await ThalesOracleCouncil.addOracleCouncilMember(councilThree, { from: manager });
				});

				it('market not disputed', async function() {
					answer = await deployedMarket.disputed();
					assert.equal(answer, false);
				});

				it('market can be disputed', async function() {
					answer = await ThalesOracleCouncil.canMarketBeDisputed(deployedMarket.address);
					assert.equal(answer, true);
				});

				it('market closed for disputes', async function() {
					answer = await ThalesOracleCouncil.closeMarketForDisputes(deployedMarket.address, {
						from: manager,
					});
					answer = await ThalesOracleCouncil.canMarketBeDisputed(deployedMarket.address);
					assert.equal(answer, false);
				});
				describe('dispute market', function() {
					beforeEach(async () => {
						let fixedBondAmount = toUnit(100);
						let disputeString = 'This is a dispute';
						answer = await Thales.increaseAllowance(ThalesBonds.address, fixedBondAmount, {
							from: userTwo,
						});
					});
					it('open a dispute', async function() {
						let disputeString = 'This is a dispute';
						answer = await ThalesOracleCouncil.openDispute(deployedMarket.address, disputeString, {
							from: userTwo,
						});
						answer = await deployedMarket.disputed();
						assert.equal(answer, true);
					});
					it('get total open diputes', async function() {
						let disputeString = 'This is a dispute';
						answer = await ThalesOracleCouncil.openDispute(deployedMarket.address, disputeString, {
							from: userTwo,
						});
						answer = await ThalesOracleCouncil.getMarketOpenDisputes(deployedMarket.address);
						assert.equal(answer.toString(), '1');
					});
					it('open 10 diputes', async function() {
						let disputeString = 'This is a dispute';
						for (let i = 1; i <= 10; i++) {
							answer = await Thales.increaseAllowance(ThalesBonds.address, fixedBondAmount, {
								from: userTwo,
							});
							answer = await ThalesOracleCouncil.openDispute(
								deployedMarket.address,
								disputeString,
								{
									from: userTwo,
								}
							);
							answer = await ThalesOracleCouncil.getMarketOpenDisputes(deployedMarket.address);
							assert.equal(answer.toString(), i.toString());
						}
					});
					it('get next open dipute', async function() {
						let disputeString = 'This is a dispute';
						answer = await ThalesOracleCouncil.openDispute(deployedMarket.address, disputeString, {
							from: userTwo,
						});
						answer = await ThalesOracleCouncil.getMarketOpenDisputes(deployedMarket.address);
						assert.equal(answer.toString(), '1');
					});
					it('get total closed diputes', async function() {
						let disputeString = 'This is a dispute';
						answer = await ThalesOracleCouncil.openDispute(deployedMarket.address, disputeString, {
							from: userTwo,
						});
						answer = await ThalesOracleCouncil.marketLastClosedDispute(deployedMarket.address);
						assert.equal(answer.toString(), '0');
					});
					it('match dispute string', async function() {
						let disputeString = 'This is a dispute';
						answer = await ThalesOracleCouncil.openDispute(deployedMarket.address, disputeString, {
							from: userTwo,
						});
						let index = await ThalesOracleCouncil.getMarketOpenDisputes(deployedMarket.address);
						answer = await ThalesOracleCouncil.getDisputeString(
							deployedMarket.address,
							index.toString()
						);
						assert.equal(answer.toString(), disputeString);
					});
					it('get total bond claimable amount', async function() {
						let disputeString = 'This is a dispute';
						answer = await ThalesOracleCouncil.openDispute(deployedMarket.address, disputeString, {
							from: userTwo,
						});
						answer = await ThalesBonds.getClaimableBondAmountForMarket(deployedMarket.address);
						let bond = fixedBondAmount.add(disputePrice);
						assert.equal(answer.toString(), bond.toString());
					});

					describe('dispute votting', function() {
						let disputeString = 'This is a dispute';
						let dispute_code_1 = '1'; // ACCEPT SLASH
						let dispute_code_2 = '2'; // ACCEPT NO SLASH
						beforeEach(async () => {
							answer = await ThalesOracleCouncil.openDispute(
								deployedMarket.address,
								disputeString,
								{ from: userTwo }
							);
						});
						it('vote for a dispute', async function() {
							let disputeIndex = await ThalesOracleCouncil.getMarketOpenDisputes(
								deployedMarket.address
							);
							answer = await ThalesOracleCouncil.voteForDispute(
								deployedMarket.address,
								disputeIndex,
								dispute_code_1,
								'0',
								{ from: councilOne }
							);
							answer = await ThalesOracleCouncil.getVotesCountForMarketDispute(
								deployedMarket.address,
								disputeIndex
							);
							assert.equal(answer.toString(), '1');
						});
						it('get number of votes of option ' + dispute_code_1, async function() {
							let disputeIndex = await ThalesOracleCouncil.getMarketOpenDisputes(
								deployedMarket.address
							);
							answer = await ThalesOracleCouncil.voteForDispute(
								deployedMarket.address,
								disputeIndex,
								dispute_code_1,
								'0',
								{ from: councilOne }
							);
							answer = await ThalesOracleCouncil.disputeVotesCount(
								deployedMarket.address,
								disputeIndex,
								dispute_code_1
							);
							assert.equal(answer.toString(), '1');
						});
						it('get max votes for dispute', async function() {
							let disputeIndex = await ThalesOracleCouncil.getMarketOpenDisputes(
								deployedMarket.address
							);
							answer = await ThalesOracleCouncil.getNumberOfCouncilMembersForMarketDispute(
								deployedMarket.address,
								disputeIndex
							);
							assert.equal(answer.toString(), '3');
						});
						it('get votes missing for dispute, after 1/3 voting', async function() {
							let disputeIndex = await ThalesOracleCouncil.getMarketOpenDisputes(
								deployedMarket.address
							);
							answer = await ThalesOracleCouncil.voteForDispute(
								deployedMarket.address,
								disputeIndex,
								dispute_code_1,
								'0',
								{ from: councilOne }
							);
							answer = await ThalesOracleCouncil.getVotesMissingForMarketDispute(
								deployedMarket.address,
								disputeIndex
							);
							assert.equal(answer.toString(), '2');
						});
						it('2 votes with codes ' + dispute_code_1 + ' and ' + dispute_code_2, async function() {
							let disputeIndex = await ThalesOracleCouncil.getMarketOpenDisputes(
								deployedMarket.address
							);
							answer = await ThalesOracleCouncil.voteForDispute(
								deployedMarket.address,
								disputeIndex,
								dispute_code_1,
								'0',
								{ from: councilOne }
							);
							answer = await ThalesOracleCouncil.voteForDispute(
								deployedMarket.address,
								disputeIndex,
								dispute_code_2,
								'0',
								{ from: councilTwo }
							);
							answer = await ThalesOracleCouncil.getVotesCountForMarketDispute(
								deployedMarket.address,
								disputeIndex
							);
							assert.equal(answer.toString(), '2');
						});
						it(
							'2 votes with codes ' +
								dispute_code_1 +
								' and ' +
								dispute_code_2 +
								', market open for disputes',
							async function() {
								let disputeIndex = await ThalesOracleCouncil.getMarketOpenDisputes(
									deployedMarket.address
								);
								answer = await ThalesOracleCouncil.voteForDispute(
									deployedMarket.address,
									disputeIndex,
									dispute_code_1,
									'0',
									{ from: councilOne }
								);
								answer = await ThalesOracleCouncil.voteForDispute(
									deployedMarket.address,
									disputeIndex,
									dispute_code_2,
									'0',
									{ from: councilTwo }
								);
								answer = await ThalesOracleCouncil.marketClosedForDisputes(deployedMarket.address);
								assert.equal(answer, false);
							}
						);
						it(
							'2 votes with codes ' +
								dispute_code_1 +
								' and ' +
								dispute_code_1 +
								', market closed for disputes',
							async function() {
								let disputeIndex = await ThalesOracleCouncil.getMarketOpenDisputes(
									deployedMarket.address
								);
								answer = await ThalesOracleCouncil.voteForDispute(
									deployedMarket.address,
									disputeIndex,
									dispute_code_1,
									'0',
									{ from: councilOne }
								);
								answer = await ThalesOracleCouncil.voteForDispute(
									deployedMarket.address,
									disputeIndex,
									dispute_code_1,
									'0',
									{ from: councilTwo }
								);
								answer = await ThalesOracleCouncil.marketClosedForDisputes(deployedMarket.address);
								assert.equal(answer, true);
							}
						);

						describe('disputes in positioning phase', function() {
							let disputeIndex;
							beforeEach(async () => {
								disputeIndex = await ThalesOracleCouncil.getMarketOpenDisputes(
									deployedMarket.address
								);
								answer = await Thales.increaseAllowance(ThalesBonds.address, fixedTicketPrice, {
									from: userOne,
								});
								answer = await Thales.increaseAllowance(ThalesBonds.address, fixedTicketPrice, {
									from: userTwo,
								});
								answer = await Thales.increaseAllowance(ThalesBonds.address, fixedTicketPrice, {
									from: userThree,
								});
							});
							it('users can take position', async function() {
								answer = await deployedMarket.canUsersPlacePosition();
								assert.equal(answer, true);
							});
							it('3 ticket purchases with 3 different positions', async function() {
								answer = await deployedMarket.takeAPosition('1', { from: userOne });
								answer = await deployedMarket.takeAPosition('2', { from: userTwo });
								answer = await deployedMarket.takeAPosition('3', { from: userThree });
								answer = await deployedMarket.totalUsersTakenPositions();
								assert.equal(answer.toString(), '4');
							});

							describe('ACCEPT_SLASH (Code 1)', function() {
								beforeEach(async () => {
									answer = await deployedMarket.takeAPosition('1', { from: userOne });
									answer = await deployedMarket.takeAPosition('2', { from: userTwo });
									answer = await deployedMarket.takeAPosition('3', { from: userThree });
									answer = await ThalesOracleCouncil.voteForDispute(
										deployedMarket.address,
										disputeIndex,
										dispute_code_1,
										'0',
										{ from: councilOne }
									);
									answer = await ThalesOracleCouncil.voteForDispute(
										deployedMarket.address,
										disputeIndex,
										dispute_code_1,
										'0',
										{ from: councilTwo }
									);
								});
								it('Market closed for disputes', async function() {
									answer = await ThalesOracleCouncil.marketClosedForDisputes(
										deployedMarket.address
									);
									assert.equal(answer, true);
								});
								it('BackstopTimeout set', async function() {
									answer = await deployedMarket.backstopTimeout();
									assert.equal(answer.toString(), (4 * HOUR).toString());
								});
								it('market dispute flag -> false', async function() {
									answer = await deployedMarket.disputed();
									assert.equal(answer, false);
								});
								it('market cancelled -> resolve: true', async function() {
									answer = await deployedMarket.resolved();
									assert.equal(answer, true);
								});
								it('market cancelled -> winning position: 0', async function() {
									answer = await deployedMarket.winningPosition();
									assert.equal(answer.toString(), '0');
								});
								it('market cancelled -> totalUsersTakenPositions: 3', async function() {
									answer = await deployedMarket.totalUsersTakenPositions();
									assert.equal(answer.toString(), '4');
								});
								it('market cancelled -> users can not claim: backstop timeout', async function() {
									answer = await deployedMarket.canUsersClaim();
									assert.equal(answer, false);
								});
								it('market cancelled -> users can claim: backstop passed', async function() {
									await fastForward(4 * HOUR + 10 * SECOND);
									answer = await deployedMarket.canUsersClaim();
									assert.equal(answer, true);
								});
							});
						});
					});
				});
			});
		});
	});
});
