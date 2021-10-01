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

contract('EthBurnedFeed', accounts => {
	const [first, owner] = accounts;

	describe('Test feed', () => {
		it('Parses result properly', async () => {
			// console.log(toBytes32('07c2ac56981546409a65be557d0b76cc'));

			let EthBurnedFeed = artifacts.require('EthBurnedFeed');
			let feed = await EthBurnedFeed.new(
				owner,
				'0xff07c97631ff3bab5e5e5660cdf47aded8d4d4fd',
				toBytes32('fcca08dd168a4bfd9ddc48ebfa142ed7'),
				toUnit(1),
				'burned-eth',
				true
			);

			let EthBurnedFeedOracleInstanceContract = artifacts.require('EthBurnedOracleInstance');
			let ethBurnedFeedOracleInstance = await EthBurnedFeedOracleInstanceContract.new(
				owner,
				feed.address,
				'ETH burned count',
				1000000,
				'ETH burned count'
			);

			let resolvable = await ethBurnedFeedOracleInstance.resolvable();
			console.log('resolvable is ' + resolvable);

			await feed.setResult(toUnit(405843.898119093361919713), {
				from: owner,
			});
			let result = await feed.result();
			console.log(result.toString());

			let outcome = await ethBurnedFeedOracleInstance.getOutcome();
			console.log('outcome is ' + outcome);

			resolvable = await ethBurnedFeedOracleInstance.resolvable();
			console.log('resolvable is ' + resolvable);

			ethBurnedFeedOracleInstance = await EthBurnedFeedOracleInstanceContract.new(
				owner,
				feed.address,
				'ETH burned count',
				100000,
				'ETH burned count'
			);
			outcome = await ethBurnedFeedOracleInstance.getOutcome();
			console.log('outcome is ' + outcome);

			resolvable = await ethBurnedFeedOracleInstance.resolvable();
			console.log('resolvable is ' + resolvable);
		});
	});
});
