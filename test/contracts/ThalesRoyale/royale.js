'use strict';

const { artifacts, contract } = require('hardhat');

const { assert } = require('../../utils/common');

const { toBytes32 } = require('../../../index');

const HOUR = 3600;

const DAY = 86400;
const WEEK = 604800;

const { fastForward, toUnit } = require('../../utils')();

const { encodeCall } = require('../../utils/helpers');

function extractJSONFromURI(uri) {
	const encodedJSON = uri.substr('data:application/json;base64,'.length);
	const decodedJSON = Buffer.from(encodedJSON, 'base64').toString('utf8');
	return JSON.parse(decodedJSON);
}

contract('ThalesRoyale', accounts => {
	const [first, owner, second, third, fourth, fifth, sixth, seventh] = accounts;
	const season_1 = 1;
	const season_2 = 2;
	let priceFeedAddress;
	let MockPriceFeedDeployed;
	let ThalesDeployed;
	let ThalesRoyale;
	let ThalesRoyaleDeployed;
	let ThalesRoyalePassport;
	let passport;
	let royale;
	let initializeRoyaleData;
	let ThalesRoyaleImplementation;
	let ThalesRoyalePass;
	let voucher;

	beforeEach(async () => {
		const thalesQty = toUnit(20000);
		const thalesQty_2500 = toUnit(2500);
		const uri = 'http://my-json-server.typicode.com/abcoathup/samplenft/tokens/0';
		const passportURI = 'https://thales-ajlyy.s3.eu-central-1.amazonaws.com';

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
			[
				'address',
				'bytes32',
				'address',
				'address',
				'uint',
				'uint',
				'uint',
				'uint',
				'uint',
				'uint',
				'bool',
			],
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
				false,
			]
		);

		await ThalesRoyaleDeployed.upgradeToAndCall(
			ThalesRoyaleImplementation.address,
			initializeRoyaleData,
			{
				from: owner,
			}
		);

		await royale.setRoyalePassAddress(voucher.address, { from: owner });

		ThalesRoyalePassport = artifacts.require('ThalesRoyalePassport');

		let ThalesRoyalePassportDeployed = await OwnedUpgradeabilityProxy.new({ from: owner });
		let ThalesRoyalePassportImplementation = await ThalesRoyalePassport.new({ from: owner });
		passport = await ThalesRoyalePassport.at(ThalesRoyalePassportDeployed.address);

		let initializePassportData = encodeCall(
			'initialize',
			['address', 'string'],
			[royale.address, passportURI]
		);

		await ThalesRoyalePassportDeployed.upgradeToAndCall(
			ThalesRoyalePassportImplementation.address,
			initializePassportData,
			{
				from: owner,
			}
		);

		await royale.setThalesRoyalePassport(passport.address, { from: owner });

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

		await ThalesDeployed.transfer(fifth, thalesQty, { from: owner });
		await ThalesDeployed.approve(royale.address, thalesQty_2500, { from: fifth });

		await ThalesDeployed.transfer(sixth, thalesQty, { from: owner });
		await ThalesDeployed.approve(royale.address, thalesQty_2500, { from: sixth });

		await ThalesDeployed.transfer(seventh, thalesQty, { from: owner });
		await ThalesDeployed.approve(royale.address, thalesQty_2500, { from: seventh });

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
			await expect(royale.startNewSeason({ from: first })).to.be.revertedWith(
				'Only owner can start season before pause between two seasons'
			);
		});

		it('Signing up can be called twice - two passports are minted', async () => {
			assert.notEqual(toBytes32('SNX'), await royale.oracleKeyPerSeason(0));
			assert.notEqual(toBytes32('SNX'), await royale.oracleKeyPerSeason(2));
			assert.notEqual(toBytes32('SNX'), await royale.oracleKeyPerSeason(1));

			await royale.startNewSeason({ from: owner });

			assert.notEqual(toBytes32('SNX'), await royale.oracleKeyPerSeason(0));
			assert.equal(toBytes32('SNX'), await royale.oracleKeyPerSeason(1));
			assert.notEqual(toBytes32('SNX'), await royale.oracleKeyPerSeason(2));

			// first token id #1, second token id #2
			await royale.signUp({ from: first });
			await royale.signUp({ from: second });

			let initTotalTokensInARound = await royale.totalTokensPerRoundPerSeason(season_1, 1);
			// not started
			assert.equal(0, initTotalTokensInARound);

			let initEliminatedTokensInARound = await royale.eliminatedPerRoundPerSeason(season_1, 1);
			// not started
			assert.equal(0, initEliminatedTokensInARound);

			await ThalesDeployed.transfer(first, toUnit(2500), { from: owner });
			await ThalesDeployed.approve(royale.address, toUnit(2500), { from: first });

			// third token id #3
			await royale.signUp({ from: first });

			assert.equal(await passport.ownerOf(1), first);
			assert.equal(await passport.ownerOf(2), second);
			assert.equal(await passport.ownerOf(3), first);
		});

		it('Signing up No enough tokens', async () => {
			await royale.startNewSeason({ from: owner });
			await royale.setBuyInAmount(toUnit(3500000000), { from: owner });
			await expect(royale.signUp({ from: first })).to.be.revertedWith('No enough sUSD for buy in');
		});

		it('Signing up with allowance check event', async () => {
			await royale.startNewSeason({ from: owner });

			const tx = await royale.signUp({ from: first });
			const firstPassportId = 1;

			// check if passport is minted
			assert.equal(await passport.ownerOf(firstPassportId), first);

			// check if event is emited
			assert.eventEqual(tx.logs[0], 'SignedUpPassport', {
				user: first,
				tokenId: firstPassportId,
				season: season_1,
				positions: [0, 0, 0, 0, 0, 0, 0],
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
			await expect(royale.startRoyaleInASeason({ from: first })).to.be.revertedWith(
				'Can not start, no tokens in a season'
			);
		});

		it('Cant start new season if this not finished', async () => {
			await royale.startNewSeason({ from: owner });

			await royale.signUp({ from: first });
			await royale.signUp({ from: second });
			await royale.signUp({ from: third });

			const firstPassportId = 1;
			const secondPassportId = 2;
			const thirdPassportId = 3;

			assert.equal(true, await royale.isTokenAlive(firstPassportId));
			assert.equal(true, await royale.isTokenAlive(secondPassportId));
			assert.equal(true, await royale.isTokenAlive(thirdPassportId));

			await fastForward(HOUR * 72 + 1);

			await royale.startRoyaleInASeason();

			let totalTokensInARound = await royale.totalTokensPerRoundPerSeason(season_1, 1);
			assert.equal(3, totalTokensInARound);

			let eliminatedTokensInARound = await royale.eliminatedPerRoundPerSeason(season_1, 1);
			assert.equal(0, eliminatedTokensInARound);

			await expect(royale.startNewSeason({ from: owner })).to.be.revertedWith(
				'Previous season must be finished'
			);
		});

		it('check require statements', async () => {
			await royale.startNewSeason({ from: owner });

			await royale.signUp({ from: first });
			await royale.signUp({ from: second });

			const firstPassportId = 1;

			await expect(royale.takeAPosition(firstPassportId, 1, { from: first })).to.be.revertedWith(
				'Competition not started yet'
			);

			await expect(royale.takeAPosition(firstPassportId, 3, { from: first })).to.be.revertedWith(
				'Position can only be 1 or 2'
			);

			await expect(royale.startRoyaleInASeason()).to.be.revertedWith(
				"Can't start until signup period expires"
			);

			await fastForward(HOUR * 72 + 1);
			await royale.startRoyaleInASeason();
			await fastForward(HOUR * 72 + 1);

			await expect(royale.takeAPosition(firstPassportId, 2, { from: first })).to.be.revertedWith(
				'Round positioning finished'
			);
		});

		it('take a losing position and end first round and try to take a position in 2nd round player not alive', async () => {
			await royale.startNewSeason({ from: owner });

			await royale.signUp({ from: first }); // minted token #1
			await royale.signUp({ from: second }); // minted token #2
			await royale.signUp({ from: third }); // minted token #3

			const firstPassportId = 1;
			const secondPassportId = 2;
			const thirdPassportId = 3;

			let isTokenFirstAlive = await royale.isTokenAlive(firstPassportId);

			assert.equal(true, isTokenFirstAlive);

			await fastForward(HOUR * 72 + 1);

			let isRoundClosableBeforeStarting = await royale.canCloseRound();
			assert.equal(false, isRoundClosableBeforeStarting);

			await royale.startRoyaleInASeason();

			let totalTokensInARound = await royale.totalTokensPerRoundPerSeason(season_1, 1);
			assert.equal(3, totalTokensInARound);

			let eliminatedTokensInARound = await royale.eliminatedPerRoundPerSeason(season_1, 1);
			assert.equal(0, eliminatedTokensInARound);

			await royale.takeAPosition(firstPassportId, 2, { from: first });
			await royale.takeAPosition(secondPassportId, 1, { from: second });
			await royale.takeAPosition(thirdPassportId, 1, { from: third });

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

			isTokenFirstAlive = await royale.isTokenAlive(firstPassportId);

			let totalTokensInARoundTwo = await royale.totalTokensPerRoundPerSeason(season_1, 2);

			assert.equal(2, totalTokensInARoundTwo);

			let eliminatedTokensInARoundOne = await royale.eliminatedPerRoundPerSeason(season_1, 1);
			assert.equal(1, eliminatedTokensInARoundOne);

			assert.equal(false, isTokenFirstAlive);

			//console.log('eliminated', await passport.tokenURI(firstPassportId));

			await expect(royale.takeAPosition(firstPassportId, 2, { from: first })).to.be.revertedWith(
				'Token no longer valid'
			);
		});

		it('take a losing position end royale no players left', async () => {
			await royale.startNewSeason({ from: owner });

			let isTokenFirstAlive = await royale.isTokenAlive(1);

			assert.equal(false, isTokenFirstAlive);

			await royale.signUp({ from: first });
			await royale.signUp({ from: second });

			const firstPassportId = 1;

			isTokenFirstAlive = await royale.isTokenAlive(firstPassportId);

			assert.equal(true, isTokenFirstAlive);

			let initTotalTokensInARound = await royale.totalTokensPerRoundPerSeason(season_1, 1);
			// not started
			assert.equal(0, initTotalTokensInARound);

			let initEliminatedTokensInARound = await royale.eliminatedPerRoundPerSeason(season_1, 1);
			// not started
			assert.equal(0, initEliminatedTokensInARound);

			await fastForward(HOUR * 72 + 1);

			let isRoundClosableBeforeStarting = await royale.canCloseRound();
			assert.equal(false, isRoundClosableBeforeStarting);

			await royale.startRoyaleInASeason();

			let totalTokensInARound = await royale.totalTokensPerRoundPerSeason(season_1, 1);
			// equal to total number of players
			assert.equal(2, totalTokensInARound);

			let eliminatedTokensInARound = await royale.eliminatedPerRoundPerSeason(season_1, 1);
			// zero round need to be finished
			assert.equal(0, eliminatedTokensInARound);

			await royale.takeAPosition(firstPassportId, 2, { from: first });

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

			isTokenFirstAlive = await royale.isTokenAlive(firstPassportId);

			let totalTokensInARoundTwo = await royale.totalTokensPerRoundPerSeason(season_1, 2);
			// equal to zero because second didn't take position
			assert.equal(0, totalTokensInARoundTwo);

			let eliminatedTokensInARoundOne = await royale.eliminatedPerRoundPerSeason(season_1, 1);
			// two because first did take losing position, and second did't take position at all
			assert.equal(2, eliminatedTokensInARoundOne);

			assert.equal(true, isTokenFirstAlive);

			await expect(royale.takeAPosition(firstPassportId, 2, { from: first })).to.be.revertedWith(
				'Competition finished'
			);
		});

		it('take a winning position and end first round and try to take a position in 2nd round', async () => {
			await royale.startNewSeason({ from: owner });
			let isTokenFirstAlive = await royale.isTokenAlive(1);

			assert.equal(false, isTokenFirstAlive);

			await royale.signUp({ from: first });
			await royale.signUp({ from: second });

			const firstPassportId = 1;

			isTokenFirstAlive = await royale.isTokenAlive(firstPassportId);

			assert.equal(true, isTokenFirstAlive);

			await fastForward(HOUR * 72 + 1);
			await royale.startRoyaleInASeason();

			let totalTokensInARound = await royale.totalTokensPerRoundPerSeason(season_1, 1);
			// equal to total number of players
			assert.equal(2, totalTokensInARound);

			let eliminatedTokensInARound = await royale.eliminatedPerRoundPerSeason(season_1, 1);
			// zero  round need to be finished
			assert.equal(0, eliminatedTokensInARound);

			await royale.takeAPosition(firstPassportId, 2, { from: first });

			await MockPriceFeedDeployed.setPricetoReturn(1100);

			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			isTokenFirstAlive = await royale.isTokenAlive(firstPassportId);

			assert.equal(true, isTokenFirstAlive);

			await expect(royale.takeAPosition(firstPassportId, 2, { from: first })).to.be.revertedWith(
				'Competition finished'
			);

			let isTokenOneClaimedReward_before = await royale.tokenRewardCollectedPerSeason(
				firstPassportId
			);
			assert.equal(false, isTokenOneClaimedReward_before);

			const tx = await royale.claimRewardForSeason(season_1, firstPassportId, { from: first });

			// check if event is emited
			assert.eventEqual(tx.logs[0], 'RewardClaimedPassport', {
				season: season_1,
				winner: first,
				tokenId: firstPassportId,
				reward: toUnit(5000),
			});

			let isTokenOneClaimedReward_after = await royale.tokenRewardCollectedPerSeason(
				firstPassportId
			);
			assert.equal(isTokenOneClaimedReward_after, true);
		});

		it('take a winning position and end first round then skip 2nd round', async () => {
			await royale.startNewSeason({ from: owner });
			let isTokenFirstAlive = await royale.isTokenAlive(1);

			assert.equal(false, isTokenFirstAlive);

			let totalTokens = await royale.getTokensForSeason(season_1);
			assert.equal(0, totalTokens.length);

			await royale.signUp({ from: first });
			const firstPassportId = 1;

			totalTokens = await royale.getTokensForSeason(season_1);
			assert.equal(1, totalTokens.length);

			await royale.signUp({ from: second });

			totalTokens = await royale.getTokensForSeason(season_1);
			assert.equal(2, totalTokens.length);

			await royale.signUp({ from: third });
			const thirdPassportId = 3;

			totalTokens = await royale.getTokensForSeason(season_1);
			assert.equal(3, totalTokens.length);

			isTokenFirstAlive = await royale.isTokenAlive(firstPassportId);

			assert.equal(true, isTokenFirstAlive);

			await fastForward(HOUR * 72 + 1);
			await royale.startRoyaleInASeason();

			let totalTokensInARound = await royale.totalTokensPerRoundPerSeason(season_1, 1);
			// equal to total number of tokens
			assert.equal(3, totalTokensInARound);

			let eliminatedTokensInARound = await royale.eliminatedPerRoundPerSeason(season_1, 1);
			// zero  round need to be finished
			assert.equal(0, eliminatedTokensInARound);

			await royale.takeAPosition(firstPassportId, 2, { from: first });
			await royale.takeAPosition(thirdPassportId, 2, { from: third });

			await MockPriceFeedDeployed.setPricetoReturn(1100);

			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let totalTokensInARoundTwo = await royale.totalTokensPerRoundPerSeason(season_1, 2);
			assert.equal(2, totalTokensInARoundTwo);

			let eliminatedTokensInARoundOne = await royale.eliminatedPerRoundPerSeason(season_1, 1);
			// second did't take position at all so eliminated is 1
			assert.equal(1, eliminatedTokensInARoundOne);

			isTokenFirstAlive = await royale.isTokenAlive(firstPassportId);

			assert.equal(true, isTokenFirstAlive);

			await MockPriceFeedDeployed.setPricetoReturn(900);
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let totalTokensInARoundThree = await royale.totalTokensPerRoundPerSeason(season_1, 3);
			// equal to zero because first player didn't take position
			assert.equal(0, totalTokensInARoundThree);

			let eliminatedTokensInARoundTwo = await royale.eliminatedPerRoundPerSeason(season_1, 2);
			// first did't take position at all so eliminated in round two is 2
			assert.equal(2, eliminatedTokensInARoundTwo);

			isTokenFirstAlive = await royale.isTokenAlive(firstPassportId);

			assert.equal(true, isTokenFirstAlive);
		});

		it('win till the end ', async () => {
			await royale.startNewSeason({ from: owner });
			await royale.signUp({ from: first });
			await royale.signUp({ from: second });
			await royale.signUp({ from: third });

			const firstPassportId = 1;
			const secondPassportId = 2;
			const thirdPassportId = 3;

			await fastForward(HOUR * 72 + 1);
			await royale.startRoyaleInASeason();

			let totalTokensInARound = await royale.totalTokensPerRoundPerSeason(season_1, 1);
			// equal to total number of tokend
			assert.equal(3, totalTokensInARound);

			let eliminatedTokensInARound = await royale.eliminatedPerRoundPerSeason(season_1, 1);
			// zero  round need to be finished
			assert.equal(0, eliminatedTokensInARound);

			await royale.takeAPosition(firstPassportId, 2, { from: first });
			await royale.takeAPosition(thirdPassportId, 2, { from: third });

			await MockPriceFeedDeployed.setPricetoReturn(1100);

			//#1
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let totalTokensInARoundTwo = await royale.totalTokensPerRoundPerSeason(season_1, 2);
			// equal to 2 - first token, third win
			assert.equal(2, totalTokensInARoundTwo);

			let eliminatedTokensInARoundOne = await royale.eliminatedPerRoundPerSeason(season_1, 1);
			// equal to 1 second player did't take position
			assert.equal(1, eliminatedTokensInARoundOne);

			//#2
			await royale.takeAPosition(firstPassportId, 2, { from: first });
			await royale.takeAPosition(thirdPassportId, 2, { from: third });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let totalTokensInARoundThree = await royale.totalTokensPerRoundPerSeason(season_1, 3);
			// equal to 2 - first, third player win
			assert.equal(2, totalTokensInARoundThree);

			let eliminatedTokensInARoundTwo = await royale.eliminatedPerRoundPerSeason(season_1, 2);
			// no one left untill the end player one win
			assert.equal(0, eliminatedTokensInARoundTwo);

			//#3
			await royale.takeAPosition(firstPassportId, 2, { from: first });
			await royale.takeAPosition(thirdPassportId, 2, { from: third });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let totalTokensInARoundFour = await royale.totalTokensPerRoundPerSeason(season_1, 4);
			// equal to 2 - first, third player win
			assert.equal(2, totalTokensInARoundFour);

			let eliminatedTokensInARoundThree = await royale.eliminatedPerRoundPerSeason(season_1, 3);
			// no one left untill the end player one win
			assert.equal(0, eliminatedTokensInARoundThree);

			//#4
			await royale.takeAPosition(firstPassportId, 2, { from: first });
			await royale.takeAPosition(thirdPassportId, 2, { from: third });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let totalTokensInARoundFive = await royale.totalTokensPerRoundPerSeason(season_1, 5);
			// equal to 2 - first, third player win
			assert.equal(2, totalTokensInARoundFive);

			let eliminatedTokensInARoundFour = await royale.eliminatedPerRoundPerSeason(season_1, 4);
			// no one left untill the end player one win
			assert.equal(0, eliminatedTokensInARoundFour);

			//#5
			await royale.takeAPosition(firstPassportId, 2, { from: first });
			await royale.takeAPosition(thirdPassportId, 2, { from: third });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let totalTokensInARoundSix = await royale.totalTokensPerRoundPerSeason(season_1, 6);
			// equal to 2 - first, third player win
			assert.equal(2, totalTokensInARoundSix);

			let eliminatedTokensInARoundFive = await royale.eliminatedPerRoundPerSeason(season_1, 5);
			// no one left untill the end player one win
			assert.equal(0, eliminatedTokensInARoundFive);

			//#6
			await royale.takeAPosition(firstPassportId, 2, { from: first });
			await royale.takeAPosition(thirdPassportId, 2, { from: third });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let totalTokensInARoundSeven = await royale.totalTokensPerRoundPerSeason(season_1, 7);
			// equal to 2 - first, third player win
			assert.equal(2, totalTokensInARoundSeven);

			let eliminatedTokensInARoundSix = await royale.eliminatedPerRoundPerSeason(season_1, 6);
			// no one left untill the end player one win
			assert.equal(0, eliminatedTokensInARoundSix);

			//#7
			await royale.takeAPosition(firstPassportId, 2, { from: first });
			await royale.takeAPosition(thirdPassportId, 1, { from: third });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let totalTokensInARoundEight = await royale.totalTokensPerRoundPerSeason(season_1, 8);
			// equal to ZERO, no 8. round!
			assert.equal(0, totalTokensInARoundEight);

			let eliminatedTokensInARoundSeven = await royale.eliminatedPerRoundPerSeason(season_1, 7);

			assert.equal(1, eliminatedTokensInARoundSeven);

			let isTokenFirstAlive = await royale.isTokenAlive(firstPassportId);

			assert.equal(true, isTokenFirstAlive);

			await expect(royale.closeRound()).to.be.revertedWith('Competition finished');
		});

		it('take a winning position and end first round then skip 2nd round', async () => {
			await royale.startNewSeason({ from: owner });
			let isTokenFirstAlive = await royale.isTokenAlive(1);

			assert.equal(false, isTokenFirstAlive);

			await royale.signUp({ from: first });
			await royale.signUp({ from: second });

			const firstPassportId = 1;
			const secondPassportId = 2;

			isTokenFirstAlive = await royale.isTokenAlive(firstPassportId);

			assert.equal(true, isTokenFirstAlive);

			await fastForward(HOUR * 72 + 1);
			await royale.startRoyaleInASeason();

			await royale.takeAPosition(firstPassportId, 2, { from: first });
			await royale.takeAPosition(secondPassportId, 2, { from: second });

			await MockPriceFeedDeployed.setPricetoReturn(1100);

			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			isTokenFirstAlive = await royale.isTokenAlive(firstPassportId);

			assert.equal(true, isTokenFirstAlive);

			await MockPriceFeedDeployed.setPricetoReturn(900);
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			isTokenFirstAlive = await royale.isTokenAlive(firstPassportId);

			assert.equal(true, isTokenFirstAlive);
		});

		it('win till the end - no token transfer ', async () => {
			await royale.startNewSeason({ from: owner });
			await royale.signUp({ from: first });
			await royale.signUp({ from: second });

			const firstPassportId = 1;
			const secondPassportId = 2;

			await fastForward(HOUR * 72 + 1);
			await royale.startRoyaleInASeason();

			await royale.takeAPosition(firstPassportId, 2, { from: first });
			await royale.takeAPosition(secondPassportId, 2, { from: second });

			await MockPriceFeedDeployed.setPricetoReturn(1100);

			//#1
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			//#2
			await royale.takeAPosition(firstPassportId, 2, { from: first });
			await royale.takeAPosition(secondPassportId, 2, { from: second });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			//#3
			await royale.takeAPosition(firstPassportId, 2, { from: first });
			await royale.takeAPosition(secondPassportId, 2, { from: second });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			//#4
			await royale.takeAPosition(firstPassportId, 2, { from: first });
			await royale.takeAPosition(secondPassportId, 2, { from: second });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			//#5
			await royale.takeAPosition(firstPassportId, 2, { from: first });
			await royale.takeAPosition(secondPassportId, 2, { from: second });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			//#6
			await royale.takeAPosition(firstPassportId, 2, { from: first });
			await royale.takeAPosition(secondPassportId, 2, { from: second });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			//#7
			await royale.takeAPosition(firstPassportId, 2, { from: first });
			await royale.takeAPosition(secondPassportId, 1, { from: second });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let isTokenFirstAlive = await royale.isTokenAlive(firstPassportId);

			assert.equal(true, isTokenFirstAlive);

			await expect(royale.closeRound()).to.be.revertedWith('Competition finished');
		});

		it('win till the end - with transfers ', async () => {
			await royale.startNewSeason({ from: owner });
			await royale.signUp({ from: first });
			await royale.signUp({ from: second });
			await royale.signUp({ from: third });
			await royale.signUp({ from: fourth });
			await royale.signUp({ from: fifth });

			const firstPassportId = 1;
			const secondPassportId = 2;
			const thirdPassportId = 3;
			const fourthPassportId = 4;
			const fifthPassportId = 5;

			await fastForward(HOUR * 72 + 1);
			await royale.startRoyaleInASeason();

			await royale.takeAPosition(firstPassportId, 2, { from: first });
			await royale.takeAPosition(secondPassportId, 2, { from: second });
			await royale.takeAPosition(thirdPassportId, 2, { from: third });
			await royale.takeAPosition(fourthPassportId, 2, { from: fourth });
			await royale.takeAPosition(fifthPassportId, 2, { from: fifth });

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
				numberOfWinningPlayers: 5,
			});

			//#2
			await royale.takeAPosition(firstPassportId, 1, { from: first });
			await royale.takeAPosition(secondPassportId, 2, { from: second });
			await royale.takeAPosition(thirdPassportId, 2, { from: third });
			await royale.takeAPosition(fourthPassportId, 2, { from: fourth });
			await royale.takeAPosition(fifthPassportId, 2, { from: fifth });

			await passport.transferFrom(fifth, first, fifthPassportId, { from: fifth });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			//#3

			// first token not valid anymore
			assert.equal(await royale.isTokenAlive(firstPassportId), false);
			assert.equal(await royale.isTokenAlive(fifthPassportId), true);

			// revert bc first passport is not valid
			await expect(royale.takeAPosition(firstPassportId, 2, { from: first })).to.be.revertedWith(
				'Token no longer valid'
			);
			await royale.takeAPosition(fifthPassportId, 2, { from: first });
			await royale.takeAPosition(secondPassportId, 2, { from: second });
			await royale.takeAPosition(thirdPassportId, 2, { from: third });
			await royale.takeAPosition(fourthPassportId, 2, { from: fourth });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			//#4
			await royale.takeAPosition(fifthPassportId, 2, { from: first });
			await royale.takeAPosition(secondPassportId, 2, { from: second });
			await royale.takeAPosition(thirdPassportId, 2, { from: third });
			await royale.takeAPosition(fourthPassportId, 2, { from: fourth });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			//#5
			await royale.takeAPosition(fifthPassportId, 2, { from: first });
			await royale.takeAPosition(secondPassportId, 2, { from: second });
			await royale.takeAPosition(thirdPassportId, 2, { from: third });
			await royale.takeAPosition(fourthPassportId, 2, { from: fourth });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			await MockPriceFeedDeployed.setPricetoReturn(1200);

			//#6
			await royale.takeAPosition(fifthPassportId, 2, { from: first });
			await royale.takeAPosition(secondPassportId, 2, { from: second });
			await royale.takeAPosition(thirdPassportId, 2, { from: third });
			await royale.takeAPosition(fourthPassportId, 1, { from: fourth });
			await fastForward(HOUR * 72 + 1);

			const tx_close_6 = await royale.closeRound();

			assert.eventEqual(tx_close_6.logs[0], 'RoundClosed', {
				season: season_1,
				round: 6,
				result: 2,
				strikePrice: 1100,
				finalPrice: 1200,
				numberOfEliminatedPlayers: 1,
				numberOfWinningPlayers: 3,
			});

			await MockPriceFeedDeployed.setPricetoReturn(1300);

			//#7
			await royale.takeAPosition(fifthPassportId, 2, { from: first });
			await royale.takeAPosition(secondPassportId, 2, { from: second });
			await royale.takeAPosition(thirdPassportId, 2, { from: third });
			await fastForward(HOUR * 72 + 1);
			const tx_close_7 = await royale.closeRound();

			assert.eventEqual(tx_close_7.logs[0], 'RoundClosed', {
				season: season_1,
				round: 7,
				result: 2,
				strikePrice: 1200,
				finalPrice: 1300,
				numberOfEliminatedPlayers: 0,
				numberOfWinningPlayers: 3,
			});

			// owner is first player
			let isTokenFifthAlive = await royale.isTokenAlive(fifthPassportId);

			assert.equal(true, isTokenFifthAlive);

			await expect(royale.closeRound()).to.be.revertedWith('Competition finished');
		});

		it('win till the end and check results ', async () => {
			await royale.startNewSeason({ from: owner });
			await royale.signUp({ from: first });
			await royale.signUp({ from: second });
			await royale.signUp({ from: third });
			await royale.signUp({ from: fourth });

			const firstPassportId = 1;
			const secondPassportId = 2;
			const thirdPassportId = 3;
			const fourthPassportId = 4;

			await fastForward(HOUR * 72 + 1);
			await royale.startRoyaleInASeason();

			let totalTokensInARound = await royale.totalTokensPerRoundPerSeason(season_1, 1);
			// equal to total number of players
			assert.equal(4, totalTokensInARound);

			let eliminatedTokensInARound = await royale.eliminatedPerRoundPerSeason(season_1, 1);
			// zero round need to be finished
			assert.equal(0, eliminatedTokensInARound);

			await royale.takeAPosition(firstPassportId, 2, { from: first });
			await royale.takeAPosition(secondPassportId, 2, { from: second });
			await royale.takeAPosition(thirdPassportId, 2, { from: third });
			await royale.takeAPosition(fourthPassportId, 2, { from: fourth });

			await MockPriceFeedDeployed.setPricetoReturn(1100);

			//#1
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let totalTokensInARound2 = await royale.totalTokensPerRoundPerSeason(season_1, 2);
			// equal to total number of players
			assert.equal(4, totalTokensInARound2);

			let eliminatedTokensInARound1 = await royale.eliminatedPerRoundPerSeason(season_1, 1);
			// zero - all players are good
			assert.equal(0, eliminatedTokensInARound1);

			//#2
			await royale.takeAPosition(firstPassportId, 2, { from: first });
			await royale.takeAPosition(secondPassportId, 2, { from: second });
			await royale.takeAPosition(thirdPassportId, 2, { from: third });
			await royale.takeAPosition(fourthPassportId, 1, { from: fourth });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let totalTokensInARound3 = await royale.totalTokensPerRoundPerSeason(season_1, 3);
			// equal to three
			assert.equal(3, totalTokensInARound3);

			let eliminatedTokensInARound2 = await royale.eliminatedPerRoundPerSeason(season_1, 2);
			// one player eliminated
			assert.equal(1, eliminatedTokensInARound2);

			//#3
			await royale.takeAPosition(firstPassportId, 2, { from: first });
			await royale.takeAPosition(secondPassportId, 2, { from: second });
			await royale.takeAPosition(thirdPassportId, 1, { from: third });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let totalTokensInARound4 = await royale.totalTokensPerRoundPerSeason(season_1, 4);
			// equal to two
			assert.equal(2, totalTokensInARound4);

			let eliminatedTokensInARound3 = await royale.eliminatedPerRoundPerSeason(season_1, 3);
			// one player eliminated
			assert.equal(1, eliminatedTokensInARound3);

			//#4
			await royale.takeAPosition(firstPassportId, 2, { from: first });
			await royale.takeAPosition(secondPassportId, 2, { from: second });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let totalTokensInARound5 = await royale.totalTokensPerRoundPerSeason(season_1, 5);
			// equal to two
			assert.equal(2, totalTokensInARound5);

			let eliminatedTokensInARound4 = await royale.eliminatedPerRoundPerSeason(season_1, 4);
			// zero - all players are good
			assert.equal(0, eliminatedTokensInARound4);

			//#5
			await royale.takeAPosition(firstPassportId, 2, { from: first });
			await royale.takeAPosition(secondPassportId, 2, { from: second });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let totalTokensInARound6 = await royale.totalTokensPerRoundPerSeason(season_1, 6);
			// equal to two
			assert.equal(2, totalTokensInARound6);

			let eliminatedTokensInARound5 = await royale.eliminatedPerRoundPerSeason(season_1, 5);
			// zero - all players are good
			assert.equal(0, eliminatedTokensInARound5);

			//#6
			await royale.takeAPosition(firstPassportId, 2, { from: first });
			await royale.takeAPosition(secondPassportId, 2, { from: second });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let totalTokensInARound7 = await royale.totalTokensPerRoundPerSeason(season_1, 7);
			// equal to two
			assert.equal(2, totalTokensInARound7);

			let eliminatedTokensInARound6 = await royale.eliminatedPerRoundPerSeason(season_1, 6);
			// zero - all players are good
			assert.equal(0, eliminatedTokensInARound6);

			//#7
			await royale.takeAPosition(firstPassportId, 2, { from: first });
			await royale.takeAPosition(secondPassportId, 1, { from: second });
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let eliminatedTokensInARound7 = await royale.eliminatedPerRoundPerSeason(season_1, 7);
			// one player eliminated
			assert.equal(1, eliminatedTokensInARound7);

			let isTokenFirstAlive = await royale.isTokenAlive(firstPassportId);
			let isTokenSecondAlive = await royale.isTokenAlive(secondPassportId);
			let isTokenThirdAlive = await royale.isTokenAlive(thirdPassportId);
			let isTokenFourthAlive = await royale.isTokenAlive(fourthPassportId);

			assert.equal(true, isTokenFirstAlive);
			assert.equal(false, isTokenSecondAlive);
			assert.equal(false, isTokenThirdAlive);
			assert.equal(false, isTokenFourthAlive);

			// check to be zero (don't exist)
			let totalTokensInARound8 = await royale.totalTokensPerRoundPerSeason(season_1, 8);
			let eliminatedTokensInARound8 = await royale.eliminatedPerRoundPerSeason(season_1, 8);
			assert.equal(0, totalTokensInARound8);
			assert.equal(0, eliminatedTokensInARound8);

			await expect(royale.closeRound()).to.be.revertedWith('Competition finished');
		});

		it('check the changing positions require to send different one', async () => {
			await royale.startNewSeason({ from: owner });

			await royale.signUp({ from: first });
			await royale.signUp({ from: second });

			const firstPassportId = 1;

			await fastForward(HOUR * 72 + 1);
			await royale.startRoyaleInASeason();

			let totalTokensInARound = await royale.totalTokensPerRoundPerSeason(season_1, 1);
			assert.equal(2, totalTokensInARound);

			await royale.takeAPosition(firstPassportId, 2, { from: first });

			await expect(royale.takeAPosition(firstPassportId, 2, { from: first })).to.be.revertedWith(
				'Same position'
			);
		});

		it('check if can start royale', async () => {
			await royale.startNewSeason({ from: owner });

			await royale.signUp({ from: first });
			await royale.signUp({ from: second });

			const firstPassportId = 1;
			const secondPassportId = 2;

			let canStartFalse = await royale.canStartRoyale();
			assert.equal(false, canStartFalse);

			await fastForward(HOUR * 72 + 1);

			let canStartTrue = await royale.canStartRoyale();
			assert.equal(true, canStartTrue);

			await royale.startRoyaleInASeason();

			await royale.takeAPosition(firstPassportId, 2, { from: first });
			await royale.takeAPosition(secondPassportId, 2, { from: second });

			let canStartFalseAlreadyStarted = await royale.canStartRoyale();
			assert.equal(false, canStartFalseAlreadyStarted);

			await MockPriceFeedDeployed.setPricetoReturn(1100);

			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let canStartFalseAfterClose = await royale.canStartRoyale();
			assert.equal(false, canStartFalseAfterClose);

			let hasParticipatedInCurrentOrLastRoyale = await royale.hasParticipatedInCurrentOrLastRoyale(
				first
			);
			assert.equal(hasParticipatedInCurrentOrLastRoyale, true);
		});

		it('check the changing positions ', async () => {
			await royale.startNewSeason({ from: owner });
			await royale.signUp({ from: first });
			await royale.signUp({ from: second });
			await royale.signUp({ from: third });
			await royale.signUp({ from: fourth });

			const firstPassportId = 1;
			const secondPassportId = 2;
			const thirdPassportId = 3;
			const fourthPassportId = 4;

			await fastForward(HOUR * 72 + 1);
			await royale.startRoyaleInASeason();

			let totalTokensInARound = await royale.totalTokensPerRoundPerSeason(season_1, 1);
			// equal to total number of players
			assert.equal(4, totalTokensInARound);

			let eliminatedTokensInARound = await royale.eliminatedPerRoundPerSeason(season_1, 1);
			// zero round need to be finished
			assert.equal(0, eliminatedTokensInARound);

			let postions1InRound1_before = await royale.positionsPerRoundPerSeason(season_1, 1, 1);
			let postions2InRound1_before = await royale.positionsPerRoundPerSeason(season_1, 1, 2);
			assert.equal(0, postions1InRound1_before);
			assert.equal(0, postions2InRound1_before);

			await royale.takeAPosition(firstPassportId, 2, { from: first });
			await royale.takeAPosition(secondPassportId, 2, { from: second });
			await royale.takeAPosition(firstPassportId, 1, { from: first });
			// 3
			await royale.takeAPosition(thirdPassportId, 2, { from: third });
			await royale.takeAPosition(fourthPassportId, 1, { from: fourth });
			await royale.takeAPosition(firstPassportId, 2, { from: first });
			// 1
			await royale.takeAPosition(firstPassportId, 1, { from: first });
			await royale.takeAPosition(fourthPassportId, 2, { from: fourth });
			await royale.takeAPosition(secondPassportId, 1, { from: second });
			// 2
			await royale.takeAPosition(secondPassportId, 2, { from: second });
			// 4
			await royale.takeAPosition(fourthPassportId, 1, { from: fourth });

			await MockPriceFeedDeployed.setPricetoReturn(1100);

			let postions1InRound1_after = await royale.positionsPerRoundPerSeason(season_1, 1, 1);
			let postions2InRound1_after = await royale.positionsPerRoundPerSeason(season_1, 1, 2);
			assert.equal(2, postions1InRound1_after);
			assert.equal(2, postions2InRound1_after);

			//#1
			await fastForward(HOUR * 72 + 1);
			await royale.closeRound();

			let totalTokensInARound2 = await royale.totalTokensPerRoundPerSeason(season_1, 2);
			// equal to total number of players
			assert.equal(2, totalTokensInARound2);

			let eliminatedTokensInARound1 = await royale.eliminatedPerRoundPerSeason(season_1, 1);
			// zero - all players are good
			assert.equal(2, eliminatedTokensInARound1);

			let postions1InRound1_after_close = await royale.positionsPerRoundPerSeason(season_1, 1, 1);
			let postions2InRound1_after_close = await royale.positionsPerRoundPerSeason(season_1, 1, 2);
			assert.equal(2, postions1InRound1_after_close);
			assert.equal(2, postions2InRound1_after_close);

			let isTokenFirstAlive = await royale.isTokenAlive(firstPassportId);
			let isTokenSecondAlive = await royale.isTokenAlive(secondPassportId);
			let isTokenThirdAlive = await royale.isTokenAlive(thirdPassportId);
			let isTokenFourthAlive = await royale.isTokenAlive(fourthPassportId);

			assert.equal(false, isTokenFirstAlive);
			assert.equal(true, isTokenSecondAlive);
			assert.equal(true, isTokenThirdAlive);
			assert.equal(false, isTokenFourthAlive);

			//#2
			//before checking
			let postions1InRound2_before_start = await royale.positionsPerRoundPerSeason(season_1, 2, 1);
			let postions2InRound2_before_start = await royale.positionsPerRoundPerSeason(season_1, 2, 2);
			assert.equal(0, postions1InRound2_before_start);
			assert.equal(0, postions2InRound2_before_start);

			await royale.takeAPosition(secondPassportId, 2, { from: second });
			await royale.takeAPosition(thirdPassportId, 2, { from: third });
			await royale.takeAPosition(secondPassportId, 1, { from: second });
			await royale.takeAPosition(secondPassportId, 2, { from: second });
			await royale.takeAPosition(thirdPassportId, 1, { from: third });
			await royale.takeAPosition(secondPassportId, 1, { from: second });
			await royale.takeAPosition(secondPassportId, 2, { from: second });
			await royale.takeAPosition(thirdPassportId, 2, { from: third });

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

			let isTokenFirstAliveRound2 = await royale.isTokenAlive(firstPassportId);
			let isTokenSecondAliveRound2 = await royale.isTokenAlive(secondPassportId);
			let isTokenThirdAliveRound2 = await royale.isTokenAlive(thirdPassportId);
			let isTokenFourthAliveRound2 = await royale.isTokenAlive(fourthPassportId);

			assert.equal(false, isTokenFirstAliveRound2);
			assert.equal(true, isTokenSecondAliveRound2);
			assert.equal(true, isTokenThirdAliveRound2);
			assert.equal(false, isTokenFourthAliveRound2);

			//#3
			//before checking
			let postions1InRound3_before_start = await royale.positionsPerRoundPerSeason(season_1, 3, 1);
			let postions2InRound3_before_start = await royale.positionsPerRoundPerSeason(season_1, 3, 2);
			assert.equal(0, postions1InRound3_before_start);
			assert.equal(0, postions2InRound3_before_start);

			await royale.takeAPosition(secondPassportId, 2, { from: second });
			await royale.takeAPosition(thirdPassportId, 2, { from: third });
			await royale.takeAPosition(secondPassportId, 1, { from: second });
			await royale.takeAPosition(secondPassportId, 2, { from: second });
			await royale.takeAPosition(thirdPassportId, 1, { from: third });
			await royale.takeAPosition(secondPassportId, 1, { from: second });

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

			let isTokenFirstAliveRound3 = await royale.isTokenAlive(firstPassportId);
			let isTokenSecondAliveRound3 = await royale.isTokenAlive(secondPassportId);
			let isTokenThirdAliveRound3 = await royale.isTokenAlive(thirdPassportId);
			let isTokenFourthAliveRound3 = await royale.isTokenAlive(fourthPassportId);

			assert.equal(false, isTokenFirstAliveRound3);
			assert.equal(true, isTokenSecondAliveRound3);
			assert.equal(true, isTokenThirdAliveRound3);
			assert.equal(false, isTokenFourthAliveRound3);

			await expect(royale.takeAPosition(firstPassportId, 2, { from: first })).to.be.revertedWith(
				'Competition finished'
			);

			let canStartFalseAfterFinish = await royale.canStartRoyale();
			assert.equal(false, canStartFalseAfterFinish);

			let rewardPerPlayer = await royale.rewardPerWinnerPerSeason(season_1);
			// 10.000 -> two winners 5.000
			assert.bnEqual(rewardPerPlayer, toUnit(5000));

			// check if player with token which not win can collect
			await expect(
				royale.claimRewardForSeason(season_1, firstPassportId, { from: first })
			).to.be.revertedWith('Token is not alive');

			// check if non owner player with token which win can collect
			await expect(
				royale.claimRewardForSeason(season_1, secondPassportId, { from: first })
			).to.be.revertedWith('Not an owner');

			// check if player which not win can collect
			await expect(
				royale.claimRewardForSeason(season_1, fourthPassportId, { from: fourth })
			).to.be.revertedWith('Token is not alive');

			let isPlayerOneClaimedReward_before = await royale.tokenRewardCollectedPerSeason(
				thirdPassportId
			);
			assert.equal(false, isPlayerOneClaimedReward_before);

			const tx = await royale.claimRewardForSeason(season_1, thirdPassportId, { from: third });

			// check if event is emited
			assert.eventEqual(tx.logs[0], 'RewardClaimedPassport', {
				season: season_1,
				winner: third,
				tokenId: thirdPassportId,
				reward: toUnit(5000),
			});

			let isPlayerOneClaimedReward_after = await royale.tokenRewardCollectedPerSeason(
				thirdPassportId
			);
			assert.equal(true, isPlayerOneClaimedReward_after);

			const tx1 = await royale.claimRewardForSeason(season_1, secondPassportId, { from: second });

			// check if event is emited
			assert.eventEqual(tx1.logs[0], 'RewardClaimedPassport', {
				season: season_1,
				winner: second,
				tokenId: secondPassportId,
				reward: toUnit(5000),
			});
		});
	});

	it('Win and collect reward ', async () => {
		await royale.startNewSeason({ from: owner });

		// check rewards
		let reward = await royale.rewardPerSeason(season_1);
		assert.bnEqual(reward, toUnit(0));

		await royale.signUp({ from: first });
		await royale.signUp({ from: second });
		await royale.signUp({ from: third });
		await royale.signUp({ from: fourth });

		const firstPassportId = 1;
		const secondPassportId = 2;
		const thirdPassportId = 3;
		const fourthPassportId = 4;

		await fastForward(HOUR * 72 + 1);
		await royale.startRoyaleInASeason();

		await royale.takeAPosition(firstPassportId, 2, { from: first });
		await royale.takeAPosition(secondPassportId, 2, { from: second });
		await royale.takeAPosition(thirdPassportId, 2, { from: third });
		await royale.takeAPosition(fourthPassportId, 2, { from: fourth });

		await MockPriceFeedDeployed.setPricetoReturn(1100);

		//#1
		await fastForward(HOUR * 72 + 1);
		await royale.closeRound();

		//#2
		await royale.takeAPosition(firstPassportId, 2, { from: first });
		await royale.takeAPosition(secondPassportId, 2, { from: second });
		await royale.takeAPosition(thirdPassportId, 2, { from: third });
		await royale.takeAPosition(fourthPassportId, 2, { from: fourth });
		await fastForward(HOUR * 72 + 1);
		await royale.closeRound();

		//#3
		await royale.takeAPosition(firstPassportId, 2, { from: first });
		await royale.takeAPosition(secondPassportId, 2, { from: second });
		await royale.takeAPosition(thirdPassportId, 2, { from: third });
		await royale.takeAPosition(fourthPassportId, 2, { from: fourth });
		await fastForward(HOUR * 72 + 1);
		await royale.closeRound();

		//#4
		await royale.takeAPosition(firstPassportId, 2, { from: first });
		await royale.takeAPosition(secondPassportId, 2, { from: second });
		await royale.takeAPosition(thirdPassportId, 2, { from: third });
		await royale.takeAPosition(fourthPassportId, 2, { from: fourth });
		await fastForward(HOUR * 72 + 1);
		await royale.closeRound();

		//#5
		await royale.takeAPosition(firstPassportId, 2, { from: first });
		await royale.takeAPosition(secondPassportId, 2, { from: second });
		await royale.takeAPosition(thirdPassportId, 2, { from: third });
		await royale.takeAPosition(fourthPassportId, 2, { from: fourth });
		await fastForward(HOUR * 72 + 1);
		await royale.closeRound();

		await expect(royale.startNewSeason({ from: owner })).to.be.revertedWith(
			'Previous season must be finished'
		);

		//#6
		await royale.takeAPosition(firstPassportId, 2, { from: first });
		await royale.takeAPosition(secondPassportId, 2, { from: second });
		await royale.takeAPosition(thirdPassportId, 2, { from: third });
		await royale.takeAPosition(fourthPassportId, 1, { from: fourth });
		await fastForward(HOUR * 72 + 1);
		await royale.closeRound();

		// check if can collect rewards before royale ends
		await expect(
			royale.claimRewardForSeason(season_1, firstPassportId, { from: first })
		).to.be.revertedWith('Royale must be finished!');

		//#7
		await royale.takeAPosition(firstPassportId, 2, { from: first });
		await royale.takeAPosition(secondPassportId, 2, { from: second });
		await royale.takeAPosition(thirdPassportId, 1, { from: third });
		await fastForward(HOUR * 72 + 1);
		await royale.closeRound();

		let isTokenFirstAlive = await royale.isTokenAlive(firstPassportId);
		let isTokenSecondAlive = await royale.isTokenAlive(secondPassportId);
		let isTokenThirdAlive = await royale.isTokenAlive(thirdPassportId);
		let isTokenFourthAlive = await royale.isTokenAlive(fourthPassportId);

		assert.equal(true, isTokenFirstAlive);
		assert.equal(true, isTokenSecondAlive);
		assert.equal(false, isTokenThirdAlive);
		assert.equal(false, isTokenFourthAlive);

		let rewardPerToken = await royale.rewardPerWinnerPerSeason(season_1);
		// 10.000 -> two winner tokens 5.000
		assert.bnEqual(rewardPerToken, toUnit(5000));

		await expect(royale.closeRound()).to.be.revertedWith('Competition finished');

		// check if player which not win can collect
		await expect(
			royale.claimRewardForSeason(season_1, thirdPassportId, { from: third })
		).to.be.revertedWith('Token is not alive');

		let isTokenOneClaimedReward_before = await royale.tokenRewardCollectedPerSeason(
			firstPassportId
		);
		assert.equal(false, isTokenOneClaimedReward_before);

		const tx = await royale.claimRewardForSeason(season_1, firstPassportId, { from: first });

		// check if event is emited
		assert.eventEqual(tx.logs[0], 'RewardClaimedPassport', {
			season: season_1,
			winner: first,
			tokenId: firstPassportId,
			reward: toUnit(5000),
		});

		let isTokenOneClaimedReward_after = await royale.tokenRewardCollectedPerSeason(firstPassportId);
		assert.equal(isTokenOneClaimedReward_after, true);

		// check if player can collect two times
		await expect(
			royale.claimRewardForSeason(season_1, firstPassportId, { from: first })
		).to.be.revertedWith('Reward already collected');
	});

	it('Win and collect rewards and start new season ', async () => {
		await royale.startNewSeason({ from: owner });

		// check rewards
		let reward = await royale.rewardPerSeason(season_1);
		assert.bnEqual(reward, toUnit(0));

		await royale.signUp({ from: first });
		await royale.signUp({ from: second });
		await royale.signUp({ from: third });
		await royale.signUp({ from: fourth });
		await royale.signUp({ from: fifth });
		await royale.signUp({ from: sixth });
		await royale.signUp({ from: seventh });

		const firstPassportId = 1;
		const secondPassportId = 2;
		const thirdPassportId = 3;
		const fourthPassportId = 4;
		const fifthPassportId = 5;
		const sixthPassportId = 6;
		const seventhPassportId = 7;

		await fastForward(HOUR * 72 + 1);
		const trx = await royale.startRoyaleInASeason();

		// check if event is emited
		assert.eventEqual(trx.logs[0], 'RoyaleStarted', {
			season: season_1,
			totalTokens: 7,
			totalReward: toUnit(17500),
		});

		await royale.takeAPosition(firstPassportId, 2, { from: first });
		await royale.takeAPosition(secondPassportId, 2, { from: second });
		await royale.takeAPosition(thirdPassportId, 2, { from: third });
		await royale.takeAPosition(fourthPassportId, 2, { from: fourth });
		await royale.takeAPosition(fifthPassportId, 2, { from: fifth });
		await royale.takeAPosition(sixthPassportId, 2, { from: sixth });
		await royale.takeAPosition(seventhPassportId, 2, { from: seventh });

		await MockPriceFeedDeployed.setPricetoReturn(1100);

		//#1
		await fastForward(HOUR * 72 + 1);
		await royale.closeRound();

		//#2
		await royale.takeAPosition(firstPassportId, 1, { from: first });
		await royale.takeAPosition(secondPassportId, 2, { from: second });
		await royale.takeAPosition(thirdPassportId, 2, { from: third });
		await royale.takeAPosition(fourthPassportId, 2, { from: fourth });
		await royale.takeAPosition(fifthPassportId, 2, { from: fifth });
		await royale.takeAPosition(sixthPassportId, 2, { from: sixth });
		await royale.takeAPosition(seventhPassportId, 2, { from: seventh });

		// first will have 3 tokens #1 - dead, #5 - alive, #7 - alive
		// second will have 2 tokens #2 - alive, #6 - alive
		await passport.transferFrom(fifth, first, fifthPassportId, { from: fifth });
		await passport.transferFrom(seventh, first, seventhPassportId, { from: seventh });
		await passport.transferFrom(sixth, second, sixthPassportId, { from: sixth });

		await fastForward(HOUR * 72 + 1);
		await royale.closeRound();

		//#3
		assert.equal(await royale.isTokenAlive(firstPassportId), false);
		assert.equal(await royale.isTokenAlive(secondPassportId), true);

		await expect(royale.takeAPosition(firstPassportId, 2, { from: first })).to.be.revertedWith(
			'Token no longer valid'
		);

		await expect(royale.takeAPosition(fifthPassportId, 2, { from: fifth })).to.be.revertedWith(
			'Not an owner'
		);

		await expect(royale.takeAPosition(sixthPassportId, 2, { from: sixth })).to.be.revertedWith(
			'Not an owner'
		);

		// positions with multiple tokens
		await royale.takeAPosition(fifthPassportId, 2, { from: first });
		await royale.takeAPosition(seventhPassportId, 2, { from: first });

		await royale.takeAPosition(secondPassportId, 2, { from: second });
		await royale.takeAPosition(sixthPassportId, 2, { from: second });

		await royale.takeAPosition(thirdPassportId, 2, { from: third });
		await royale.takeAPosition(fourthPassportId, 2, { from: fourth });
		await fastForward(HOUR * 72 + 1);
		await royale.closeRound();

		//#4
		await royale.takeAPosition(fifthPassportId, 2, { from: first });
		await royale.takeAPosition(seventhPassportId, 2, { from: first });

		await royale.takeAPosition(secondPassportId, 2, { from: second });
		await royale.takeAPosition(sixthPassportId, 2, { from: second });

		await royale.takeAPosition(thirdPassportId, 2, { from: third });
		await royale.takeAPosition(fourthPassportId, 2, { from: fourth });
		await fastForward(HOUR * 72 + 1);
		await royale.closeRound();

		//#5
		await royale.takeAPosition(fifthPassportId, 2, { from: first });
		await royale.takeAPosition(seventhPassportId, 2, { from: first });

		await royale.takeAPosition(secondPassportId, 2, { from: second });
		await royale.takeAPosition(sixthPassportId, 2, { from: second });

		await royale.takeAPosition(thirdPassportId, 2, { from: third });
		await royale.takeAPosition(fourthPassportId, 2, { from: fourth });
		await fastForward(HOUR * 72 + 1);
		await royale.closeRound();

		await expect(royale.startNewSeason({ from: owner })).to.be.revertedWith(
			'Previous season must be finished'
		);

		//#6
		await royale.takeAPosition(fifthPassportId, 2, { from: first });
		await royale.takeAPosition(seventhPassportId, 2, { from: first });

		await royale.takeAPosition(secondPassportId, 2, { from: second });
		await royale.takeAPosition(sixthPassportId, 2, { from: second });

		await royale.takeAPosition(thirdPassportId, 2, { from: third });
		await royale.takeAPosition(fourthPassportId, 1, { from: fourth });
		await fastForward(HOUR * 72 + 1);
		await royale.closeRound();

		// check if can collect rewards before royale ends
		await expect(
			royale.claimRewardForSeason(season_1, fifthPassportId, { from: first })
		).to.be.revertedWith('Royale must be finished!');

		//#7
		await royale.takeAPosition(fifthPassportId, 2, { from: first });
		await royale.takeAPosition(seventhPassportId, 2, { from: first });

		await royale.takeAPosition(secondPassportId, 2, { from: second });
		await royale.takeAPosition(sixthPassportId, 2, { from: second });

		await royale.takeAPosition(thirdPassportId, 1, { from: third });
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
			numberOfWinners: 4,
			rewardPerWinner: toUnit(4375),
		});

		let isTokenFirstAlive = await royale.isTokenAlive(firstPassportId);
		let isTokenSecondAlive = await royale.isTokenAlive(secondPassportId);
		let isTokenThirdAlive = await royale.isTokenAlive(thirdPassportId);
		let isTokenFourthAlive = await royale.isTokenAlive(fourthPassportId);
		let isTokenFifthAlive = await royale.isTokenAlive(fifthPassportId);
		let isTokenSixthAlive = await royale.isTokenAlive(sixthPassportId);
		let isTokenSeventhAlive = await royale.isTokenAlive(seventhPassportId);

		assert.equal(false, isTokenFirstAlive);
		assert.equal(true, isTokenSecondAlive);
		assert.equal(false, isTokenThirdAlive);
		assert.equal(false, isTokenFourthAlive);
		assert.equal(true, isTokenFifthAlive);
		assert.equal(true, isTokenSixthAlive);
		assert.equal(true, isTokenSeventhAlive);

		let rewardPerPlayer = await royale.rewardPerWinnerPerSeason(season_1);
		// 17.500 -> four token winners 4.375
		assert.bnEqual(rewardPerPlayer, toUnit(4375));

		await expect(royale.closeRound()).to.be.revertedWith('Competition finished');

		// check if player which not win can collect
		await expect(
			royale.claimRewardForSeason(season_1, thirdPassportId, { from: third })
		).to.be.revertedWith('Token is not alive');

		// check if winner player with token which not win can collect
		await expect(
			royale.claimRewardForSeason(season_1, firstPassportId, { from: first })
		).to.be.revertedWith('Token is not alive');

		// #2, #5, #6, #7 - winner tokens
		// #2, #1, #2, #1 - winner players
		let isToken2ClaimedReward_before = await royale.tokenRewardCollectedPerSeason(secondPassportId);
		assert.equal(false, isToken2ClaimedReward_before);

		const tx = await royale.claimRewardForSeason(season_1, secondPassportId, { from: second });

		// check if event is emited
		assert.eventEqual(tx.logs[0], 'RewardClaimedPassport', {
			season: season_1,
			winner: second,
			tokenId: secondPassportId,
			reward: toUnit(4375),
		});

		let isToken2ClaimedReward_after = await royale.tokenRewardCollectedPerSeason(secondPassportId);
		assert.equal(isToken2ClaimedReward_after, true);

		let isToken6ClaimedReward_before = await royale.tokenRewardCollectedPerSeason(sixthPassportId);
		assert.equal(false, isToken6ClaimedReward_before);

		const tx_sixthPassportId = await royale.claimRewardForSeason(season_1, sixthPassportId, {
			from: second,
		});

		// check if event is emited
		assert.eventEqual(tx_sixthPassportId.logs[0], 'RewardClaimedPassport', {
			season: season_1,
			winner: second,
			tokenId: sixthPassportId,
			reward: toUnit(4375),
		});

		let isToken6ClaimedReward_after = await royale.tokenRewardCollectedPerSeason(sixthPassportId);
		assert.equal(isToken6ClaimedReward_after, true);

		// check if player can collect two times
		await expect(
			royale.claimRewardForSeason(season_1, secondPassportId, { from: second })
		).to.be.revertedWith('Reward already collected');

		await expect(
			royale.claimRewardForSeason(season_1, sixthPassportId, { from: second })
		).to.be.revertedWith('Reward already collected');

		// check if different then owner can start season
		await expect(royale.startNewSeason({ from: first })).to.be.revertedWith(
			'Only owner can start season before pause between two seasons'
		);

		// check if player can collect ex season
		await expect(
			royale.claimRewardForSeason(season_1, secondPassportId, { from: second })
		).to.be.revertedWith('Reward already collected');

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
			season: season_2,
		});

		// season updated
		let s2 = await royale.season();
		assert.bnEqual(season_2, s2);

		let hasParticipatedInCurrentOrLastRoyale = await royale.hasParticipatedInCurrentOrLastRoyale(
			first
		);
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
		await ThalesDeployed.transfer(fifth, toUnit(2500), { from: owner });
		await ThalesDeployed.approve(royale.address, toUnit(2500), { from: fifth });
		await ThalesDeployed.transfer(sixth, toUnit(2500), { from: owner });
		await ThalesDeployed.approve(royale.address, toUnit(2500), { from: sixth });
		await ThalesDeployed.transfer(seventh, toUnit(2500), { from: owner });
		await ThalesDeployed.approve(royale.address, toUnit(2500), { from: seventh });

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
		await royale.signUp({ from: fifth });
		await royale.signUp({ from: sixth });
		await royale.signUp({ from: seventh });

		const firstPassportIdSeason2 = 8;
		const secondPassportIdSeason2 = 9;
		const thirdPassportIdSeason2 = 10;
		const fourthPassportIdSeason2 = 11;
		const fifthPassportIdSeason2 = 12;
		const sixthPassportIdSeason2 = 13;
		const seventhPassportIdSeason2 = 14;

		let reward_s2_aftersignup = await royale.rewardPerSeason(season_2);
		assert.bnEqual(reward_s2_aftersignup, toUnit(27500));

		await fastForward(HOUR * 72 + 1);
		await royale.startRoyaleInASeason();

		await royale.takeAPosition(firstPassportIdSeason2, 2, { from: first });
		await royale.takeAPosition(secondPassportIdSeason2, 2, { from: second });
		await royale.takeAPosition(secondPassportIdSeason2, 1, { from: second });
		await royale.takeAPosition(secondPassportIdSeason2, 2, { from: second });
		await royale.takeAPosition(thirdPassportIdSeason2, 2, { from: third });
		await royale.takeAPosition(fourthPassportIdSeason2, 2, { from: fourth });
		await royale.takeAPosition(fifthPassportIdSeason2, 2, { from: fifth });
		await royale.takeAPosition(sixthPassportIdSeason2, 2, { from: sixth });
		await royale.takeAPosition(seventhPassportIdSeason2, 2, { from: seventh });

		await MockPriceFeedDeployed.setPricetoReturn(1100);

		//#1
		await fastForward(HOUR * 72 + 1);
		await royale.closeRound();

		const positions = await royale.getTokenPositions(sixthPassportIdSeason2);
		//console.log('positions', positions[0]);
		// fetch token uri
		const tokenURI1 = await passport.tokenURI(sixthPassportIdSeason2);
		//console.log(tokenURI1);

		//#2
		await royale.takeAPosition(firstPassportIdSeason2, 1, { from: first });
		await royale.takeAPosition(secondPassportIdSeason2, 2, { from: second });
		await royale.takeAPosition(thirdPassportIdSeason2, 2, { from: third });
		await royale.takeAPosition(fourthPassportIdSeason2, 2, { from: fourth });
		await royale.takeAPosition(fifthPassportIdSeason2, 2, { from: fifth });
		await royale.takeAPosition(sixthPassportIdSeason2, 2, { from: sixth });
		await royale.takeAPosition(seventhPassportIdSeason2, 2, { from: seventh });

		await passport.transferFrom(fifth, first, fifthPassportIdSeason2, { from: fifth });
		await passport.transferFrom(sixth, first, sixthPassportIdSeason2, { from: sixth });
		await passport.transferFrom(seventh, first, seventhPassportIdSeason2, { from: seventh });
		// player first tokens: #8 - dead, #12 - alive, #13 - alive, #14 - alive

		await fastForward(HOUR * 72 + 1);
		await royale.closeRound();

		//#3

		await royale.takeAPosition(fifthPassportIdSeason2, 2, { from: first });
		await royale.takeAPosition(sixthPassportIdSeason2, 2, { from: first });
		await royale.takeAPosition(seventhPassportIdSeason2, 2, { from: first });

		await royale.takeAPosition(secondPassportIdSeason2, 2, { from: second });
		await royale.takeAPosition(thirdPassportIdSeason2, 2, { from: third });
		await royale.takeAPosition(fourthPassportIdSeason2, 2, { from: fourth });
		await fastForward(HOUR * 72 + 1);
		await royale.closeRound();

		//#4
		await royale.takeAPosition(fifthPassportIdSeason2, 2, { from: first });
		await royale.takeAPosition(sixthPassportIdSeason2, 2, { from: first });
		await royale.takeAPosition(seventhPassportIdSeason2, 2, { from: first });

		await royale.takeAPosition(secondPassportIdSeason2, 2, { from: second });
		await royale.takeAPosition(thirdPassportIdSeason2, 2, { from: third });
		await royale.takeAPosition(fourthPassportIdSeason2, 2, { from: fourth });
		await fastForward(HOUR * 72 + 1);
		await royale.closeRound();

		//#5
		await royale.takeAPosition(fifthPassportIdSeason2, 2, { from: first });
		await royale.takeAPosition(sixthPassportIdSeason2, 2, { from: first });
		await royale.takeAPosition(seventhPassportIdSeason2, 2, { from: first });

		await royale.takeAPosition(secondPassportIdSeason2, 2, { from: second });
		await royale.takeAPosition(thirdPassportIdSeason2, 2, { from: third });
		await royale.takeAPosition(fourthPassportIdSeason2, 2, { from: fourth });
		await fastForward(HOUR * 72 + 1);
		await royale.closeRound();

		await expect(royale.startNewSeason({ from: owner })).to.be.revertedWith(
			'Previous season must be finished'
		);

		//#6
		await royale.takeAPosition(fifthPassportIdSeason2, 2, { from: first });
		await royale.takeAPosition(sixthPassportIdSeason2, 2, { from: first });
		await royale.takeAPosition(sixthPassportIdSeason2, 1, { from: first });
		await royale.takeAPosition(sixthPassportIdSeason2, 2, { from: first });
		await royale.takeAPosition(seventhPassportIdSeason2, 2, { from: first });

		await royale.takeAPosition(secondPassportIdSeason2, 2, { from: second });
		await royale.takeAPosition(thirdPassportIdSeason2, 2, { from: third });
		await royale.takeAPosition(fourthPassportIdSeason2, 1, { from: fourth });
		await fastForward(HOUR * 72 + 1);
		await royale.closeRound();

		// check if can collect rewards before royale ends
		await expect(
			royale.claimRewardForSeason(season_2, fifthPassportIdSeason2, { from: first })
		).to.be.revertedWith('Royale must be finished!');

		//#7
		await royale.takeAPosition(fifthPassportIdSeason2, 2, { from: first });
		await royale.takeAPosition(sixthPassportIdSeason2, 2, { from: first });
		await royale.takeAPosition(seventhPassportIdSeason2, 1, { from: first });

		await royale.takeAPosition(secondPassportIdSeason2, 1, { from: second });
		await royale.takeAPosition(thirdPassportIdSeason2, 1, { from: third });
		await fastForward(HOUR * 72 + 1);
		await royale.closeRound();

		let isTokenFirstAlive_s2 = await royale.isTokenAlive(firstPassportIdSeason2);
		let isTokenSecondAlives_2 = await royale.isTokenAlive(secondPassportIdSeason2);
		let isTokenThirdAlive_s2 = await royale.isTokenAlive(thirdPassportIdSeason2);
		let isTokenFourthAlive_s2 = await royale.isTokenAlive(fourthPassportIdSeason2);
		let isTokenFifthAlive_s2 = await royale.isTokenAlive(fifthPassportIdSeason2);
		let isTokenSixthAlive_s2 = await royale.isTokenAlive(sixthPassportIdSeason2);
		let isTokenSeventhAlive_s2 = await royale.isTokenAlive(seventhPassportIdSeason2);

		// only #1 player tokens are alive
		assert.equal(false, isTokenFirstAlive_s2);
		assert.equal(false, isTokenSecondAlives_2);
		assert.equal(false, isTokenThirdAlive_s2);
		assert.equal(false, isTokenFourthAlive_s2);
		assert.equal(true, isTokenFifthAlive_s2);
		assert.equal(true, isTokenSixthAlive_s2);
		assert.equal(false, isTokenSeventhAlive_s2);

		let rewardPerPlayer_s2 = await royale.rewardPerWinnerPerSeason(season_2);
		assert.bnEqual(rewardPerPlayer_s2, toUnit(13750));

		await expect(royale.closeRound()).to.be.revertedWith('Competition finished');

		// check if player which not win can collect
		await expect(
			royale.claimRewardForSeason(season_2, thirdPassportId, { from: third })
		).to.be.revertedWith('Token is not alive');

		let isToken5ClaimedReward_before_s2 = await royale.tokenRewardCollectedPerSeason(
			fifthPassportIdSeason2
		);
		assert.equal(false, isToken5ClaimedReward_before_s2);

		const tx_s2 = await royale.claimRewardForSeason(season_2, fifthPassportIdSeason2, {
			from: first,
		});

		// check if event is emited
		assert.eventEqual(tx_s2.logs[0], 'RewardClaimedPassport', {
			season: season_2,
			winner: first,
			tokenId: fifthPassportIdSeason2,
			reward: toUnit(13750),
		});

		let isToken5ClaimedReward_after_s2 = await royale.tokenRewardCollectedPerSeason(
			fifthPassportIdSeason2
		);
		assert.equal(isToken5ClaimedReward_after_s2, true);

		let isToken6ClaimedReward_before_s2 = await royale.tokenRewardCollectedPerSeason(
			sixthPassportIdSeason2
		);
		assert.equal(false, isToken6ClaimedReward_before_s2);

		const tx_s2_token6 = await royale.claimRewardForSeason(season_2, sixthPassportIdSeason2, {
			from: first,
		});

		// check if event is emited
		assert.eventEqual(tx_s2_token6.logs[0], 'RewardClaimedPassport', {
			season: season_2,
			winner: first,
			tokenId: sixthPassportIdSeason2,
			reward: toUnit(13750),
		});

		let isToken6ClaimedReward_after_s2 = await royale.tokenRewardCollectedPerSeason(
			sixthPassportIdSeason2
		);
		assert.equal(isToken6ClaimedReward_after_s2, true);

		// check if player can collect two times
		await expect(
			royale.claimRewardForSeason(season_2, sixthPassportIdSeason2, { from: first })
		).to.be.revertedWith('Reward already collected');

		// check if player can collect two times
		await expect(
			royale.claimRewardForSeason(season_2, fifthPassportIdSeason2, { from: first })
		).to.be.revertedWith('Reward already collected');

		// check if player can collect two times
		await expect(
			royale.claimRewardForSeason(season_2, secondPassportIdSeason2, { from: second })
		).to.be.revertedWith('Token is not alive');

		//console.log('finished', await royale.seasonFinished(season_2));

		// fetch token uri
		const tokenURI = await passport.tokenURI(sixthPassportIdSeason2);
		//console.log(tokenURI);
		const metadata = extractJSONFromURI(tokenURI);

		assert.equal(metadata.name, 'Thales Royale Passport');
		assert.equal(metadata.description, 'Thales Royale Passport - season 2');
	});

	it('Two players take loosing positions no one left but they can collect and they are winners ', async () => {
		await royale.startNewSeason({ from: owner });

		// check rewards
		let reward = await royale.rewardPerSeason(season_1);
		assert.bnEqual(reward, toUnit(0));

		await royale.signUp({ from: first });
		await royale.signUp({ from: second });
		await royale.signUp({ from: third });
		await royale.signUp({ from: fourth });

		const firstPassportId = 1;
		const secondPassportId = 2;
		const thirdPassportId = 3;
		const fourthPassportId = 4;

		await fastForward(HOUR * 72 + 1);
		await royale.startRoyaleInASeason();

		await royale.takeAPosition(firstPassportId, 2, { from: first });
		await royale.takeAPosition(secondPassportId, 2, { from: second });
		await royale.takeAPosition(thirdPassportId, 2, { from: third });
		await royale.takeAPosition(fourthPassportId, 2, { from: fourth });

		await MockPriceFeedDeployed.setPricetoReturn(1100);

		//#1
		await fastForward(HOUR * 72 + 1);
		await royale.closeRound();

		//#2
		await royale.takeAPosition(firstPassportId, 2, { from: first });
		await royale.takeAPosition(secondPassportId, 2, { from: second });
		await royale.takeAPosition(thirdPassportId, 2, { from: third });
		await royale.takeAPosition(fourthPassportId, 2, { from: fourth });
		await fastForward(HOUR * 72 + 1);
		await royale.closeRound();

		//#3
		await royale.takeAPosition(firstPassportId, 2, { from: first });
		await royale.takeAPosition(secondPassportId, 2, { from: second });
		await royale.takeAPosition(thirdPassportId, 2, { from: third });
		await royale.takeAPosition(fourthPassportId, 2, { from: fourth });
		await fastForward(HOUR * 72 + 1);
		await royale.closeRound();

		//#4
		await royale.takeAPosition(firstPassportId, 2, { from: first });
		await royale.takeAPosition(secondPassportId, 2, { from: second });
		await royale.takeAPosition(thirdPassportId, 2, { from: third });
		await royale.takeAPosition(fourthPassportId, 2, { from: fourth });
		await fastForward(HOUR * 72 + 1);
		await royale.closeRound();

		//#5
		await royale.takeAPosition(firstPassportId, 2, { from: first });
		await royale.takeAPosition(secondPassportId, 2, { from: second });
		await royale.takeAPosition(thirdPassportId, 2, { from: third });
		await royale.takeAPosition(fourthPassportId, 2, { from: fourth });
		await fastForward(HOUR * 72 + 1);
		await royale.closeRound();

		await expect(royale.startNewSeason({ from: owner })).to.be.revertedWith(
			'Previous season must be finished'
		);

		//#6
		await royale.takeAPosition(firstPassportId, 2, { from: first });
		await royale.takeAPosition(secondPassportId, 2, { from: second });
		await royale.takeAPosition(thirdPassportId, 1, { from: third });
		await royale.takeAPosition(fourthPassportId, 1, { from: fourth });
		await fastForward(HOUR * 72 + 1);
		await royale.closeRound();

		// check if can collect rewards before royale ends
		await expect(
			royale.claimRewardForSeason(season_1, firstPassportId, { from: first })
		).to.be.revertedWith('Royale must be finished!');

		//#7
		await royale.takeAPosition(firstPassportId, 1, { from: first });
		await royale.takeAPosition(secondPassportId, 1, { from: second });
		await fastForward(HOUR * 72 + 1);
		await royale.closeRound();

		let isTokenFirstAlive = await royale.isTokenAlive(firstPassportId);
		let isTokenSecondAlive = await royale.isTokenAlive(secondPassportId);
		let isTokenThirdAlive = await royale.isTokenAlive(thirdPassportId);
		let isTokenFourthAlive = await royale.isTokenAlive(fourthPassportId);

		assert.equal(true, isTokenFirstAlive);
		assert.equal(true, isTokenSecondAlive);
		assert.equal(false, isTokenThirdAlive);
		assert.equal(false, isTokenFourthAlive);

		let rewardPerPlayer = await royale.rewardPerWinnerPerSeason(season_1);
		// 10.000 -> two winners 5.000
		assert.bnEqual(rewardPerPlayer, toUnit(5000));

		await expect(royale.closeRound()).to.be.revertedWith('Competition finished');

		// check if player which not win can collect
		await expect(
			royale.claimRewardForSeason(season_1, thirdPassportId, { from: third })
		).to.be.revertedWith('Token is not alive');

		let isPlayerOneClaimedReward_before = await royale.tokenRewardCollectedPerSeason(
			firstPassportId
		);
		assert.equal(false, isPlayerOneClaimedReward_before);

		assert.bnEqual(await royale.unclaimedRewardPerSeason(season_1), toUnit(10000));

		const tx = await royale.claimRewardForSeason(season_1, firstPassportId, { from: first });

		// check if event is emited
		assert.eventEqual(tx.logs[0], 'RewardClaimedPassport', {
			season: season_1,
			winner: first,
			tokenId: firstPassportId,
			reward: toUnit(5000),
		});

		let isPlayerOneClaimedReward_after = await royale.tokenRewardCollectedPerSeason(
			firstPassportId
		);
		assert.equal(isPlayerOneClaimedReward_after, true);

		// check if player can collect two times
		await expect(
			royale.claimRewardForSeason(season_1, firstPassportId, { from: first })
		).to.be.revertedWith('Reward already collected');

		// check if different then owner can start season
		await expect(royale.startNewSeason({ from: first })).to.be.revertedWith(
			'Only owner can start season before pause between two seasons'
		);

		// check if player can collect ex season
		await expect(
			royale.claimRewardForSeason(season_1, firstPassportId, { from: first })
		).to.be.revertedWith('Reward already collected');
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

		const firstPassportId = 1;
		const secondPassportId = 2;
		const thirdPassportId = 3;
		const fourthPassportId = 4;

		// check values for reward 10.000 - 20%
		reward = await royale.rewardPerSeason(season_1);
		assert.bnEqual(reward, toUnit(8000));

		await fastForward(HOUR * 72 + 1);
		await royale.startRoyaleInASeason();

		await royale.takeAPosition(firstPassportId, 2, { from: first });
		await royale.takeAPosition(secondPassportId, 1, { from: second });
		await royale.takeAPosition(thirdPassportId, 1, { from: third });
		await royale.takeAPosition(fourthPassportId, 1, { from: fourth });
		await fastForward(HOUR * 72 + 1);
		await royale.closeRound();

		let isTokenFirstAlive = await royale.isTokenAlive(firstPassportId);
		let isTokenSecondAlive = await royale.isTokenAlive(secondPassportId);
		let isTokenThirdAlive = await royale.isTokenAlive(thirdPassportId);
		let isTokenFourthAlive = await royale.isTokenAlive(fourthPassportId);

		assert.equal(true, isTokenFirstAlive);
		assert.equal(false, isTokenSecondAlive);
		assert.equal(false, isTokenThirdAlive);
		assert.equal(false, isTokenFourthAlive);

		let rewardPerPlayer = await royale.rewardPerWinnerPerSeason(season_1);
		assert.bnEqual(rewardPerPlayer, toUnit(8000));

		const tx = await royale.claimRewardForSeason(season_1, firstPassportId, { from: first });

		// check if event is emited
		assert.eventEqual(tx.logs[0], 'RewardClaimedPassport', {
			season: season_1,
			winner: first,
			tokenId: firstPassportId,
			reward: toUnit(8000),
		});

		let isPlayerOneClaimedReward_after = await royale.tokenRewardCollectedPerSeason(
			firstPassportId
		);
		assert.equal(isPlayerOneClaimedReward_after, true);

		// check if player can collect two times
		await expect(
			royale.claimRewardForSeason(season_1, firstPassportId, { from: first })
		).to.be.revertedWith('Reward already collected');
	});

	it('Sign up with positions check values', async () => {
		await royale.startNewSeason({ from: owner });

		// check rewards
		let reward = await royale.rewardPerSeason(season_1);
		assert.bnEqual(reward, toUnit(0));

		await expect(
			royale.signUpWithPosition([3, 1, 1, 1, 1, 1, 1], { from: first })
		).to.be.revertedWith('Position can only be 1 or 2');
		await expect(
			royale.signUpWithPosition([0, 0, 0, 0, 0, 0, 0], { from: first })
		).to.be.revertedWith('Position can only be 1 or 2');

		assert.equal(0, await royale.positionsPerRoundPerSeason(season_1, 1, 1));
		assert.equal(0, await royale.positionsPerRoundPerSeason(season_1, 1, 2));

		await royale.signUpWithPosition([1, 1, 1, 1, 1, 1, 1], { from: first });
		await royale.signUpWithPosition([2, 2, 2, 2, 2, 2, 2], { from: second });
		await royale.signUpWithPosition([1, 1, 1, 1, 1, 1, 2], { from: third });
		await royale.signUpWithPosition([2, 2, 2, 2, 2, 2, 2], { from: fourth });

		const firstPassportId = 1;
		const secondPassportId = 2;
		const thirdPassportId = 3;
		const fourthPassportId = 4;

		assert.equal(2, await royale.positionsPerRoundPerSeason(season_1, 1, 1));
		assert.equal(2, await royale.positionsPerRoundPerSeason(season_1, 1, 2));

		await fastForward(HOUR * 72 + 1);
		await royale.startRoyaleInASeason();

		await royale.takeAPosition(firstPassportId, 2, { from: first });
		await expect(royale.takeAPosition(secondPassportId, 2, { from: second })).to.be.revertedWith(
			'Same position'
		);
		await royale.takeAPosition(thirdPassportId, 2, { from: third });
		await expect(royale.takeAPosition(fourthPassportId, 2, { from: fourth })).to.be.revertedWith(
			'Same position'
		);

		assert.equal(0, await royale.positionsPerRoundPerSeason(season_1, 1, 1));
		assert.equal(4, await royale.positionsPerRoundPerSeason(season_1, 1, 2));
	});

	it('Sign up with vouchers check values', async () => {
		// adding vauchers to users
		const id_1 = 1;
		const id_2 = 2;

		await voucher.setThalesRoyaleAddress(royale.address, { from: owner });

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
		await expect(
			royale.signUpWithPassWithPosition(2, [2, 2, 2, 2, 2, 2, 2], { from: first })
		).to.be.revertedWith('Owner of the token not valid');

		assert.bnEqual(1, await voucher.balanceOf(first));
		assert.bnEqual(1, await voucher.balanceOf(second));

		await royale.signUpWithPass(1, { from: first });
		await royale.signUpWithPassWithPosition(2, [2, 2, 2, 2, 2, 2, 2], { from: second });

		assert.bnEqual(2, await royale.mintedTokensCount(season_1));

		assert.equal(0, await royale.positionsPerRoundPerSeason(season_1, 1, 1));
		assert.equal(1, await royale.positionsPerRoundPerSeason(season_1, 1, 2));

		reward = await royale.rewardPerSeason(season_1);
		assert.bnEqual(reward, toUnit(5000));

		assert.bnEqual(0, await voucher.balanceOf(first));
		assert.bnEqual(0, await voucher.balanceOf(second));
	});

	it('Sign up with ALL ROUNDS default positions check values, first scenario ', async () => {
		await royale.startNewSeason({ from: owner });

		assert.equal(0, await royale.positionsPerRoundPerSeason(season_1, 1, 1));
		assert.equal(0, await royale.positionsPerRoundPerSeason(season_1, 1, 2));

		await royale.signUpWithPosition([2, 2, 2, 2, 2, 2, 2], { from: first });
		await royale.signUpWithPosition([2, 2, 2, 2, 2, 2, 2], { from: second });
		await royale.signUpWithPosition([1, 1, 1, 1, 1, 1, 1], { from: third });
		await royale.signUpWithPosition([1, 1, 1, 1, 1, 1, 1], { from: fourth });

		const firstPassportId = 1;
		const secondPassportId = 2;
		const thirdPassportId = 3;
		const fourthPassportId = 4;

		assert.equal(2, await royale.positionsPerRoundPerSeason(season_1, 1, 1)); // round 1
		assert.equal(2, await royale.positionsPerRoundPerSeason(season_1, 1, 2)); // round 1
		assert.equal(2, await royale.positionsPerRoundPerSeason(season_1, 2, 1)); // round 2
		assert.equal(2, await royale.positionsPerRoundPerSeason(season_1, 2, 2)); // round 2
		assert.equal(2, await royale.positionsPerRoundPerSeason(season_1, 2, 1)); // round 3
		assert.equal(2, await royale.positionsPerRoundPerSeason(season_1, 2, 2)); // round 3 ...

		assert.equal(1, await royale.tokenPositionInARoundPerSeason(fourthPassportId, 1));
		assert.equal(1, await royale.tokenPositionInARoundPerSeason(fourthPassportId, 2));
		assert.equal(1, await royale.tokenPositionInARoundPerSeason(fourthPassportId, 3));
		assert.equal(1, await royale.tokenPositionInARoundPerSeason(fourthPassportId, 4));
		assert.equal(1, await royale.tokenPositionInARoundPerSeason(fourthPassportId, 5));
		assert.equal(1, await royale.tokenPositionInARoundPerSeason(fourthPassportId, 6));
		assert.equal(1, await royale.tokenPositionInARoundPerSeason(fourthPassportId, 7));

		await fastForward(HOUR * 72 + 1);
		await royale.startRoyaleInASeason();

		await MockPriceFeedDeployed.setPricetoReturn(900);

		//#1
		await fastForward(HOUR * 72 + 1);
		const tx_close_1 = await royale.closeRound();

		// check if event is emited
		assert.eventEqual(tx_close_1.logs[0], 'RoundClosed', {
			season: season_1,
			round: 1,
			result: 1,
			strikePrice: 1000,
			finalPrice: 900,
			numberOfEliminatedPlayers: 2,
			numberOfWinningPlayers: 2,
		});

		let isTokenFirstAlive = await royale.isTokenAlive(firstPassportId);
		let isTokenSecondAlive = await royale.isTokenAlive(secondPassportId);
		let isTokenThirdAlive = await royale.isTokenAlive(thirdPassportId);
		let isTokenFourthAlive = await royale.isTokenAlive(fourthPassportId);

		assert.equal(false, isTokenFirstAlive);
		assert.equal(false, isTokenSecondAlive);
		assert.equal(true, isTokenThirdAlive);
		assert.equal(true, isTokenFourthAlive);

		assert.equal(0, await royale.tokenPositionInARoundPerSeason(firstPassportId, 2));
		assert.equal(2, await royale.tokenPositionInARoundPerSeason(firstPassportId, 3));
		assert.equal(2, await royale.tokenPositionInARoundPerSeason(firstPassportId, 4));
		assert.equal(2, await royale.tokenPositionInARoundPerSeason(firstPassportId, 5));
		assert.equal(2, await royale.tokenPositionInARoundPerSeason(firstPassportId, 6));
		assert.equal(2, await royale.tokenPositionInARoundPerSeason(firstPassportId, 7));

		assert.equal(0, await royale.tokenPositionInARoundPerSeason(secondPassportId, 2));
		assert.equal(2, await royale.tokenPositionInARoundPerSeason(secondPassportId, 3));
		assert.equal(2, await royale.tokenPositionInARoundPerSeason(secondPassportId, 4));
		assert.equal(2, await royale.tokenPositionInARoundPerSeason(secondPassportId, 5));
		assert.equal(2, await royale.tokenPositionInARoundPerSeason(secondPassportId, 6));
		assert.equal(2, await royale.tokenPositionInARoundPerSeason(secondPassportId, 7));

		let totalTokensInARound = await royale.totalTokensPerRoundPerSeason(season_1, 1); // round 1
		assert.equal(4, totalTokensInARound);

		totalTokensInARound = await royale.totalTokensPerRoundPerSeason(season_1, 2); // round 2
		assert.equal(2, totalTokensInARound);

		let eliminatedPlayersInARound = await royale.eliminatedPerRoundPerSeason(season_1, 1);
		assert.equal(2, eliminatedPlayersInARound);

		//#2
		await expect(royale.takeAPosition(firstPassportId, 1, { from: first })).to.be.revertedWith(
			'Token no longer valid'
		);

		await expect(royale.takeAPosition(secondPassportId, 1, { from: second })).to.be.revertedWith(
			'Token no longer valid'
		);

		await royale.takeAPosition(thirdPassportId, 2, { from: third });

		await MockPriceFeedDeployed.setPricetoReturn(1100);
		await fastForward(HOUR * 72 + 1);
		const tx_close_2 = await royale.closeRound();

		// check if event is emited
		assert.eventEqual(tx_close_2.logs[0], 'RoundClosed', {
			season: season_1,
			round: 2,
			result: 2,
			strikePrice: 900,
			finalPrice: 1100,
			numberOfEliminatedPlayers: 1,
			numberOfWinningPlayers: 1,
		});

		assert.eventEqual(tx_close_2.logs[1], 'RoyaleFinished', {
			season: season_1,
			numberOfWinners: 1,
			rewardPerWinner: toUnit(10000),
		});

		isTokenFirstAlive = await royale.isTokenAlive(firstPassportId);
		isTokenSecondAlive = await royale.isTokenAlive(secondPassportId);
		isTokenThirdAlive = await royale.isTokenAlive(thirdPassportId);
		isTokenFourthAlive = await royale.isTokenAlive(fourthPassportId);

		assert.equal(1, await royale.tokenPositionInARoundPerSeason(fourthPassportId, 1)); // defult 1
		assert.equal(1, await royale.tokenPositionInARoundPerSeason(fourthPassportId, 2)); // defult 1
		assert.equal(0, await royale.tokenPositionInARoundPerSeason(fourthPassportId, 3));
		assert.equal(1, await royale.tokenPositionInARoundPerSeason(fourthPassportId, 4));
		assert.equal(1, await royale.tokenPositionInARoundPerSeason(fourthPassportId, 5));
		assert.equal(1, await royale.tokenPositionInARoundPerSeason(fourthPassportId, 6));
		assert.equal(1, await royale.tokenPositionInARoundPerSeason(fourthPassportId, 7));

		assert.equal(false, isTokenFirstAlive);
		assert.equal(false, isTokenSecondAlive);
		assert.equal(true, isTokenThirdAlive);
		assert.equal(false, isTokenFourthAlive);

		totalTokensInARound = await royale.totalTokensPerRoundPerSeason(season_1, 3);
		assert.equal(1, totalTokensInARound);

		eliminatedPlayersInARound = await royale.eliminatedPerRoundPerSeason(season_1, 2);
		assert.equal(1, eliminatedPlayersInARound);

		await expect(royale.takeAPosition(firstPassportId, 1, { from: first })).to.be.revertedWith(
			'Competition finished'
		);

		await expect(royale.takeAPosition(thirdPassportId, 1, { from: third })).to.be.revertedWith(
			'Competition finished'
		);
	});

	it('Sign up with ALL ROUNDS default positions check values, second scenario ', async () => {
		await royale.startNewSeason({ from: owner });

		assert.equal(0, await royale.positionsPerRoundPerSeason(season_1, 1, 1));
		assert.equal(0, await royale.positionsPerRoundPerSeason(season_1, 1, 2));

		await royale.signUpWithPosition([2, 2, 2, 2, 2, 2, 2], { from: first });
		await royale.signUpWithPosition([1, 1, 1, 1, 1, 1, 1], { from: second });
		await royale.signUpWithPosition([1, 1, 1, 1, 1, 1, 1], { from: third });
		await royale.signUpWithPosition([1, 1, 1, 1, 1, 1, 1], { from: fourth });

		const firstPassportId = 1;
		const secondPassportId = 2;
		const thirdPassportId = 3;
		const fourthPassportId = 4;

		assert.equal(3, await royale.positionsPerRoundPerSeason(season_1, 1, 1)); // round 1
		assert.equal(1, await royale.positionsPerRoundPerSeason(season_1, 1, 2)); // round 1
		assert.equal(3, await royale.positionsPerRoundPerSeason(season_1, 2, 1)); // round 2
		assert.equal(1, await royale.positionsPerRoundPerSeason(season_1, 2, 2)); // round 2
		assert.equal(3, await royale.positionsPerRoundPerSeason(season_1, 2, 1)); // round 3
		assert.equal(1, await royale.positionsPerRoundPerSeason(season_1, 2, 2)); // round 3 ...

		assert.equal(2, await royale.tokenPositionInARoundPerSeason(firstPassportId, 1));
		assert.equal(2, await royale.tokenPositionInARoundPerSeason(firstPassportId, 2));
		assert.equal(2, await royale.tokenPositionInARoundPerSeason(firstPassportId, 3));
		assert.equal(2, await royale.tokenPositionInARoundPerSeason(firstPassportId, 4));
		assert.equal(2, await royale.tokenPositionInARoundPerSeason(firstPassportId, 5));
		assert.equal(2, await royale.tokenPositionInARoundPerSeason(firstPassportId, 6));
		assert.equal(2, await royale.tokenPositionInARoundPerSeason(firstPassportId, 7));

		assert.equal(1, await royale.tokenPositionInARoundPerSeason(secondPassportId, 1));
		assert.equal(1, await royale.tokenPositionInARoundPerSeason(secondPassportId, 2));
		assert.equal(1, await royale.tokenPositionInARoundPerSeason(secondPassportId, 3));
		assert.equal(1, await royale.tokenPositionInARoundPerSeason(secondPassportId, 4));
		assert.equal(1, await royale.tokenPositionInARoundPerSeason(secondPassportId, 5));
		assert.equal(1, await royale.tokenPositionInARoundPerSeason(secondPassportId, 6));
		assert.equal(1, await royale.tokenPositionInARoundPerSeason(secondPassportId, 7));

		assert.equal(1, await royale.tokenPositionInARoundPerSeason(thirdPassportId, 1));
		assert.equal(1, await royale.tokenPositionInARoundPerSeason(thirdPassportId, 2));
		assert.equal(1, await royale.tokenPositionInARoundPerSeason(thirdPassportId, 3));
		assert.equal(1, await royale.tokenPositionInARoundPerSeason(thirdPassportId, 4));
		assert.equal(1, await royale.tokenPositionInARoundPerSeason(thirdPassportId, 5));
		assert.equal(1, await royale.tokenPositionInARoundPerSeason(thirdPassportId, 6));
		assert.equal(1, await royale.tokenPositionInARoundPerSeason(thirdPassportId, 7));

		await fastForward(HOUR * 72 + 1);
		await royale.startRoyaleInASeason();

		await MockPriceFeedDeployed.setPricetoReturn(900);

		//#1
		await fastForward(HOUR * 72 + 1);
		const tx_close_1 = await royale.closeRound();

		assert.equal(1, await royale.roundResultPerSeason(season_1, 1));
		assert.equal(3, await royale.positionsPerRoundPerSeason(season_1, 1, 1)); // round 1 winning
		assert.equal(1, await royale.positionsPerRoundPerSeason(season_1, 1, 2)); // round 1 loosing

		assert.equal(2, await royale.tokenPositionInARoundPerSeason(firstPassportId, 1));
		assert.equal(0, await royale.tokenPositionInARoundPerSeason(firstPassportId, 2));
		assert.equal(2, await royale.tokenPositionInARoundPerSeason(firstPassportId, 3));
		assert.equal(2, await royale.tokenPositionInARoundPerSeason(firstPassportId, 4));
		assert.equal(2, await royale.tokenPositionInARoundPerSeason(firstPassportId, 5));
		assert.equal(2, await royale.tokenPositionInARoundPerSeason(firstPassportId, 6));
		assert.equal(2, await royale.tokenPositionInARoundPerSeason(firstPassportId, 7));

		assert.equal(1, await royale.tokenPositionInARoundPerSeason(secondPassportId, 1));
		assert.equal(1, await royale.tokenPositionInARoundPerSeason(secondPassportId, 2));
		assert.equal(1, await royale.tokenPositionInARoundPerSeason(secondPassportId, 3));
		assert.equal(1, await royale.tokenPositionInARoundPerSeason(secondPassportId, 4));
		assert.equal(1, await royale.tokenPositionInARoundPerSeason(secondPassportId, 5));
		assert.equal(1, await royale.tokenPositionInARoundPerSeason(secondPassportId, 6));
		assert.equal(1, await royale.tokenPositionInARoundPerSeason(secondPassportId, 7));

		assert.equal(1, await royale.tokenPositionInARoundPerSeason(thirdPassportId, 1));
		assert.equal(1, await royale.tokenPositionInARoundPerSeason(thirdPassportId, 2));
		assert.equal(1, await royale.tokenPositionInARoundPerSeason(thirdPassportId, 3));
		assert.equal(1, await royale.tokenPositionInARoundPerSeason(thirdPassportId, 4));
		assert.equal(1, await royale.tokenPositionInARoundPerSeason(thirdPassportId, 5));
		assert.equal(1, await royale.tokenPositionInARoundPerSeason(thirdPassportId, 6));
		assert.equal(1, await royale.tokenPositionInARoundPerSeason(thirdPassportId, 7));

		// check if event is emited
		assert.eventEqual(tx_close_1.logs[0], 'RoundClosed', {
			season: season_1,
			round: 1,
			result: 1,
			strikePrice: 1000,
			finalPrice: 900,
			numberOfEliminatedPlayers: 1,
			numberOfWinningPlayers: 3,
		});

		let isTokenFirstAlive = await royale.isTokenAlive(firstPassportId);
		let isTokenSecondAlive = await royale.isTokenAlive(secondPassportId);
		let isTokenThirdAlive = await royale.isTokenAlive(thirdPassportId);
		let isTokenFourthAlive = await royale.isTokenAlive(fourthPassportId);

		assert.equal(false, isTokenFirstAlive);
		assert.equal(true, isTokenSecondAlive);
		assert.equal(true, isTokenThirdAlive);
		assert.equal(true, isTokenFourthAlive);

		let totalTokensInARound = await royale.totalTokensPerRoundPerSeason(season_1, 1); // round 1
		assert.equal(4, totalTokensInARound);

		totalTokensInARound = await royale.totalTokensPerRoundPerSeason(season_1, 2); // round 2
		assert.equal(3, totalTokensInARound);

		let eliminatedPlayersInARound = await royale.eliminatedPerRoundPerSeason(season_1, 1);
		assert.equal(1, eliminatedPlayersInARound);

		//#2
		await expect(royale.takeAPosition(firstPassportId, 1, { from: first })).to.be.revertedWith(
			'Token no longer valid'
		);

		await royale.takeAPosition(secondPassportId, 2, { from: second });
		await royale.takeAPosition(thirdPassportId, 2, { from: third });

		assert.equal(1, await royale.tokenPositionInARoundPerSeason(secondPassportId, 1));
		assert.equal(2, await royale.tokenPositionInARoundPerSeason(secondPassportId, 2));
		assert.equal(1, await royale.tokenPositionInARoundPerSeason(secondPassportId, 3));
		assert.equal(1, await royale.tokenPositionInARoundPerSeason(secondPassportId, 4));
		assert.equal(1, await royale.tokenPositionInARoundPerSeason(secondPassportId, 5));
		assert.equal(1, await royale.tokenPositionInARoundPerSeason(secondPassportId, 6));
		assert.equal(1, await royale.tokenPositionInARoundPerSeason(secondPassportId, 7));

		assert.equal(1, await royale.tokenPositionInARoundPerSeason(thirdPassportId, 1));
		assert.equal(2, await royale.tokenPositionInARoundPerSeason(thirdPassportId, 2));
		assert.equal(1, await royale.tokenPositionInARoundPerSeason(thirdPassportId, 3));
		assert.equal(1, await royale.tokenPositionInARoundPerSeason(thirdPassportId, 4));
		assert.equal(1, await royale.tokenPositionInARoundPerSeason(thirdPassportId, 5));
		assert.equal(1, await royale.tokenPositionInARoundPerSeason(thirdPassportId, 6));
		assert.equal(1, await royale.tokenPositionInARoundPerSeason(thirdPassportId, 7));

		assert.equal(0, await royale.tokenPositionInARoundPerSeason(fourthPassportId, 0));
		assert.equal(1, await royale.tokenPositionInARoundPerSeason(fourthPassportId, 1));
		assert.equal(1, await royale.tokenPositionInARoundPerSeason(fourthPassportId, 2));
		assert.equal(1, await royale.tokenPositionInARoundPerSeason(fourthPassportId, 3));
		assert.equal(1, await royale.tokenPositionInARoundPerSeason(fourthPassportId, 4));
		assert.equal(1, await royale.tokenPositionInARoundPerSeason(fourthPassportId, 5));
		assert.equal(1, await royale.tokenPositionInARoundPerSeason(fourthPassportId, 6));
		assert.equal(1, await royale.tokenPositionInARoundPerSeason(fourthPassportId, 7));
		assert.equal(0, await royale.tokenPositionInARoundPerSeason(fourthPassportId, 8));

		await MockPriceFeedDeployed.setPricetoReturn(1100);
		await fastForward(HOUR * 72 + 1);
		const tx_close_2 = await royale.closeRound();

		assert.equal(2, await royale.roundResultPerSeason(season_1, 2));

		totalTokensInARound = await royale.totalTokensPerRoundPerSeason(season_1, 3);
		assert.equal(2, totalTokensInARound);

		eliminatedPlayersInARound = await royale.eliminatedPerRoundPerSeason(season_1, 2);
		assert.equal(1, eliminatedPlayersInARound);

		// check if event is emited
		assert.eventEqual(tx_close_2.logs[0], 'RoundClosed', {
			season: season_1,
			round: 2,
			result: 2,
			strikePrice: 900,
			finalPrice: 1100,
			numberOfEliminatedPlayers: 1,
			numberOfWinningPlayers: 2,
		});

		isTokenFirstAlive = await royale.isTokenAlive(firstPassportId);
		isTokenSecondAlive = await royale.isTokenAlive(secondPassportId);
		isTokenThirdAlive = await royale.isTokenAlive(thirdPassportId);
		isTokenFourthAlive = await royale.isTokenAlive(fourthPassportId);

		assert.equal(false, isTokenFirstAlive);
		assert.equal(true, isTokenSecondAlive);
		assert.equal(true, isTokenThirdAlive);
		assert.equal(false, isTokenFourthAlive);

		//#3
		await expect(royale.takeAPosition(firstPassportId, 1, { from: first })).to.be.revertedWith(
			'Token no longer valid'
		);

		await expect(royale.takeAPosition(fourthPassportId, 1, { from: fourth })).to.be.revertedWith(
			'Token no longer valid'
		);

		await MockPriceFeedDeployed.setPricetoReturn(1200);
		await fastForward(HOUR * 72 + 1);
		const tx_close_3 = await royale.closeRound();

		// check if event is emited
		assert.eventEqual(tx_close_3.logs[0], 'RoundClosed', {
			season: season_1,
			round: 3,
			result: 2,
			strikePrice: 1100,
			finalPrice: 1200,
			numberOfEliminatedPlayers: 2,
			numberOfWinningPlayers: 2,
		});

		assert.eventEqual(tx_close_3.logs[1], 'RoyaleFinished', {
			season: season_1,
			numberOfWinners: 2,
			rewardPerWinner: toUnit(5000),
		});

		isTokenFirstAlive = await royale.isTokenAlive(firstPassportId);
		isTokenSecondAlive = await royale.isTokenAlive(secondPassportId);
		isTokenThirdAlive = await royale.isTokenAlive(thirdPassportId);
		isTokenFourthAlive = await royale.isTokenAlive(fourthPassportId);

		assert.equal(false, isTokenFirstAlive);
		assert.equal(true, isTokenSecondAlive);
		assert.equal(true, isTokenThirdAlive);
		assert.equal(false, isTokenFourthAlive);

		totalTokensInARound = await royale.totalTokensPerRoundPerSeason(season_1, 4);
		assert.equal(0, totalTokensInARound);

		eliminatedPlayersInARound = await royale.eliminatedPerRoundPerSeason(season_1, 3);
		assert.equal(2, eliminatedPlayersInARound);

		await expect(royale.takeAPosition(firstPassportId, 1, { from: first })).to.be.revertedWith(
			'Competition finished'
		);

		await expect(royale.takeAPosition(thirdPassportId, 1, { from: third })).to.be.revertedWith(
			'Competition finished'
		);
	});
});
