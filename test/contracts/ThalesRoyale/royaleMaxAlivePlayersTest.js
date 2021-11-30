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
	let ThalesDeployed;
	let MockPriceFeedDeployed;

	const thalesQty = toUnit(10000);
	const thalesQty_2500 = toUnit(2500);

	beforeEach(async () => {

		let Thales = artifacts.require('Thales');
		ThalesDeployed = await Thales.new({ from: owner });

		priceFeedAddress = owner;

		let MockPriceFeed = artifacts.require('MockPriceFeed');
		MockPriceFeedDeployed = await MockPriceFeed.new(owner);

		await MockPriceFeedDeployed.setPricetoReturn(1000);

		priceFeedAddress = MockPriceFeedDeployed.address;

		ThalesRoyale = artifacts.require('ThalesRoyale');
		royale = await ThalesRoyale.new(
			owner,
			toBytes32('SNX'),
			priceFeedAddress,
			toUnit(0),
			ThalesDeployed.address,
			7,
			DAY * 3,
			HOUR * 8,
			DAY,
			WEEK,
			1 // season 1
		);

		await ThalesDeployed.transfer(royale.address, thalesQty, { from: owner });
		await ThalesDeployed.approve(royale.address, thalesQty, { from: owner });

	});

	describe('Init', () => {
		it('max alive players', async () => {
				for (let i = 0; i < 2000; i++) {
					var id = crypto.randomBytes(32).toString('hex');
					var privateKey = '0x' + id;
	
					var wallet = new ethers2.Wallet(privateKey);
					//console.log('wallet  ' + wallet.address);
					
					//await ThalesDeployed.approve(wallet.address, toUnit(1), { from: owner });
					//await ThalesDeployed.transfer(wallet.address, toUnit(1), { from: owner });
					//await ThalesDeployed.approve(royale.address, toUnit(1), { from: wallet.address });
					//await ThalesDeployed.transfer(royale.address, toUnit(1), { from: wallet.address });
					//await royale.signUp(toUnit(1) , { from: wallet.address });

					//console.log('Signed up ' + wallet.address, ' which is ' + i);
				}

				await fastForward(4 * DAY);
				await royale.startRoyale();
				let totalPlayersRound1 = await royale.totalPlayersPerRoundPerSeason(1, 1);
				console.log('totalPlayersRound1 is ' + totalPlayersRound1);
		});
	});
});
