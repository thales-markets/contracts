'use strict';

const { artifacts, contract, web3 } = require('hardhat');

const { assert } = require('../../utils/common');

const { currentTime, toUnit, fastForward, bytesToString } = require('../../utils')();

const {
	onlyGivenAddressCanInvoke,
	convertToDecimals,
	encodeCall,
	assertRevert,
} = require('../../utils/helpers');

const { expect } = require('chai');
const { toBN } = require('web3-utils');

const SECOND = 1;
const HOUR = 3600;
const DAY = 86400;
const WEEK = 604800;
const YEAR = 31556926;

const ZERO_ADDRESS = '0x' + '0'.repeat(40);
const MAX_NUMBER = '115792089237316195423570985008687907853269984665640564039457584007913129639935';

const ExoticPositionalMarketContract = artifacts.require('ExoticPositionalMarket');
const ExoticPositionalMarketManagerContract = artifacts.require('ExoticPositionalMarketManager');
const ThalesOracleCouncilContract = artifacts.require('ThalesOracleCouncil');
const ThalesContract = artifacts.require('contracts/Token/OpThales_L1.sol:OpThales');
const ThalesBondsContract = artifacts.require('ThalesBonds');
const ExoticPositionalTagsContract = artifacts.require('ExoticPositionalTags');
let ExoticPositionalMarket;
let ExoticPositionalMarketManager;
let ExoticPositionalTags;
let ThalesOracleCouncil;
let Thales;
let ThalesBonds;
let answer;
let minimumPositioningDuration = 0;
let minimumMarketMaturityDuration = 0;

