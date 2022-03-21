// 'use strict';

// const { artifacts, contract, web3 } = require('hardhat');
// const { toBN } = web3.utils;

// const { assert, addSnapshotBeforeRestoreAfterEach } = require('../../utils/common');

// const { toBytes32 } = require('../../../index');

// var ethers2 = require('ethers');
// var crypto = require('crypto');

// const SECOND = 1000;
// const HOUR = 3600;
// const DAY = 86400;
// const WEEK = 604800;
// const YEAR = 31556926;

// const { fastForward, toUnit } = require('../../utils')();

// const { encodeCall, assertRevert } = require('../../utils/helpers');

// function extractJSONFromURI(uri) {
// 	const encodedJSON = uri.substr('data:application/json;base64,'.length);
// 	const decodedJSON = Buffer.from(encodedJSON, 'base64').toString('utf8');
// 	return JSON.parse(decodedJSON);
// }

// contract('ThalesRoyalePassport', accounts => {
// 	const [first, owner, second, third, fourth] = accounts;
// 	let ThalesRoyalePassport;
// 	let passport;
// 	const season_1 = 1;
// 	const season_2 = 2;
// 	let priceFeedAddress;
// 	let MockPriceFeedDeployed;
// 	let ThalesDeployed;
// 	let thales;
// 	let ThalesRoyale;
// 	let ThalesRoyaleDeployed;
// 	let royale;
// 	let initializeRoyaleData;
// 	let ThalesRoyaleImplementation;
// 	const nonExistentTokenId = 6;

// 	beforeEach(async () => {
// 		const thalesQty_0 = toUnit(0);
// 		const thalesQty = toUnit(10000);
// 		const thalesQty_2500 = toUnit(2500);

// 		let OwnedUpgradeabilityProxy = artifacts.require('OwnedUpgradeabilityProxy');

// 		let Thales = artifacts.require('Thales');
// 		ThalesDeployed = await Thales.new({ from: owner });

// 		priceFeedAddress = owner;

// 		let MockPriceFeed = artifacts.require('MockPriceFeed');
// 		MockPriceFeedDeployed = await MockPriceFeed.new(owner);

// 		await MockPriceFeedDeployed.setPricetoReturn(1000);

// 		priceFeedAddress = MockPriceFeedDeployed.address;

// 		ThalesRoyale = artifacts.require('ThalesRoyale');

// 		ThalesRoyaleDeployed = await OwnedUpgradeabilityProxy.new({ from: owner });
// 		ThalesRoyaleImplementation = await ThalesRoyale.new({ from: owner });
// 		royale = await ThalesRoyale.at(ThalesRoyaleDeployed.address);

// 		initializeRoyaleData = encodeCall(
// 			'initialize',
// 			[
// 				'address',
// 				'bytes32',
// 				'address',
// 				'address',
// 				'uint',
// 				'uint',
// 				'uint',
// 				'uint',
// 				'uint',
// 				'uint',
// 				'bool',
// 			],
// 			[
// 				owner,
// 				toBytes32('SNX'),
// 				priceFeedAddress,
// 				ThalesDeployed.address,
// 				7,
// 				DAY * 3,
// 				HOUR * 8,
// 				DAY,
// 				toUnit(2500),
// 				WEEK * 4,
// 				false,
// 			]
// 		);

// 		await ThalesRoyaleDeployed.upgradeToAndCall(
// 			ThalesRoyaleImplementation.address,
// 			initializeRoyaleData,
// 			{
// 				from: owner,
// 			}
// 		);

// 		ThalesRoyalePassport = artifacts.require('ThalesRoyalePassport');
// 		passport = await ThalesRoyalePassport.new(royale.address, { from: owner });
// 		await royale.setThalesRoyalePassport(passport.address, { from: owner });

// 		await ThalesDeployed.transfer(royale.address, thalesQty, { from: owner });
// 		await ThalesDeployed.approve(royale.address, thalesQty, { from: owner });

// 		await ThalesDeployed.transfer(first, thalesQty, { from: owner });
// 		await ThalesDeployed.approve(royale.address, thalesQty_2500, { from: first });

// 		await ThalesDeployed.transfer(second, thalesQty, { from: owner });
// 		await ThalesDeployed.approve(royale.address, thalesQty_2500, { from: second });

// 		await ThalesDeployed.transfer(third, thalesQty, { from: owner });
// 		await ThalesDeployed.approve(royale.address, thalesQty_2500, { from: third });

// 		await ThalesDeployed.transfer(fourth, thalesQty, { from: owner });
// 		await ThalesDeployed.approve(royale.address, thalesQty_2500, { from: fourth });
// 	});

// 	describe('ThalesRoyalePassport Init', () => {
// 		it('Init checking', async () => {
// 			assert.bnEqual('Thales Royale Passport', await passport.name());
// 			assert.bnEqual('TRS', await passport.symbol());
// 		});
// 	});

