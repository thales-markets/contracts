'use strict';

const { artifacts, contract, web3 } = require('hardhat');
const { toBN } = web3.utils;

const { assert, addSnapshotBeforeRestoreAfterEach } = require('./common');

contract('OlympicsFeed', accounts => {
	const [first, owner] = accounts;

	describe('Test feed', () => {
		it('Parses result properly', async () => {
			let OlympicsFeedContract = artifacts.require('OlympicsFeed');
			let feed = await OlympicsFeedContract.new(owner);
			await feed.setResult('0x5b22555341222c2243484e222c22474252225d00000000000000000000000000', {
				from: owner,
			});
			let stringResult = await feed.getResultAsString();
			let plainResult = await feed.result();
			console.log('result is' + stringResult);
			console.log('result plain is' + plainResult);
			console.log('result bytes is' + (await feed.bytes32ToString(plainResult)));
		});
	});
});
