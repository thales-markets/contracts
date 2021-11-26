'use strict';

const { artifacts, contract, web3 } = require('hardhat');
const { toBN } = web3.utils;

const { assert, addSnapshotBeforeRestoreAfterEach } = require('../../utils/common');

const { toBytes32 } = require('../../../index');

var ethers2 = require('ethers');
var crypto = require('crypto');

const SECOND = 1000;
const HOUR = 3600;
const DAY = 86400;
const WEEK = 604800;
const YEAR = 31556926;

const {
	fastForward,
	toUnit,
	currentTime,
	multiplyDecimalRound,
	divideDecimalRound,
} = require('../../utils')();

contract('ThalesRoyale', accounts => {
	const [first, owner, second, third, fourth] = accounts;
	let priceFeedAddress;
	let rewardTokenAddress;
	let ThalesRoyale;
	let royale;
	let MockPriceFeedDeployed;

	beforeEach(async () => {
		priceFeedAddress = owner;
		rewardTokenAddress = owner;

		let MockPriceFeed = artifacts.require('MockPriceFeed');
		MockPriceFeedDeployed = await MockPriceFeed.new(owner);

		await MockPriceFeedDeployed.setPricetoReturn(1000);

		priceFeedAddress = MockPriceFeedDeployed.address;

		ThalesRoyale = artifacts.require('ThalesRoyale');
		royale = await ThalesRoyale.new(
			owner,
			toBytes32('SNX'),
			priceFeedAddress,
			toUnit(10000),
			rewardTokenAddress,
			7,
			DAY * 3,
			HOUR * 8,
			DAY
		);
	});

	describe('Init', () => {
		it('Signing up cant be called twice', async () => {
			await royale.signUp({ from: first });
			await royale.signUp({ from: second });
			let player1 = await royale.players(0);
			console.log('Player1 is ' + player1);

			let player2 = await royale.players(1);
			console.log('Player2 is ' + player2);

			let players = await royale.getPlayers();
			console.log('players are ' + players);

			let initTotalPlayersInARound = await royale.totalPlayersPerRound(1);
			// not started
			assert.equal(0, initTotalPlayersInARound);

			let initEliminatedPlayersInARound = await royale.eliminatedPerRound(1);
			// not started
			assert.equal(0, initEliminatedPlayersInARound);

			await expect(royale.signUp({ from: first })).to.be.revertedWith('Player already signed up');
		});

		it('Signing up only possible in specified time', async () => {
			await fastForward(DAY * 4);
			await expect(royale.signUp({ from: first })).to.be.revertedWith('Sign up period has expired');
		});

		it('check require statements', async () => {
			await royale.signUp({ from: first });
			await royale.signUp({ from: second });

			await expect(royale.takeAPosition(1, { from: first })).to.be.revertedWith(
				'Competition not started yet'
			);

			await expect(royale.takeAPosition(3, { from: first })).to.be.revertedWith(
				'Position can only be 1 or 2'
			);

			await expect(royale.startRoyale()).to.be.revertedWith(
				"Can't start until signup period expires"
			);

			await fastForward(HOUR * 72 + 1);
			await royale.startRoyale();
			await fastForward(HOUR * 72 + 1);

			await expect(royale.takeAPosition(2, { from: first })).to.be.revertedWith(
				'Round positioning finished'
			);
		});

		it('take a losing position and end first round and try to take a position in 2nd round player not alive', async () => {
			let isPlayerFirstAlive = await royale.isPlayerAlive(first);

			assert.equal(false, isPlayerFirstAlive);

			await royale.signUp({ from: first });
			await royale.signUp({ from: second });
			await royale.signUp({ from: third });

			isPlayerFirstAlive = await royale.isPlayerAlive(first);

			assert.equal(true, isPlayerFirstAlive);

			await fastForward(HOUR * 72 + 1);

			let isRoundClosableBeforeStarting = await royale.canCloseRound();
			assert.equal(false, isRoundClosableBeforeStarting);

			await royale.startRoyale();

			let totalPlayersInARound = await royale.totalPlayersPerRound(1);
			assert.equal(3, totalPlayersInARound);

			let eliminatedPlayersInARound = await royale.eliminatedPerRound(1);
			assert.equal(0, eliminatedPlayersInARound);

			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(1, { from: second });
			await royale.takeAPosition(1, { from: third });

			let roundTargetPrice = await royale.roundTargetPrice();
			console.log('roundTargetPrice is ' + roundTargetPrice);

			let currentPrice = await MockPriceFeedDeployed.rateForCurrency(toBytes32('SNX'));
			console.log('currentPrice is ' + currentPrice);

			await MockPriceFeedDeployed.setPricetoReturn(900);

			let isRoundClosableBefore = await royale.canCloseRound();
			assert.equal(false, isRoundClosableBefore);

			await fastForward(HOUR * 72 + 1);

			let isRoundClosableAfter = await royale.canCloseRound();
			assert.equal(true, isRoundClosableAfter);

			await royale.closeRound();

			let isRoundClosableAfterClosing = await royale.canCloseRound();
			assert.equal(false, isRoundClosableAfterClosing);

			roundTargetPrice = await royale.roundTargetPrice();
			console.log('roundTargetPrice is ' + roundTargetPrice);

			currentPrice = await MockPriceFeedDeployed.rateForCurrency(toBytes32('SNX'));
			console.log('currentPrice is ' + currentPrice);

			let roundResult = await royale.roundResult(1);
			console.log('roundResult is  ' + roundResult);

			isPlayerFirstAlive = await royale.isPlayerAlive(first);

			let totalPlayersInARoundTwo = await royale.totalPlayersPerRound(2);
			assert.equal(2, totalPlayersInARoundTwo);

			let eliminatedPlayersInARoundOne = await royale.eliminatedPerRound(1);
			assert.equal(1, eliminatedPlayersInARoundOne);

			assert.equal(false, isPlayerFirstAlive);

			await expect(royale.takeAPosition(2, { from: first })).to.be.revertedWith(
				'Player no longer alive'
			);
		});

		it('take a losing position end royale no players left', async () => {
			let isPlayerFirstAlive = await royale.isPlayerAlive(first);

			assert.equal(false, isPlayerFirstAlive);

			await royale.signUp({ from: first });
			await royale.signUp({ from: second });

			isPlayerFirstAlive = await royale.isPlayerAlive(first);

			assert.equal(true, isPlayerFirstAlive);

			let initTotalPlayersInARound = await royale.totalPlayersPerRound(1);
			// not started
			assert.equal(0, initTotalPlayersInARound);

			let initEliminatedPlayersInARound = await royale.eliminatedPerRound(1);
			// not started
			assert.equal(0, initEliminatedPlayersInARound);

			await fastForward(HOUR * 72 + 1);

			let isRoundClosableBeforeStarting = await royale.canCloseRound();
			assert.equal(false, isRoundClosableBeforeStarting);

			await royale.startRoyale();

			let totalPlayersInARound = await royale.totalPlayersPerRound(1);
			console.log('Total players in a 1. round: ' + totalPlayersInARound);
			// equal to total number of players
			assert.equal(2, totalPlayersInARound);

			let eliminatedPlayersInARound = await royale.eliminatedPerRound(1);
			console.log('Total players eliminated in a 1. round: ' + eliminatedPlayersInARound);
			// zero  round need to be finished
			assert.equal(0, eliminatedPlayersInARound);

			await royale.takeAPosition(2, { from: first });

			let roundTargetPrice = await royale.roundTargetPrice();
			console.log('roundTargetPrice is ' + roundTargetPrice);

			let currentPrice = await MockPriceFeedDeployed.rateForCurrency(toBytes32('SNX'));
			console.log('currentPrice is ' + currentPrice);

			await MockPriceFeedDeployed.setPricetoReturn(900);

			let isRoundClosableBefore = await royale.canCloseRound();
			assert.equal(false, isRoundClosableBefore);

			await fastForward(HOUR * 72 + 1);

			let isRoundClosableAfter = await royale.canCloseRound();
			assert.equal(true, isRoundClosableAfter);

			await royale.closeRound();

			let isRoundClosableAfterClosing = await royale.canCloseRound();
			assert.equal(false, isRoundClosableAfterClosing);

			roundTargetPrice = await royale.roundTargetPrice();
			console.log('roundTargetPrice is ' + roundTargetPrice);

			currentPrice = await MockPriceFeedDeployed.rateForCurrency(toBytes32('SNX'));
			console.log('currentPrice is ' + currentPrice);

			let roundResult = await royale.roundResult(1);
			console.log('roundResult is  ' + roundResult);

			isPlayerFirstAlive = await royale.isPlayerAlive(first);

			let totalPlayersInARoundTwo = await royale.totalPlayersPerRound(2);
			console.log('Total players in a 2. round: ' + totalPlayersInARoundTwo);
			// equal to zero because second didn't take position
			assert.equal(0, totalPlayersInARoundTwo);

			let eliminatedPlayersInARoundOne = await royale.eliminatedPerRound(1);
			console.log('Total players eliminated in a 1. round: ' + eliminatedPlayersInARoundOne);
			// two because first did take losing position, and second did't take position at all
			assert.equal(2, eliminatedPlayersInARoundOne);

			assert.equal(false, isPlayerFirstAlive);

			await expect(royale.takeAPosition(2, { from: first })).to.be.revertedWith(
				'Competition finished'
			);
		});

		it('take a winning position and end first round and try to take a position in 2nd round', async () => {
			let isPlayerFirstAlive = await royale.isPlayerAlive(first);

			assert.equal(false, isPlayerFirstAlive);

			await royale.signUp({ from: first });
			await royale.signUp({ from: second });

			isPlayerFirstAlive = await royale.isPlayerAlive(first);

			assert.equal(true, isPlayerFirstAlive);

			await fastForward(HOUR * 72 + 1);
			await royale.startRoyale();

			let totalPlayersInARound = await royale.totalPlayersPerRound(1);
			console.log('Total players in a 1. round: ' + totalPlayersInARound);
			// equal to total number of players
			assert.equal(2, totalPlayersInARound);

			let eliminatedPlayersInARound = await royale.eliminatedPerRound(1);
			console.log('Total players eliminated in a 1. round: ' + eliminatedPlayersInARound);
			// zero  round need to be finished
			assert.equal(0, eliminatedPlayersInARound);

			await royale.takeAPosition(2, { from: first });

			await MockPriceFeedDeployed.setPricetoReturn(1100);

			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			isPlayerFirstAlive = await royale.isPlayerAlive(first);

			assert.equal(true, isPlayerFirstAlive);

			// only one player left -> competition is ended
			await expect(royale.takeAPosition(2, { from: first })).to.be.revertedWith('Competition finished');
		});

		it('take a winning position and end first round then skip 2nd round', async () => {
			let isPlayerFirstAlive = await royale.isPlayerAlive(first);

			assert.equal(false, isPlayerFirstAlive);

			await royale.signUp({ from: first });
			await royale.signUp({ from: second });
			await royale.signUp({ from: third });

			let alivePlayers = await royale.getAlivePlayers();
			console.log('alivePlayers are ' + alivePlayers);

			isPlayerFirstAlive = await royale.isPlayerAlive(first);

			assert.equal(true, isPlayerFirstAlive);

			await fastForward(HOUR * 72 + 1);
			await royale.startRoyale();

			let totalPlayersInARound = await royale.totalPlayersPerRound(1);
			console.log('Total players in a 1. round: ' + totalPlayersInARound);
			// equal to total number of players
			assert.equal(3, totalPlayersInARound);

			let eliminatedPlayersInARound = await royale.eliminatedPerRound(1);
			console.log('Total players eliminated in a 1. round: ' + eliminatedPlayersInARound);
			// zero  round need to be finished
			assert.equal(0, eliminatedPlayersInARound);

			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: third });

			await MockPriceFeedDeployed.setPricetoReturn(1100);

			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let totalPlayersInARoundTwo = await royale.totalPlayersPerRound(2);
			console.log('Total players in a 2. round: ' + totalPlayersInARoundTwo);
			assert.equal(2, totalPlayersInARoundTwo);

			let eliminatedPlayersInARoundOne = await royale.eliminatedPerRound(1);
			console.log('Total players eliminated in a 1. round: ' + eliminatedPlayersInARoundOne);
			// second did't take position at all so eliminated is 1
			assert.equal(1, eliminatedPlayersInARoundOne);

			isPlayerFirstAlive = await royale.isPlayerAlive(first);

			assert.equal(true, isPlayerFirstAlive);

			alivePlayers = await royale.getAlivePlayers();
			console.log('alivePlayers2 are ' + alivePlayers);

			await MockPriceFeedDeployed.setPricetoReturn(900);
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let totalPlayersInARoundThree = await royale.totalPlayersPerRound(3);
			console.log('Total players in a 3. round: ' + totalPlayersInARoundThree);
			// equal to zero because first player didn't take position
			assert.equal(0, totalPlayersInARoundThree);

			let eliminatedPlayersInARoundTwo = await royale.eliminatedPerRound(2);
			console.log('Total players eliminated in a 2. round: ' + eliminatedPlayersInARoundTwo);
			// first did't take position at all so eliminated in round two is 2
			assert.equal(2, eliminatedPlayersInARoundTwo);

			isPlayerFirstAlive = await royale.isPlayerAlive(first);

			assert.equal(false, isPlayerFirstAlive);
		});

		it('win till the end', async () => {
			await royale.signUp({ from: first });
			await royale.signUp({ from: second });
			await royale.signUp({ from: third });

			await fastForward(HOUR * 72 + 1);
			await royale.startRoyale();

			let totalPlayersInARound = await royale.totalPlayersPerRound(1);
			console.log('Total players in a 1. round: ' + totalPlayersInARound);
			// equal to total number of players
			assert.equal(3, totalPlayersInARound);

			let eliminatedPlayersInARound = await royale.eliminatedPerRound(1);
			console.log('Total players eliminated in a 1. round: ' + eliminatedPlayersInARound);
			// zero  round need to be finished
			assert.equal(0, eliminatedPlayersInARound);

			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: third });

			await MockPriceFeedDeployed.setPricetoReturn(1100);

			//#1
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let totalPlayersInARoundTwo = await royale.totalPlayersPerRound(2);
			console.log('Total players in a 2. round: ' + totalPlayersInARoundTwo);
			// equal to 2 - first player, third win
			assert.equal(2, totalPlayersInARoundTwo);

			let eliminatedPlayersInARoundOne = await royale.eliminatedPerRound(1);
			console.log('Total players eliminated in a 1. round: ' + eliminatedPlayersInARoundOne);
			// equal to 1 second player did't take position
			assert.equal(1, eliminatedPlayersInARoundOne);

			//#2
			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: third });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let totalPlayersInARoundThree = await royale.totalPlayersPerRound(3);
			console.log('Total players in a 3. round: ' + totalPlayersInARoundThree);
			// equal to 2 - first, third player win
			assert.equal(2, totalPlayersInARoundThree);

			let eliminatedPlayersInARoundTwo = await royale.eliminatedPerRound(2);
			console.log('Total players eliminated in a 2. round: ' + eliminatedPlayersInARoundTwo);
			// no one left untill the end player one win
			assert.equal(0, eliminatedPlayersInARoundTwo);

			//#3
			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: third });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let totalPlayersInARoundFour = await royale.totalPlayersPerRound(4);
			console.log('Total players in a 4. round: ' + totalPlayersInARoundFour);
			// equal to 2 - first, third player win
			assert.equal(2, totalPlayersInARoundFour);

			let eliminatedPlayersInARoundThree = await royale.eliminatedPerRound(3);
			console.log('Total players eliminated in a 3. round: ' + eliminatedPlayersInARoundThree);
			// no one left untill the end player one win
			assert.equal(0, eliminatedPlayersInARoundThree);

			//#4
			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: third });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let totalPlayersInARoundFive = await royale.totalPlayersPerRound(5);
			console.log('Total players in a 5. round: ' + totalPlayersInARoundFive);
			// equal to 2 - first, third player win
			assert.equal(2, totalPlayersInARoundFive);

			let eliminatedPlayersInARoundFour = await royale.eliminatedPerRound(4);
			console.log('Total players eliminated in a 4. round: ' + eliminatedPlayersInARoundFour);
			// no one left untill the end player one win
			assert.equal(0, eliminatedPlayersInARoundFour);

			//#5
			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: third });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let totalPlayersInARoundSix = await royale.totalPlayersPerRound(6);
			console.log('Total players in a 6. round: ' + totalPlayersInARoundSix);
			// equal to 2 - first, third player win
			assert.equal(2, totalPlayersInARoundSix);

			let eliminatedPlayersInARoundFive = await royale.eliminatedPerRound(5);
			console.log('Total players eliminated in a 5. round: ' + eliminatedPlayersInARoundFive);
			// no one left untill the end player one win
			assert.equal(0, eliminatedPlayersInARoundFive);

			//#6
			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: third });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let totalPlayersInARoundSeven = await royale.totalPlayersPerRound(7);
			console.log('Total players in a 7. round: ' + totalPlayersInARoundSeven);
			// equal to 2 - first, third player win
			assert.equal(2, totalPlayersInARoundSeven);

			let eliminatedPlayersInARoundSix = await royale.eliminatedPerRound(6);
			console.log('Total players eliminated in a 6. round: ' + eliminatedPlayersInARoundSix);
			// no one left untill the end player one win
			assert.equal(0, eliminatedPlayersInARoundSix);

			//#7
			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(1, { from: third });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let totalPlayersInARoundEight = await royale.totalPlayersPerRound(8);
			console.log('Total players in a 8. round: ' + totalPlayersInARoundEight);
			// equal to ZERO, no 8. round!
			assert.equal(0, totalPlayersInARoundEight);

			let eliminatedPlayersInARoundSeven = await royale.eliminatedPerRound(7);
			console.log('Total players eliminated in a 7. round: ' + eliminatedPlayersInARoundSeven);
			// no one left untill the end player one win
			assert.equal(1, eliminatedPlayersInARoundSeven);

			let alivePlayers = await royale.getAlivePlayers();
			console.log('final alive players are ' + alivePlayers);

			let isPlayerFirstAlive = await royale.isPlayerAlive(first);

			assert.equal(true, isPlayerFirstAlive);

			await expect(royale.closeRound()).to.be.revertedWith('Competition finished');
		});

		it('take a winning position and end first round then skip 2nd round', async () => {
			let isPlayerFirstAlive = await royale.isPlayerAlive(first);

			assert.equal(false, isPlayerFirstAlive);

			await royale.signUp({ from: first });
			await royale.signUp({ from: second });

			let alivePlayers = await royale.getAlivePlayers();
			console.log('alivePlayers are ' + alivePlayers);

			isPlayerFirstAlive = await royale.isPlayerAlive(first);

			assert.equal(true, isPlayerFirstAlive);

			await fastForward(HOUR * 72 + 1);
			await royale.startRoyale();

			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: second });

			await MockPriceFeedDeployed.setPricetoReturn(1100);

			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			isPlayerFirstAlive = await royale.isPlayerAlive(first);

			assert.equal(true, isPlayerFirstAlive);

			alivePlayers = await royale.getAlivePlayers();
			console.log('alivePlayers2 are ' + alivePlayers);

			await MockPriceFeedDeployed.setPricetoReturn(900);
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			isPlayerFirstAlive = await royale.isPlayerAlive(first);

			assert.equal(false, isPlayerFirstAlive);
		});

		it('win till the end', async () => {
			await royale.signUp({ from: first });
			await royale.signUp({ from: second });

			await fastForward(HOUR * 72 + 1);
			await royale.startRoyale();

			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: second });

			await MockPriceFeedDeployed.setPricetoReturn(1100);

			//#1
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			//#2
			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: second });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			//#3
			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: second });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			//#4
			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: second });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			//#5
			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: second });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			//#6
			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: second });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			//#7
			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(1, { from: second });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let alivePlayers = await royale.getAlivePlayers();
			console.log('final alive players are ' + alivePlayers);

			let isPlayerFirstAlive = await royale.isPlayerAlive(first);

			assert.equal(true, isPlayerFirstAlive);

			await expect(royale.closeRound()).to.be.revertedWith('Competition finished');
		});

		it('win till the end', async () => {
			await royale.signUp({ from: first });
			await royale.signUp({ from: second });
			await royale.signUp({ from: third });
			await royale.signUp({ from: fourth });

			await fastForward(HOUR * 72 + 1);
			await royale.startRoyale();

			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: second });
			await royale.takeAPosition(2, { from: third });
			await royale.takeAPosition(2, { from: fourth });

			await MockPriceFeedDeployed.setPricetoReturn(1100);

			//#1
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			//#2
			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: second });
			await royale.takeAPosition(2, { from: third });
			await royale.takeAPosition(2, { from: fourth });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			//#3
			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: second });
			await royale.takeAPosition(2, { from: third });
			await royale.takeAPosition(2, { from: fourth });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			//#4
			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: second });
			await royale.takeAPosition(2, { from: third });
			await royale.takeAPosition(2, { from: fourth });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			//#5
			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: second });
			await royale.takeAPosition(2, { from: third });
			await royale.takeAPosition(2, { from: fourth });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			//#6
			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: second });
			await royale.takeAPosition(2, { from: third });
			await royale.takeAPosition(1, { from: fourth });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let alivePlayers = await royale.getAlivePlayers();
			console.log('final alive players are ' + alivePlayers);

			//#7
			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: second });
			await royale.takeAPosition(2, { from: third });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			alivePlayers = await royale.getAlivePlayers();
			console.log('final alive players are ' + alivePlayers);

			let isPlayerFirstAlive = await royale.isPlayerAlive(first);

			assert.equal(true, isPlayerFirstAlive);

			await expect(royale.closeRound()).to.be.revertedWith('Competition finished');
		});

		it('win till the end and check results', async () => {
			await royale.signUp({ from: first });
			await royale.signUp({ from: second });
			await royale.signUp({ from: third });
			await royale.signUp({ from: fourth });

			await fastForward(HOUR * 72 + 1);
			await royale.startRoyale();

			let totalPlayersInARound = await royale.totalPlayersPerRound(1);
			console.log('Total players in a 1. round: ' + totalPlayersInARound);
			// equal to total number of players
			assert.equal(4, totalPlayersInARound);

			let eliminatedPlayersInARound = await royale.eliminatedPerRound(1);
			console.log('Total players eliminated in a 1. round: ' + eliminatedPlayersInARound);
			// zero round need to be finished
			assert.equal(0, eliminatedPlayersInARound);

			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: second });
			await royale.takeAPosition(2, { from: third });
			await royale.takeAPosition(2, { from: fourth });

			await MockPriceFeedDeployed.setPricetoReturn(1100);

			//#1
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let totalPlayersInARound2 = await royale.totalPlayersPerRound(2);
			console.log('Total players in a 2. round: ' + totalPlayersInARound2);
			// equal to total number of players
			assert.equal(4, totalPlayersInARound2);

			let eliminatedPlayersInARound1 = await royale.eliminatedPerRound(1);
			console.log('Total players eliminated in a 1. round: ' + eliminatedPlayersInARound1);
			// zero - all players are good
			assert.equal(0, eliminatedPlayersInARound1);

			//#2
			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: second });
			await royale.takeAPosition(2, { from: third });
			await royale.takeAPosition(1, { from: fourth });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let totalPlayersInARound3 = await royale.totalPlayersPerRound(3);
			console.log('Total players in a 3. round: ' + totalPlayersInARound3);
			// equal to three
			assert.equal(3, totalPlayersInARound3);

			let eliminatedPlayersInARound2 = await royale.eliminatedPerRound(2);
			console.log('Total players eliminated in a 2. round: ' + eliminatedPlayersInARound2);
			// one player eliminated
			assert.equal(1, eliminatedPlayersInARound2);

			//#3
			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: second });
			await royale.takeAPosition(1, { from: third });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let totalPlayersInARound4 = await royale.totalPlayersPerRound(4);
			console.log('Total players in a 4. round: ' + totalPlayersInARound4);
			// equal to two
			assert.equal(2, totalPlayersInARound4);

			let eliminatedPlayersInARound3 = await royale.eliminatedPerRound(3);
			console.log('Total players eliminated in a 3. round: ' + eliminatedPlayersInARound3);
			// one player eliminated
			assert.equal(1, eliminatedPlayersInARound3);

			//#4
			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: second });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let totalPlayersInARound5 = await royale.totalPlayersPerRound(5);
			console.log('Total players in a 5. round: ' + totalPlayersInARound5);
			// equal to two
			assert.equal(2, totalPlayersInARound5);

			let eliminatedPlayersInARound4 = await royale.eliminatedPerRound(4);
			console.log('Total players eliminated in a 4. round: ' + eliminatedPlayersInARound4);
			// zero - all players are good
			assert.equal(0, eliminatedPlayersInARound4);

			//#5
			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: second });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let totalPlayersInARound6 = await royale.totalPlayersPerRound(6);
			console.log('Total players in a 6. round: ' + totalPlayersInARound6);
			// equal to two
			assert.equal(2, totalPlayersInARound6);

			let eliminatedPlayersInARound5 = await royale.eliminatedPerRound(5);
			console.log('Total players eliminated in a 5. round: ' + eliminatedPlayersInARound5);
			// zero - all players are good
			assert.equal(0, eliminatedPlayersInARound5);

			//#6
			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: second });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let totalPlayersInARound7 = await royale.totalPlayersPerRound(7);
			console.log('Total players in a 7. round: ' + totalPlayersInARound7);
			// equal to two
			assert.equal(2, totalPlayersInARound7);

			let eliminatedPlayersInARound6 = await royale.eliminatedPerRound(6);
			console.log('Total players eliminated in a 6. round: ' + eliminatedPlayersInARound6);
			// zero - all players are good
			assert.equal(0, eliminatedPlayersInARound6);

			let alivePlayers = await royale.getAlivePlayers();
			console.log('final alive players are ' + alivePlayers);

			//#7
			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(1, { from: second });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let eliminatedPlayersInARound7 = await royale.eliminatedPerRound(7);
			console.log('Total players eliminated in a 7. round: ' + eliminatedPlayersInARound7);
			// one player eliminated
			assert.equal(1, eliminatedPlayersInARound7);

			alivePlayers = await royale.getAlivePlayers();
			console.log('final alive players are ' + alivePlayers);

			let isPlayerFirstAlive = await royale.isPlayerAlive(first);
			let isPlayerSecondAlive = await royale.isPlayerAlive(second);
			let isPlayerThirdAlive = await royale.isPlayerAlive(third);
			let isPlayerFourthAlive = await royale.isPlayerAlive(fourth);

			assert.equal(true, isPlayerFirstAlive);
			assert.equal(false, isPlayerSecondAlive);
			assert.equal(false, isPlayerThirdAlive);
			assert.equal(false, isPlayerFourthAlive);

			// check to be zero (don't exist)
			let totalPlayersInARound8 = await royale.totalPlayersPerRound(8);
			let eliminatedPlayersInARound8 = await royale.eliminatedPerRound(8);
			assert.equal(0, totalPlayersInARound8);
			assert.equal(0, eliminatedPlayersInARound8);

			await expect(royale.closeRound()).to.be.revertedWith('Competition finished');
		});


		it('check the changing positions require to send different one', async () => {

			await royale.signUp({ from: first });
			await royale.signUp({ from: second });

			await fastForward(HOUR * 72 + 1);
			await royale.startRoyale();

			let totalPlayersInARound = await royale.totalPlayersPerRound(1);
			assert.equal(2, totalPlayersInARound);

			await royale.takeAPosition(2, { from: first });

			await expect(royale.takeAPosition(2, { from: first })).to.be.revertedWith(
				'Same position'
			);


		});

		it('check if can start royale', async () => {

			await royale.signUp({ from: first });
			await royale.signUp({ from: second });

			let canStartFalse = await royale.canStartRoyale();
			assert.equal(false, canStartFalse);

			await fastForward(HOUR * 72 + 1);

			let canStartTrue = await royale.canStartRoyale();
			assert.equal(true, canStartTrue);

			await royale.startRoyale();

			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: second });

			let canStartFalseAlreadyStarted = await royale.canStartRoyale();
			assert.equal(false, canStartFalseAlreadyStarted);

			await MockPriceFeedDeployed.setPricetoReturn(1100);

			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let canStartFalseAfterClose = await royale.canStartRoyale();
			assert.equal(false, canStartFalseAfterClose);

		});

		it('check the changing positions', async () => {
			await royale.signUp({ from: first });
			await royale.signUp({ from: second });
			await royale.signUp({ from: third });
			await royale.signUp({ from: fourth });

			await fastForward(HOUR * 72 + 1);
			await royale.startRoyale();

			let totalPlayersInARound = await royale.totalPlayersPerRound(1);
			console.log('Total players in a 1. round: ' + totalPlayersInARound);
			// equal to total number of players
			assert.equal(4, totalPlayersInARound);

			let eliminatedPlayersInARound = await royale.eliminatedPerRound(1);
			console.log('Total players eliminated in a 1. round: ' + eliminatedPlayersInARound);
			// zero round need to be finished
			assert.equal(0, eliminatedPlayersInARound);

			let postions1InRound1_before = await royale.getPositionsPerRound(1,1);
			let postions2InRound1_before = await royale.getPositionsPerRound(1,2);
			assert.equal(0, postions1InRound1_before);
			assert.equal(0, postions2InRound1_before);

			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: second });
			await royale.takeAPosition(1, { from: first });
			// 3
			await royale.takeAPosition(2, { from: third });
			await royale.takeAPosition(1, { from: fourth });
			await royale.takeAPosition(2, { from: first });
			// 1
			await royale.takeAPosition(1, { from: first });
			await royale.takeAPosition(2, { from: fourth });
			await royale.takeAPosition(1, { from: second });
			// 2
			await royale.takeAPosition(2, { from: second });
			// 4
			await royale.takeAPosition(1, { from: fourth });

			await MockPriceFeedDeployed.setPricetoReturn(1100);

			let postions1InRound1_after = await royale.getPositionsPerRound(1,1);
			let postions2InRound1_after = await royale.getPositionsPerRound(1,2);
			assert.equal(2, postions1InRound1_after);
			assert.equal(2, postions2InRound1_after);

			//#1
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let totalPlayersInARound2 = await royale.totalPlayersPerRound(2);
			console.log('Total players in a 2. round: ' + totalPlayersInARound2);
			// equal to total number of players
			assert.equal(2, totalPlayersInARound2);

			let eliminatedPlayersInARound1 = await royale.eliminatedPerRound(1);
			console.log('Total players eliminated in a 1. round: ' + eliminatedPlayersInARound1);
			// zero - all players are good
			assert.equal(2, eliminatedPlayersInARound1);

			let postions1InRound1_after_close = await royale.getPositionsPerRound(1,1);
			let postions2InRound1_after_close = await royale.getPositionsPerRound(1,2);
			assert.equal(2, postions1InRound1_after_close);
			assert.equal(2, postions2InRound1_after_close);

			let isPlayerFirstAlive = await royale.isPlayerAlive(first);
			let isPlayerSecondAlive = await royale.isPlayerAlive(second);
			let isPlayerThirdAlive = await royale.isPlayerAlive(third);
			let isPlayerFourthAlive = await royale.isPlayerAlive(fourth);

			assert.equal(false, isPlayerFirstAlive);
			assert.equal(true, isPlayerSecondAlive);
			assert.equal(true, isPlayerThirdAlive);
			assert.equal(false, isPlayerFourthAlive);

			//#2
			//before checking
			let postions1InRound2_before_start = await royale.getPositionsPerRound(2,1);
			let postions2InRound2_before_start = await royale.getPositionsPerRound(2,2);
			assert.equal(0, postions1InRound2_before_start);
			assert.equal(0, postions2InRound2_before_start);

			await royale.takeAPosition(2, { from: second });
			await royale.takeAPosition(2, { from: third });
			await royale.takeAPosition(1, { from: second });
			await royale.takeAPosition(2, { from: second });
			await royale.takeAPosition(1, { from: third });
			await royale.takeAPosition(1, { from: second });
			await royale.takeAPosition(2, { from: second });
			await royale.takeAPosition(2, { from: third });

			let postions1InRound2_after = await royale.getPositionsPerRound(2,1);
			let postions2InRound2_after = await royale.getPositionsPerRound(2,2);
			assert.equal(0, postions1InRound2_after);
			assert.equal(2, postions2InRound2_after);

			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let postions1InRound2_after_close = await royale.getPositionsPerRound(2,1);
			let postions2InRound2_after_close = await royale.getPositionsPerRound(2,2);
			assert.equal(0, postions1InRound2_after_close);
			assert.equal(2, postions2InRound2_after_close);

			let isPlayerFirstAliveRound2 = await royale.isPlayerAlive(first);
			let isPlayerSecondAliveRound2 = await royale.isPlayerAlive(second);
			let isPlayerThirdAliveRound2 = await royale.isPlayerAlive(third);
			let isPlayerFourthAliveRound2 = await royale.isPlayerAlive(fourth);

			assert.equal(false, isPlayerFirstAliveRound2);
			assert.equal(true, isPlayerSecondAliveRound2);
			assert.equal(true, isPlayerThirdAliveRound2);
			assert.equal(false, isPlayerFourthAliveRound2);

			//#3
			//before checking
			let postions1InRound3_before_start = await royale.getPositionsPerRound(3,1);
			let postions2InRound3_before_start = await royale.getPositionsPerRound(3,2);
			assert.equal(0, postions1InRound3_before_start);
			assert.equal(0, postions2InRound3_before_start);

			await royale.takeAPosition(2, { from: second });
			await royale.takeAPosition(2, { from: third });
			await royale.takeAPosition(1, { from: second });
			await royale.takeAPosition(2, { from: second });
			await royale.takeAPosition(1, { from: third });
			await royale.takeAPosition(1, { from: second });

			let postions1InRound3_after = await royale.getPositionsPerRound(3,1);
			let postions2InRound3_after = await royale.getPositionsPerRound(3,2);
			assert.equal(2, postions1InRound3_after);
			assert.equal(0, postions2InRound3_after);

			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let postions1InRound3_after_close = await royale.getPositionsPerRound(3,1);
			let postions2InRound3_after_close = await royale.getPositionsPerRound(3,2);
			assert.equal(2, postions1InRound3_after_close);
			assert.equal(0, postions2InRound3_after_close);

			let isPlayerFirstAliveRound3 = await royale.isPlayerAlive(first);
			let isPlayerSecondAliveRound3 = await royale.isPlayerAlive(second);
			let isPlayerThirdAliveRound3 = await royale.isPlayerAlive(third);
			let isPlayerFourthAliveRound3 = await royale.isPlayerAlive(fourth);

			assert.equal(false, isPlayerFirstAliveRound3);
			assert.equal(false, isPlayerSecondAliveRound3);
			assert.equal(false, isPlayerThirdAliveRound3);
			assert.equal(false, isPlayerFourthAliveRound3);

			await expect(royale.takeAPosition(2, { from: first })).to.be.revertedWith(
				'Competition finished'
			);

			let canStartFalseAfterFinish = await royale.canStartRoyale();
			assert.equal(false, canStartFalseAfterFinish);
		});
	});
});