// 	describe('ThalesRoyalePassport Functions', () => {
// 		beforeEach(async () => {
// 			await royale.startNewSeason({ from: owner });
// 			let isPlayerFirstAlive = await royale.isPlayerAlive(first);

// 			assert.equal(false, isPlayerFirstAlive);

// 			await royale.signUp({ from: first });
// 			await royale.signUp({ from: second });
// 			await royale.signUp({ from: third });
// 			await royale.signUp({ from: fourth });

// 			isPlayerFirstAlive = await royale.isPlayerAlive(first);

// 			assert.equal(true, isPlayerFirstAlive);

// 			await fastForward(HOUR * 72 + 1);

// 			let isRoundClosableBeforeStarting = await royale.canCloseRound();
// 			assert.equal(false, isRoundClosableBeforeStarting);

// 			await royale.startRoyaleInASeason();

// 			let totalPlayersInARound = await royale.totalPlayersPerRoundPerSeason(season_1, 1);
// 			assert.equal(4, totalPlayersInARound);

// 			let eliminatedPlayersInARound = await royale.eliminatedPerRoundPerSeason(season_1, 1);
// 			assert.equal(0, eliminatedPlayersInARound);

// 			await royale.takeAPosition(2, { from: first });
// 			await royale.takeAPosition(1, { from: second });
// 			await royale.takeAPosition(1, { from: third });
// 			await royale.takeAPosition(1, { from: fourth });

// 			let roundTargetPrice = await royale.roundTargetPrice();

// 			let currentPrice = await MockPriceFeedDeployed.rateForCurrency(toBytes32('SNX'));

// 			await MockPriceFeedDeployed.setPricetoReturn(900);

// 			let isRoundClosableBefore = await royale.canCloseRound();
// 			assert.equal(false, isRoundClosableBefore);

// 			await fastForward(HOUR * 72 + 1);

// 			let isRoundClosableAfter = await royale.canCloseRound();
// 			assert.equal(true, isRoundClosableAfter);

// 			await royale.closeRound();

// 			let isRoundClosableAfterClosing = await royale.canCloseRound();
// 			assert.equal(false, isRoundClosableAfterClosing);

// 			roundTargetPrice = await royale.roundTargetPrice();

// 			currentPrice = await MockPriceFeedDeployed.rateForCurrency(toBytes32('SNX'));

// 			isPlayerFirstAlive = await royale.isPlayerAlive(first);

// 			let totalPlayersInARoundTwo = await royale.totalPlayersPerRoundPerSeason(season_1, 2);

// 			assert.equal(3, totalPlayersInARoundTwo);

// 			let eliminatedPlayersInARoundOne = await royale.eliminatedPerRoundPerSeason(season_1, 1);
// 			assert.equal(1, eliminatedPlayersInARoundOne);

// 			assert.equal(false, isPlayerFirstAlive);

// 			await expect(royale.takeAPosition(2, { from: first })).to.be.revertedWith(
// 				'Player no longer alive'
// 			);

// 			// round #2
// 			// await royale.takeAPosition(2, { from: second });
// 			// await royale.takeAPosition(1, { from: third });
// 			// await royale.takeAPosition(2, { from: fourth });
// 			// await fastForward(HOUR * 72 + 1);
// 			// await royale.closeRound();
// 		});

// 		it('Transfer passport', async () => {
// 			// transfer
// 			let secondTokenId = await passport.tokenPerSeason(second, 1);
// 			await passport.transferFrom(second, first, secondTokenId, { from: second });

// 			assert.equal((await passport.tokenPerSeason(first, 1)).toString(), secondTokenId.toString());
// 			assert.equal(await passport.ownerOf(secondTokenId), first);

// 			// royale logic check
// 		});

// 		it('Burn passport', async () => {
// 			const secondTokenId = await passport.tokenPerSeason(second, 1);
// 			const thirdTokenId = await passport.tokenPerSeason(third, 1);

// 			await expect(passport.burn(secondTokenId, { from: third })).to.be.revertedWith(
// 				'Must be owner or approver'
// 			);

// 			await expect(passport.burn(nonExistentTokenId, { from: third })).to.be.revertedWith(
// 				"Passport doesn't exist"
// 			);

// 			await passport.burn(thirdTokenId, { from: third });

// 			await expect(passport.ownerOf(thirdTokenId)).to.be.revertedWith(
// 				'revert ERC721: owner query for nonexistent token'
// 			);
// 			assert.equal(await passport.tokenPerSeason(third, 1), 0);
// 		});

// 		it('Fetch tokenURI', async () => {
// 			const secondTokenId = await passport.tokenPerSeason(second, 1);

