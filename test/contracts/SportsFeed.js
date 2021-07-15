'use strict';

const { artifacts, contract, web3 } = require('hardhat');
const { toBN } = web3.utils;

const { assert, addSnapshotBeforeRestoreAfterEach } = require('./common');

contract('SportFeed', accounts => {
	const [first, owner] = accounts;

	describe('Test feed', () => {
		it('Parses result properly', async () => {
			let SportFeedContract = artifacts.require('TestSportFeed');
			let feed = await SportFeedContract.new(owner);
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
		});
	});
});
