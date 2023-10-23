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
	fromUnit,
	currentTime,
	bytesToString,
	multiplyDecimalRound,
	divideDecimalRound,
} = require('../../utils')();

const {
	onlyGivenAddressCanInvoke,
	convertToDecimals,
	encodeCall,
	assertRevert,
	getEventByName,
} = require('../../utils/helpers');

let SportAMMRiskManager;

contract('SportsAMMRiskManager', (accounts) => {
	const [manager, first, owner] = accounts;

	const ZERO_ADDRESS = '0x' + '0'.repeat(40);
	const MAX_NUMBER =
		'115792089237316195423570985008687907853269984665640564039457584007913129639935';

	const SportAMMLiquidityPoolRoundMastercopy = artifacts.require(
		'SportAMMLiquidityPoolRoundMastercopy'
	);

	beforeEach(async () => {
		let SportAMMRiskManagerContract = artifacts.require('SportAMMRiskManager');
		SportAMMRiskManager = await SportAMMRiskManagerContract.new();

		const sportId_4 = 4; // NBA
		const sportId_16 = 16; // CHL

		const tagID_4 = 9000 + sportId_4;
		const tagID_16 = 9000 + sportId_16;
		const tagIDChild = 10002;

		await SportAMMRiskManager.initialize(
			owner,
			ZERO_ADDRESS,
			toUnit('5000'),
			[tagID_4],
			[toUnit('50000')],
			[tagID_4],
			[tagIDChild],
			[toUnit('1000')],
			3,
			[tagID_4],
			[5],
			{ from: owner }
		);
	});

	describe('Test dynamic liquidity', () => {
		it('Check dynamic liquidity', async () => {
			let SportMarketMock = artifacts.require('SportMarketMock');
			let sportMarketMock = await SportMarketMock.new(9001);

			let now = await currentTime();
			console.log('now: ' + now);

			//set 24h to game
			await sportMarketMock.setStartTime(now + 86400);

			let gameTime = await sportMarketMock.times();
			console.log('gametime: ' + gameTime[0]);

			console.log('sportMarketMock: ' + sportMarketMock.address);
			console.log('SportAMMRiskManager: ' + SportAMMRiskManager.address);

			let calculateCapToBeUsed = await SportAMMRiskManager.calculateCapToBeUsed(
				sportMarketMock.address
			);

			console.log('calculateCapToBeUsed: ' + calculateCapToBeUsed);
			assert.bnEqual(toUnit(5000), calculateCapToBeUsed);

			await SportAMMRiskManager.setDynamicLiquidityParamsPerSport(9001, 43200, 0, {
				from: owner,
			});

			calculateCapToBeUsed = await SportAMMRiskManager.calculateCapToBeUsed(
				sportMarketMock.address
			);

			console.log('calculateCapToBeUsed: ' + calculateCapToBeUsed);
			assert.bnEqual(toUnit(2500), calculateCapToBeUsed);

			await sportMarketMock.setStartTime(now + 21600);
			calculateCapToBeUsed = await SportAMMRiskManager.calculateCapToBeUsed(
				sportMarketMock.address
			);
			console.log('calculateCapToBeUsed: ' + calculateCapToBeUsed);
			assert.bnLt(calculateCapToBeUsed, toUnit('3751'));
			assert.bnGt(calculateCapToBeUsed, toUnit('3749'));

			await SportAMMRiskManager.setDynamicLiquidityParamsPerSport(9001, 0, 0, {
				from: owner,
			});
			calculateCapToBeUsed = await SportAMMRiskManager.calculateCapToBeUsed(
				sportMarketMock.address
			);

			console.log('calculateCapToBeUsed: ' + calculateCapToBeUsed);
			assert.bnEqual(toUnit(5000), calculateCapToBeUsed);
		});
	});
});
