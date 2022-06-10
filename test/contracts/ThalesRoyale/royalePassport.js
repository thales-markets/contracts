'use strict';

const { artifacts, contract } = require('hardhat');

const { assert } = require('../../utils/common');

const { toBytes32 } = require('../../../index');

const { fastForward, toUnit } = require('../../utils')();

const { encodeCall } = require('../../utils/helpers');

contract('ThalesRoyalePassport', accounts => {
	const [first, owner, second, third] = accounts;
	let ThalesRoyalePassport;
	let MockPriceFeedDeployed;
	let ThalesRoyalePassportDeployed;
	let passport;
	const uri = 'http://my-json-server.typicode.com/abcoathup/samplenft/tokens/0';

	beforeEach(async () => {
		let MockPriceFeed = artifacts.require('MockPriceFeed');
		MockPriceFeedDeployed = await MockPriceFeed.new(owner);

		ThalesRoyalePassport = artifacts.require('ThalesRoyalePassport');
		ThalesRoyalePassportDeployed = await ThalesRoyalePassport.new({ from: owner });
		passport = await ThalesRoyalePassport.at(ThalesRoyalePassportDeployed.address);

		await passport.initialize(third, uri, { from: owner });
	});

	describe('Thales royale passport', () => {
		it('Pause contract check result', async () => {
			await expect(passport.pause({ from: first })).to.be.revertedWith(
				'Ownable: caller is not the owner'
			);

			const tx = await passport.pause({ from: owner });
			assert.equal(true, await passport.paused());

			// check if event is emited
			assert.eventEqual(tx.logs[1], 'ThalesRoyalePassportPaused', {
				_state: true,
			});
		});

		it('Unpause contract check result', async () => {
			await expect(passport.pause({ from: first })).to.be.revertedWith(
				'Ownable: caller is not the owner'
			);

			await passport.pause({ from: owner });

			const tx = await passport.unpause({ from: owner });
			assert.equal(false, await passport.paused());

			// check if event is emited
			assert.eventEqual(tx.logs[1], 'ThalesRoyalePassportPaused', {
				_state: false,
			});
		});

		it('Set uri check result', async () => {
			await expect(
				passport.setBaseURI('MockPriceFeedDeployed.address', { from: first })
			).to.be.revertedWith('Ownable: caller is not the owner');

			const tx = await passport.setBaseURI('MockPriceFeedDeployed.address', { from: owner });

			// check if event is emited
			assert.eventEqual(tx.logs[0], 'BaseUriChanged', {
				_baseURI: 'MockPriceFeedDeployed.address',
			});
		});

		it('Set royale address check result', async () => {
			await expect(
				passport.setThalesRoyale(MockPriceFeedDeployed.address, { from: first })
			).to.be.revertedWith('Ownable: caller is not the owner');

			const tx = await passport.setThalesRoyale(MockPriceFeedDeployed.address, { from: owner });

			// check if event is emited
			assert.eventEqual(tx.logs[0], 'ThalesRoyaleAddressChanged', {
				_thalesRoyaleAddress: MockPriceFeedDeployed.address,
			});
		});

		it('Mint and Burn passport check result', async () => {
			await expect(passport.burn(1, { from: first })).to.be.revertedWith("Passport doesn't exist");

			const tx_mint = await passport.safeMint(first, { from: third });

			assert.notEqual(0, await passport.tokenTimestamps(1));

			// check if event is emited
			assert.eventEqual(tx_mint.logs[1], 'ThalesRoyalePassportMinted', {
				_recipient: first,
				_tokenId: 1,
			});

			await expect(passport.burn(1, { from: second })).to.be.revertedWith(
				'Must be owner or approver'
			);

			const tx_burn = await passport.burn(1, { from: first });

			// check if event is emited
			assert.eventEqual(tx_burn.logs[2], 'ThalesRoyalePassportBurned', {
				_tokenId: 1,
			});

			await expect(passport.burn(1, { from: first })).to.be.revertedWith("Passport doesn't exist");
		});

		it('Check if supports interface', async () => {
			const byteCode = '0x15fb397c00000000000000000000000000000000000000000000000000000000'.slice(
				0,
				10
			);
			assert.equal(false, await passport.supportsInterface(byteCode));
		});
	});
});
