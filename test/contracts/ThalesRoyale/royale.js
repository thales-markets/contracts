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

const {
	onlyGivenAddressCanInvoke,
	convertToDecimals,
	encodeCall,
	assertRevert,
} = require('../../utils/helpers');

contract('ThalesRoyale', accounts => {
	const [first, owner, second, third, fourth] = accounts;
	const season_1 = 1;
	const season_2 = 2;
	let priceFeedAddress;
	let MockPriceFeedDeployed;
	let ThalesDeployed;
	let thales;
	let ThalesRoyale;
	let ThalesRoyaleDeployed;
	let royale;
	let initializeRoyaleData;
	let ThalesRoyaleImplementation;
	let ThalesRoyalePass;
	let ThalesRoyalePassDeployed;
	let voucher;

	beforeEach(async () => {

		const thalesQty_0 = toUnit(0);
		const thalesQty = toUnit(10000);
		const thalesQty_2500 = toUnit(2500);
		const uri = 'http://my-json-server.typicode.com/abcoathup/samplenft/tokens/0';

		let OwnedUpgradeabilityProxy = artifacts.require('OwnedUpgradeabilityProxy');

		let Thales = artifacts.require('Thales');
		ThalesDeployed = await Thales.new({ from: owner });
		
		priceFeedAddress = owner;

		let MockPriceFeed = artifacts.require('MockPriceFeed');
		MockPriceFeedDeployed = await MockPriceFeed.new(owner);


		await MockPriceFeedDeployed.setPricetoReturn(1000);

		priceFeedAddress = MockPriceFeedDeployed.address;

		ThalesRoyale = artifacts.require('ThalesRoyale');

		ThalesRoyaleDeployed = await OwnedUpgradeabilityProxy.new({ from: owner });
		ThalesRoyaleImplementation = await ThalesRoyale.new({ from: owner });
		royale = await ThalesRoyale.at(ThalesRoyaleDeployed.address);

		ThalesRoyalePass = artifacts.require('ThalesRoyalePass');

		voucher = await ThalesRoyalePass.new(
			ThalesDeployed.address,
			uri,
			ThalesRoyaleDeployed.address, 
			{ from: owner }
		);

		initializeRoyaleData = encodeCall(
			'initialize',
			['address', 'bytes32', 'address', 'address', 'uint',
				'uint', 'uint', 'uint', 'uint', 'uint', 'bool'],
			[
				owner,
				toBytes32('SNX'),
				priceFeedAddress,
				ThalesDeployed.address,
				7,
				DAY * 3,
				HOUR * 8,
				DAY,
				toUnit(2500),
				WEEK * 4,
				false
			]
		);

		await ThalesRoyaleDeployed.upgradeToAndCall(ThalesRoyaleImplementation.address, initializeRoyaleData, {
			from: owner,
		});

		await royale.setRoyalePassAddress(voucher.address, {from:owner});

		await ThalesDeployed.transfer(royale.address, thalesQty, { from: owner });
		await ThalesDeployed.approve(royale.address, thalesQty, { from: owner });

		await ThalesDeployed.transfer(first, thalesQty, { from: owner });
		await ThalesDeployed.approve(royale.address, thalesQty_2500, { from: first });

		await ThalesDeployed.transfer(second, thalesQty, { from: owner });
		await ThalesDeployed.approve(royale.address, thalesQty_2500, { from: second });

		await ThalesDeployed.transfer(third, thalesQty, { from: owner });
		await ThalesDeployed.approve(royale.address, thalesQty_2500, { from: third });

		await ThalesDeployed.transfer(fourth, thalesQty, { from: owner });
		await ThalesDeployed.approve(royale.address, thalesQty_2500, { from: fourth });

		await ThalesDeployed.transfer(voucher.address, thalesQty, { from: owner });
		await ThalesDeployed.approve(voucher.address, thalesQty, { from: owner });

		await ThalesDeployed.transfer(first, thalesQty_2500, { from: owner });
		await ThalesDeployed.approve(voucher.address, thalesQty_2500, { from: first });

		await ThalesDeployed.transfer(second, thalesQty_2500, { from: owner });
		await ThalesDeployed.approve(voucher.address, thalesQty_2500, { from: second });

	});

	describe('Init', () => {

		it('Initialize first season', async () => {
			await expect(royale.signUp({ from: first })).to.be.revertedWith('Initialize first season');
		});

		it('Can not start first season if not owner', async () => {
			await expect(royale.startNewSeason({ from: first })).to.be.revertedWith('Only owner can start season before pause between two seasons');
		});

		it('Signing up cant be called twice', async () => {

			await royale.startNewSeason({ from: owner });

			await royale.signUp({ from: first });
			await royale.signUp({ from: second });

			let initTotalPlayersInARound = await royale.totalPlayersPerRoundPerSeason(season_1, 1);
			// not started
			assert.equal(0, initTotalPlayersInARound);

			let initEliminatedPlayersInARound = await royale.eliminatedPerRoundPerSeason(season_1, 1);
			// not started
			assert.equal(0, initEliminatedPlayersInARound);

			await expect(royale.signUp({ from: first })).to.be.revertedWith('Player already signed up');
		});

		it('Signing up No enough tokens', async () => {
			await royale.startNewSeason({ from: owner });
			await royale.setBuyInAmount(toUnit(3500000000), { from: owner });
			await expect(royale.signUp({ from: first })).to.be.revertedWith('No enough sUSD for buy in');
		});

		it('Signing up with allowance check event', async () => {
			await royale.startNewSeason({ from: owner });

			const tx = await royale.signUp({ from: first });

			// check if event is emited
			assert.eventEqual(tx.logs[0], 'SignedUp', {
				user: first,
				season: season_1
			});
		});

		it('Signing up only possible in specified time', async () => {
			await royale.startNewSeason({ from: owner });

			await fastForward(DAY * 4);
			await expect(royale.signUp({ from: first })).to.be.revertedWith('Sign up period has expired');
		});

		it('No one is signed up try to start', async () => {
			await royale.startNewSeason({ from: owner });

			await fastForward(HOUR * 72 + 1);
			await expect(royale.startRoyaleInASeason({ from: first })).to.be.revertedWith('Can not start, no players in a season');

		});

		it('Cant start new season if this not finished', async () => {
			await royale.startNewSeason({ from: owner });

			await royale.signUp({ from: first });
			await royale.signUp({ from: second });
			await royale.signUp({ from: third });

			let isPlayerFirstAlive = await royale.isPlayerAlive(first);

			assert.equal(true, isPlayerFirstAlive);

			await fastForward(HOUR * 72 + 1);

			await royale.startRoyaleInASeason();

			let totalPlayersInARound = await royale.totalPlayersPerRoundPerSeason(season_1, 1);
			assert.equal(3, totalPlayersInARound);

			let eliminatedPlayersInARound = await royale.eliminatedPerRoundPerSeason(season_1, 1);
			assert.equal(0, eliminatedPlayersInARound);

			await expect(royale.startNewSeason({ from: owner })).to.be.revertedWith('Previous season must be finished');
		});

		it('check require statements', async () => {
			await royale.startNewSeason({ from: owner });

			await royale.signUp({ from: first });
			await royale.signUp({ from: second });

			await expect(royale.takeAPosition(1, { from: first })).to.be.revertedWith(
				'Competition not started yet'
			);

			await expect(royale.takeAPosition(3, { from: first })).to.be.revertedWith(
				'Position can only be 1 or 2'
			);

			await expect(royale.startRoyaleInASeason()).to.be.revertedWith(
				"Can't start until signup period expires"
			);

			await fastForward(HOUR * 72 + 1);
			await royale.startRoyaleInASeason();
			await fastForward(HOUR * 72 + 1);

			await expect(royale.takeAPosition(2, { from: first })).to.be.revertedWith(
				'Round positioning finished'
			);
		});

		it('take a losing position and end first round and try to take a position in 2nd round player not alive', async () => {
			await royale.startNewSeason({ from: owner });
			let isPlayerFirstAlive = await royale.isPlayerAlive(first);

			assert.equal(false, isPlayerFirstAlive);

			await royale.signUp({ from: first });
			await royale.signUp({ from: second });
			await royale.signUp({ from: third });

			isPlayerFirstAlive = await royale.isPlayerAlive(first);

			assert.equal(true, isPlayerFirstAlive);

			await fastForward(HOUR * 72 + 1);

			let isRoundClosableBeforeStarting = await royale.canCloseRound();
			assert.equal(false, isRoundClosableBeforeStarting);

			await royale.startRoyaleInASeason();

			let totalPlayersInARound = await royale.totalPlayersPerRoundPerSeason(season_1, 1);
			assert.equal(3, totalPlayersInARound);

			let eliminatedPlayersInARound = await royale.eliminatedPerRoundPerSeason(season_1, 1);
			assert.equal(0, eliminatedPlayersInARound);

			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(1, { from: second });
			await royale.takeAPosition(1, { from: third });

			let roundTargetPrice = await royale.roundTargetPrice();

			let currentPrice = await MockPriceFeedDeployed.rateForCurrency(toBytes32('SNX'));

			await MockPriceFeedDeployed.setPricetoReturn(900);

			let isRoundClosableBefore = await royale.canCloseRound();
			assert.equal(false, isRoundClosableBefore);

			await fastForward(HOUR * 72 + 1);

			let isRoundClosableAfter = await royale.canCloseRound();
			assert.equal(true, isRoundClosableAfter);

			await royale.closeRound();

			let isRoundClosableAfterClosing = await royale.canCloseRound();
			assert.equal(false, isRoundClosableAfterClosing);

			roundTargetPrice = await royale.roundTargetPrice();

			currentPrice = await MockPriceFeedDeployed.rateForCurrency(toBytes32('SNX'));

			isPlayerFirstAlive = await royale.isPlayerAlive(first);

			let totalPlayersInARoundTwo = await royale.totalPlayersPerRoundPerSeason(season_1, 2);

			assert.equal(2, totalPlayersInARoundTwo);

			let eliminatedPlayersInARoundOne = await royale.eliminatedPerRoundPerSeason(season_1, 1);
			assert.equal(1, eliminatedPlayersInARoundOne);

			assert.equal(false, isPlayerFirstAlive);

			await expect(royale.takeAPosition(2, { from: first })).to.be.revertedWith(
				'Player no longer alive'
			);
		});

		it('take a losing position end royale no players left', async () => {
			await royale.startNewSeason({ from: owner });

			let isPlayerFirstAlive = await royale.isPlayerAlive(first);

			assert.equal(false, isPlayerFirstAlive);

			await royale.signUp({ from: first });
			await royale.signUp({ from: second });

			isPlayerFirstAlive = await royale.isPlayerAlive(first);

			assert.equal(true, isPlayerFirstAlive);

			let initTotalPlayersInARound = await royale.totalPlayersPerRoundPerSeason(season_1, 1);
			// not started
			assert.equal(0, initTotalPlayersInARound);

			let initEliminatedPlayersInARound = await royale.eliminatedPerRoundPerSeason(season_1, 1);
			// not started
			assert.equal(0, initEliminatedPlayersInARound);

			await fastForward(HOUR * 72 + 1);

			let isRoundClosableBeforeStarting = await royale.canCloseRound();
			assert.equal(false, isRoundClosableBeforeStarting);

			await royale.startRoyaleInASeason();

			let totalPlayersInARound = await royale.totalPlayersPerRoundPerSeason(season_1, 1);
			// equal to total number of players
			assert.equal(2, totalPlayersInARound);

			let eliminatedPlayersInARound = await royale.eliminatedPerRoundPerSeason(season_1, 1);
			// zero  round need to be finished
			assert.equal(0, eliminatedPlayersInARound);

			await royale.takeAPosition(2, { from: first });

			let roundTargetPrice = await royale.roundTargetPrice();

			let currentPrice = await MockPriceFeedDeployed.rateForCurrency(toBytes32('SNX'));

			await MockPriceFeedDeployed.setPricetoReturn(900);

			let isRoundClosableBefore = await royale.canCloseRound();
			assert.equal(false, isRoundClosableBefore);

			await fastForward(HOUR * 72 + 1);

			let isRoundClosableAfter = await royale.canCloseRound();
			assert.equal(true, isRoundClosableAfter);

			await royale.closeRound();

			let isRoundClosableAfterClosing = await royale.canCloseRound();
			assert.equal(false, isRoundClosableAfterClosing);

			roundTargetPrice = await royale.roundTargetPrice();

			currentPrice = await MockPriceFeedDeployed.rateForCurrency(toBytes32('SNX'));

			let roundResult = await royale.roundResultPerSeason(season_1, 1);

			isPlayerFirstAlive = await royale.isPlayerAlive(first);

			let totalPlayersInARoundTwo = await royale.totalPlayersPerRoundPerSeason(season_1, 2);
			// equal to zero because second didn't take position
			assert.equal(0, totalPlayersInARoundTwo);

			let eliminatedPlayersInARoundOne = await royale.eliminatedPerRoundPerSeason(season_1, 1);
			// two because first did take losing position, and second did't take position at all
			assert.equal(2, eliminatedPlayersInARoundOne);

			assert.equal(true, isPlayerFirstAlive);

			await expect(royale.takeAPosition(2, { from: first })).to.be.revertedWith(
				'Competition finished'
			);
		});

		it('take a winning position and end first round and try to take a position in 2nd round', async () => {
			await royale.startNewSeason({ from: owner });
			let isPlayerFirstAlive = await royale.isPlayerAlive(first);

			assert.equal(false, isPlayerFirstAlive);

			await royale.signUp({ from: first });
			await royale.signUp({ from: second });

			isPlayerFirstAlive = await royale.isPlayerAlive(first);

			assert.equal(true, isPlayerFirstAlive);

			await fastForward(HOUR * 72 + 1);
			await royale.startRoyaleInASeason();

			let totalPlayersInARound = await royale.totalPlayersPerRoundPerSeason(season_1, 1);
			// equal to total number of players
			assert.equal(2, totalPlayersInARound);

			let eliminatedPlayersInARound = await royale.eliminatedPerRoundPerSeason(season_1, 1);
			// zero  round need to be finished
			assert.equal(0, eliminatedPlayersInARound);

			await royale.takeAPosition(2, { from: first });

			await MockPriceFeedDeployed.setPricetoReturn(1100);

			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			isPlayerFirstAlive = await royale.isPlayerAlive(first);

			assert.equal(true, isPlayerFirstAlive);

			await expect(royale.takeAPosition(2, { from: first })).to.be.revertedWith('Competition finished');

			let isPlayerOneClaimedReward_before = await royale.rewardCollectedPerSeason(season_1, first);
			assert.equal(false, isPlayerOneClaimedReward_before);

			const tx = await royale.claimRewardForSeason(season_1, { from: first });

			// check if event is emited
			assert.eventEqual(tx.logs[0], 'RewardClaimed', {
				season: season_1,
				winner: first,
				reward: toUnit(5000),
			});

			let isPlayerOneClaimedReward_after = await royale.rewardCollectedPerSeason(season_1, first);
			assert.equal(isPlayerOneClaimedReward_after, true);
		});

		it('take a winning position and end first round then skip 2nd round', async () => {
			await royale.startNewSeason({ from: owner });
			let isPlayerFirstAlive = await royale.isPlayerAlive(first);

			assert.equal(false, isPlayerFirstAlive);

			let totalPlayers = await royale.getPlayersForSeason(season_1);
			assert.equal(0, totalPlayers.length);

			await royale.signUp({ from: first });

			totalPlayers = await royale.getPlayersForSeason(season_1);
			assert.equal(1, totalPlayers.length);

			await royale.signUp({ from: second });

			totalPlayers = await royale.getPlayersForSeason(season_1);
			assert.equal(2, totalPlayers.length);

			await royale.signUp({ from: third });

			totalPlayers = await royale.getPlayersForSeason(season_1);
			assert.equal(3, totalPlayers.length);

			isPlayerFirstAlive = await royale.isPlayerAlive(first);

			assert.equal(true, isPlayerFirstAlive);

			await fastForward(HOUR * 72 + 1);
			await royale.startRoyaleInASeason();

			let totalPlayersInARound = await royale.totalPlayersPerRoundPerSeason(season_1, 1);
			// equal to total number of players
			assert.equal(3, totalPlayersInARound);

			let eliminatedPlayersInARound = await royale.eliminatedPerRoundPerSeason(season_1, 1);
			// zero  round need to be finished
			assert.equal(0, eliminatedPlayersInARound);

			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: third });

			await MockPriceFeedDeployed.setPricetoReturn(1100);

			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let totalPlayersInARoundTwo = await royale.totalPlayersPerRoundPerSeason(season_1, 2);
			assert.equal(2, totalPlayersInARoundTwo);

			let eliminatedPlayersInARoundOne = await royale.eliminatedPerRoundPerSeason(season_1, 1);
			// second did't take position at all so eliminated is 1
			assert.equal(1, eliminatedPlayersInARoundOne);

			isPlayerFirstAlive = await royale.isPlayerAlive(first);

			assert.equal(true, isPlayerFirstAlive);

			await MockPriceFeedDeployed.setPricetoReturn(900);
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let totalPlayersInARoundThree = await royale.totalPlayersPerRoundPerSeason(season_1, 3);
			// equal to zero because first player didn't take position
			assert.equal(0, totalPlayersInARoundThree);

			let eliminatedPlayersInARoundTwo = await royale.eliminatedPerRoundPerSeason(season_1, 2);
			// first did't take position at all so eliminated in round two is 2
			assert.equal(2, eliminatedPlayersInARoundTwo);

			isPlayerFirstAlive = await royale.isPlayerAlive(first);

			assert.equal(true, isPlayerFirstAlive);

		});

		it('win till the end', async () => {
			await royale.startNewSeason({ from: owner });
			await royale.signUp({ from: first });
			await royale.signUp({ from: second });
			await royale.signUp({ from: third });

			await fastForward(HOUR * 72 + 1);
			await royale.startRoyaleInASeason();

			let totalPlayersInARound = await royale.totalPlayersPerRoundPerSeason(season_1, 1);
			// equal to total number of players
			assert.equal(3, totalPlayersInARound);

			let eliminatedPlayersInARound = await royale.eliminatedPerRoundPerSeason(season_1, 1);
			// zero  round need to be finished
			assert.equal(0, eliminatedPlayersInARound);

			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: third });

			await MockPriceFeedDeployed.setPricetoReturn(1100);

			//#1
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let totalPlayersInARoundTwo = await royale.totalPlayersPerRoundPerSeason(season_1, 2);
			// equal to 2 - first player, third win
			assert.equal(2, totalPlayersInARoundTwo);

			let eliminatedPlayersInARoundOne = await royale.eliminatedPerRoundPerSeason(season_1, 1);
			// equal to 1 second player did't take position
			assert.equal(1, eliminatedPlayersInARoundOne);

			//#2
			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: third });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let totalPlayersInARoundThree = await royale.totalPlayersPerRoundPerSeason(season_1, 3);
			// equal to 2 - first, third player win
			assert.equal(2, totalPlayersInARoundThree);

			let eliminatedPlayersInARoundTwo = await royale.eliminatedPerRoundPerSeason(season_1, 2);
			// no one left untill the end player one win
			assert.equal(0, eliminatedPlayersInARoundTwo);

			//#3
			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: third });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let totalPlayersInARoundFour = await royale.totalPlayersPerRoundPerSeason(season_1, 4);
			// equal to 2 - first, third player win
			assert.equal(2, totalPlayersInARoundFour);

			let eliminatedPlayersInARoundThree = await royale.eliminatedPerRoundPerSeason(season_1, 3);
			// no one left untill the end player one win
			assert.equal(0, eliminatedPlayersInARoundThree);

			//#4
			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: third });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let totalPlayersInARoundFive = await royale.totalPlayersPerRoundPerSeason(season_1, 5);
			// equal to 2 - first, third player win
			assert.equal(2, totalPlayersInARoundFive);

			let eliminatedPlayersInARoundFour = await royale.eliminatedPerRoundPerSeason(season_1, 4);
			// no one left untill the end player one win
			assert.equal(0, eliminatedPlayersInARoundFour);

			//#5
			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: third });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let totalPlayersInARoundSix = await royale.totalPlayersPerRoundPerSeason(season_1, 6);
			// equal to 2 - first, third player win
			assert.equal(2, totalPlayersInARoundSix);

			let eliminatedPlayersInARoundFive = await royale.eliminatedPerRoundPerSeason(season_1, 5);
			// no one left untill the end player one win
			assert.equal(0, eliminatedPlayersInARoundFive);

			//#6
			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: third });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let totalPlayersInARoundSeven = await royale.totalPlayersPerRoundPerSeason(season_1, 7);
			// equal to 2 - first, third player win
			assert.equal(2, totalPlayersInARoundSeven);

			let eliminatedPlayersInARoundSix = await royale.eliminatedPerRoundPerSeason(season_1, 6);
			// no one left untill the end player one win
			assert.equal(0, eliminatedPlayersInARoundSix);

			//#7
			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(1, { from: third });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let totalPlayersInARoundEight = await royale.totalPlayersPerRoundPerSeason(season_1, 8);
			// equal to ZERO, no 8. round!
			assert.equal(0, totalPlayersInARoundEight);

			let eliminatedPlayersInARoundSeven = await royale.eliminatedPerRoundPerSeason(season_1, 7);

			assert.equal(1, eliminatedPlayersInARoundSeven);

			let isPlayerFirstAlive = await royale.isPlayerAlive(first);

			assert.equal(true, isPlayerFirstAlive);

			await expect(royale.closeRound()).to.be.revertedWith('Competition finished');
		});

		it('take a winning position and end first round then skip 2nd round', async () => {
			await royale.startNewSeason({ from: owner });
			let isPlayerFirstAlive = await royale.isPlayerAlive(first);

			assert.equal(false, isPlayerFirstAlive);

			await royale.signUp({ from: first });
			await royale.signUp({ from: second });

			isPlayerFirstAlive = await royale.isPlayerAlive(first);

			assert.equal(true, isPlayerFirstAlive);

			await fastForward(HOUR * 72 + 1);
			await royale.startRoyaleInASeason();

			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: second });

			await MockPriceFeedDeployed.setPricetoReturn(1100);

			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			isPlayerFirstAlive = await royale.isPlayerAlive(first);

			assert.equal(true, isPlayerFirstAlive);

			await MockPriceFeedDeployed.setPricetoReturn(900);
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			isPlayerFirstAlive = await royale.isPlayerAlive(first);

			assert.equal(true, isPlayerFirstAlive);
		});

		it('win till the end', async () => {
			await royale.startNewSeason({ from: owner });
			await royale.signUp({ from: first });
			await royale.signUp({ from: second });

			await fastForward(HOUR * 72 + 1);
			await royale.startRoyaleInASeason();

			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: second });

			await MockPriceFeedDeployed.setPricetoReturn(1100);

			//#1
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			//#2
			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: second });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			//#3
			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: second });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			//#4
			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: second });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			//#5
			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: second });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			//#6
			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: second });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			//#7
			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(1, { from: second });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let isPlayerFirstAlive = await royale.isPlayerAlive(first);

			assert.equal(true, isPlayerFirstAlive);

			await expect(royale.closeRound()).to.be.revertedWith('Competition finished');
		});

		it('win till the end', async () => {
			await royale.startNewSeason({ from: owner });
			await royale.signUp({ from: first });
			await royale.signUp({ from: second });
			await royale.signUp({ from: third });
			await royale.signUp({ from: fourth });

			await fastForward(HOUR * 72 + 1);
			await royale.startRoyaleInASeason();

			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: second });
			await royale.takeAPosition(2, { from: third });
			await royale.takeAPosition(2, { from: fourth });

			await MockPriceFeedDeployed.setPricetoReturn(1100);

			//#1
			await fastForward(HOUR * 72 + 1);

			const tx_close_1 = await royale.closeRound();

			// check if event is emited
			assert.eventEqual(tx_close_1.logs[0], 'RoundClosed', {
				season: season_1,
				round: 1,
				result: 2,
				strikePrice: 1000,
				finalPrice: 1100,
				numberOfEliminatedPlayers: 0,
				numberOfWinningPlayers: 4
			});

			//#2
			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: second });
			await royale.takeAPosition(2, { from: third });
			await royale.takeAPosition(2, { from: fourth });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			//#3
			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: second });
			await royale.takeAPosition(2, { from: third });
			await royale.takeAPosition(2, { from: fourth });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			//#4
			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: second });
			await royale.takeAPosition(2, { from: third });
			await royale.takeAPosition(2, { from: fourth });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			//#5
			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: second });
			await royale.takeAPosition(2, { from: third });
			await royale.takeAPosition(2, { from: fourth });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();


			await MockPriceFeedDeployed.setPricetoReturn(1200);

			//#6
			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: second });
			await royale.takeAPosition(2, { from: third });
			await royale.takeAPosition(1, { from: fourth });
			await fastForward(HOUR * 72 + 1);

			const tx_close_6 = await royale.closeRound();

			assert.eventEqual(tx_close_6.logs[0], 'RoundClosed', {
				season: season_1,
				round: 6,
				result: 2,
				strikePrice: 1100,
				finalPrice: 1200,
				numberOfEliminatedPlayers: 1,
				numberOfWinningPlayers: 3
			});

			await MockPriceFeedDeployed.setPricetoReturn(1300);

			//#7
			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: second });
			await royale.takeAPosition(2, { from: third });
			await fastForward(HOUR * 72 + 1);
			const tx_close_7 = await royale.closeRound();

			assert.eventEqual(tx_close_7.logs[0], 'RoundClosed', {
				season: season_1,
				round: 7,
				result: 2,
				strikePrice: 1200,
				finalPrice: 1300,
				numberOfEliminatedPlayers: 0,
				numberOfWinningPlayers: 3
			});

			let isPlayerFirstAlive = await royale.isPlayerAlive(first);

			assert.equal(true, isPlayerFirstAlive);

			await expect(royale.closeRound()).to.be.revertedWith('Competition finished');
		});

		it('win till the end and check results', async () => {
			await royale.startNewSeason({ from: owner });
			await royale.signUp({ from: first });
			await royale.signUp({ from: second });
			await royale.signUp({ from: third });
			await royale.signUp({ from: fourth });

			await fastForward(HOUR * 72 + 1);
			await royale.startRoyaleInASeason();

			let totalPlayersInARound = await royale.totalPlayersPerRoundPerSeason(season_1, 1);
			// equal to total number of players
			assert.equal(4, totalPlayersInARound);

			let eliminatedPlayersInARound = await royale.eliminatedPerRoundPerSeason(season_1, 1);
			// zero round need to be finished
			assert.equal(0, eliminatedPlayersInARound);

			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: second });
			await royale.takeAPosition(2, { from: third });
			await royale.takeAPosition(2, { from: fourth });

			await MockPriceFeedDeployed.setPricetoReturn(1100);

			//#1
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let totalPlayersInARound2 = await royale.totalPlayersPerRoundPerSeason(season_1, 2);
			// equal to total number of players
			assert.equal(4, totalPlayersInARound2);

			let eliminatedPlayersInARound1 = await royale.eliminatedPerRoundPerSeason(season_1, 1);
			// zero - all players are good
			assert.equal(0, eliminatedPlayersInARound1);

			//#2
			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: second });
			await royale.takeAPosition(2, { from: third });
			await royale.takeAPosition(1, { from: fourth });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let totalPlayersInARound3 = await royale.totalPlayersPerRoundPerSeason(season_1, 3);
			// equal to three
			assert.equal(3, totalPlayersInARound3);

			let eliminatedPlayersInARound2 = await royale.eliminatedPerRoundPerSeason(season_1, 2);
			// one player eliminated
			assert.equal(1, eliminatedPlayersInARound2);

			//#3
			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: second });
			await royale.takeAPosition(1, { from: third });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let totalPlayersInARound4 = await royale.totalPlayersPerRoundPerSeason(season_1, 4);
			// equal to two
			assert.equal(2, totalPlayersInARound4);

			let eliminatedPlayersInARound3 = await royale.eliminatedPerRoundPerSeason(season_1, 3);
			// one player eliminated
			assert.equal(1, eliminatedPlayersInARound3);

			//#4
			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: second });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let totalPlayersInARound5 = await royale.totalPlayersPerRoundPerSeason(season_1, 5);
			// equal to two
			assert.equal(2, totalPlayersInARound5);

			let eliminatedPlayersInARound4 = await royale.eliminatedPerRoundPerSeason(season_1, 4);
			// zero - all players are good
			assert.equal(0, eliminatedPlayersInARound4);

			//#5
			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: second });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let totalPlayersInARound6 = await royale.totalPlayersPerRoundPerSeason(season_1, 6);
			// equal to two
			assert.equal(2, totalPlayersInARound6);

			let eliminatedPlayersInARound5 = await royale.eliminatedPerRoundPerSeason(season_1, 5);
			// zero - all players are good
			assert.equal(0, eliminatedPlayersInARound5);

			//#6
			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: second });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let totalPlayersInARound7 = await royale.totalPlayersPerRoundPerSeason(season_1, 7);
			// equal to two
			assert.equal(2, totalPlayersInARound7);

			let eliminatedPlayersInARound6 = await royale.eliminatedPerRoundPerSeason(season_1, 6);
			// zero - all players are good
			assert.equal(0, eliminatedPlayersInARound6);

			//#7
			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(1, { from: second });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let eliminatedPlayersInARound7 = await royale.eliminatedPerRoundPerSeason(season_1, 7);
			// one player eliminated
			assert.equal(1, eliminatedPlayersInARound7);

			let isPlayerFirstAlive = await royale.isPlayerAlive(first);
			let isPlayerSecondAlive = await royale.isPlayerAlive(second);
			let isPlayerThirdAlive = await royale.isPlayerAlive(third);
			let isPlayerFourthAlive = await royale.isPlayerAlive(fourth);

			assert.equal(true, isPlayerFirstAlive);
			assert.equal(false, isPlayerSecondAlive);
			assert.equal(false, isPlayerThirdAlive);
			assert.equal(false, isPlayerFourthAlive);

			// check to be zero (don't exist)
			let totalPlayersInARound8 = await royale.totalPlayersPerRoundPerSeason(season_1, 8);
			let eliminatedPlayersInARound8 = await royale.eliminatedPerRoundPerSeason(season_1, 8);
			assert.equal(0, totalPlayersInARound8);
			assert.equal(0, eliminatedPlayersInARound8);

			await expect(royale.closeRound()).to.be.revertedWith('Competition finished');
		});


		it('check the changing positions require to send different one', async () => {
			await royale.startNewSeason({ from: owner });

			await royale.signUp({ from: first });
			await royale.signUp({ from: second });

			await fastForward(HOUR * 72 + 1);
			await royale.startRoyaleInASeason();

			let totalPlayersInARound = await royale.totalPlayersPerRoundPerSeason(season_1, 1);
			assert.equal(2, totalPlayersInARound);

			await royale.takeAPosition(2, { from: first });

			await expect(royale.takeAPosition(2, { from: first })).to.be.revertedWith(
				'Same position'
			);


		});

		it('check if can start royale', async () => {
			await royale.startNewSeason({ from: owner });

			await royale.signUp({ from: first });
			await royale.signUp({ from: second });

			let canStartFalse = await royale.canStartRoyale();
			assert.equal(false, canStartFalse);

			await fastForward(HOUR * 72 + 1);

			let canStartTrue = await royale.canStartRoyale();
			assert.equal(true, canStartTrue);

			await royale.startRoyaleInASeason();

			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: second });

			let canStartFalseAlreadyStarted = await royale.canStartRoyale();
			assert.equal(false, canStartFalseAlreadyStarted);

			await MockPriceFeedDeployed.setPricetoReturn(1100);

			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let canStartFalseAfterClose = await royale.canStartRoyale();
			assert.equal(false, canStartFalseAfterClose);

			let hasParticipatedInCurrentOrLastRoyale = await royale.hasParticipatedInCurrentOrLastRoyale(first);
			assert.equal(hasParticipatedInCurrentOrLastRoyale, true);

			hasParticipatedInCurrentOrLastRoyale = await royale.hasParticipatedInCurrentOrLastRoyale(fourth);
			assert.equal(hasParticipatedInCurrentOrLastRoyale, false);

		});

		it('check the changing positions', async () => {
			await royale.startNewSeason({ from: owner });
			await royale.signUp({ from: first });
			await royale.signUp({ from: second });
			await royale.signUp({ from: third });
			await royale.signUp({ from: fourth });

			await fastForward(HOUR * 72 + 1);
			await royale.startRoyaleInASeason();

			let totalPlayersInARound = await royale.totalPlayersPerRoundPerSeason(season_1, 1);
			// equal to total number of players
			assert.equal(4, totalPlayersInARound);

			let eliminatedPlayersInARound = await royale.eliminatedPerRoundPerSeason(season_1, 1);
			// zero round need to be finished
			assert.equal(0, eliminatedPlayersInARound);

			let postions1InRound1_before = await royale.positionsPerRoundPerSeason(season_1, 1, 1);
			let postions2InRound1_before = await royale.positionsPerRoundPerSeason(season_1, 1, 2);
			assert.equal(0, postions1InRound1_before);
			assert.equal(0, postions2InRound1_before);

			await royale.takeAPosition(2, { from: first });
			await royale.takeAPosition(2, { from: second });
			await royale.takeAPosition(1, { from: first });
			// 3
			await royale.takeAPosition(2, { from: third });
			await royale.takeAPosition(1, { from: fourth });
			await royale.takeAPosition(2, { from: first });
			// 1
			await royale.takeAPosition(1, { from: first });
			await royale.takeAPosition(2, { from: fourth });
			await royale.takeAPosition(1, { from: second });
			// 2
			await royale.takeAPosition(2, { from: second });
			// 4
			await royale.takeAPosition(1, { from: fourth });

			await MockPriceFeedDeployed.setPricetoReturn(1100);

			let postions1InRound1_after = await royale.positionsPerRoundPerSeason(season_1, 1, 1);
			let postions2InRound1_after = await royale.positionsPerRoundPerSeason(season_1, 1, 2);
			assert.equal(2, postions1InRound1_after);
			assert.equal(2, postions2InRound1_after);

			//#1
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let totalPlayersInARound2 = await royale.totalPlayersPerRoundPerSeason(season_1, 2);
			// equal to total number of players
			assert.equal(2, totalPlayersInARound2);

			let eliminatedPlayersInARound1 = await royale.eliminatedPerRoundPerSeason(season_1, 1);
			// zero - all players are good
			assert.equal(2, eliminatedPlayersInARound1);

			let postions1InRound1_after_close = await royale.positionsPerRoundPerSeason(season_1, 1, 1);
			let postions2InRound1_after_close = await royale.positionsPerRoundPerSeason(season_1, 1, 2);
			assert.equal(2, postions1InRound1_after_close);
			assert.equal(2, postions2InRound1_after_close);

			let isPlayerFirstAlive = await royale.isPlayerAlive(first);
			let isPlayerSecondAlive = await royale.isPlayerAlive(second);
			let isPlayerThirdAlive = await royale.isPlayerAlive(third);
			let isPlayerFourthAlive = await royale.isPlayerAlive(fourth);

			assert.equal(false, isPlayerFirstAlive);
			assert.equal(true, isPlayerSecondAlive);
			assert.equal(true, isPlayerThirdAlive);
			assert.equal(false, isPlayerFourthAlive);

			//#2
			//before checking
			let postions1InRound2_before_start = await royale.positionsPerRoundPerSeason(season_1, 2, 1);
			let postions2InRound2_before_start = await royale.positionsPerRoundPerSeason(season_1, 2, 2);
			assert.equal(0, postions1InRound2_before_start);
			assert.equal(0, postions2InRound2_before_start);

			await royale.takeAPosition(2, { from: second });
			await royale.takeAPosition(2, { from: third });
			await royale.takeAPosition(1, { from: second });
			await royale.takeAPosition(2, { from: second });
			await royale.takeAPosition(1, { from: third });
			await royale.takeAPosition(1, { from: second });
			await royale.takeAPosition(2, { from: second });
			await royale.takeAPosition(2, { from: third });

			let postions1InRound2_after = await royale.positionsPerRoundPerSeason(season_1, 2, 1);
			let postions2InRound2_after = await royale.positionsPerRoundPerSeason(season_1, 2, 2);
			assert.equal(0, postions1InRound2_after);
			assert.equal(2, postions2InRound2_after);

			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let postions1InRound2_after_close = await royale.positionsPerRoundPerSeason(season_1, 2, 1);
			let postions2InRound2_after_close = await royale.positionsPerRoundPerSeason(season_1, 2, 2);
			assert.equal(0, postions1InRound2_after_close);
			assert.equal(2, postions2InRound2_after_close);

			let isPlayerFirstAliveRound2 = await royale.isPlayerAlive(first);
			let isPlayerSecondAliveRound2 = await royale.isPlayerAlive(second);
			let isPlayerThirdAliveRound2 = await royale.isPlayerAlive(third);
			let isPlayerFourthAliveRound2 = await royale.isPlayerAlive(fourth);

			assert.equal(false, isPlayerFirstAliveRound2);
			assert.equal(true, isPlayerSecondAliveRound2);
			assert.equal(true, isPlayerThirdAliveRound2);
			assert.equal(false, isPlayerFourthAliveRound2);

			//#3
			//before checking
			let postions1InRound3_before_start = await royale.positionsPerRoundPerSeason(season_1, 3, 1);
			let postions2InRound3_before_start = await royale.positionsPerRoundPerSeason(season_1, 3, 2);
			assert.equal(0, postions1InRound3_before_start);
			assert.equal(0, postions2InRound3_before_start);

			await royale.takeAPosition(2, { from: second });
			await royale.takeAPosition(2, { from: third });
			await royale.takeAPosition(1, { from: second });
			await royale.takeAPosition(2, { from: second });
			await royale.takeAPosition(1, { from: third });
			await royale.takeAPosition(1, { from: second });

			let postions1InRound3_after = await royale.positionsPerRoundPerSeason(season_1, 3, 1);
			let postions2InRound3_after = await royale.positionsPerRoundPerSeason(season_1, 3, 2);
			assert.equal(2, postions1InRound3_after);
			assert.equal(0, postions2InRound3_after);

			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let postions1InRound3_after_close = await royale.positionsPerRoundPerSeason(season_1, 3, 1);
			let postions2InRound3_after_close = await royale.positionsPerRoundPerSeason(season_1, 3, 2);
			assert.equal(2, postions1InRound3_after_close);
			assert.equal(0, postions2InRound3_after_close);

			let isPlayerFirstAliveRound3 = await royale.isPlayerAlive(first);
			let isPlayerSecondAliveRound3 = await royale.isPlayerAlive(second);
			let isPlayerThirdAliveRound3 = await royale.isPlayerAlive(third);
			let isPlayerFourthAliveRound3 = await royale.isPlayerAlive(fourth);

			assert.equal(false, isPlayerFirstAliveRound3);
			assert.equal(true, isPlayerSecondAliveRound3);
			assert.equal(true, isPlayerThirdAliveRound3);
			assert.equal(false, isPlayerFourthAliveRound3);

			await expect(royale.takeAPosition(2, { from: first })).to.be.revertedWith(
				'Competition finished'
			);

			let canStartFalseAfterFinish = await royale.canStartRoyale();
			assert.equal(false, canStartFalseAfterFinish);

			let rewardPerPlayer = await royale.rewardPerWinnerPerSeason(season_1);
			// 10.000 -> two winners 5.000
			assert.bnEqual(rewardPerPlayer, toUnit(5000));

			// check if player which not win can collect 
			await expect(royale.claimRewardForSeason(season_1, { from: first })).to.be.revertedWith(
				'Player is not alive'
			);

			// check if player which not win can collect 
			await expect(royale.claimRewardForSeason(season_1, { from: fourth })).to.be.revertedWith(
				'Player is not alive'
			);

			let isPlayerOneClaimedReward_before = await royale.rewardCollectedPerSeason(season_1, third);
			assert.equal(false, isPlayerOneClaimedReward_before);

			const tx = await royale.claimRewardForSeason(season_1, { from: third });

			// check if event is emited
			assert.eventEqual(tx.logs[0], 'RewardClaimed', {
				season: season_1,
				winner: third,
				reward: toUnit(5000),
			});

			let isPlayerOneClaimedReward_after = await royale.rewardCollectedPerSeason(season_1, third);
			assert.equal(true, isPlayerOneClaimedReward_after);

			const tx1 = await royale.claimRewardForSeason(season_1, { from: second });

			// check if event is emited
			assert.eventEqual(tx1.logs[0], 'RewardClaimed', {
				season: season_1,
				winner: second,
				reward: toUnit(5000),
			});
		});
	});

	it('Win and collect reward', async () => {
		await royale.startNewSeason({ from: owner });

		// check rewards
		let reward = await royale.rewardPerSeason(season_1);
		assert.bnEqual(reward, toUnit(0));

		await royale.signUp({ from: first });
		await royale.signUp({ from: second });
		await royale.signUp({ from: third });
		await royale.signUp({ from: fourth });

		await fastForward(HOUR * 72 + 1);
		await royale.startRoyaleInASeason();

		await royale.takeAPosition(2, { from: first });
		await royale.takeAPosition(2, { from: second });
		await royale.takeAPosition(2, { from: third });
		await royale.takeAPosition(2, { from: fourth });

		await MockPriceFeedDeployed.setPricetoReturn(1100);

		//#1
		await fastForward(HOUR * 72 + 1);
		await royale.closeRound();

		//#2
		await royale.takeAPosition(2, { from: first });
		await royale.takeAPosition(2, { from: second });
		await royale.takeAPosition(2, { from: third });
		await royale.takeAPosition(2, { from: fourth });
		await fastForward(HOUR * 72 + 1);
		await royale.closeRound();

		//#3
		await royale.takeAPosition(2, { from: first });
		await royale.takeAPosition(2, { from: second });
		await royale.takeAPosition(2, { from: third });
		await royale.takeAPosition(2, { from: fourth });
		await fastForward(HOUR * 72 + 1);
		await royale.closeRound();

		//#4
		await royale.takeAPosition(2, { from: first });
		await royale.takeAPosition(2, { from: second });
		await royale.takeAPosition(2, { from: third });
		await royale.takeAPosition(2, { from: fourth });
		await fastForward(HOUR * 72 + 1);
		await royale.closeRound();

		//#5
		await royale.takeAPosition(2, { from: first });
		await royale.takeAPosition(2, { from: second });
		await royale.takeAPosition(2, { from: third });
		await royale.takeAPosition(2, { from: fourth });
		await fastForward(HOUR * 72 + 1);
		await royale.closeRound();

		await expect(royale.startNewSeason({ from: owner })).to.be.revertedWith('Previous season must be finished');

		//#6
		await royale.takeAPosition(2, { from: first });
		await royale.takeAPosition(2, { from: second });
		await royale.takeAPosition(2, { from: third });
		await royale.takeAPosition(1, { from: fourth });
		await fastForward(HOUR * 72 + 1);
		await royale.closeRound();

		// check if can collect rewards before royale ends
		await expect(royale.claimRewardForSeason(season_1, { from: first })).to.be.revertedWith(
			'Royale must be finished!'
		);

		//#7
		await royale.takeAPosition(2, { from: first });
		await royale.takeAPosition(2, { from: second });
		await royale.takeAPosition(1, { from: third });
		await fastForward(HOUR * 72 + 1);
		await royale.closeRound();

		let isPlayerFirstAlive = await royale.isPlayerAlive(first);
		let isPlayerSecondAlive = await royale.isPlayerAlive(second);
		let isPlayerThirdAlive = await royale.isPlayerAlive(third);
		let isPlayerFourthAlive = await royale.isPlayerAlive(fourth);

		assert.equal(true, isPlayerFirstAlive);
		assert.equal(true, isPlayerSecondAlive);
		assert.equal(false, isPlayerThirdAlive);
		assert.equal(false, isPlayerFourthAlive);

		let rewardPerPlayer = await royale.rewardPerWinnerPerSeason(season_1);
		// 10.000 -> two winners 5.000
		assert.bnEqual(rewardPerPlayer, toUnit(5000));

		await expect(royale.closeRound()).to.be.revertedWith('Competition finished');

		// check if player which not win can collect 
		await expect(royale.claimRewardForSeason(season_1, { from: third })).to.be.revertedWith(
			'Player is not alive'
		);

		let isPlayerOneClaimedReward_before = await royale.rewardCollectedPerSeason(season_1, first);
		assert.equal(false, isPlayerOneClaimedReward_before);

		const tx = await royale.claimRewardForSeason(season_1, { from: first });

		// check if event is emited
		assert.eventEqual(tx.logs[0], 'RewardClaimed', {
			season: season_1,
			winner: first,
			reward: toUnit(5000),
		});

		let isPlayerOneClaimedReward_after = await royale.rewardCollectedPerSeason(season_1, first);
		assert.equal(isPlayerOneClaimedReward_after, true);

		// check if player can collect two times
		await expect(royale.claimRewardForSeason(season_1, { from: first })).to.be.revertedWith(
			'Player already collected reward'
		);

	});

	it('Win and collect rewards and start new season', async () => {
		await royale.startNewSeason({ from: owner });

		// check rewards
		let reward = await royale.rewardPerSeason(season_1);
		assert.bnEqual(reward, toUnit(0));

		await royale.signUp({ from: first });
		await royale.signUp({ from: second });
		await royale.signUp({ from: third });
		await royale.signUp({ from: fourth });

		await fastForward(HOUR * 72 + 1);
		const trx = await royale.startRoyaleInASeason();

		// check if event is emited
		assert.eventEqual(trx.logs[0], 'RoyaleStarted', {
			season: season_1,
			totalPlayers: 4,
			totalReward: toUnit(10000),
		});

		await royale.takeAPosition(2, { from: first });
		await royale.takeAPosition(2, { from: second });
		await royale.takeAPosition(2, { from: third });
		await royale.takeAPosition(2, { from: fourth });

		await MockPriceFeedDeployed.setPricetoReturn(1100);

		//#1
		await fastForward(HOUR * 72 + 1);
		await royale.closeRound();

		//#2
		await royale.takeAPosition(2, { from: first });
		await royale.takeAPosition(2, { from: second });
		await royale.takeAPosition(2, { from: third });
		await royale.takeAPosition(2, { from: fourth });
		await fastForward(HOUR * 72 + 1);
		await royale.closeRound();

		//#3
		await royale.takeAPosition(2, { from: first });
		await royale.takeAPosition(2, { from: second });
		await royale.takeAPosition(2, { from: third });
		await royale.takeAPosition(2, { from: fourth });
		await fastForward(HOUR * 72 + 1);
		await royale.closeRound();

		//#4
		await royale.takeAPosition(2, { from: first });
		await royale.takeAPosition(2, { from: second });
		await royale.takeAPosition(2, { from: third });
		await royale.takeAPosition(2, { from: fourth });
		await fastForward(HOUR * 72 + 1);
		await royale.closeRound();

		//#5
		await royale.takeAPosition(2, { from: first });
		await royale.takeAPosition(2, { from: second });
		await royale.takeAPosition(2, { from: third });
		await royale.takeAPosition(2, { from: fourth });
		await fastForward(HOUR * 72 + 1);
		await royale.closeRound();

		await expect(royale.startNewSeason({ from: owner })).to.be.revertedWith('Previous season must be finished');

		//#6
		await royale.takeAPosition(2, { from: first });
		await royale.takeAPosition(2, { from: second });
		await royale.takeAPosition(2, { from: third });
		await royale.takeAPosition(1, { from: fourth });
		await fastForward(HOUR * 72 + 1);
		await royale.closeRound();

		// check if can collect rewards before royale ends
		await expect(royale.claimRewardForSeason(season_1, { from: first })).to.be.revertedWith(
			'Royale must be finished!'
		);

		//#7
		await royale.takeAPosition(2, { from: first });
		await royale.takeAPosition(2, { from: second });
		await royale.takeAPosition(1, { from: third });
		await fastForward(HOUR * 72 + 1);
		const trx_2 = await royale.closeRound();

		// check if event is emited
		assert.eventEqual(trx_2.logs[0], 'RoundClosed', {
			season: season_1,
			round: 7,
			result: 2,
		});
		assert.eventEqual(trx_2.logs[1], 'RoyaleFinished', {
			season: season_1,
			numberOfWinners: 2,
			rewardPerWinner: toUnit(5000),
		});

		let isPlayerFirstAlive = await royale.isPlayerAlive(first);
		let isPlayerSecondAlive = await royale.isPlayerAlive(second);
		let isPlayerThirdAlive = await royale.isPlayerAlive(third);
		let isPlayerFourthAlive = await royale.isPlayerAlive(fourth);

		assert.equal(true, isPlayerFirstAlive);
		assert.equal(true, isPlayerSecondAlive);
		assert.equal(false, isPlayerThirdAlive);
		assert.equal(false, isPlayerFourthAlive);

		let rewardPerPlayer = await royale.rewardPerWinnerPerSeason(season_1);
		// 10.000 -> two winners 5.000
		assert.bnEqual(rewardPerPlayer, toUnit(5000));

		await expect(royale.closeRound()).to.be.revertedWith('Competition finished');

		// check if player which not win can collect 
		await expect(royale.claimRewardForSeason(season_1, { from: third })).to.be.revertedWith(
			'Player is not alive'
		);

		let isPlayerOneClaimedReward_before = await royale.rewardCollectedPerSeason(season_1, first);
		assert.equal(false, isPlayerOneClaimedReward_before);

		const tx = await royale.claimRewardForSeason(season_1, { from: first });

		// check if event is emited
		assert.eventEqual(tx.logs[0], 'RewardClaimed', {
			season: season_1,
			winner: first,
			reward: toUnit(5000),
		});

		let isPlayerOneClaimedReward_after = await royale.rewardCollectedPerSeason(season_1, first);
		assert.equal(isPlayerOneClaimedReward_after, true);

		// check if player can collect two times
		await expect(royale.claimRewardForSeason(season_1, { from: first })).to.be.revertedWith(
			'Player already collected reward'
		);

		// check if different then owner can start season
		await expect(royale.startNewSeason({ from: first })).to.be.revertedWith(
			'Only owner can start season before pause between two seasons'
		);

		// check if player can collect ex season
		await expect(royale.claimRewardForSeason(season_1, { from: first })).to.be.revertedWith(
			'Player already collected reward'
		);

		let canStartNewSeason = await royale.canStartNewSeason();
		assert.equal(canStartNewSeason, false);

		await fastForward(WEEK * 1 + 1);

		canStartNewSeason = await royale.canStartNewSeason();
		assert.equal(canStartNewSeason, false);

		await royale.setNextSeasonStartsAutomatically(true, { from: owner });

		canStartNewSeason = await royale.canStartNewSeason();
		assert.equal(canStartNewSeason, true);

		await expect(royale.putFunds(toUnit(100), season_1, { from: owner })).to.be.revertedWith(
			'Season is finished'
		);

		const tx1 = await royale.startNewSeason({ from: owner });

		await expect(royale.putFunds(toUnit(100), season_1, { from: owner })).to.be.revertedWith(
			'Cant put funds in a past'
		);

		// check if new season is started event called
		assert.eventEqual(tx1.logs[0], 'NewSeasonStarted', {
			season: season_2
		});

		// season updated
		let s2 = await royale.season();
		assert.bnEqual(season_2, s2);

		let hasParticipatedInCurrentOrLastRoyale = await royale.hasParticipatedInCurrentOrLastRoyale(first);
		assert.equal(hasParticipatedInCurrentOrLastRoyale, true);

		// NEW SEASON!!!

		// aprove new amount in pool (add aditional 5000, bacause in a pool is already 5000)
		await ThalesDeployed.transfer(royale.address, toUnit(10000), { from: owner });
		await ThalesDeployed.approve(royale.address, toUnit(10000), { from: owner });
		await ThalesDeployed.transfer(first, toUnit(2500), { from: owner });
		await ThalesDeployed.approve(royale.address, toUnit(2500), { from: first });
		await ThalesDeployed.transfer(second, toUnit(2500), { from: owner });
		await ThalesDeployed.approve(royale.address, toUnit(2500), { from: second });
		await ThalesDeployed.transfer(third, toUnit(2500), { from: owner });
		await ThalesDeployed.approve(royale.address, toUnit(2500), { from: third });
		await ThalesDeployed.transfer(fourth, toUnit(2500), { from: owner });
		await ThalesDeployed.approve(royale.address, toUnit(2500), { from: fourth });

		// check rewards
		let reward_s2 = await royale.rewardPerSeason(season_2);
		assert.bnEqual(reward_s2, toUnit(0));

		await expect(royale.putFunds(toUnit(0), season_2, { from: owner })).to.be.revertedWith(
			'Amount must be more then zero'
		);

		await royale.putFunds(toUnit(10000), season_2, { from: owner });

		await royale.signUp({ from: first });
		await royale.signUp({ from: second });
		await royale.signUp({ from: third });
		await royale.signUp({ from: fourth });

		let reward_s2_aftersignup = await royale.rewardPerSeason(season_2);
		assert.bnEqual(reward_s2_aftersignup, toUnit(20000));

		await fastForward(HOUR * 72 + 1);
		await royale.startRoyaleInASeason();

		await royale.takeAPosition(2, { from: first });
		await royale.takeAPosition(2, { from: second });
		await royale.takeAPosition(2, { from: third });
		await royale.takeAPosition(2, { from: fourth });

		await MockPriceFeedDeployed.setPricetoReturn(1100);

		//#1
		await fastForward(HOUR * 72 + 1);
		await royale.closeRound();

		//#2
		await royale.takeAPosition(2, { from: first });
		await royale.takeAPosition(2, { from: second });
		await royale.takeAPosition(2, { from: third });
		await royale.takeAPosition(2, { from: fourth });
		await fastForward(HOUR * 72 + 1);
		await royale.closeRound();

		//#3
		await royale.takeAPosition(2, { from: first });
		await royale.takeAPosition(2, { from: second });
		await royale.takeAPosition(2, { from: third });
		await royale.takeAPosition(2, { from: fourth });
		await fastForward(HOUR * 72 + 1);
		await royale.closeRound();

		//#4
		await royale.takeAPosition(2, { from: first });
		await royale.takeAPosition(2, { from: second });
		await royale.takeAPosition(2, { from: third });
		await royale.takeAPosition(2, { from: fourth });
		await fastForward(HOUR * 72 + 1);
		await royale.closeRound();

		//#5
		await royale.takeAPosition(2, { from: first });
		await royale.takeAPosition(2, { from: second });
		await royale.takeAPosition(2, { from: third });
		await royale.takeAPosition(2, { from: fourth });
		await fastForward(HOUR * 72 + 1);
		await royale.closeRound();

		await expect(royale.startNewSeason({ from: owner })).to.be.revertedWith('Previous season must be finished');

		//#6
		await royale.takeAPosition(2, { from: first });
		await royale.takeAPosition(2, { from: second });
		await royale.takeAPosition(2, { from: third });
		await royale.takeAPosition(1, { from: fourth });
		await fastForward(HOUR * 72 + 1);
		await royale.closeRound();

		// check if can collect rewards before royale ends
		await expect(royale.claimRewardForSeason(season_2, { from: first })).to.be.revertedWith(
			'Royale must be finished!'
		);

		//#7
		await royale.takeAPosition(2, { from: first });
		await royale.takeAPosition(1, { from: second });
		await royale.takeAPosition(1, { from: third });
		await fastForward(HOUR * 72 + 1);
		await royale.closeRound();

		let isPlayerFirstAlive_s2 = await royale.isPlayerAlive(first);
		let isPlayerSecondAlives_2 = await royale.isPlayerAlive(second);
		let isPlayerThirdAlive_s2 = await royale.isPlayerAlive(third);
		let isPlayerFourthAlive_s2 = await royale.isPlayerAlive(fourth);

		assert.equal(true, isPlayerFirstAlive_s2);
		assert.equal(false, isPlayerSecondAlives_2);
		assert.equal(false, isPlayerThirdAlive_s2);
		assert.equal(false, isPlayerFourthAlive_s2);

		let rewardPerPlayer_s2 = await royale.rewardPerWinnerPerSeason(season_2);
		assert.bnEqual(rewardPerPlayer_s2, toUnit(20000));

		await expect(royale.closeRound()).to.be.revertedWith('Competition finished');

		// check if player which not win can collect 
		await expect(royale.claimRewardForSeason(season_2, { from: third })).to.be.revertedWith(
			'Player is not alive'
		);

		let isPlayerOneClaimedReward_before_s2 = await royale.rewardCollectedPerSeason(season_2, first);
		assert.equal(false, isPlayerOneClaimedReward_before_s2);

		const tx_s2 = await royale.claimRewardForSeason(season_2, { from: first });

		// check if event is emited
		assert.eventEqual(tx_s2.logs[0], 'RewardClaimed', {
			season: season_2,
			winner: first,
			reward: toUnit(20000),
		});

		let isPlayerOneClaimedReward_after_s2 = await royale.rewardCollectedPerSeason(season_2, first);
		assert.equal(isPlayerOneClaimedReward_after_s2, true);

		// check if player can collect two times
		await expect(royale.claimRewardForSeason(season_2, { from: first })).to.be.revertedWith(
			'Player already collected reward'
		);

		// check if player can collect two times
		await expect(royale.claimRewardForSeason(season_2, { from: first })).to.be.revertedWith(
			'Player already collected reward'
		);

		// check if player can collect two times
		await expect(royale.claimRewardForSeason(season_2, { from: second })).to.be.revertedWith(
			'Player is not alive'
		);

	});

	it('Two players take loosing positions no one left but they can collect and they are winners', async () => {
		await royale.startNewSeason({ from: owner });

		// check rewards
		let reward = await royale.rewardPerSeason(season_1);
		assert.bnEqual(reward, toUnit(0));

		await royale.signUp({ from: first });
		await royale.signUp({ from: second });
		await royale.signUp({ from: third });
		await royale.signUp({ from: fourth });

		await fastForward(HOUR * 72 + 1);
		await royale.startRoyaleInASeason();

		await royale.takeAPosition(2, { from: first });
		await royale.takeAPosition(2, { from: second });
		await royale.takeAPosition(2, { from: third });
		await royale.takeAPosition(2, { from: fourth });

		await MockPriceFeedDeployed.setPricetoReturn(1100);

		//#1
		await fastForward(HOUR * 72 + 1);
		await royale.closeRound();

		//#2
		await royale.takeAPosition(2, { from: first });
		await royale.takeAPosition(2, { from: second });
		await royale.takeAPosition(2, { from: third });
		await royale.takeAPosition(2, { from: fourth });
		await fastForward(HOUR * 72 + 1);
		await royale.closeRound();

		//#3
		await royale.takeAPosition(2, { from: first });
		await royale.takeAPosition(2, { from: second });
		await royale.takeAPosition(2, { from: third });
		await royale.takeAPosition(2, { from: fourth });
		await fastForward(HOUR * 72 + 1);
		await royale.closeRound();

		//#4
		await royale.takeAPosition(2, { from: first });
		await royale.takeAPosition(2, { from: second });
		await royale.takeAPosition(2, { from: third });
		await royale.takeAPosition(2, { from: fourth });
		await fastForward(HOUR * 72 + 1);
		await royale.closeRound();

		//#5
		await royale.takeAPosition(2, { from: first });
		await royale.takeAPosition(2, { from: second });
		await royale.takeAPosition(2, { from: third });
		await royale.takeAPosition(2, { from: fourth });
		await fastForward(HOUR * 72 + 1);
		await royale.closeRound();

		await expect(royale.startNewSeason({ from: owner })).to.be.revertedWith('Previous season must be finished');

		//#6
		await royale.takeAPosition(2, { from: first });
		await royale.takeAPosition(2, { from: second });
		await royale.takeAPosition(1, { from: third });
		await royale.takeAPosition(1, { from: fourth });
		await fastForward(HOUR * 72 + 1);
		await royale.closeRound();

		// check if can collect rewards before royale ends
		await expect(royale.claimRewardForSeason(season_1, { from: first })).to.be.revertedWith(
			'Royale must be finished!'
		);

		//#7
		await royale.takeAPosition(1, { from: first });
		await royale.takeAPosition(1, { from: second });
		await fastForward(HOUR * 72 + 1);
		await royale.closeRound();

		let isPlayerFirstAlive = await royale.isPlayerAlive(first);
		let isPlayerSecondAlive = await royale.isPlayerAlive(second);
		let isPlayerThirdAlive = await royale.isPlayerAlive(third);
		let isPlayerFourthAlive = await royale.isPlayerAlive(fourth);

		assert.equal(true, isPlayerFirstAlive);
		assert.equal(true, isPlayerSecondAlive);
		assert.equal(false, isPlayerThirdAlive);
		assert.equal(false, isPlayerFourthAlive);

		let rewardPerPlayer = await royale.rewardPerWinnerPerSeason(season_1);
		// 10.000 -> two winners 5.000
		assert.bnEqual(rewardPerPlayer, toUnit(5000));

		await expect(royale.closeRound()).to.be.revertedWith('Competition finished');

		// check if player which not win can collect 
		await expect(royale.claimRewardForSeason(season_1, { from: third })).to.be.revertedWith(
			'Player is not alive'
		);

		let isPlayerOneClaimedReward_before = await royale.rewardCollectedPerSeason(season_1, first);
		assert.equal(false, isPlayerOneClaimedReward_before);

		assert.bnEqual(await royale.unclaimedRewardPerSeason(season_1), toUnit(10000));

		const tx = await royale.claimRewardForSeason(season_1, { from: first });

		// check if event is emited
		assert.eventEqual(tx.logs[0], 'RewardClaimed', {
			season: season_1,
			winner: first,
			reward: toUnit(5000),
		});

		let isPlayerOneClaimedReward_after = await royale.rewardCollectedPerSeason(season_1, first);
		assert.equal(isPlayerOneClaimedReward_after, true);

		// check if player can collect two times
		await expect(royale.claimRewardForSeason(season_1, { from: first })).to.be.revertedWith(
			'Player already collected reward'
		);

		// check if different then owner can start season
		await expect(royale.startNewSeason({ from: first })).to.be.revertedWith(
			'Only owner can start season before pause between two seasons'
		);

		// check if player can collect ex season
		await expect(royale.claimRewardForSeason(season_1, { from: first })).to.be.revertedWith(
			'Player already collected reward'
		);
		await fastForward(WEEK * 1 + 1);

		assert.bnEqual(await royale.unclaimedRewardPerSeason(season_1), toUnit(5000));

	});

	it('SafeBox impact check values', async () => {
		await royale.startNewSeason({ from: owner });

		// check rewards
		let reward = await royale.rewardPerSeason(season_1);
		assert.bnEqual(reward, toUnit(0));

		// check if only owner can change
		await expect(royale.setSafeBoxPercentage(20, { from: first })).to.be.revertedWith(
			'Only the contract owner may perform this action'
		);

		// check if can be higher then 100
		await expect(royale.setSafeBoxPercentage(101, { from: owner })).to.be.revertedWith(
			'Must be in between 0 and 100 %'
		);

		// check if only owner can change
		await expect(royale.setSafeBox(owner, { from: first })).to.be.revertedWith(
			'Only the contract owner may perform this action'
		);

		// setting impact to 20 %
		await royale.setSafeBoxPercentage(20, { from: owner });
		await royale.setSafeBox(owner, { from: owner });

		await royale.signUp({ from: first });
		await royale.signUp({ from: second });
		await royale.signUp({ from: third });
		await royale.signUp({ from: fourth });

		// check values for reward 10.000 - 20%
		reward = await royale.rewardPerSeason(season_1);
		assert.bnEqual(reward, toUnit(8000));

		await fastForward(HOUR * 72 + 1);
		await royale.startRoyaleInASeason();

		await royale.takeAPosition(2, { from: first });
		await royale.takeAPosition(1, { from: second });
		await royale.takeAPosition(1, { from: third });
		await royale.takeAPosition(1, { from: fourth });
		await fastForward(HOUR * 72 + 1);
		await royale.closeRound();

		let isPlayerFirstAlive = await royale.isPlayerAlive(first);
		let isPlayerSecondAlive = await royale.isPlayerAlive(second);
		let isPlayerThirdAlive = await royale.isPlayerAlive(third);
		let isPlayerFourthAlive = await royale.isPlayerAlive(fourth);

		assert.equal(true, isPlayerFirstAlive);
		assert.equal(false, isPlayerSecondAlive);
		assert.equal(false, isPlayerThirdAlive);
		assert.equal(false, isPlayerFourthAlive);

		let rewardPerPlayer = await royale.rewardPerWinnerPerSeason(season_1);
		assert.bnEqual(rewardPerPlayer, toUnit(8000));

		const tx = await royale.claimRewardForSeason(season_1, { from: first });

		// check if event is emited
		assert.eventEqual(tx.logs[0], 'RewardClaimed', {
			season: season_1,
			winner: first,
			reward: toUnit(8000),
		});

		let isPlayerOneClaimedReward_after = await royale.rewardCollectedPerSeason(season_1, first);
		assert.equal(isPlayerOneClaimedReward_after, true);

		// check if player can collect two times
		await expect(royale.claimRewardForSeason(season_1, { from: first })).to.be.revertedWith(
			'Player already collected reward'
		);

	});

	it('Sign up with positions check values', async () => {
		await royale.startNewSeason({ from: owner });

		// check rewards
		let reward = await royale.rewardPerSeason(season_1);
		assert.bnEqual(reward, toUnit(0));

		await expect(royale.signUpWithPosition(3, { from: first })).to.be.revertedWith(
			'Position can only be 1 or 2'
		);
		await expect(royale.signUpWithPosition(0, { from: first })).to.be.revertedWith(
			'Position can only be 1 or 2'
		);

		assert.equal(0, await royale.positionsPerRoundPerSeason(season_1, 1, 1));
		assert.equal(0, await royale.positionsPerRoundPerSeason(season_1, 1, 2));

		await royale.signUpWithPosition(1, { from: first });
		await royale.signUpWithPosition(2, { from: second });
		await royale.signUpWithPosition(1, { from: third });
		await royale.signUpWithPosition(2, { from: fourth });

		assert.equal(2, await royale.positionsPerRoundPerSeason(season_1, 1, 1));
		assert.equal(2, await royale.positionsPerRoundPerSeason(season_1, 1, 2));


		await fastForward(HOUR * 72 + 1);
		await royale.startRoyaleInASeason();

		await royale.takeAPosition(2, { from: first });
		await expect(royale.takeAPosition(2, { from: second })).to.be.revertedWith(
			'Same position'
		);
		await royale.takeAPosition(2, { from: third });
		await expect(royale.takeAPosition(2, { from: fourth })).to.be.revertedWith(
			'Same position'
		);

		assert.equal(0, await royale.positionsPerRoundPerSeason(season_1, 1, 1));
		assert.equal(4, await royale.positionsPerRoundPerSeason(season_1, 1, 2));

	});

	it('Sign up with vouchers check values', async () => {

		// adding vauchers to users
		const id_1 = 1;
		const id_2 = 2;

		await voucher.setThalesRoyaleAddress(royale.address, { from: owner })

		await voucher.mint(first, { from: first });

		assert.bnEqual(1, await voucher.balanceOf(first));
		assert.equal(first, await voucher.ownerOf(id_1));

		await ThalesDeployed.transfer(second, toUnit(2500), { from: owner });
		await ThalesDeployed.approve(voucher.address, toUnit(2500), { from: second });

		await voucher.mint(second, { from: second });

		assert.bnEqual(1, await voucher.balanceOf(second));
		assert.equal(second, await voucher.ownerOf(id_2));

		// play royale
		await royale.startNewSeason({ from: owner });

		// check rewards
		let reward = await royale.rewardPerSeason(season_1);
		assert.bnEqual(reward, toUnit(0));

		assert.bnEqual(0, await royale.signedUpPlayersCount(season_1));

		assert.equal(0, await royale.positionsPerRoundPerSeason(season_1, 1, 1));
		assert.equal(0, await royale.positionsPerRoundPerSeason(season_1, 1, 2));

		assert.bnEqual(0, await royale.signedUpPlayersCount(season_1));

		await expect(royale.signUpWithPass(1, { from: second })).to.be.revertedWith(
			'Owner of the token not valid'
		);
		await expect(royale.signUpWithPassWithPosition(2, 2, { from: first })).to.be.revertedWith(
			'Owner of the token not valid'
		);

		await royale.signUpWithPass(1, { from: first });
		await royale.signUpWithPassWithPosition(2, 2, { from: second });

		assert.bnEqual(2, await royale.signedUpPlayersCount(season_1));

		assert.equal(0, await royale.positionsPerRoundPerSeason(season_1, 1, 1));
		assert.equal(1, await royale.positionsPerRoundPerSeason(season_1, 1, 2));

		reward = await royale.rewardPerSeason(season_1);
		assert.bnEqual(reward, toUnit(5000));

	});

});