let marketQuestion,
	marketSource,
	endOfPositioning,
	fixedTicketPrice,
	positionAmount1,
	positionAmount2,
	positionAmount3,
	withdrawalAllowed,
	tag,
	paymentToken,
	phrases = [],
	deployedMarket,
	fixedBondAmount,
	outcomePosition;

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
	let initializeData;
	beforeEach(async () => {
		ExoticPositionalMarket = await ExoticPositionalMarketContract.new();
		ExoticPositionalMarketManager = await ExoticPositionalMarketManagerContract.new();
		ThalesOracleCouncil = await ThalesOracleCouncilContract.new({ from: owner });
		Thales = await ThalesContract.new({ from: owner });
		ThalesBonds = await ThalesBondsContract.new();
		ExoticPositionalTags = await ExoticPositionalTagsContract.new();
		await ExoticPositionalTags.initialize(manager, {from:manager});
		await ThalesBonds.initialize(manager, { from: manager });

		await ExoticPositionalMarketManager.initialize(
			manager,
			minimumPositioningDuration,
			Thales.address,
			{ from: manager }
		);
		fixedBondAmount = toUnit(100);
		await ExoticPositionalMarketManager.setExoticMarketMastercopy(ExoticPositionalMarket.address);
		await ExoticPositionalMarketManager.setOracleCouncilAddress(ThalesOracleCouncil.address);
		await ExoticPositionalMarketManager.setThalesBonds(ThalesBonds.address);
		await ExoticPositionalMarketManager.setTagsAddress(ExoticPositionalTags.address);
		await ThalesBonds.setMarketManager(ExoticPositionalMarketManager.address, { from: manager });
		await ExoticPositionalMarketManager.setFixedBondAmount(fixedBondAmount, { from: manager });
		await ExoticPositionalMarketManager.setSafeBoxAddress(safeBox, { from: manager });
		await ExoticPositionalMarketManager.setMaximumPositionsAllowed('5', { from: manager });
		await Thales.transfer(userOne, toUnit('1000'), { from: owner });
		await Thales.transfer(userTwo, toUnit('1000'), { from: owner });
		await Thales.transfer(userThree, toUnit('1000'), { from: owner });

		await ExoticPositionalTags.addTag("Sport", "1");
		await ExoticPositionalTags.addTag("Football", "101");
		await ExoticPositionalTags.addTag("Basketball", "102");
		await ExoticPositionalTags.addTag("Crypto", "2");
		await ExoticPositionalTags.addTag("Bitcoin", "201");
		await ExoticPositionalTags.addTag("Politics", "3");
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
			outcomePosition = '1';

			answer = await Thales.increaseAllowance(ThalesBonds.address, fixedBondAmount, {
				from: owner,
			});
			answer = await ExoticPositionalMarketManager.createExoticMarket(
				marketQuestion,
				marketSource,
				endOfPositioning,
				fixedTicketPrice,
				withdrawalAllowed,
				tag,
				phrases.length,
				phrases,
				{ from: owner }
			);

			answer = await ExoticPositionalMarketManager.getActiveMarketAddress('0');
			deployedMarket = await ExoticPositionalMarketContract.at(answer);
			answer = await deployedMarket.ticketType();
			assert.equal(answer, '0');
		});
		
		it('new market open bid', async function() {
			const timestamp = await currentTime();
			marketQuestion = 'Who will win the el clasico which will be played on 2022-02-22?';
			marketSource = 'http://www.realmadrid.com';
			endOfPositioning = (timestamp + DAY).toString();
			fixedTicketPrice = "0";
			withdrawalAllowed = true;
			tag = [1, 2, 3];
			paymentToken = Thales.address;
			phrases = ['Real Madrid', 'FC Barcelona', 'It will be a draw'];
			outcomePosition = '1';
			
			answer = await Thales.increaseAllowance(ThalesBonds.address, fixedBondAmount, {
				from: owner,
			});
			answer = await ExoticPositionalMarketManager.createExoticMarket(
				marketQuestion,
				marketSource,
				endOfPositioning,
				fixedTicketPrice,
				withdrawalAllowed,
				tag,
				phrases.length,
				phrases,
				{ from: owner }
				);
				
			answer = await ExoticPositionalMarketManager.getActiveMarketAddress('0');
			deployedMarket = await ExoticPositionalMarketContract.at(answer);
			answer = await deployedMarket.ticketType();
			assert.equal(answer, '1');
		});
	});

	describe('create Open bid Exotic market', function() {
		beforeEach(async () => {
			const timestamp = await currentTime();
			marketQuestion = 'Who will win the el clasico which will be played on 2022-02-22?';
			marketSource = 'http://www.realmadrid.com';
			endOfPositioning = (timestamp + DAY).toString();
			fixedTicketPrice = toUnit('0');
			positionAmount1 = toUnit('100');
			positionAmount2 = toUnit('20');
			positionAmount3 = toUnit('50');
			withdrawalAllowed = true;
			tag = [1, 2, 3];
			paymentToken = Thales.address;
			phrases = ['Real Madrid', 'Draw', 'FC Barcelona'];
			outcomePosition = '1';

			answer = await Thales.increaseAllowance(ThalesBonds.address, fixedBondAmount, {
				from: owner,
			});
			answer = await ExoticPositionalMarketManager.createExoticMarket(
				marketQuestion,
				marketSource,
				endOfPositioning,
				fixedTicketPrice,
				withdrawalAllowed,
				tag,
				phrases.length,
				phrases,
				{ from: owner }
			);

			answer = await ExoticPositionalMarketManager.getActiveMarketAddress('0');
			deployedMarket = await ExoticPositionalMarketContract.at(answer);
		});
		it('new market', async function() {
			answer = await ExoticPositionalMarketManager.numOfActiveMarkets();
			assert.equal(answer, '1');
		});
		
		it('market type: fixed Bid', async function() {
			answer = await deployedMarket.ticketType();
			assert.equal(answer, '1');
		});

		it('new market is active?', async function() {
			answer = await ExoticPositionalMarketManager.isActiveMarket(deployedMarket.address);
			// console.log('Market address: ', deployedMarket.address);
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
				let sumOfPositions = positionAmount1.add(positionAmount2).add(positionAmount3);
				answer = await Thales.increaseAllowance(deployedMarket.address, sumOfPositions, {
					from: userOne,
				});
			});

			describe('userOne takes position', async function() {
				beforeEach(async () => {
					answer = await deployedMarket.takeOpenBidPositions([outcomePosition],[positionAmount1], { from: userOne });
				});
				it('1 ticket holder', async function() {
					answer = await deployedMarket.totalUsersTakenPositions();
					assert.equal(answer, outcomePosition);
				});
				it('ticket holder position match', async function() {
					answer = await deployedMarket.getAllUserPositions(userOne);
					console.log(answer.toString())
					// assert.equal(answer.toString(), outcomePosition);
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
						answer = await Thales.increaseAllowance(deployedMarket.address, fixedBondAmount, {
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
						answer = await Thales.increaseAllowance(deployedMarket.address, fixedBondAmount, {
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
							answer = await Thales.increaseAllowance(deployedMarket.address, fixedBondAmount, {
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
								console.log("Claimable: ",answer.toString());
								let result = parseFloat(positionAmount1.toString()) * 0.97;
								assert.equal(answer.toString(), result.toString());
							});
							it('claimed amount match', async function() {
								let result = await Thales.balanceOf(userOne);
								result =
									parseFloat(result.toString()) + parseFloat(positionAmount1.toString()) * 0.97;
								await deployedMarket.claimWinningTicket({ from: userOne });
								answer = await Thales.balanceOf(userOne);
								assert.equal(answer.toString(), result.toString());
								answer = await deployedMarket.getUserClaimableAmount(userOne);
								console.log("Claimable: ",answer.toString());
								assert.equal(answer.toString(), "0");
							});
						});
					});
				});
			});
		});
	});

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

			answer = await Thales.increaseAllowance(ThalesBonds.address, fixedBondAmount, {
				from: owner,
			});
			answer = await ExoticPositionalMarketManager.createExoticMarket(
				marketQuestion,
				marketSource,
				endOfPositioning,
				fixedTicketPrice,
				withdrawalAllowed,
				tag,
				phrases.length,
				phrases,
				{ from: owner }
			);

			answer = await ExoticPositionalMarketManager.getActiveMarketAddress('0');
			deployedMarket = await ExoticPositionalMarketContract.at(answer);
		});
		it('new market', async function() {
			answer = await ExoticPositionalMarketManager.numOfActiveMarkets();
			assert.equal(answer, '1');
		});

		it('new market is active?', async function() {
			answer = await ExoticPositionalMarketManager.isActiveMarket(deployedMarket.address);
			// console.log('Market address: ', deployedMarket.address);
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
				answer = await Thales.increaseAllowance(deployedMarket.address, fixedTicketPrice, {
					from: userOne,
				});
			});

			describe('userOne takes position', async function() {
				beforeEach(async () => {
					answer = await deployedMarket.takeAPosition(outcomePosition, { from: userOne });
				});
				it('1 ticket holder', async function() {
					answer = await deployedMarket.totalUsersTakenPositions();
					assert.equal(answer, outcomePosition);
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

				describe('resolve with ticket holder result', async function() {
					beforeEach(async () => {
						await fastForward(DAY + SECOND);
					});

					it('winning position is 0, not resolved', async function() {
						answer = await deployedMarket.winningPosition();
						assert.equal(answer, '0');
					});

					it('market resolved', async function() {
						answer = await Thales.increaseAllowance(deployedMarket.address, fixedBondAmount, {
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
						answer = await Thales.increaseAllowance(deployedMarket.address, fixedBondAmount, {
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
							answer = await Thales.increaseAllowance(deployedMarket.address, fixedBondAmount, {
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
							it('claimed amount match', async function() {
								let result = await Thales.balanceOf(userOne);
								result =
									parseFloat(result.toString()) + parseFloat(fixedTicketPrice.toString()) * 0.97;
								await deployedMarket.claimWinningTicket({ from: userOne });
								answer = await Thales.balanceOf(userOne);
								assert.equal(answer.toString(), result.toString());
								answer = await deployedMarket.getUserClaimableAmount(userOne);
								console.log("Claimable: ",answer.toString());
								assert.equal(answer.toString(), "0");
							});
						});
					});
				});
			});
		});

		describe('position and withdraw', function() {
			beforeEach(async () => {
				answer = await Thales.increaseAllowance(deployedMarket.address, toUnit('100'), {
					from: userOne,
				});
			});

			describe('userOne takes position', async function() {
				beforeEach(async () => {
					answer = await deployedMarket.takeAPosition(outcomePosition, { from: userOne });
				});
				it('1 ticket holder', async function() {
					answer = await deployedMarket.totalUsersTakenPositions();
					assert.equal(answer, outcomePosition);
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
						console.log(balance.toString());
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
						answer = await ThalesOracleCouncil.getNextOpenDisputeIndex(deployedMarket.address);
						assert.equal(answer.toString(), '1');
					});
					it('get total closed diputes', async function() {
						let disputeString = 'This is a dispute';
						answer = await ThalesOracleCouncil.openDispute(deployedMarket.address, disputeString, {
							from: userTwo,
						});
						answer = await ThalesOracleCouncil.getMarketClosedDisputes(deployedMarket.address);
						assert.equal(answer.toString(), '0');
					});
					it('match dispute string', async function() {
						let disputeString = 'This is a dispute';
						answer = await ThalesOracleCouncil.openDispute(deployedMarket.address, disputeString, {
							from: userTwo,
						});
						let index = await ThalesOracleCouncil.getMarketOpenDisputes(deployedMarket.address);
						answer = await ThalesOracleCouncil.getDistputeString(
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
						let bond = fixedBondAmount * 2;
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
							let disputeIndex = await ThalesOracleCouncil.getNextOpenDisputeIndex(
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
							let disputeIndex = await ThalesOracleCouncil.getNextOpenDisputeIndex(
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
							let disputeIndex = await ThalesOracleCouncil.getNextOpenDisputeIndex(
								deployedMarket.address
							);
							answer = await ThalesOracleCouncil.getNumberOfCouncilMembersForMarketDispute(
								deployedMarket.address,
								disputeIndex
							);
							assert.equal(answer.toString(), '3');
						});
						it('get votes missing for dispute, after 1/3 voting', async function() {
							let disputeIndex = await ThalesOracleCouncil.getNextOpenDisputeIndex(
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
							let disputeIndex = await ThalesOracleCouncil.getNextOpenDisputeIndex(
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
								let disputeIndex = await ThalesOracleCouncil.getNextOpenDisputeIndex(
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
								let disputeIndex = await ThalesOracleCouncil.getNextOpenDisputeIndex(
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
								disputeIndex = await ThalesOracleCouncil.getNextOpenDisputeIndex(
									deployedMarket.address
								);
								answer = await Thales.increaseAllowance(deployedMarket.address, fixedTicketPrice, {
									from: userOne,
								});
								answer = await Thales.increaseAllowance(deployedMarket.address, fixedTicketPrice, {
									from: userTwo,
								});
								answer = await Thales.increaseAllowance(deployedMarket.address, fixedTicketPrice, {
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
								assert.equal(answer.toString(), '3');
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
									assert.equal(answer.toString(), '3');
								});
								it('market cancelled -> users can not claim: backstop timeout', async function() {
									answer = await deployedMarket.canUsersClaim();
									assert.equal(answer, false);
								});
								it('market cancelled -> users can claim: backstop passed', async function() {
									await fastForward(4 * HOUR + 5);
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
