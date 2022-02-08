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

contract('XYZFeedInstance', accounts => {
	const [first, owner] = accounts;

	describe('Test feed', () => {
		it('Parses result properly', async () => {
			let TestMerkleDistributor = artifacts.require('TestMerkleDistributor');
			let md = await TestMerkleDistributor.new();

			let xyzFeed = artifacts.require('XYZFeedInstance');
			let feed = await xyzFeed.new(
				owner,
				md.address,
				100,
				'XYZ airdrop claims',
				'100',
				'XYZ airdrop claims'
			);

			console.log((await feed.targetCount()).toString());
			console.log((await md.claimed()).toString());

			assert.equal(await feed.getOutcome(), false);

			await md.setClaimed(100, {
				from: owner,
			});

			console.log((await feed.targetCount()).toString());
			console.log((await md.claimed()).toString());

			assert.equal(await feed.getOutcome(), true);
		});
	});
});
