'use strict';

const { artifacts, contract, web3 } = require('hardhat');
const { toBN } = web3.utils;

const { assert, addSnapshotBeforeRestoreAfterEach } = require('../common');

const { toBytes32 } = require('../../../index');

const {
	fastForward,
	toUnit,
	currentTime,
	multiplyDecimalRound,
	divideDecimalRound,
} = require('../../utils')();

contract('SportFeed', accounts => {
	const [first, owner] = accounts;

	describe('Test feed', () => {
		it('Parses result properly', async () => {
			let SportFeedContract = artifacts.require('TestSportFeed');
			let feed = await SportFeedContract.new(
				owner,
				'0x56dd6586db0d08c6ce7b2f2805af28616e082455',
				toBytes32('aa34467c0b074fb0888c9f42c449547f'),
				toUnit(1)
			);
			await feed.setResult('0x5b22555341222c2243484e222c22474252225d00000000000000000000000000', {
				from: owner,
			});
			let stringResult = await feed.resultString();
			let plainResult = await feed.result();
			console.log('result is' + stringResult);
			console.log('result plain is' + plainResult);
			console.log('result bytes is' + (await feed.bytes32ToString(plainResult)));
			let firstPlace = await feed.firstPlace();
			let secondPlace = await feed.secondPlace();
			let thirdPlace = await feed.thirdPlace();
			console.log('firstPlace is ' + firstPlace);
			console.log('secondPlace is ' + secondPlace);
			console.log('thirdPlace is ' + thirdPlace);

			assert.equal(await feed.isCompetitorAtPlace('USA', 1), true);
			assert.equal(await feed.isCompetitorAtPlace('CHN', 2), true);
			assert.equal(await feed.isCompetitorAtPlace('GBR', 3), true);

			assert.equal(await feed.isCompetitorAtPlace('GBR', 1), false);

			let feed2 = await SportFeedContract.new(
				owner,
				'0x56dd6586db0d08c6ce7b2f2805af28616e082455',
				toBytes32('aa34467c0b074fb0888c9f42c449547f'),
				toUnit(1)
			);
			let SportFeedOracleInstanceContract = artifacts.require('SportFeedOracleInstance');

			await SportFeedOracleInstanceContract.link(await artifacts.require('Integers').new());

			let customOracle = await SportFeedOracleInstanceContract.new(
				owner,
				feed2.address,
				'USA',
				'1',
				'Olympics Medal Count'
			);

			assert.equal(await customOracle.getOutcome(), false);

			await feed2.setResult('0x5b22555341222c2243484e222c22474252225d00000000000000000000000000', {
				from: owner,
			});

			assert.equal(await customOracle.getOutcome(), true);
		});

	});
});
