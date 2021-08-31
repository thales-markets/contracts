'use strict';

const { artifacts, contract, web3 } = require('hardhat');
const { toBN } = web3.utils;

const { assert, addSnapshotBeforeRestoreAfterEach } = require('../../utils/common');

const { toBytes32 } = require('../../../index');

const {
	fastForward,
	toUnit,
	currentTime,
	multiplyDecimalRound,
	divideDecimalRound,
} = require('../../utils')();

contract('USopenfeed', accounts => {
	const [first, owner] = accounts;

	describe('Test feed', () => {
		it('Parses result properly', async () => {
			let USOpenFeed = artifacts.require('TestUSOpenFeed');
			let feed = await USOpenFeed.new(
				owner,
				'0x56dd6586db0d08c6ce7b2f2805af28616e082455',
				toBytes32('aa34467c0b074fb0888c9f42c449547f'),
				toUnit(1),
				'2020'
			);
			let USOpenFeedInstance = artifacts.require('USOpenFeedInstance');

			let customOracle = await USOpenFeedInstance.new(
				owner,
				feed.address,
				toBN(605658),
				'Dominic Thiem',
				'1',
				'US Open 2020 winner'
			);

			assert.equal(await customOracle.getOutcome(), false);

			await feed.setResult(605658, {
				from: owner,
			});

			assert.equal(await customOracle.getOutcome(), true);
		});
	});
});
