'use strict';

const { artifacts, contract, web3 } = require('hardhat');
const { toBN } = web3.utils;

const { assert, addSnapshotBeforeRestoreAfterEach } = require('../../utils/common');

const { toBytes32 } = require('../../../index');

const SECOND = 1000;
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
	const [first, owner] = accounts;
	let priceFeedAddress;
	let rewardTokenAddress;
	let ThalesRoyale;
	let royale;

	beforeEach(async () => {
		priceFeedAddress = owner;
		rewardTokenAddress = owner;

		ThalesRoyale = artifacts.require('ThalesRoyale');
		royale = await ThalesRoyale.new(
			owner,
			toBytes32('SNX'),
			priceFeedAddress,
			toUnit(10000),
			rewardTokenAddress,
			7,
			1000
		);
	});

	describe('Init', () => {
		it('Signing up cant be called twice', async () => {
			await royale.signUp({ from: first });

			await expect(royale.signUp({ from: first })).to.be.revertedWith('Player already signed up');

		});

		it('Signing up only possible in specified time', async () => {
			await fastForward(DAY * 2);
			await expect(royale.signUp({ from: first })).to.be.revertedWith('Sign up period has expired');
		});
	});
});
