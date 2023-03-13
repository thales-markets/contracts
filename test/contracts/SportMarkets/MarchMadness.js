'use strict';

const { expect } = require('chai');
const { artifacts, contract, network } = require('hardhat');

const { assert } = require('../../utils/common');

const { toUnit } = require('../../utils')();

contract('MarchMadness', (accounts) => {
	const [first, owner, second, third] = accounts;
	let MarchMadnessContract;
	let marchMadness;

	const bracketsArray = Array(63).fill(1);

	beforeEach(async () => {
		MarchMadnessContract = artifacts.require('MarchMadness');

		marchMadness = await MarchMadnessContract.new({
			from: owner,
		});
	});

	describe('Contract managment', () => {
		it('Init checking', async () => {
			assert.bnEqual('Overtime March Madness', await marchMadness.name());
			assert.bnEqual('OMM', await marchMadness.symbol());
		});

		it('Should revert, paused contract', async () => {
			await marchMadness.setPaused(true, { from: owner });

			await expect(marchMadness.mint(bracketsArray, { from: first })).to.be.revertedWith(
				'Pausable: paused'
			);
		});

		it('Should revert, trying to set up date range, not owner', async () => {
			// Initial value not provided
			assert.bnEqual(await marchMadness.canNotMintOrUpdateAfter(), 0);

			const dateTo = new Date('01-12-2023').getTime();

			await expect(
				marchMadness.setFinalDateForPositioning(dateTo, { from: first })
			).to.be.revertedWith('Ownable: caller is not the owner');
		});

		it('Should set date range and emit event', async () => {
			// Initial value not provided
			assert.bnEqual(await marchMadness.canNotMintOrUpdateAfter(), 0);

			const dateTo = new Date('01-12-2023').getTime();

			const tx = await marchMadness.setFinalDateForPositioning(dateTo, { from: owner });

			assert.bnEqual(dateTo, await marchMadness.canNotMintOrUpdateAfter());

			assert.eventEqual(tx.logs[0], 'FinalPositioningDateUpdated', {
				_toDate: dateTo,
			});
		});

		it('Should revert adding the result for game, not owner', async () => {
			await expect(marchMadness.setResultForGame(1, 1, { from: first })).to.be.revertedWith(
				'Ownable: caller is not the owner'
			);
		});

		it('Should set array of results', async () => {
			const _results = Array(63).fill(2);

			_results[1] = 15;
			_results[5] = 35;

			await marchMadness.setResultArray(_results, { from: owner });

			assert.bnEqual(await marchMadness.results(5), _results[5]);
		});

		it('Should revert adding the points to round, then pass when it called by owner', async () => {
			await expect(marchMadness.setPointsToRound(0, 2, { from: first })).to.be.revertedWith(
				'Ownable: caller is not the owner'
			);

			await marchMadness.setPointsToRound(0, 2, { from: owner });

			assert.bnEqual(await marchMadness.roundToPoints(0), 2);
		});

		it('Should assign gameIds to round', async () => {
			const gameIdsArray = Array.from({ length: 32 }, (_, k) => k + 1);

			await marchMadness.assignGameIdsToRound(0, gameIdsArray, { from: owner });

			assert.bnEqual(await marchMadness.roundToGameIds(0, 4), 5);
		});
	});

	describe('Minting', () => {
		it('Should revert minting, not in date range', async () => {
			const currentBlockTime = new Date('02-17-2023').getTime() / 1000;
			await network.provider.send('evm_setNextBlockTimestamp', [currentBlockTime]);

			const dateTo = new Date('02-15-2023').getTime() / 1000;

			await marchMadness.setFinalDateForPositioning(dateTo, { from: owner });

			await expect(marchMadness.mint(bracketsArray, { from: first })).to.be.revertedWith(
				'Can not mint after settled date'
			);
		});

		it('Should mint', async () => {
			const dateTo = new Date('02-25-2023').getTime() / 1000;

			await marchMadness.setFinalDateForPositioning(dateTo, { from: owner });

			await marchMadness.mint(bracketsArray, { from: first });

			assert.bnEqual(await marchMadness.getBracketsByMinter(first), bracketsArray);

			assert.bnGt(await marchMadness.balanceOf(first), 0);
		});

		it('Should revert, already minted from address', async () => {
			const dateTo = new Date('02-25-2023').getTime() / 1000;

			await marchMadness.setFinalDateForPositioning(dateTo, { from: owner });

			await marchMadness.mint(bracketsArray, { from: first });

			assert.bnGt(await marchMadness.balanceOf(first), 0);

			await expect(marchMadness.mint(bracketsArray, { from: first })).to.be.revertedWith(
				'Address already minted'
			);
		});
	});

	describe('Updating minted positions/Getting correct positions', () => {
		it('Should update already minted position, before that testing reverting on update brackets', async () => {
			const dateTo = new Date('02-25-2023').getTime() / 1000;

			await marchMadness.setFinalDateForPositioning(dateTo, { from: owner });

			await marchMadness.mint(bracketsArray, { from: first });

			assert.bnGt(await marchMadness.balanceOf(first), 0);

			const newBrackets = Array.from({ length: 63 }, () =>
				Math.floor(Math.random() == 0 ? 1 : Math.random() * 64)
			);

			const newFirstPosition = 3;
			const newSecondPosition = 4;

			newBrackets[0] = newFirstPosition;
			newBrackets[1] = newSecondPosition;

			await expect(
				marchMadness.updateBracketsForAlreadyMintedItem(1, newBrackets, { from: second })
			).to.be.revertedWith('Caller is not owner of entered tokenId');

			await expect(
				marchMadness.updateBracketsForAlreadyMintedItem(2, newBrackets, { from: second })
			).to.be.revertedWith('Item does not exists');

			await marchMadness.updateBracketsForAlreadyMintedItem(1, newBrackets, { from: first });

			assert.bnEqual(await marchMadness.itemToBrackets(1, 0), newFirstPosition);
			assert.bnEqual(await marchMadness.itemToBrackets(1, 1), newSecondPosition);
		});

		it('Should display count of correct positions', async () => {
			const dateTo = new Date('02-25-2023').getTime() / 1000;

			await marchMadness.setFinalDateForPositioning(dateTo, { from: owner });

			const newBrackets = Array.from({ length: 63 }, () => Math.floor((Math.random() + 0.1) * 64));

			const newFirstPosition = 3;
			const newSecondPosition = 4;

			const newLastPosition = 50;

			newBrackets[0] = newFirstPosition;
			newBrackets[1] = newSecondPosition;

			newBrackets[60] = newLastPosition;

			await marchMadness.mint(newBrackets, { from: first });

			assert.bnGt(await marchMadness.balanceOf(first), 0);

			await marchMadness.setResultForGame(0, newFirstPosition, { from: owner });
			await marchMadness.setResultForGame(1, newSecondPosition, { from: owner });
			await marchMadness.setResultForGame(60, newLastPosition, { from: owner });

			assert.bnEqual(await marchMadness.getCorrectPositionsByTokenId(1), 3);
			assert.bnEqual(await marchMadness.getCorrectPositionsByTokenId(1), 3);

			assert.bnEqual(await marchMadness.getCorrectPositionsByMinterAddress(first), 3);
			assert.bnEqual(await marchMadness.getCorrectPositionsByMinterAddress(first), 3);
		});

		it('Should display count of correct positions from round, also show display points for that round', async () => {
			// Setting the final date for positioning
			const dateTo = new Date('02-25-2023').getTime() / 1000;
			await marchMadness.setFinalDateForPositioning(dateTo, { from: owner });

			// Setting gameIds for round
			const gameIdsArray = Array.from({ length: 32 }, (_, k) => k + 1);
			await marchMadness.assignGameIdsToRound(0, gameIdsArray, { from: owner });
			assert.bnEqual(await marchMadness.roundToGameIds(0, 4), 5);

			// Results
			const resultsForForFirstRound = Array(32).fill(1);
			resultsForForFirstRound[2] = 10;
			resultsForForFirstRound[3] = 15;
			resultsForForFirstRound[4] = 13;
			resultsForForFirstRound[6] = 21;
			resultsForForFirstRound[7] = 18;
			resultsForForFirstRound[8] = 33;

			for (let i = 0; i < resultsForForFirstRound.length; i++) {
				await marchMadness.setResultForGame(i, resultsForForFirstRound[i], { from: owner });
			}

			const brackets = Array(63).fill(2);
			brackets[2] = 10;
			brackets[3] = 15;
			brackets[4] = 13;
			brackets[6] = 21;
			brackets[7] = 18;
			brackets[8] = 33;

			await marchMadness.mint(brackets, { from: first });

			assert.bnEqual(await marchMadness.getCorrectPositionsPerRoundByTokenId(0, 1), 6);

			await marchMadness.setPointsToRound(0, 12, { from: owner });

			assert.bnEqual(await marchMadness.getTotalPointsByTokenId(1), 6 * 12);
		});
	});

	describe('Multiple rounds final testing', () => {
		it('Should return count of correct positions and total points', async () => {
			// Setting the final date for positioning
			const dateTo = new Date('02-25-2023').getTime() / 1000;
			await marchMadness.setFinalDateForPositioning(dateTo, { from: owner });

			// Setting gameIds for round
			const gameIdsForFirstRound = Array.from({ length: 32 }, (_, k) => k);
			const gameIdsForSecondRound = Array.from({ length: 16 }, (_, k) => k + 31);
			const gameIdsForThirdRound = Array.from({ length: 8 }, (_, k) => k + 47);
			const gameIdsForFourthRound = Array.from({ length: 4 }, (_, k) => k + 55);
			const gameIdsForFifthRound = [60, 61];
			const gameIdsForSixthRound = [62];

			await marchMadness.assignGameIdsToRound(0, gameIdsForFirstRound, { from: owner });
			await marchMadness.assignGameIdsToRound(1, gameIdsForSecondRound, { from: owner });
			await marchMadness.assignGameIdsToRound(2, gameIdsForThirdRound, { from: owner });
			await marchMadness.assignGameIdsToRound(3, gameIdsForFourthRound, { from: owner });
			await marchMadness.assignGameIdsToRound(4, gameIdsForFifthRound, { from: owner });
			await marchMadness.assignGameIdsToRound(5, gameIdsForSixthRound, { from: owner });

			// Set results for games
			const results = Array(63).fill(1);

			// First round
			results[7] = 15;
			results[10] = 23;
			results[15] = 18;
			results[17] = 41;
			results[18] = 44;
			results[25] = 12;

			// Second round
			results[34] = 15;
			results[36] = 23;
			results[38] = 18;
			results[39] = 41;
			results[41] = 12;

			// Third round
			results[49] = 15;
			results[51] = 18;
			results[52] = 41;
			results[54] = 23;

			// Fourth round
			results[56] = 18;
			results[57] = 23;
			results[58] = 41;

			// Fifth round
			results[60] = 18;

			// Final
			results[62] = 18;

			for (let i = 0; i < results.length; i++) {
				await marchMadness.setResultForGame(i, results[i], { from: owner });
			}

			const brackets = Array(63).fill(3);

			// First round
			brackets[7] = 15;
			brackets[10] = 23;
			brackets[15] = 18;
			brackets[17] = 41;
			brackets[18] = 44;
			brackets[25] = 12;

			// Second round
			brackets[34] = 15;
			brackets[36] = 23;
			brackets[38] = 18;
			brackets[39] = 41;
			brackets[41] = 12;

			// Third round
			brackets[49] = 15;
			brackets[51] = 18;
			brackets[52] = 41;
			brackets[54] = 23;

			// Fourth round
			brackets[56] = 18;
			brackets[57] = 23;
			brackets[58] = 41;

			// Fifth round
			brackets[60] = 18;

			// Final
			brackets[62] = 18;

			await marchMadness.mint(brackets, { from: first });

			assert.bnEqual(await marchMadness.getCorrectPositionsPerRoundByTokenId(0, 1), 6);
			assert.bnEqual(await marchMadness.getCorrectPositionsPerRoundByTokenId(1, 1), 5);
			assert.bnEqual(await marchMadness.getCorrectPositionsPerRoundByTokenId(2, 1), 4);
			assert.bnEqual(await marchMadness.getCorrectPositionsPerRoundByTokenId(3, 1), 3);
			assert.bnEqual(await marchMadness.getCorrectPositionsPerRoundByTokenId(4, 1), 1);
			assert.bnEqual(await marchMadness.getCorrectPositionsPerRoundByTokenId(5, 1), 1);

			await marchMadness.setPointsToRound(0, 1, { from: owner });
			await marchMadness.setPointsToRound(1, 2, { from: owner });
			await marchMadness.setPointsToRound(2, 4, { from: owner });
			await marchMadness.setPointsToRound(3, 7, { from: owner });
			await marchMadness.setPointsToRound(4, 10, { from: owner });
			await marchMadness.setPointsToRound(5, 20, { from: owner });

			assert.bnEqual([6, 5, 4, 3, 1, 1], await marchMadness.getCorrectPositionsByRound(first));

			assert.bnEqual(
				await marchMadness.getTotalPointsByMinterAddress(first),
				6 * 1 + 5 * 2 + 4 * 4 + 3 * 7 + 1 * 10 + 20 * 1
			);
		});
	});
});
