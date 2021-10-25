'use strict';

const { artifacts, contract, web3 } = require('hardhat');
const { toBN } = web3.utils;

const { assert, addSnapshotBeforeRestoreAfterEach } = require('../../utils/common');

const { toBytes32 } = require('../../../index');

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
	const [first, owner, second] = accounts;
	let priceFeedAddress;
	let rewardTokenAddress;
	let ThalesRoyale;
	let royale;

	beforeEach(async () => {
		priceFeedAddress = owner;
		rewardTokenAddress = owner;

		let MockPriceFeed = artifacts.require('MockPriceFeed');
		let MockPriceFeedDeployed = await MockPriceFeed.new(owner);

		priceFeedAddress = MockPriceFeedDeployed.address;

		ThalesRoyale = artifacts.require('ThalesRoyale');
		royale = await ThalesRoyale.new(
			owner,
			toBytes32('SNX'),
			priceFeedAddress,
			toUnit(10000),
			rewardTokenAddress,
			7
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

			await expect(royale.signUp({ from: first })).to.be.revertedWith('Player already signed up');
		});

		it('Signing up only possible in specified time', async () => {
			await fastForward(DAY * 4);
			await expect(royale.signUp({ from: first })).to.be.revertedWith('Sign up period has expired');
		});

		it('next', async () => {
			await royale.signUp({ from: first });
			await royale.signUp({ from: second });

			await expect(royale.takeAPosition(0, { from: first })).to.be.revertedWith(
				'Competition not started yet'
			);

			await expect(royale.takeAPosition(2, { from: first })).to.be.revertedWith(
				'Position can only be 0 or 1'
			);

			await expect(royale.startRoyale()).to.be.revertedWith(
				"Can't start until signup period expires"
			);

			await fastForward(HOUR * 72 + 1);
			await royale.startRoyale();
			await fastForward(HOUR * 72 + 1);

			await expect(royale.takeAPosition(1, { from: first })).to.be.revertedWith(
				'Round positioning finished'
			);
		});
	});
});
