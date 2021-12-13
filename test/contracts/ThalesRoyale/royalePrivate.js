'use strict';

const { artifacts, contract, web3 } = require('hardhat');
const { toBN } = web3.utils;

const { assert, addSnapshotBeforeRestoreAfterEach } = require('../../utils/common');

const { toBytes32 } = require('../../../index');

var ethers2 = require('ethers');
var crypto = require('crypto');

const SECOND = 1;
const MINUTES = 60;
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

const GameType = {
	LAST_MAN_STANDING: toBN(0),
	LIMITED_NUMBER_OF_ROUNDS: toBN(1)
};

const RoomType = {
	OPEN: toBN(0), 
	CLOSED: toBN(1) 
};

contract('ThalesRoyalePrivateRoom', accounts => {
	
	const [first, owner, second, third, fourth] = accounts;
	let priceFeedAddress;
	let rewardTokenAddress;
	let ThalesRoyalePrivateRoom;
	let royale;
	let MockPriceFeedDeployed;
	let ThalesDeployed;
	let thales;

	const buyInZero = toUnit(0); 
	const buyIn100 = toUnit(100); 
	const buyIn200 = toUnit(200); 
	const thalesQty = toUnit(5000); 
	const empty = [];
	const allowedPlayers = [];
	allowedPlayers.push(second);
	allowedPlayers.push(third);
	const SNX = toBytes32('SNX');

	beforeEach(async () => {
		priceFeedAddress = owner;

		let Thales = artifacts.require('Thales');
		ThalesDeployed = await Thales.new({ from: owner });

		let MockPriceFeed = artifacts.require('MockPriceFeed');
		MockPriceFeedDeployed = await MockPriceFeed.new(owner);

		await MockPriceFeedDeployed.setPricetoReturn(1000);
		priceFeedAddress = MockPriceFeedDeployed.address;

		ThalesRoyalePrivateRoom = artifacts.require('ThalesRoyalePrivateRoom');
			royale = await ThalesRoyalePrivateRoom.new(
			owner,
			priceFeedAddress,
			ThalesDeployed.address
		);

		await ThalesDeployed.transfer(royale.address, thalesQty, { from: owner });
		await ThalesDeployed.approve(royale.address, thalesQty, { from: owner });
		await ThalesDeployed.transfer(first, thalesQty, { from: owner });
		await ThalesDeployed.approve(royale.address, buyIn200, { from: first });
		await ThalesDeployed.transfer(second, thalesQty, { from: owner });
		await ThalesDeployed.approve(royale.address, buyIn200, { from: second });
		await ThalesDeployed.transfer(third, thalesQty, { from: owner });
		await ThalesDeployed.approve(royale.address, buyIn200, { from: third });
		await ThalesDeployed.transfer(fourth, thalesQty, { from: owner });
		await ThalesDeployed.approve(royale.address, buyIn100, { from: fourth });
	});

	describe('ThalesRoyalePrivateRoom', () => {

		it('Sign up before creation of room', async () => {
			await expect(royale.signUpForRoom( 1, { from: first })).to.be.revertedWith('No private room stil created!');
		});

		it('Not allowed assets and check if asset is allowed', async () => {

			await expect(
				royale.createARoom( 
				toBytes32('GGG'), RoomType.OPEN, GameType.LAST_MAN_STANDING, empty, buyIn100, 10, 1 * HOUR, 7, 1 * HOUR, 2 * HOUR, 2 * DAY,
					{ from: first }
				)
			).to.be.revertedWith('Not allowed assets');

			assert.equal(await royale.stringToBytes32('BTC'), toBytes32('BTC'));
			assert.equal(await royale.stringToBytes32('SNX'), SNX);
			assert.equal(await royale.isAssetAllowed(toBytes32('BTC')), true);
			assert.equal(await royale.isAssetAllowed(toBytes32('GGG')), false);
		});

		it('Create room without buy in', async () => {
			await expect(
				royale.createARoom( 
				SNX, RoomType.OPEN, GameType.LAST_MAN_STANDING, empty, buyInZero, 10, 1 * HOUR, 7, 1 * HOUR, 2 * HOUR, 2 * DAY,
				{ from: first }
				)
			).to.be.revertedWith('Buy in must be greather then minimum');
		});

		it('Minimum sign in period 15min.', async () => {
			await expect(
				royale.createARoom( 
				SNX, RoomType.OPEN, GameType.LAST_MAN_STANDING, empty, buyIn100, 10, 10 * MINUTES, 7, 1 * HOUR, 2 * HOUR, 2 * DAY,
				{ from: first }
				)
			).to.be.revertedWith('Sign in period must be greather or equal then 15 min.');
		});

		it('Minimum rounds', async () => {
			await expect(
				royale.createARoom( 
				SNX, RoomType.OPEN, GameType.LAST_MAN_STANDING, empty, buyIn100, 10, 1 * HOUR, 0, 1 * HOUR, 2 * HOUR, 2 * DAY,
				{ from: first }
				)
			).to.be.revertedWith('Must be more then one round');
		});

		it('Minimum round choosing is 15min', async () => {
			await expect(
				royale.createARoom( 
				SNX, RoomType.OPEN, GameType.LAST_MAN_STANDING, empty, buyIn100, 10, 1 * HOUR, 10, 10 * MINUTES, 2 * HOUR, 2 * DAY,
				{ from: first }
				)
			).to.be.revertedWith('Round chosing period must be more then 15min.');
		});

		it('Minimum round length is 30 min.', async () => {
			await expect(
				royale.createARoom( 
				SNX, RoomType.OPEN, GameType.LAST_MAN_STANDING, empty, buyIn100, 10, 1 * HOUR, 10, 1 * HOUR, 29 * MINUTES, 2 * DAY,
				{ from: first }
				)
			).to.be.revertedWith('Round length must be more then 30 min.');
		});

		it('Round length must be greather then choosing period PLUS MINIMUM OFFSET', async () => {
			await expect(
				royale.createARoom( 
				SNX, RoomType.OPEN, GameType.LAST_MAN_STANDING, empty, buyIn100, 10, 1 * HOUR, 10, 29 * MINUTES, 35 * MINUTES, 2 * DAY,
				{ from: first }
				)
			).to.be.revertedWith('Round length must be greather with minimum offset of 15min.');
		});

		it('Create room CLOSED room without allowed players', async () => {
			await expect(
				royale.createARoom( 
					SNX, RoomType.CLOSED, GameType.LAST_MAN_STANDING, empty, buyIn100, 10, 1 * HOUR, 7, 1 * HOUR, 2 * HOUR, 2 * DAY,
					{ from: first }
				)
				).to.be.revertedWith('Room must be open and have total players in room or closed with allowed players');
		});

		it('Create room OPEN room with allowed players', async () => {
			await expect(
				royale.createARoom( 
					SNX, RoomType.OPEN, GameType.LAST_MAN_STANDING, empty, buyIn100, 0, 1 * HOUR, 7, 1 * HOUR, 2 * HOUR, 2 * DAY,
					{ from: first }
				)
				).to.be.revertedWith('Room must be open and have total players in room or closed with allowed players');
		});

		it('Create OPEN room and check values', async () => {

			const tx = await royale.createARoom(SNX, RoomType.OPEN, GameType.LAST_MAN_STANDING, empty, buyIn100, 10, 1 * HOUR, 7, 1 * HOUR, 2 * HOUR, 2 * DAY,{ from: first })

			let roomNumberCounter = await royale.roomNumberCounter();
			assert.equal(roomNumberCounter, 1);

			assert.equal(await royale.roomOwner(roomNumberCounter), first);

			assert.notEqual(await royale.roomCreationTime(roomNumberCounter), 0);

			assert.equal(await royale.roomSignUpPeriod(roomNumberCounter), 1 * HOUR);

			assert.equal(await royale.numberOfRoundsInRoom(roomNumberCounter), 7);

			assert.equal(await royale.roundChoosingLengthInRoom(roomNumberCounter), 1 * HOUR);

			assert.equal(await royale.roundLengthInRoom(roomNumberCounter), 2 * HOUR);

			assert.bnEqual(await royale.roomTypePerRoom(roomNumberCounter), RoomType.OPEN);

			assert.bnEqual(await royale.gameTypeInRoom(roomNumberCounter), GameType.LAST_MAN_STANDING);
			
			assert.equal(await royale.numberOfAlowedPlayersInRoom(roomNumberCounter), 10);

			assert.equal(await royale.playerCanPlayInRoom(roomNumberCounter, first), true);

			assert.bnEqual(await royale.buyInPerPlayerRerRoom(roomNumberCounter), buyIn100);

			// check if event is emited
			assert.eventEqual(tx.logs[0], 'RoomCreated', {
				_owner: first,
				_roomNumberCounter: roomNumberCounter,
				_roomType: RoomType.OPEN,
				_gameType: GameType.LAST_MAN_STANDING
			});

			assert.equal(await royale.numberOfPlayersInRoom(roomNumberCounter), 1);

			let playersInRoom = await royale.numberOfPlayersInRoom(roomNumberCounter);
			assert.equal(playersInRoom, 1);

			// check if event is emited
			assert.eventEqual(tx.logs[1], 'BuyIn', {
				_user: first,
				_amount: buyIn100,
				_roomNumber: roomNumberCounter
			});

			// check if event is emited
			assert.eventEqual(tx.logs[2], 'SignedUpInARoom', {
				_account: first,
				_roomNumber: roomNumberCounter
			});
		});

		it('Create CLOSED room and check values', async () => {
			const tx = await royale.createARoom(SNX, RoomType.CLOSED, GameType.LAST_MAN_STANDING, allowedPlayers, buyIn100, 10, 1 * HOUR, 7, 1 * HOUR, 2 * HOUR, 2 * DAY,{ from: first })

			let roomNumberCounter = await royale.roomNumberCounter();
			assert.equal(roomNumberCounter, 1);

			assert.equal(await royale.roomOwner(roomNumberCounter), first);

			assert.notEqual(await royale.roomCreationTime(roomNumberCounter), 0);

			assert.equal(await royale.roomSignUpPeriod(roomNumberCounter), 1 * HOUR);

			assert.equal(await royale.numberOfRoundsInRoom(roomNumberCounter), 7);

			assert.equal(await royale.roundChoosingLengthInRoom(roomNumberCounter), 1 * HOUR);

			assert.equal(await royale.roundLengthInRoom(roomNumberCounter), 2 * HOUR);

			assert.bnEqual(await royale.roomTypePerRoom(roomNumberCounter), RoomType.CLOSED);

			assert.bnEqual(await royale.gameTypeInRoom(roomNumberCounter), GameType.LAST_MAN_STANDING);
			
			// first(owner) second third
			assert.equal(await royale.numberOfAlowedPlayersInRoom(roomNumberCounter), 3);
			assert.equal(await royale.playerCanPlayInRoom(roomNumberCounter, first), true);
			assert.equal(await royale.playerCanPlayInRoom(roomNumberCounter, second), true);
			assert.equal(await royale.playerCanPlayInRoom(roomNumberCounter, third), true);
			assert.equal(await royale.playerCanPlayInRoom(roomNumberCounter, fourth), false);

			assert.equal(await royale.playerCanPlayInRoom(roomNumberCounter, first), true);

			assert.bnEqual(await royale.buyInPerPlayerRerRoom(roomNumberCounter), buyIn100);

			// check if event is emited
			assert.eventEqual(tx.logs[0], 'RoomCreated', {
				_owner: first,
				_roomNumberCounter: roomNumberCounter,
				_roomType: RoomType.CLOSED,
				_gameType: GameType.LAST_MAN_STANDING
			});

			assert.equal(await royale.numberOfPlayersInRoom(roomNumberCounter), 1);

			let playersInRoom = await royale.numberOfPlayersInRoom(roomNumberCounter);
			assert.equal(playersInRoom, 1);

			// check if event is emited
			assert.eventEqual(tx.logs[1], 'BuyIn', {
				_user: first,
				_amount: buyIn100,
				_roomNumber: roomNumberCounter
			});

			// check if event is emited
			assert.eventEqual(tx.logs[2], 'SignedUpInARoom', {
				_account: first,
				_roomNumber: roomNumberCounter
			});
		});

		it('Create OPEN room and check values and sign up period has expired', async () => {
			const tx = await royale.createARoom(SNX, RoomType.OPEN, GameType.LAST_MAN_STANDING, empty, buyIn100, 10, 1 * HOUR, 7, 1 * HOUR, 2 * HOUR, 2 * DAY,{ from: first });

			await royale.signUpForRoom( 1, { from: second });

			await fastForward(HOUR * 72 + 1);

			await expect(royale.signUpForRoom( 1, { from: third })).to.be.revertedWith('Sign up period has expired');

			});

			it('Create OPEN room and check values and double sign up', async () => {

			const tx = await royale.createARoom(SNX, RoomType.OPEN, GameType.LAST_MAN_STANDING, empty, buyIn100, 10, 1 * HOUR, 7, 1 * HOUR, 2 * HOUR, 2 * DAY,{ from: first });

			await royale.signUpForRoom( 1, { from: second });

			await expect(royale.signUpForRoom( 1, { from: second })).to.be.revertedWith('Player already signed up, for this room.');

			});

			it('Create OPEN room and check values and number of players in room reach limit', async () => {

			const tx = await royale.createARoom(SNX, RoomType.OPEN, GameType.LAST_MAN_STANDING, empty, buyIn100, 2, 1 * HOUR, 7, 1 * HOUR, 2 * HOUR, 2 * DAY,{ from: first });

			let roomNumberCounter = await royale.roomNumberCounter();

			await royale.signUpForRoom(roomNumberCounter, { from: second });

			await expect(royale.signUpForRoom( roomNumberCounter, { from: third })).to.be.revertedWith('Can not sign up for room, not allowed or it is full');

		});

		it('Create OPEN room, sign up with success and check values', async () => {

			await royale.createARoom(SNX, RoomType.OPEN, GameType.LAST_MAN_STANDING, empty, buyIn100, 2, 1 * HOUR, 7, 1 * HOUR, 2 * HOUR, 2 * DAY,{ from: first });
			
			let roomNumberCounter = await royale.roomNumberCounter();
			assert.equal(roomNumberCounter, 1);

			let playersInRoom_before = await royale.numberOfPlayersInRoom(roomNumberCounter);
			assert.equal(playersInRoom_before, 1);

			const tx = await royale.signUpForRoom( roomNumberCounter, { from: second });

			assert.equal(await royale.numberOfAlowedPlayersInRoom(roomNumberCounter), 2);
			assert.notEqual(await royale.playerSignedUpPerRoom(roomNumberCounter, first), 0);
			assert.notEqual(await royale.playerSignedUpPerRoom(roomNumberCounter, second), 0);
			assert.equal(await royale.playerSignedUpPerRoom(roomNumberCounter, third), 0);
			assert.equal(await royale.playerSignedUpPerRoom(roomNumberCounter, fourth), 0);

			let playersInRoom_after = await royale.numberOfPlayersInRoom(roomNumberCounter);
			assert.equal(playersInRoom_after, 2);

			assert.equal(await royale.playerCanPlayInRoom(roomNumberCounter, first), true);
			assert.equal(await royale.playerCanPlayInRoom(roomNumberCounter, second), true);
			assert.equal(await royale.playerCanPlayInRoom(roomNumberCounter, third), false);
			assert.equal(await royale.playerCanPlayInRoom(roomNumberCounter, fourth), false);
			
			// check if event is emited
			assert.eventEqual(tx.logs[0], 'BuyIn', {
				_user: second,
				_amount: buyIn100,
				_roomNumber: roomNumberCounter
			});

			// check if event is emited
			assert.eventEqual(tx.logs[1], 'SignedUpInARoom', {
				_account: second,
				_roomNumber: roomNumberCounter
			});
		});

		it('Create CLOSED room and check values and sign up period has expired', async () => {
			const tx = await royale.createARoom(SNX, RoomType.CLOSED, GameType.LAST_MAN_STANDING, allowedPlayers, buyIn100, 10, 1 * HOUR, 7, 1 * HOUR, 2 * HOUR, 2 * DAY,{ from: first });

			await royale.signUpForRoom( 1, { from: second });

			await fastForward(HOUR * 72 + 1);

			await expect(royale.signUpForRoom( 1, { from: third })).to.be.revertedWith('Sign up period has expired');

		});

		it('Create CLOSED room and check values and double sign up', async () => {
			const tx = await royale.createARoom(SNX, RoomType.CLOSED, GameType.LAST_MAN_STANDING, allowedPlayers, buyIn100, 10, 1 * HOUR, 7, 1 * HOUR, 2 * HOUR, 2 * DAY,{ from: first });

			await royale.signUpForRoom( 1, { from: second });

			await expect(royale.signUpForRoom( 1, { from: second })).to.be.revertedWith('Player already signed up, for this room.');

			});

			it('Create CLOSED room and check values and check if player is not allowed', async () => {
			const tx = await royale.createARoom(SNX, RoomType.CLOSED, GameType.LAST_MAN_STANDING, allowedPlayers, buyIn100, 2, 1 * HOUR, 7, 1 * HOUR, 2 * HOUR, 2 * DAY,{ from: first });

			let roomNumberCounter = await royale.roomNumberCounter();

			await royale.signUpForRoom(roomNumberCounter, { from: second });
			await royale.signUpForRoom(roomNumberCounter, { from: third });

			await expect(royale.signUpForRoom(roomNumberCounter, { from: fourth })).to.be.revertedWith('Can not sign up for room, not allowed or it is full');

			
		});

		it('Create CLOSED room, sign up with success and check values', async () => {

			await royale.createARoom(SNX, RoomType.CLOSED, GameType.LAST_MAN_STANDING, allowedPlayers, buyIn100, 2, 1 * HOUR, 7, 1 * HOUR, 2 * HOUR, 2 * DAY,{ from: first });
					
			let roomNumberCounter = await royale.roomNumberCounter();
			assert.equal(roomNumberCounter, 1);

			assert.equal(await royale.playerCanPlayInRoom(roomNumberCounter, first), true);
			assert.equal(await royale.playerCanPlayInRoom(roomNumberCounter, second), true);
			assert.equal(await royale.playerCanPlayInRoom(roomNumberCounter, third), true);
			assert.equal(await royale.playerCanPlayInRoom(roomNumberCounter, fourth), false);

			let playersInRoom_before = await royale.numberOfPlayersInRoom(roomNumberCounter);
			assert.equal(playersInRoom_before, 1);

			const tx = await royale.signUpForRoom( roomNumberCounter, { from: second });

			assert.equal(await royale.numberOfAlowedPlayersInRoom(roomNumberCounter), 3);
			assert.notEqual(await royale.playerSignedUpPerRoom(roomNumberCounter, first), 0);
			assert.notEqual(await royale.playerSignedUpPerRoom(roomNumberCounter, second), 0);
			assert.equal(await royale.playerSignedUpPerRoom(roomNumberCounter, third), 0);
			assert.equal(await royale.playerSignedUpPerRoom(roomNumberCounter, fourth), 0);

			let playersInRoom_after = await royale.numberOfPlayersInRoom(roomNumberCounter);
			assert.equal(playersInRoom_after, 2);

			// check if event is emited
			assert.eventEqual(tx.logs[0], 'BuyIn', {
				_user: second,
				_amount: buyIn100,
				_roomNumber: roomNumberCounter
			});

			// check if event is emited
			assert.eventEqual(tx.logs[1], 'SignedUpInARoom', {
				_account: second,
				_roomNumber: roomNumberCounter
			});

		});

		it('Create TWO rooms (open and closed), sign up with both', async () => {
			
			await royale.createARoom(SNX, RoomType.CLOSED, GameType.LAST_MAN_STANDING, allowedPlayers, buyIn100, 2, 1 * HOUR, 7, 1 * HOUR, 2 * HOUR, 2 * DAY,{ from: first });
			await royale.createARoom(SNX, RoomType.OPEN, GameType.LAST_MAN_STANDING, empty, buyIn100, 2, 1 * HOUR, 7, 1 * HOUR, 2 * HOUR, 2 * DAY,{ from: first });
			
			let roomNumberCounter = await royale.roomNumberCounter();
			assert.equal(roomNumberCounter, 2);

			let closedRoomId = roomNumberCounter - 1;
			let openRoomId = roomNumberCounter;

			// CLOSED ROOM

			assert.equal(await royale.playerCanPlayInRoom(closedRoomId, first), true);
			assert.equal(await royale.playerCanPlayInRoom(closedRoomId, second), true);
			assert.equal(await royale.playerCanPlayInRoom(closedRoomId, third), true);
			assert.equal(await royale.playerCanPlayInRoom(closedRoomId, fourth), false);

			let playersInRoom_before_closed = await royale.numberOfPlayersInRoom(closedRoomId);
			assert.equal(playersInRoom_before_closed, 1);

			const tx_closed = await royale.signUpForRoom( closedRoomId, { from: second });

			assert.equal(await royale.numberOfAlowedPlayersInRoom(closedRoomId), 3);
			assert.notEqual(await royale.playerSignedUpPerRoom(closedRoomId, first), 0);
			assert.notEqual(await royale.playerSignedUpPerRoom(closedRoomId, second), 0);
			assert.equal(await royale.playerSignedUpPerRoom(closedRoomId, third), 0);
			assert.equal(await royale.playerSignedUpPerRoom(closedRoomId, fourth), 0);

			let playersInRoom_after_closed = await royale.numberOfPlayersInRoom(closedRoomId);
			assert.equal(playersInRoom_after_closed, 2);

			// check if event is emited
			assert.eventEqual(tx_closed.logs[0], 'BuyIn', {
				_user: second,
				_amount: buyIn100,
				_roomNumber: closedRoomId
			});

			// check if event is emited
			assert.eventEqual(tx_closed.logs[1], 'SignedUpInARoom', {
				_account: second,
				_roomNumber: closedRoomId
			});

			// OPEN ROOM

			let playersInRoom_before = await royale.numberOfPlayersInRoom(openRoomId);
			assert.equal(playersInRoom_before, 1);
			
			const tx_open = await royale.signUpForRoom( openRoomId, { from: second });
			
			assert.equal(await royale.numberOfAlowedPlayersInRoom(openRoomId), 2);
			assert.notEqual(await royale.playerSignedUpPerRoom(openRoomId, first), 0);
			assert.notEqual(await royale.playerSignedUpPerRoom(openRoomId, second), 0);
			assert.equal(await royale.playerSignedUpPerRoom(openRoomId, third), 0);
			assert.equal(await royale.playerSignedUpPerRoom(openRoomId, fourth), 0);
			
			let playersInRoom_after = await royale.numberOfPlayersInRoom(openRoomId);
			assert.equal(playersInRoom_after, 2);
			
			assert.equal(await royale.playerCanPlayInRoom(openRoomId, first), true);
			assert.equal(await royale.playerCanPlayInRoom(openRoomId, second), true);
			assert.equal(await royale.playerCanPlayInRoom(openRoomId, third), false);
			assert.equal(await royale.playerCanPlayInRoom(openRoomId, fourth), false);
			
			// check if event is emited
			assert.eventEqual(tx_open.logs[0], 'BuyIn', {
				_user: second,
				_amount: buyIn100,
				_roomNumber: openRoomId
			});

			// check if event is emited
			assert.eventEqual(tx_open.logs[1], 'SignedUpInARoom', {
				_account: second,
				_roomNumber: openRoomId
			});

		});

		it('Start royale sign piriod is ongoing', async () => {
			await royale.createARoom(SNX, RoomType.CLOSED, GameType.LAST_MAN_STANDING, allowedPlayers, buyIn100, 2, 1 * HOUR, 7, 1 * HOUR, 2 * HOUR, 2 * DAY,{ from: first });
			
			let roomNumberCounter = await royale.roomNumberCounter();
			assert.equal(roomNumberCounter, 1);

			await royale.signUpForRoom( roomNumberCounter, { from: second });
			
			await expect(royale.startRoyaleInRoom( roomNumberCounter, { from: second })).to.be.revertedWith('Can not start until signup period expires for that room');

			let roomStarted = await royale.roomStarted(roomNumberCounter);
			assert.equal(roomStarted, false);

			await fastForward(HOUR * 72 + 1);

			await royale.startRoyaleInRoom( roomNumberCounter, { from: second })

			roomStarted = await royale.roomNumberCounter();
			assert.equal(roomStarted, true);

		});

		it('Start royale if user is not participante', async () => {
			await royale.createARoom(SNX, RoomType.CLOSED, GameType.LAST_MAN_STANDING, allowedPlayers, buyIn100, 2, 1 * HOUR, 7, 1 * HOUR, 2 * HOUR, 2 * DAY,{ from: first });
			
			let roomNumberCounter = await royale.roomNumberCounter();
			assert.equal(roomNumberCounter, 1);

			await royale.signUpForRoom( roomNumberCounter, { from: second });
			
			await expect(royale.startRoyaleInRoom( roomNumberCounter, { from: second })).to.be.revertedWith('Can not start until signup period expires for that room');

			let roomStarted = await royale.roomStarted(roomNumberCounter);
			assert.equal(roomStarted, false);

			await fastForward(HOUR * 72 + 1);

			await expect(royale.startRoyaleInRoom( roomNumberCounter, { from: fourth })).to.be.revertedWith('You are not room participante');

			roomStarted = await royale.roomStarted(roomNumberCounter);
			assert.equal(roomStarted, false);

			await royale.startRoyaleInRoom( roomNumberCounter, { from: second })

			roomStarted = await royale.roomNumberCounter();
			assert.equal(roomStarted, true);

		});

		it('Start royale already started', async () => {

			await royale.createARoom(SNX, RoomType.CLOSED, GameType.LAST_MAN_STANDING, allowedPlayers, buyIn100, 2, 1 * HOUR, 7, 1 * HOUR, 2 * HOUR, 2 * DAY,{ from: first });
			
			let roomNumberCounter = await royale.roomNumberCounter();
			assert.equal(roomNumberCounter, 1);

			await royale.signUpForRoom( roomNumberCounter, { from: second });
			
			await expect(royale.startRoyaleInRoom( roomNumberCounter, { from: second })).to.be.revertedWith('Can not start until signup period expires for that room');

			let roomStarted = await royale.roomStarted(roomNumberCounter);
			assert.equal(roomStarted, false);

			await fastForward(HOUR * 72 + 1);

			await royale.startRoyaleInRoom( roomNumberCounter, { from: second })

			await expect(royale.startRoyaleInRoom( roomNumberCounter, { from: second })).to.be.revertedWith('Royale already started for that room');
		});

		it('Start royale and check values', async () => {

			await royale.createARoom(SNX, RoomType.CLOSED, GameType.LAST_MAN_STANDING, allowedPlayers, buyIn100, 2, 1 * HOUR, 7, 1 * HOUR, 2 * HOUR, 2 * DAY,{ from: first });
			
			let roomNumberCounter = await royale.roomNumberCounter();
			assert.equal(roomNumberCounter, 1);

			await royale.signUpForRoom( roomNumberCounter, { from: second });
			
			await expect(royale.startRoyaleInRoom( roomNumberCounter, { from: second })).to.be.revertedWith('Can not start until signup period expires for that room');

			let roomStarted = await royale.roomStarted(roomNumberCounter);
			assert.equal(roomStarted, false);

			await fastForward(HOUR * 72 + 1);

			const tx = await royale.startRoyaleInRoom( roomNumberCounter, { from: second })

			roomStarted = await royale.roomNumberCounter();
			assert.equal(roomStarted, true);

			assert.notEqual(await royale.roundTargetPriceInRoom(roomNumberCounter), 0);
			assert.notEqual(await royale.targetPricePerRoundPerRoom(roomNumberCounter, 1), 0);
			assert.equal(await royale.currentRoundInRoom(roomNumberCounter), 1);
			assert.notEqual(await royale.roundStartTimeInRoom(roomNumberCounter), 0);
			assert.notEqual(await royale.roundEndTimeInRoom(roomNumberCounter), 0);
			assert.equal(await royale.totalPlayersInARoomInARound(roomNumberCounter, 1), 2);

			// check if event is emited
			assert.eventEqual(tx.logs[0], 'RoyaleStartedForRoom', {
				_roomNumber: roomNumberCounter
			});
		});

		it('Start royale and take a position which is not 1 or 2', async () => {
			await royale.createARoom(SNX, RoomType.CLOSED, GameType.LAST_MAN_STANDING, allowedPlayers, buyIn100, 2, 1 * HOUR, 7, 1 * HOUR, 2 * HOUR, 2 * DAY,{ from: first });
			
			let roomNumberCounter = await royale.roomNumberCounter();
			assert.equal(roomNumberCounter, 1);

			await royale.signUpForRoom(roomNumberCounter, { from: second });

			await fastForward(HOUR * 72 + 1);

			await royale.startRoyaleInRoom( roomNumberCounter, { from: second })

			await expect(royale.takeAPositionInRoom( roomNumberCounter,0, { from: second })).to.be.revertedWith('Position can only be 1 or 2');
			
			await expect(royale.takeAPositionInRoom( roomNumberCounter,3, { from: second })).to.be.revertedWith('Position can only be 1 or 2');
			
		});

		it('Take a position royale not started', async () => {
			await royale.createARoom(SNX, RoomType.CLOSED, GameType.LAST_MAN_STANDING, allowedPlayers, buyIn100, 2, 1 * HOUR, 7, 1 * HOUR, 2 * HOUR, 2 * DAY,{ from: first });
			
			let roomNumberCounter = await royale.roomNumberCounter();
			assert.equal(roomNumberCounter, 1);

			await royale.signUpForRoom(roomNumberCounter, { from: second });

			await fastForward(HOUR * 72 + 1);

			await expect(royale.takeAPositionInRoom( roomNumberCounter, 1, { from: second })).to.be.revertedWith('Competition not started yet');
			
		});

		it('Take a position royale finished', async () => {

			assert.bnEqual(await royale.rewardPerRoom(1), buyInZero);

			await royale.createARoom(SNX, RoomType.CLOSED, GameType.LAST_MAN_STANDING, allowedPlayers, buyIn100, 2, 1 * HOUR, 7, 1 * HOUR, 2 * HOUR, 2 * DAY,{ from: first });
			
			let roomNumberCounter = await royale.roomNumberCounter();
			assert.equal(roomNumberCounter, 1);

			assert.bnEqual(await royale.rewardPerRoom(roomNumberCounter), buyIn100);

			await royale.signUpForRoom( roomNumberCounter, { from: second });

			assert.bnEqual(await royale.rewardPerRoom(roomNumberCounter), buyIn100 * 2);

			await fastForward(HOUR * 72 + 1);

			await royale.startRoyaleInRoom(roomNumberCounter, { from: second })

			assert.equal(await royale.roundTargetPriceInRoom(roomNumberCounter), 1000);
			assert.equal(await royale.targetPricePerRoundPerRoom(roomNumberCounter, 1), 1000);

			await royale.takeAPositionInRoom(roomNumberCounter,1, { from: first });
			await royale.takeAPositionInRoom(roomNumberCounter,2, { from: second });

			await MockPriceFeedDeployed.setPricetoReturn(1100);

			assert.equal(await royale.roomFinished(roomNumberCounter), false);

			await fastForward(HOUR * 72 + 1);
			const tx = await royale.closeRound(roomNumberCounter, { from: second });

			assert.equal(await royale.roomFinished(roomNumberCounter), true);

			await expect(royale.takeAPositionInRoom( roomNumberCounter, 1, { from: second })).to.be.revertedWith('Competition finished');
			await expect(royale.takeAPositionInRoom( roomNumberCounter, 1, { from: first })).to.be.revertedWith('Competition finished');

		});

		it('Take a position player did not sign up, not participante', async () => {
			
			await royale.createARoom(SNX, RoomType.CLOSED, GameType.LAST_MAN_STANDING, allowedPlayers, buyIn100, 2, 1 * HOUR, 7, 1 * HOUR, 2 * HOUR, 2 * DAY,{ from: first });
			
			let roomNumberCounter = await royale.roomNumberCounter();
			assert.equal(roomNumberCounter, 1);

			await royale.signUpForRoom( roomNumberCounter, { from: second });

			await fastForward(HOUR * 72 + 1);

			await royale.startRoyaleInRoom( roomNumberCounter, { from: second })

			await expect(royale.takeAPositionInRoom( roomNumberCounter,1, { from: third })).to.be.revertedWith('You are not room participante');
			
			await expect(royale.takeAPositionInRoom( roomNumberCounter,2, { from: fourth })).to.be.revertedWith('You are not room participante');
			
		});

		it('Same user take same position twice', async () => {

			await royale.createARoom(SNX, RoomType.CLOSED, GameType.LAST_MAN_STANDING, allowedPlayers, buyIn100, 2, 1 * HOUR, 7, 1 * HOUR, 2 * HOUR, 2 * DAY,{ from: first });
			
			let roomNumberCounter = await royale.roomNumberCounter();
			assert.equal(roomNumberCounter, 1);

			await royale.signUpForRoom( roomNumberCounter, { from: second });

			await fastForward(HOUR * 72 + 1);

			await royale.startRoyaleInRoom( roomNumberCounter, { from: second })

			await royale.takeAPositionInRoom(roomNumberCounter,1, { from: second });
			
			await expect(royale.takeAPositionInRoom(roomNumberCounter,1, { from: second })).to.be.revertedWith('Same position');

		});

		it('Take a position with royale which position time ends', async () => {
			
			await royale.createARoom(SNX, RoomType.CLOSED, GameType.LAST_MAN_STANDING, allowedPlayers, buyIn100, 2, 1 * HOUR, 7, 1 * HOUR, 2 * HOUR, 2 * DAY,{ from: first });
			
			let roomNumberCounter = await royale.roomNumberCounter();
			assert.equal(roomNumberCounter, 1);

			await royale.signUpForRoom( roomNumberCounter, { from: second });

			await fastForward(HOUR * 72 + 1);

			await royale.startRoyaleInRoom( roomNumberCounter, { from: second })

			await fastForward(HOUR * 72 + 1);

			await expect(royale.takeAPositionInRoom( roomNumberCounter,1, { from: second })).to.be.revertedWith('Round positioning finished');
			
		});

		it('Take a position check values', async () => {

			await royale.createARoom(SNX, RoomType.CLOSED, GameType.LAST_MAN_STANDING, allowedPlayers, buyIn100, 2, 1 * HOUR, 7, 1 * HOUR, 2 * HOUR, 2 * DAY,{ from: first });
			
			let roomNumberCounter = await royale.roomNumberCounter();
			assert.equal(roomNumberCounter, 1);

			await royale.signUpForRoom( roomNumberCounter, { from: second });

			await fastForward(HOUR * 72 + 1);

			await royale.startRoyaleInRoom( roomNumberCounter, { from: second })

			const tx_p1 = await royale.takeAPositionInRoom(roomNumberCounter,1, { from: second });

			const tx_p2 = await royale.takeAPositionInRoom(roomNumberCounter,2, { from: first });

			// check if event is emited
			assert.eventEqual(tx_p1.logs[0], 'TookAPosition', {
				_user : second,
				_roomNumber: roomNumberCounter,
				_round: 1,
				_position: 1
			});

			// check if event is emited
			assert.eventEqual(tx_p2.logs[0], 'TookAPosition', {
				_user : first,
				_roomNumber: roomNumberCounter,
				_round: 1,
				_position: 2
			});

			assert.equal(await royale.positionInARoundPerRoom(roomNumberCounter, first, 1), 2);
			assert.equal(await royale.positionInARoundPerRoom(roomNumberCounter, second, 1), 1);
			assert.equal(await royale.positionsPerRoundPerRoom(roomNumberCounter, 1, 1), 1); // number of positions
			assert.equal(await royale.positionsPerRoundPerRoom(roomNumberCounter, 1, 2), 1); // number of positions

		});

		it('Take a position with changing values and check values', async () => {

			await royale.createARoom(SNX, RoomType.CLOSED, GameType.LAST_MAN_STANDING, allowedPlayers, buyIn100, 2, 1 * HOUR, 7, 1 * HOUR, 2 * HOUR, 2 * DAY,{ from: first });
			
			let roomNumberCounter = await royale.roomNumberCounter();
			assert.equal(roomNumberCounter, 1);

			await royale.signUpForRoom( roomNumberCounter, { from: second });

			await fastForward(HOUR * 72 + 1);

			await royale.startRoyaleInRoom( roomNumberCounter, { from: second })

			const tx_p1_s = await royale.takeAPositionInRoom(roomNumberCounter,1, { from: second });
			const tx_p2_s = await royale.takeAPositionInRoom(roomNumberCounter,2, { from: second });

			const tx_p2_f = await royale.takeAPositionInRoom(roomNumberCounter,2, { from: first });
			const tx_p1_f = await royale.takeAPositionInRoom(roomNumberCounter,1, { from: first });

			// check if event is emited
			assert.eventEqual(tx_p1_s.logs[0], 'TookAPosition', {
				_user : second,
				_roomNumber: roomNumberCounter,
				_round: 1,
				_position: 1
			});

			// check if event is emited
			assert.eventEqual(tx_p2_s.logs[0], 'TookAPosition', {
				_user : second,
				_roomNumber: roomNumberCounter,
				_round: 1,
				_position: 2
			});

			// check if event is emited
			assert.eventEqual(tx_p2_f.logs[0], 'TookAPosition', {
				_user : first,
				_roomNumber: roomNumberCounter,
				_round: 1,
				_position: 2
			});

			// check if event is emited
			assert.eventEqual(tx_p1_f.logs[0], 'TookAPosition', {
				_user : first,
				_roomNumber: roomNumberCounter,
				_round: 1,
				_position: 1
			});

			assert.equal(await royale.positionInARoundPerRoom(roomNumberCounter, first, 1), 1);
			assert.equal(await royale.positionInARoundPerRoom(roomNumberCounter, second, 1), 2);
			assert.equal(await royale.positionsPerRoundPerRoom(roomNumberCounter, 1, 1), 1); // number of positions
			assert.equal(await royale.positionsPerRoundPerRoom(roomNumberCounter, 1, 2), 1); // number of positions

			assert.equal(await royale.isPlayerAliveInASpecificRoom(first, roomNumberCounter), true); 
			assert.equal(await royale.isPlayerAliveInASpecificRoom(second, roomNumberCounter), true); 
			assert.equal(await royale.isPlayerAliveInASpecificRoom(third, roomNumberCounter), false); 

		});

		it('Close round competition not started', async () => {

			await royale.createARoom(SNX, RoomType.CLOSED, GameType.LAST_MAN_STANDING, allowedPlayers, buyIn100, 2, 1 * HOUR, 7, 1 * HOUR, 2 * HOUR, 2 * DAY,{ from: first });
			
			let roomNumberCounter = await royale.roomNumberCounter();
			assert.equal(roomNumberCounter, 1);

			await royale.signUpForRoom( roomNumberCounter, { from: second });

			await fastForward(HOUR * 72 + 1);

			await expect(royale.closeRound( roomNumberCounter, { from: second })).to.be.revertedWith('Competition not started yet');

		});

		it('Close round player that are not participate', async () => {

			await royale.createARoom(SNX, RoomType.CLOSED, GameType.LAST_MAN_STANDING, allowedPlayers, buyIn100, 2, 1 * HOUR, 7, 1 * HOUR, 2 * HOUR, 2 * DAY,{ from: first });
			
			let roomNumberCounter = await royale.roomNumberCounter();
			assert.equal(roomNumberCounter, 1);

			await royale.signUpForRoom( roomNumberCounter, { from: second });

			await fastForward(HOUR * 72 + 1);

			await expect(royale.closeRound( roomNumberCounter, { from: fourth })).to.be.revertedWith('You are not room participante');

		});

		it('Close round competition finished', async () => {

			await royale.createARoom(SNX, RoomType.CLOSED, GameType.LAST_MAN_STANDING, allowedPlayers, buyIn100, 2, 1 * HOUR, 7, 1 * HOUR, 2 * HOUR, 2 * DAY,{ from: first });
			
			let roomNumberCounter = await royale.roomNumberCounter();
			assert.equal(roomNumberCounter, 1);

			await royale.signUpForRoom( roomNumberCounter, { from: second });

			await fastForward(HOUR * 72 + 1);

			await royale.startRoyaleInRoom( roomNumberCounter, { from: second })

			await royale.takeAPositionInRoom(roomNumberCounter,1, { from: second });
			await royale.takeAPositionInRoom(roomNumberCounter,2, { from: second });

			await MockPriceFeedDeployed.setPricetoReturn(1100);

			await fastForward(HOUR * 72 + 1);

			await fastForward(HOUR * 72 + 1);
			const tx = await royale.closeRound(roomNumberCounter, { from: second });

			// check if event is emited
			assert.eventEqual(tx.logs[0], 'RoundClosedInRoom', {
				_roomNumber: roomNumberCounter,
				_round: 1,
				_result: 2
			});

			// check if event is emited
			assert.eventEqual(tx.logs[1], 'RoyaleFinishedForRoom', {
				_roomNumber: roomNumberCounter
			});

			await expect(royale.closeRound( roomNumberCounter, { from: second })).to.be.revertedWith('Competition finished');
		});

		it('Close round round still ongoing', async () => {

			await royale.createARoom(SNX, RoomType.CLOSED, GameType.LAST_MAN_STANDING, allowedPlayers, buyIn100, 2, 1 * HOUR, 7, 1 * HOUR, 2 * HOUR, 2 * DAY,{ from: first });
			
			let roomNumberCounter = await royale.roomNumberCounter();
			assert.equal(roomNumberCounter, 1);

			await royale.signUpForRoom( roomNumberCounter, { from: second });

			await fastForward(HOUR * 72 + 1);

			await royale.startRoyaleInRoom( roomNumberCounter, { from: second })

			await expect(royale.closeRound( roomNumberCounter, { from: second })).to.be.revertedWith('Can not close round yet');

		});

		it('Close round round check values', async () => {

			assert.bnEqual(await royale.rewardPerRoom(1), buyInZero);

			await royale.createARoom(SNX, RoomType.CLOSED, GameType.LAST_MAN_STANDING, allowedPlayers, buyIn100, 2, 1 * HOUR, 7, 1 * HOUR, 2 * HOUR, 2 * DAY,{ from: first });
			
			let roomNumberCounter = await royale.roomNumberCounter();
			assert.equal(roomNumberCounter, 1);

			assert.equal(await royale.isPlayerOwner(first, roomNumberCounter), true);
			assert.equal(await royale.isPlayerOwner(second, roomNumberCounter), false);

			assert.bnEqual(await royale.rewardPerRoom(roomNumberCounter), buyIn100);

			await royale.signUpForRoom( roomNumberCounter, { from: second });

			assert.bnEqual(await royale.rewardPerRoom(roomNumberCounter), buyIn100 * 2);

			await fastForward(HOUR * 72 + 1);

			await royale.startRoyaleInRoom( roomNumberCounter, { from: second })

			assert.equal(await royale.isPlayerAliveInASpecificRoom(first, roomNumberCounter), true);
			assert.equal(await royale.isPlayerAliveInASpecificRoom(second, roomNumberCounter), true);

			assert.equal(await royale.roundTargetPriceInRoom(roomNumberCounter), 1000);
			assert.equal(await royale.targetPricePerRoundPerRoom(roomNumberCounter, 1), 1000);

			await royale.takeAPositionInRoom(roomNumberCounter,1, { from: first });
			await royale.takeAPositionInRoom(roomNumberCounter,2, { from: second });

			await MockPriceFeedDeployed.setPricetoReturn(1100);

			assert.equal(await royale.roomFinished(roomNumberCounter), false);

			await fastForward(HOUR * 72 + 1);
			const tx = await royale.closeRound(roomNumberCounter, { from: second });

			assert.equal(await royale.isPlayerAliveInASpecificRoom(first, roomNumberCounter), false);
			assert.equal(await royale.isPlayerAliveInASpecificRoom(second, roomNumberCounter), true);

			assert.equal(await royale.finalPricePerRoundPerRoom(roomNumberCounter, 1), 1100);
			assert.equal(await royale.roundResultPerRoom(roomNumberCounter, 1), 2);
			assert.equal(await royale.roundTargetPriceInRoom(roomNumberCounter), 1100);

			assert.equal(await royale.totalPlayersInARoomInARound(roomNumberCounter, 1), 2);
			assert.equal(await royale.totalPlayersInARoomInARound(roomNumberCounter, 2), 1);

			assert.equal(await royale.eliminatedPerRoundPerRoom(roomNumberCounter, 1), 1);

			assert.equal(await royale.currentRoundInRoom(roomNumberCounter), 2);
			assert.equal(await royale.targetPricePerRoundPerRoom(roomNumberCounter, 2), 1100);
			assert.equal(await royale.roomFinished(roomNumberCounter), true);

			assert.equal(await royale.rewardPerPlayerPerRoom(roomNumberCounter), buyIn100 * 2);

			assert.notEqual(await royale.roomEndTime(roomNumberCounter), 0);

			// check if event is emited
			assert.eventEqual(tx.logs[0], 'RoundClosedInRoom', {
				_roomNumber: roomNumberCounter,
				_round: 1,
				_result: 2
			});

			// check if event is emited
			assert.eventEqual(tx.logs[1], 'RoyaleFinishedForRoom', {
				_roomNumber: roomNumberCounter
			});

		});

		it('Win at last man standing', async () => {

			await royale.createARoom(SNX, RoomType.OPEN, GameType.LAST_MAN_STANDING, empty, buyIn100, 3, 1 * HOUR, 3, 1 * HOUR, 2 * HOUR, 2 * DAY,{ from: first });
			
			let roomNumberCounter = await royale.roomNumberCounter();
			assert.equal(roomNumberCounter, 1);

			assert.equal(await royale.isPlayerOwner(first, roomNumberCounter), true);

			assert.bnEqual(await royale.rewardPerRoom(roomNumberCounter), buyIn100);

			await royale.signUpForRoom( roomNumberCounter, { from: second });
			await royale.signUpForRoom( roomNumberCounter, { from: third });
			await expect(royale.signUpForRoom(roomNumberCounter, { from: fourth })).to.be.revertedWith('Can not sign up for room, not allowed or it is full');

			assert.bnEqual(await royale.rewardPerRoom(roomNumberCounter), buyIn100 * 3);

			await fastForward(HOUR * 72 + 1);

			await royale.startRoyaleInRoom( roomNumberCounter, { from: second })

			assert.equal(await royale.roundTargetPriceInRoom(roomNumberCounter), 1000);
			assert.equal(await royale.targetPricePerRoundPerRoom(roomNumberCounter, 1), 1000);

			// #1
			await royale.takeAPositionInRoom(roomNumberCounter,2, { from: first });
			await royale.takeAPositionInRoom(roomNumberCounter,2, { from: second });
			await royale.takeAPositionInRoom(roomNumberCounter,2, { from: third });

			await MockPriceFeedDeployed.setPricetoReturn(1100);

			await fastForward(HOUR * 72 + 1);
			await royale.closeRound(roomNumberCounter, { from: second });

			assert.equal(await royale.finalPricePerRoundPerRoom(roomNumberCounter, 1), 1100);
			assert.equal(await royale.roundResultPerRoom(roomNumberCounter, 1), 2);
			assert.equal(await royale.roundTargetPriceInRoom(roomNumberCounter), 1100);
			assert.equal(await royale.totalPlayersInARoomInARound(roomNumberCounter, 1), 3);
			assert.equal(await royale.totalPlayersInARoomInARound(roomNumberCounter, 2), 3);
			assert.equal(await royale.eliminatedPerRoundPerRoom(roomNumberCounter, 1), 0);
			assert.equal(await royale.currentRoundInRoom(roomNumberCounter), 2);
			assert.equal(await royale.targetPricePerRoundPerRoom(roomNumberCounter, 2), 1100);
			assert.equal(await royale.roomFinished(roomNumberCounter), false);

			// #2
			await royale.takeAPositionInRoom(roomNumberCounter,2, { from: first });
			await royale.takeAPositionInRoom(roomNumberCounter,2, { from: second });
			await royale.takeAPositionInRoom(roomNumberCounter,2, { from: third });

			await MockPriceFeedDeployed.setPricetoReturn(1200);

			await fastForward(HOUR * 72 + 1);
			await royale.closeRound(roomNumberCounter, { from: second });

			assert.equal(await royale.finalPricePerRoundPerRoom(roomNumberCounter, 2), 1200);
			assert.equal(await royale.roundResultPerRoom(roomNumberCounter, 1), 2);
			assert.equal(await royale.roundTargetPriceInRoom(roomNumberCounter), 1200);
			assert.equal(await royale.totalPlayersInARoomInARound(roomNumberCounter, 1), 3);
			assert.equal(await royale.totalPlayersInARoomInARound(roomNumberCounter, 2), 3);
			assert.equal(await royale.eliminatedPerRoundPerRoom(roomNumberCounter, 2), 0);
			assert.equal(await royale.currentRoundInRoom(roomNumberCounter), 3);
			assert.equal(await royale.targetPricePerRoundPerRoom(roomNumberCounter, 3), 1200);
			assert.equal(await royale.roomFinished(roomNumberCounter), false);

			// #3
			await royale.takeAPositionInRoom(roomNumberCounter,2, { from: first });
			await royale.takeAPositionInRoom(roomNumberCounter,2, { from: second });
			await royale.takeAPositionInRoom(roomNumberCounter,1, { from: third });

			await MockPriceFeedDeployed.setPricetoReturn(1300);

			await fastForward(HOUR * 72 + 1);
			await royale.closeRound(roomNumberCounter, { from: second });

			assert.equal(await royale.finalPricePerRoundPerRoom(roomNumberCounter, 3), 1300);
			assert.equal(await royale.roundResultPerRoom(roomNumberCounter, 1), 2);
			assert.equal(await royale.roundTargetPriceInRoom(roomNumberCounter), 1300);
			assert.equal(await royale.totalPlayersInARoomInARound(roomNumberCounter, 3), 3);
			assert.equal(await royale.totalPlayersInARoomInARound(roomNumberCounter, 4), 2);
			assert.equal(await royale.eliminatedPerRoundPerRoom(roomNumberCounter, 3), 1);
			assert.equal(await royale.currentRoundInRoom(roomNumberCounter), 4);
			assert.equal(await royale.targetPricePerRoundPerRoom(roomNumberCounter, 4), 1300);
			assert.equal(await royale.roomFinished(roomNumberCounter), false);

			// #4 - IF LAST MAN STANDING PLAYS GO UNTILL ONE IS WINNER
			await royale.takeAPositionInRoom(roomNumberCounter,2, { from: first });
			await royale.takeAPositionInRoom(roomNumberCounter,1, { from: second });
			await expect(royale.takeAPositionInRoom(roomNumberCounter,1, { from: third })).to.be.revertedWith('Player no longer alive');

			await MockPriceFeedDeployed.setPricetoReturn(1400);

			await fastForward(HOUR * 72 + 1);
			const tx = await royale.closeRound(roomNumberCounter, { from: second });

			assert.equal(await royale.finalPricePerRoundPerRoom(roomNumberCounter, 4), 1400);
			assert.equal(await royale.roundResultPerRoom(roomNumberCounter, 1), 2);
			assert.equal(await royale.roundTargetPriceInRoom(roomNumberCounter), 1400);
			assert.equal(await royale.totalPlayersInARoomInARound(roomNumberCounter, 4), 2);
			assert.equal(await royale.totalPlayersInARoomInARound(roomNumberCounter, 5), 1);
			assert.equal(await royale.eliminatedPerRoundPerRoom(roomNumberCounter, 4), 1);
			assert.equal(await royale.currentRoundInRoom(roomNumberCounter), 5);
			assert.equal(await royale.targetPricePerRoundPerRoom(roomNumberCounter, 5), 1400);
			assert.equal(await royale.roomFinished(roomNumberCounter), true);

			assert.equal(await royale.rewardPerPlayerPerRoom(roomNumberCounter), buyIn100 * 3);

			// check if event is emited
			assert.eventEqual(tx.logs[0], 'RoundClosedInRoom', {
				_roomNumber: roomNumberCounter,
				_round: 4,
				_result: 2
			});

			// check if event is emited
			assert.eventEqual(tx.logs[1], 'RoyaleFinishedForRoom', {
				_roomNumber: roomNumberCounter
			});
		});

		it('Win at limited number of rounds one player finished before each', async () => {

			await royale.createARoom(SNX, RoomType.OPEN, GameType.LIMITED_NUMBER_OF_ROUNDS, empty, buyIn100, 3, 1 * HOUR, 3, 1 * HOUR, 2 * HOUR, 2 * DAY,{ from: first });
			
			let roomNumberCounter = await royale.roomNumberCounter();
			assert.equal(roomNumberCounter, 1);

			assert.equal(await royale.isPlayerOwner(first, roomNumberCounter), true);

			assert.bnEqual(await royale.rewardPerRoom(roomNumberCounter), buyIn100);

			await royale.signUpForRoom( roomNumberCounter, { from: second });
			await royale.signUpForRoom( roomNumberCounter, { from: third });
			await expect(royale.signUpForRoom(roomNumberCounter, { from: fourth })).to.be.revertedWith('Can not sign up for room, not allowed or it is full');

			assert.bnEqual(await royale.rewardPerRoom(roomNumberCounter), buyIn100 * 3);

			await fastForward(HOUR * 72 + 1);

			await royale.startRoyaleInRoom( roomNumberCounter, { from: second })

			assert.equal(await royale.roundTargetPriceInRoom(roomNumberCounter), 1000);
			assert.equal(await royale.targetPricePerRoundPerRoom(roomNumberCounter, 1), 1000);

			// #1
			await royale.takeAPositionInRoom(roomNumberCounter,2, { from: first });
			await royale.takeAPositionInRoom(roomNumberCounter,2, { from: second });
			await royale.takeAPositionInRoom(roomNumberCounter,2, { from: third });

			await MockPriceFeedDeployed.setPricetoReturn(1100);

			await fastForward(HOUR * 72 + 1);
			await royale.closeRound(roomNumberCounter, { from: second });

			assert.equal(await royale.finalPricePerRoundPerRoom(roomNumberCounter, 1), 1100);
			assert.equal(await royale.roundResultPerRoom(roomNumberCounter, 1), 2);
			assert.equal(await royale.roundTargetPriceInRoom(roomNumberCounter), 1100);
			assert.equal(await royale.totalPlayersInARoomInARound(roomNumberCounter, 1), 3);
			assert.equal(await royale.totalPlayersInARoomInARound(roomNumberCounter, 2), 3);
			assert.equal(await royale.eliminatedPerRoundPerRoom(roomNumberCounter, 1), 0);
			assert.equal(await royale.currentRoundInRoom(roomNumberCounter), 2);
			assert.equal(await royale.targetPricePerRoundPerRoom(roomNumberCounter, 2), 1100);
			assert.equal(await royale.roomFinished(roomNumberCounter), false);

			// #2
			await royale.takeAPositionInRoom(roomNumberCounter,2, { from: first });
			await royale.takeAPositionInRoom(roomNumberCounter,2, { from: second });
			await royale.takeAPositionInRoom(roomNumberCounter,2, { from: third });

			await MockPriceFeedDeployed.setPricetoReturn(1200);

			await fastForward(HOUR * 72 + 1);
			await royale.closeRound(roomNumberCounter, { from: second });

			assert.equal(await royale.finalPricePerRoundPerRoom(roomNumberCounter, 2), 1200);
			assert.equal(await royale.roundResultPerRoom(roomNumberCounter, 1), 2);
			assert.equal(await royale.roundTargetPriceInRoom(roomNumberCounter), 1200);
			assert.equal(await royale.totalPlayersInARoomInARound(roomNumberCounter, 1), 3);
			assert.equal(await royale.totalPlayersInARoomInARound(roomNumberCounter, 2), 3);
			assert.equal(await royale.eliminatedPerRoundPerRoom(roomNumberCounter, 2), 0);
			assert.equal(await royale.currentRoundInRoom(roomNumberCounter), 3);
			assert.equal(await royale.targetPricePerRoundPerRoom(roomNumberCounter, 3), 1200);
			assert.equal(await royale.roomFinished(roomNumberCounter), false);

			// #3
			await royale.takeAPositionInRoom(roomNumberCounter,2, { from: first });
			await royale.takeAPositionInRoom(roomNumberCounter,1, { from: second });
			await royale.takeAPositionInRoom(roomNumberCounter,1, { from: third });

			await MockPriceFeedDeployed.setPricetoReturn(1300);

			await fastForward(HOUR * 72 + 1);
			const tx = await royale.closeRound(roomNumberCounter, { from: second });

			assert.equal(await royale.finalPricePerRoundPerRoom(roomNumberCounter, 3), 1300);
			assert.equal(await royale.roundResultPerRoom(roomNumberCounter, 1), 2);
			assert.equal(await royale.roundTargetPriceInRoom(roomNumberCounter), 1300);
			assert.equal(await royale.totalPlayersInARoomInARound(roomNumberCounter, 3), 3);
			assert.equal(await royale.totalPlayersInARoomInARound(roomNumberCounter, 4), 0); // end game
			assert.equal(await royale.eliminatedPerRoundPerRoom(roomNumberCounter, 3), 2);
			assert.equal(await royale.currentRoundInRoom(roomNumberCounter), 4);
			assert.equal(await royale.targetPricePerRoundPerRoom(roomNumberCounter, 4), 1300);
			assert.equal(await royale.roomFinished(roomNumberCounter), true);

			assert.equal(await royale.rewardPerPlayerPerRoom(roomNumberCounter), buyIn100 * 3);

			// check if event is emited
			assert.eventEqual(tx.logs[0], 'RoundClosedInRoom', {
				_roomNumber: roomNumberCounter,
				_round: 3,
				_result: 2
			});

			// check if event is emited
			assert.eventEqual(tx.logs[1], 'RoyaleFinishedForRoom', {
				_roomNumber: roomNumberCounter
			});
		});

		it('Win at limited number of rounds two players win', async () => {

			await royale.createARoom(SNX, RoomType.OPEN, GameType.LIMITED_NUMBER_OF_ROUNDS, empty, buyIn100, 3, 1 * HOUR, 3, 1 * HOUR, 2 * HOUR, 2 * DAY,{ from: first });
			
			let roomNumberCounter = await royale.roomNumberCounter();
			assert.equal(roomNumberCounter, 1);

			assert.equal(await royale.isPlayerOwner(first, roomNumberCounter), true);

			assert.bnEqual(await royale.rewardPerRoom(roomNumberCounter), buyIn100);

			await royale.signUpForRoom( roomNumberCounter, { from: second });
			await royale.signUpForRoom( roomNumberCounter, { from: third });
			await expect(royale.signUpForRoom(roomNumberCounter, { from: fourth })).to.be.revertedWith('Can not sign up for room, not allowed or it is full');

			assert.bnEqual(await royale.rewardPerRoom(roomNumberCounter), buyIn100 * 3);

			await fastForward(HOUR * 72 + 1);

			await royale.startRoyaleInRoom( roomNumberCounter, { from: second })

			assert.equal(await royale.roundTargetPriceInRoom(roomNumberCounter), 1000);
			assert.equal(await royale.targetPricePerRoundPerRoom(roomNumberCounter, 1), 1000);

			// #1
			await royale.takeAPositionInRoom(roomNumberCounter,2, { from: first });
			await royale.takeAPositionInRoom(roomNumberCounter,2, { from: second });
			await royale.takeAPositionInRoom(roomNumberCounter,2, { from: third });

			await MockPriceFeedDeployed.setPricetoReturn(1100);

			await fastForward(HOUR * 72 + 1);
			await royale.closeRound(roomNumberCounter, { from: second });

			assert.equal(await royale.finalPricePerRoundPerRoom(roomNumberCounter, 1), 1100);
			assert.equal(await royale.roundResultPerRoom(roomNumberCounter, 1), 2);
			assert.equal(await royale.roundTargetPriceInRoom(roomNumberCounter), 1100);
			assert.equal(await royale.totalPlayersInARoomInARound(roomNumberCounter, 1), 3);
			assert.equal(await royale.totalPlayersInARoomInARound(roomNumberCounter, 2), 3);
			assert.equal(await royale.eliminatedPerRoundPerRoom(roomNumberCounter, 1), 0);
			assert.equal(await royale.currentRoundInRoom(roomNumberCounter), 2);
			assert.equal(await royale.targetPricePerRoundPerRoom(roomNumberCounter, 2), 1100);
			assert.equal(await royale.roomFinished(roomNumberCounter), false);

			// #2
			await royale.takeAPositionInRoom(roomNumberCounter,2, { from: first });
			await royale.takeAPositionInRoom(roomNumberCounter,2, { from: second });
			await royale.takeAPositionInRoom(roomNumberCounter,2, { from: third });

			await MockPriceFeedDeployed.setPricetoReturn(1200);

			await fastForward(HOUR * 72 + 1);
			await royale.closeRound(roomNumberCounter, { from: second });

			assert.equal(await royale.finalPricePerRoundPerRoom(roomNumberCounter, 2), 1200);
			assert.equal(await royale.roundResultPerRoom(roomNumberCounter, 1), 2);
			assert.equal(await royale.roundTargetPriceInRoom(roomNumberCounter), 1200);
			assert.equal(await royale.totalPlayersInARoomInARound(roomNumberCounter, 1), 3);
			assert.equal(await royale.totalPlayersInARoomInARound(roomNumberCounter, 2), 3);
			assert.equal(await royale.eliminatedPerRoundPerRoom(roomNumberCounter, 2), 0);
			assert.equal(await royale.currentRoundInRoom(roomNumberCounter), 3);
			assert.equal(await royale.targetPricePerRoundPerRoom(roomNumberCounter, 3), 1200);
			assert.equal(await royale.roomFinished(roomNumberCounter), false);

			// #3
			await royale.takeAPositionInRoom(roomNumberCounter,2, { from: first });
			await royale.takeAPositionInRoom(roomNumberCounter,2, { from: second });
			await royale.takeAPositionInRoom(roomNumberCounter,1, { from: third });

			await MockPriceFeedDeployed.setPricetoReturn(1300);

			await fastForward(HOUR * 72 + 1);
			const tx = await royale.closeRound(roomNumberCounter, { from: second });

			assert.equal(await royale.finalPricePerRoundPerRoom(roomNumberCounter, 3), 1300);
			assert.equal(await royale.roundResultPerRoom(roomNumberCounter, 1), 2);
			assert.equal(await royale.roundTargetPriceInRoom(roomNumberCounter), 1300);
			assert.equal(await royale.totalPlayersInARoomInARound(roomNumberCounter, 3), 3);
			assert.equal(await royale.totalPlayersInARoomInARound(roomNumberCounter, 4), 0); // end game
			assert.equal(await royale.eliminatedPerRoundPerRoom(roomNumberCounter, 3), 1);
			assert.equal(await royale.currentRoundInRoom(roomNumberCounter), 4);
			assert.equal(await royale.targetPricePerRoundPerRoom(roomNumberCounter, 4), 1300);
			assert.equal(await royale.roomFinished(roomNumberCounter), true);

			assert.equal(await royale.rewardPerPlayerPerRoom(roomNumberCounter), buyIn100 * 1.5);

			// check if event is emited
			assert.eventEqual(tx.logs[0], 'RoundClosedInRoom', {
				_roomNumber: roomNumberCounter,
				_round: 3,
				_result: 2
			});

			// check if event is emited
			assert.eventEqual(tx.logs[1], 'RoyaleFinishedForRoom', {
				_roomNumber: roomNumberCounter
			});
		});

		it('Win at limited number of rounds three players loose at end they win', async () => {
			await royale.createARoom(SNX, RoomType.OPEN, GameType.LIMITED_NUMBER_OF_ROUNDS, empty, buyIn100, 3, 1 * HOUR, 3, 1 * HOUR, 2 * HOUR, 2 * DAY,{ from: first });
			
			let roomNumberCounter = await royale.roomNumberCounter();
			assert.equal(roomNumberCounter, 1);

			assert.equal(await royale.isPlayerOwner(first, roomNumberCounter), true);

			assert.bnEqual(await royale.rewardPerRoom(roomNumberCounter), buyIn100);

			await royale.signUpForRoom( roomNumberCounter, { from: second });
			await royale.signUpForRoom( roomNumberCounter, { from: third });
			await expect(royale.signUpForRoom(roomNumberCounter, { from: fourth })).to.be.revertedWith('Can not sign up for room, not allowed or it is full');

			assert.bnEqual(await royale.rewardPerRoom(roomNumberCounter), buyIn100 * 3);

			await fastForward(HOUR * 72 + 1);

			await royale.startRoyaleInRoom( roomNumberCounter, { from: second })

			assert.equal(await royale.roundTargetPriceInRoom(roomNumberCounter), 1000);
			assert.equal(await royale.targetPricePerRoundPerRoom(roomNumberCounter, 1), 1000);

			// #1
			await royale.takeAPositionInRoom(roomNumberCounter,2, { from: first });
			await royale.takeAPositionInRoom(roomNumberCounter,2, { from: second });
			await royale.takeAPositionInRoom(roomNumberCounter,2, { from: third });

			await MockPriceFeedDeployed.setPricetoReturn(1100);

			await fastForward(HOUR * 72 + 1);
			await royale.closeRound(roomNumberCounter, { from: second });

			assert.equal(await royale.finalPricePerRoundPerRoom(roomNumberCounter, 1), 1100);
			assert.equal(await royale.roundResultPerRoom(roomNumberCounter, 1), 2);
			assert.equal(await royale.roundTargetPriceInRoom(roomNumberCounter), 1100);
			assert.equal(await royale.totalPlayersInARoomInARound(roomNumberCounter, 1), 3);
			assert.equal(await royale.totalPlayersInARoomInARound(roomNumberCounter, 2), 3);
			assert.equal(await royale.eliminatedPerRoundPerRoom(roomNumberCounter, 1), 0);
			assert.equal(await royale.currentRoundInRoom(roomNumberCounter), 2);
			assert.equal(await royale.targetPricePerRoundPerRoom(roomNumberCounter, 2), 1100);
			assert.equal(await royale.roomFinished(roomNumberCounter), false);

			// #2
			await royale.takeAPositionInRoom(roomNumberCounter,2, { from: first });
			await royale.takeAPositionInRoom(roomNumberCounter,2, { from: second });
			await royale.takeAPositionInRoom(roomNumberCounter,2, { from: third });

			await MockPriceFeedDeployed.setPricetoReturn(1200);

			await fastForward(HOUR * 72 + 1);
			await royale.closeRound(roomNumberCounter, { from: second });

			assert.equal(await royale.finalPricePerRoundPerRoom(roomNumberCounter, 2), 1200);
			assert.equal(await royale.roundResultPerRoom(roomNumberCounter, 1), 2);
			assert.equal(await royale.roundTargetPriceInRoom(roomNumberCounter), 1200);
			assert.equal(await royale.totalPlayersInARoomInARound(roomNumberCounter, 1), 3);
			assert.equal(await royale.totalPlayersInARoomInARound(roomNumberCounter, 2), 3);
			assert.equal(await royale.eliminatedPerRoundPerRoom(roomNumberCounter, 2), 0);
			assert.equal(await royale.currentRoundInRoom(roomNumberCounter), 3);
			assert.equal(await royale.targetPricePerRoundPerRoom(roomNumberCounter, 3), 1200);
			assert.equal(await royale.roomFinished(roomNumberCounter), false);

			// #3
			await royale.takeAPositionInRoom(roomNumberCounter,1, { from: first });
			await royale.takeAPositionInRoom(roomNumberCounter,1, { from: second });
			await royale.takeAPositionInRoom(roomNumberCounter,1, { from: third });

			await MockPriceFeedDeployed.setPricetoReturn(1300);

			await fastForward(HOUR * 72 + 1);
			const tx = await royale.closeRound(roomNumberCounter, { from: second });

			assert.equal(await royale.finalPricePerRoundPerRoom(roomNumberCounter, 3), 1300);
			assert.equal(await royale.roundResultPerRoom(roomNumberCounter, 1), 2);
			assert.equal(await royale.roundTargetPriceInRoom(roomNumberCounter), 1300);
			assert.equal(await royale.totalPlayersInARoomInARound(roomNumberCounter, 3), 3);
			assert.equal(await royale.totalPlayersInARoomInARound(roomNumberCounter, 4), 0);
			assert.equal(await royale.eliminatedPerRoundPerRoom(roomNumberCounter, 3), 3);
			assert.equal(await royale.currentRoundInRoom(roomNumberCounter), 3); // end game
			assert.equal(await royale.roomFinished(roomNumberCounter), true);

			assert.bnEqual(await royale.rewardPerPlayerPerRoom(roomNumberCounter), buyIn100);
			
			// check if event is emited
			assert.eventEqual(tx.logs[0], 'SplitBetweenLoosers', {
				_roomNumber: roomNumberCounter,
				_round: 3,
				_numberOfPlayers: 3
			});

			// check if event is emited
			assert.eventEqual(tx.logs[1], 'RoundClosedInRoom', {
				_roomNumber: roomNumberCounter,
				_round: 3,
				_result: 2
			});

			// check if event is emited
			assert.eventEqual(tx.logs[2], 'RoyaleFinishedForRoom', {
				_roomNumber: roomNumberCounter
			});
		});

		it('Two players win and one claim one expired and check require statements', async () => {

			await royale.createARoom(SNX, RoomType.OPEN, GameType.LIMITED_NUMBER_OF_ROUNDS, empty, buyIn100, 3, 1 * HOUR, 3, 1 * HOUR, 2 * HOUR, 2 * DAY,{ from: first });
			
			let roomNumberCounter = await royale.roomNumberCounter();
			assert.equal(roomNumberCounter, 1);

			assert.equal(await royale.isPlayerOwner(first, roomNumberCounter), true);

			assert.bnEqual(await royale.rewardPerRoom(roomNumberCounter), buyIn100);

			await royale.signUpForRoom( roomNumberCounter, { from: second });
			await royale.signUpForRoom( roomNumberCounter, { from: third });
			await expect(royale.signUpForRoom(roomNumberCounter, { from: fourth })).to.be.revertedWith('Can not sign up for room, not allowed or it is full');

			assert.bnEqual(await royale.rewardPerRoom(roomNumberCounter), buyIn100 * 3);

			await fastForward(HOUR * 72 + 1);

			await royale.startRoyaleInRoom( roomNumberCounter, { from: second })

			// #1
			await royale.takeAPositionInRoom(roomNumberCounter,2, { from: first });
			await royale.takeAPositionInRoom(roomNumberCounter,2, { from: second });
			await royale.takeAPositionInRoom(roomNumberCounter,2, { from: third });

			await MockPriceFeedDeployed.setPricetoReturn(1100);

			await fastForward(HOUR * 72 + 1);
			await royale.closeRound(roomNumberCounter, { from: second });

			// #2
			await royale.takeAPositionInRoom(roomNumberCounter,2, { from: first });
			await royale.takeAPositionInRoom(roomNumberCounter,2, { from: second });
			await royale.takeAPositionInRoom(roomNumberCounter,2, { from: third });

			await MockPriceFeedDeployed.setPricetoReturn(1200);

			await fastForward(HOUR * 72 + 1);
			await royale.closeRound(roomNumberCounter, { from: second });

			// #3
			await royale.takeAPositionInRoom(roomNumberCounter,2, { from: first });
			await royale.takeAPositionInRoom(roomNumberCounter,2, { from: second });
			await royale.takeAPositionInRoom(roomNumberCounter,1, { from: third });

			await MockPriceFeedDeployed.setPricetoReturn(1300);

			await expect(royale.claimRewardForRoom(roomNumberCounter, { from: first })).to.be.revertedWith('Royale must be finished!');

			await fastForward(HOUR * 72 + 1);
			await royale.closeRound(roomNumberCounter, { from: second });
			assert.equal(await royale.roomFinished(roomNumberCounter), true);

			await expect(royale.claimRewardForRoom(roomNumberCounter, { from: third })).to.be.revertedWith('Player is not alive');

			const tx = await royale.claimRewardForRoom(roomNumberCounter, { from: first });
			
			// check if event is emited
			assert.eventEqual(tx.logs[0], 'RewardClaimed', {
				_roomNumber: roomNumberCounter,
				_winner: first,
				_reward: toUnit(150)
			});

			await expect(royale.claimRewardForRoom(roomNumberCounter, { from: first })).to.be.revertedWith('Player already collected reward');
			
			await fastForward(HOUR * 72 + 1);

			await expect(royale.claimRewardForRoom(roomNumberCounter, { from: second })).to.be.revertedWith('Time for reward claiming expired');

		});
	});
	describe('Room management', () => {
		it('Set round length', async () => {
		});
	});
});