// 			await expect(passport.tokenURI(nonExistentTokenId, { from: third })).to.be.revertedWith(
// 				"Passport doesn't exist"
// 			);
// 			const tokenURI = await passport.tokenURI(secondTokenId);
// 			const metadata = extractJSONFromURI(tokenURI);

// 			assert.equal(metadata.name, 'Thales Royale Passport');
// 			assert.equal(metadata.description, 'Thales Royale Passport - season 1');
// 		});

// 		it('Mint tokens in new season', async () => {
			
// 			// continue royale season #1

// 			// round #3
// 			await royale.takeAPosition(2, { from: second });
// 			await royale.takeAPosition(2, { from: third });
// 			await royale.takeAPosition(2, { from: fourth });
// 			await fastForward(HOUR * 72 + 1);
// 			await royale.closeRound();

// 			// round #4
// 			await royale.takeAPosition(2, { from: second });
// 			await royale.takeAPosition(2, { from: third });
// 			await royale.takeAPosition(2, { from: fourth });
// 			await fastForward(HOUR * 72 + 1);
// 			await royale.closeRound();

// 			// round #5
// 			await royale.takeAPosition(2, { from: second });
// 			await royale.takeAPosition(2, { from: third });
// 			await royale.takeAPosition(2, { from: fourth });
// 			await fastForward(HOUR * 72 + 1);
// 			await royale.closeRound();

// 			// round #6
// 			await royale.takeAPosition(2, { from: second });
// 			await royale.takeAPosition(2, { from: third });
// 			await royale.takeAPosition(1, { from: fourth });
// 			await fastForward(HOUR * 72 + 1);
// 			await royale.closeRound();


// 			// round #7
// 			await royale.takeAPosition(2, { from: second });
// 			await royale.takeAPosition(1, { from: third });
// 			await fastForward(HOUR * 72 + 1);
// 			await royale.closeRound();
		

// 			await royale.claimRewardForSeason(season_1, { from: second });

// 			let isPlayerOneClaimedReward_after = await royale.rewardCollectedPerSeason(season_1, second);
// 			assert.equal(isPlayerOneClaimedReward_after, true);

// 			await fastForward(WEEK * 1 + 1);

// 			await royale.setNextSeasonStartsAutomatically(true, { from: owner });

// 			await royale.startNewSeason({ from: owner });

// 			// season #2

	
// 			await ThalesDeployed.transfer(royale.address, toUnit(10000), { from: owner });
// 			await ThalesDeployed.approve(royale.address, toUnit(10000), { from: owner });
// 			await ThalesDeployed.transfer(first, toUnit(2500), { from: owner });
// 			await ThalesDeployed.approve(royale.address, toUnit(2500), { from: first });
// 			await ThalesDeployed.transfer(second, toUnit(2500), { from: owner });
// 			await ThalesDeployed.approve(royale.address, toUnit(2500), { from: second });
// 			await ThalesDeployed.transfer(third, toUnit(2500), { from: owner });
// 			await ThalesDeployed.approve(royale.address, toUnit(2500), { from: third });
// 			await ThalesDeployed.transfer(fourth, toUnit(2500), { from: owner });
// 			await ThalesDeployed.approve(royale.address, toUnit(2500), { from: fourth });
		
// 			await royale.putFunds(toUnit(10000), season_2, { from: owner });

// 			await royale.signUp({ from: first });
// 			await royale.signUp({ from: second });
// 			await royale.signUp({ from: third });
// 			await royale.signUp({ from: fourth });

// 			await fastForward(HOUR * 72 + 1);
// 			await royale.startRoyaleInASeason();

// 			await royale.takeAPosition(2, { from: first });
// 			await royale.takeAPosition(2, { from: second });
// 			await royale.takeAPosition(2, { from: third });
// 			await royale.takeAPosition(2, { from: fourth });

// 			await MockPriceFeedDeployed.setPricetoReturn(1100);

// 			// round #1
// 			await fastForward(HOUR * 72 + 1);
// 			await royale.closeRound();

// 			assert.equal(await passport.totalSupply(), 8);
// 			assert.equal(await passport.tokenPerSeason(first, 2), 5);
// 			assert.equal(await passport.tokenPerSeason(second, 2), 6);
// 			assert.equal(await passport.tokenPerSeason(third, 2), 7);
// 			assert.equal(await passport.tokenPerSeason(fourth, 2), 8);

// 			const secondTokenId = await passport.tokenPerSeason(second, 2);

// 			const tokenURI = await passport.tokenURI(secondTokenId);
// 			const metadata = extractJSONFromURI(tokenURI);

// 			assert.equal(metadata.name, 'Thales Royale Passport');
// 			assert.equal(metadata.description, 'Thales Royale Passport - season 2');

// 		});
// 	});
// });
