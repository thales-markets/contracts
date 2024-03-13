'use strict';

const { expect } = require('chai');
const { artifacts, contract, network } = require('hardhat');

const { assert } = require('../../utils/common');

const { toBN } = web3.utils;
const { toWei } = require('web3-utils');
const toUnitSix = (amount) => toBN(toWei(amount.toString(), 'ether') / 1e12);

const {
	fastForward,
	toUnit,
	fromUnit,
	currentTime,
	bytesToString,
	multiplyDecimalRound,
	divideDecimalRound,
} = require('../../utils')();

contract('MarchMadness', (accounts) => {
	const [first, owner, second, safeBox] = accounts;
	let MarchMadnessContract;
	let MarchMadnessContractData;
	let marchMadness;
	let marchMadnessData;
	let exoticUSD;

	const bracketsArray = Array(63).fill(1);

	beforeEach(async () => {
		MarchMadnessContract = artifacts.require('MarchMadnessV2');

		marchMadness = await MarchMadnessContract.new({
			from: owner,
		});

		let TestUSDC = artifacts.require('TestUSDC');
		exoticUSD = await TestUSDC.new();

		await exoticUSD.mint(second, toUnitSix(100));
		let balance = await exoticUSD.balanceOf(second);
		console.log('Balance of user is ' + balance / 1e6);
		await exoticUSD.approve(marchMadness.address, toUnitSix(100), { from: second });

		await marchMadness.setsUSD(exoticUSD.address, {
			from: owner,
		});

		await marchMadness.setSafeBox(safeBox, toUnit(0.1), {
			from: owner,
		});
	});

	describe('Contract managment', () => {
		it('Init checking', async () => {
			assert.bnEqual('Overtime March Madness 2024', await marchMadness.name());
			assert.bnEqual('OTMM', await marchMadness.symbol());
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

			const dateTo = new Date('01-12-2033').getTime();

			await expect(
				marchMadness.setFinalDateForPositioning(dateTo, { from: first })
			).to.be.revertedWith('Ownable: caller is not the owner');
		});

		it('Should set date range and emit event', async () => {
			// Initial value not provided
			assert.bnEqual(await marchMadness.canNotMintOrUpdateAfter(), 0);

			const dateTo = new Date('01-12-2033').getTime();

			const tx = await marchMadness.setFinalDateForPositioning(dateTo, { from: owner });

			assert.bnEqual(dateTo, await marchMadness.canNotMintOrUpdateAfter());

			assert.eventEqual(tx.logs[0], 'FinalPositioningDateUpdated', {
				_toDate: dateTo,
			});
		});

		it('Should revert adding the result for game, not owner', async () => {
			await expect(marchMadness.setResultForGame(1, 1, { from: first })).to.be.revertedWith(
				'Invalid caller'
			);
		});

		it('Should set array of results', async () => {
			const _results = Array(63).fill(2);

			_results[1] = 15;
			_results[5] = 35;

			await marchMadness.setResultArray(_results, { from: owner });

			assert.bnEqual(await marchMadness.results(5), _results[5]);
		});

		it('Should assign gameIds to round', async () => {
			const gameIdsArray = Array.from({ length: 32 }, (_, k) => k + 1);

			await marchMadness.assignGameIdsToRound(0, gameIdsArray, { from: owner });

			assert.bnEqual(await marchMadness.roundToGameIds(0, 4), 5);
		});
	});

	describe('Minting', () => {
		it('Should revert minting, not in date range', async () => {
			const currentBlockTime = new Date('02-17-2033').getTime() * 1000;
			await network.provider.send('evm_setNextBlockTimestamp', [currentBlockTime]);

			const dateTo = new Date('02-15-2033').getTime() * 1000;

			await marchMadness.setFinalDateForPositioning(dateTo, { from: owner });

			await expect(marchMadness.mint(bracketsArray, { from: first })).to.be.revertedWith(
				'Can not mint after settled date'
			);
		});

		it('Should mint x2', async () => {
			const dateTo = new Date('02-25-2033').getTime() * 1000;

			await marchMadness.setFinalDateForPositioning(dateTo, { from: owner });

			await marchMadness.mint(bracketsArray, { from: second });

			let balance = await marchMadness.balanceOf(second);
			console.log('Balance is: ' + balance);
			assert.bnGt(await marchMadness.balanceOf(second), 0);

			await marchMadness.mint(bracketsArray, { from: second });
			balance = await marchMadness.balanceOf(second);
			console.log('Balance is: ' + balance);
			assert.bnGt(await marchMadness.balanceOf(second), 1);

			await expect(marchMadness.mint(bracketsArray, { from: first })).to.be.revertedWith(
				'Not enough balance'
			);

			balance = await exoticUSD.balanceOf(safeBox);
			console.log('SafeBox Balance is: ' + balance / 1e6);
			assert.bnGt(balance, 0);

			let tokenIds = await marchMadness.getAddressToTokenIds(second);
			console.log('tokenIds: ' + tokenIds);

			assert.bnEqual(toUnit(tokenIds.length), toUnit(2));

			let brackets = await marchMadness.getBracketsByItemId(1);
			console.log('brackets are: ' + brackets);
			assert.bnGt(toUnit(brackets.length), 0);

			let points = await marchMadness.getTotalPointsByTokenIds([1, 2]);
			console.log('points are: ' + points);
			assert.bnGt(toUnit(points.length), 0);

			let currentId = await marchMadness.getCurrentTokenId();
			console.log('currentId is: ' + currentId);
			assert.bnGt(toUnit(currentId), 0);
		});
	});

	describe('Updating minted positions/Getting correct positions', () => {
		it('Should update already minted position, before that testing reverting on update brackets', async () => {
			await exoticUSD.mint(first, toUnitSix(100));
			await exoticUSD.approve(marchMadness.address, toUnitSix(100), { from: first });

			const dateTo = new Date('02-25-2033').getTime() * 1000;

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
			await exoticUSD.mint(first, toUnitSix(100));
			await exoticUSD.approve(marchMadness.address, toUnitSix(100), { from: first });

			const dateTo = new Date('02-25-2033').getTime() * 1000;

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
		});

		it('Should display count of correct positions from round, also show display points for that round', async () => {
			await exoticUSD.mint(first, toUnitSix(100));
			await exoticUSD.approve(marchMadness.address, toUnitSix(100), { from: first });

			// Setting the final date for positioning
			const dateTo = new Date('02-25-2033').getTime() * 1000;
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

			assert.bnEqual(await marchMadness.getTotalPointsByTokenId(1), 6);
		});
	});

	describe('Multiple rounds final testing', () => {
		it('Should return count of correct positions and total points', async () => {
			await exoticUSD.mint(first, toUnitSix(100));
			await exoticUSD.approve(marchMadness.address, toUnitSix(100), { from: first });

			// Setting the final date for positioning
			const dateTo = new Date('02-25-2033').getTime() * 1000;
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

			assert.bnEqual([6, 5, 4, 3, 1, 1], await marchMadness.getCorrectPositionsByRound(1));

			assert.bnEqual(
				await marchMadness.getTotalPointsByTokenId(1),
				6 * 1 + 5 * 2 + 4 * 4 + 3 * 8 + 1 * 16 + 32 * 1
			);
		});
	});
});
