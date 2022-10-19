'use strict';

const { artifacts, contract } = require('hardhat');

const { assert } = require('../../utils/common');

const { toUnit } = require('../../utils')();
const { toBytes32 } = require('../../../index');

contract('FIFAFavoriteTeam', (accounts) => {
	const [first, owner, second, third] = accounts;
	let FIFAFavoriteTeam;
	let StakingThales, SNXRewards, Thales;
	let fifa;
	const uri = 'http://my-json-server.typicode.com/abcoathup/samplenft/tokens';
	let favoriteTeams = ['Serbia', 'Brasil', 'Swiss'];

	const WEEK = 604800;

	beforeEach(async () => {
		const ThalesContract = artifacts.require('contracts/Token/OpThales_L1.sol:OpThales');
		const SNXRewardsContract = artifacts.require('SNXRewards');

		SNXRewards = await SNXRewardsContract.new({ from: owner });
		Thales = await ThalesContract.new({ from: owner });

		const StakingThalesContract = artifacts.require('StakingThales');
		StakingThales = await StakingThalesContract.new({ from: owner });

		await StakingThales.initialize(
			owner,
			Thales.address,
			Thales.address,
			Thales.address,
			WEEK,
			WEEK,
			SNXRewards.address,
			{ from: owner }
		);

		FIFAFavoriteTeam = artifacts.require('FIFAFavoriteTeam');

		fifa = await FIFAFavoriteTeam.new(uri, favoriteTeams, StakingThales.address, toUnit('10'), {
			from: owner,
		});
	});

	describe('FIFA FT', () => {
		it('Init checking', async () => {
			assert.bnEqual('FIFA Favorite Team', await fifa.name());
			assert.bnEqual('FFT', await fifa.symbol());

			assert.bnEqual(false, await fifa.allowedCountryNumber(0));
			assert.bnEqual(true, await fifa.allowedCountryNumber(1));
			assert.bnEqual(true, await fifa.allowedCountryNumber(2));
			assert.bnEqual(true, await fifa.allowedCountryNumber(3));
			assert.bnEqual(false, await fifa.allowedCountryNumber(0));

			assert.equal('', await fifa.countryNameByNumber(0));
			assert.equal('Serbia', await fifa.countryNameByNumber(1));
			assert.equal('Brasil', await fifa.countryNameByNumber(2));
			assert.equal('Swiss', await fifa.countryNameByNumber(3));
			assert.equal('', await fifa.countryNameByNumber(4));

			assert.equal('', await fifa.countryNameByNumber(4));

			assert.bnEqual(toUnit('10'), await fifa.minimumStake());
		});

		it('Set paused, can not mint', async () => {
			await expect(fifa.setPause(true, { from: first })).to.be.revertedWith(
				'Ownable: caller is not the owner'
			);

			await expect(fifa.setPause(false, { from: owner })).to.be.revertedWith(
				'Already in that state'
			);

			const tx = await fifa.setPause(true, { from: owner });

			// check if event is emited
			assert.eventEqual(tx.logs[0], 'Paused', {
				_state: true,
			});

			await expect(fifa.mint(first, 1, { from: first })).to.be.revertedWith(
				'Cant mint while paused'
			);
		});

		it('Can not mint not allowed country', async () => {
			await expect(fifa.mint(first, 0, { from: first })).to.be.revertedWith('Country not allowed');
			await expect(fifa.mint(first, 4, { from: first })).to.be.revertedWith('Country not allowed');
		});

		it('Can not mint user not whitelisted', async () => {
			await expect(fifa.mint(first, 3, { from: first })).to.be.revertedWith(
				'User is not allowed to mint this NFT'
			);
		});

		it('Set whitelisted address, mint, check data', async () => {
			await expect(fifa.mint(first, 3, { from: first })).to.be.revertedWith(
				'User is not allowed to mint this NFT'
			);

			assert.equal(false, await fifa.isMinterEligibleToMint(first));

			const tx_WL = await fifa.setWhitelistedAddresses([first], true, { from: owner });

			assert.equal(true, await fifa.isMinterEligibleToMint(first));

			// check if event is emited
			assert.eventEqual(tx_WL.logs[0], 'AddedIntoWhitelist', {
				_whitelistAddress: first,
				_flag: true,
			});

			const tx_mint = await fifa.mint(first, 1, { from: first });

			assert.equal(1, await fifa.usersFavoriteTeamById(first));
			assert.equal('Serbia', await fifa.usersFavoriteTeamByName(first));
			assert.equal(first, await fifa.listOfUsersByCountry(1, 0));

			let list_1 = await fifa.getListOfUsersPerTeam(1);
			assert.equal(1, list_1.length);
			let list_2 = await fifa.getListOfUsersPerTeam(2);
			assert.equal(0, list_2.length);

			// check if event is emited
			assert.eventEqual(tx_mint.logs[1], 'Mint', {
				_recipient: first,
				_id: 1,
				_country: 1,
				_countryName: 'Serbia',
			});

			await expect(fifa.mint(first, 3, { from: first })).to.be.revertedWith(
				'Recipient has picked the team'
			);

			await fifa.setWhitelistedAddresses([second], true, { from: owner });
			await fifa.mint(second, 3, { from: second });

			assert.equal(second, await fifa.ownerOf(2));

			assert.equal(3, await fifa.usersFavoriteTeamById(second));
			assert.equal('Swiss', await fifa.usersFavoriteTeamByName(second));
		});

		it('Mint for others, can not do', async () => {
			await fifa.setWhitelistedAddresses([first], true, { from: owner });
			await expect(fifa.mint(first, 1, { from: second })).to.be.revertedWith(
				'Soulbound NFT can be only minted for his owner'
			);
		});

		it('Mint, try to transfer, can not be done', async () => {
			await fifa.setWhitelistedAddresses([first], true, { from: owner });
			await fifa.mint(first, 1, { from: first });

			assert.equal(first, await fifa.ownerOf(1));

			assert.equal(1, await fifa.usersFavoriteTeamById(first));
			assert.equal('Serbia', await fifa.usersFavoriteTeamByName(first));

			let team = await fifa.getFavoriteTeamForUser(first);

			assert.equal(1, team[0]);
			assert.equal('Serbia', team[1]);

			await expect(fifa.transferFrom(first, second, 1, { from: first })).to.be.revertedWith(
				'Can not transfer NFT, only mint and burn'
			);

			await expect(fifa.safeTransferFrom(first, second, 1, { from: first })).to.be.revertedWith(
				'Can not transfer NFT, only mint and burn'
			);
		});

		it('Burn, try to burn not owner, burn owner, and try to burn after burn', async () => {
			await fifa.setWhitelistedAddresses([first], true, { from: owner });
			await fifa.mint(first, 1, { from: first });

			assert.equal(first, await fifa.ownerOf(1));

			assert.equal(1, await fifa.usersFavoriteTeamById(first));
			assert.equal('Serbia', await fifa.usersFavoriteTeamByName(first));

			await expect(fifa.burn(1, { from: second })).to.be.revertedWith('Not owner');
			const tx_burn = await fifa.burn(1, { from: first });
			await expect(fifa.burn(1, { from: second })).to.be.revertedWith('ERC721: invalid token ID');

			// check if event is emited
			assert.eventEqual(tx_burn.logs[2], 'Burn', {
				_tokenId: 1,
				_exHolder: first,
			});
		});

		it('Set owner functions', async () => {
			await expect(fifa.setTokenURI('aaaaaa', { from: first })).to.be.revertedWith(
				'Ownable: caller is not the owner'
			);

			const tx = await fifa.setTokenURI('aaaaaa', { from: owner });

			// check if event is emited
			assert.eventEqual(tx.logs[0], 'NewTokenUri', {
				_tokenURI: 'aaaaaa',
			});

			const tx_contry = await fifa.setAllowedCountryNumber(4, true, { from: owner });

			// check if event is emited
			assert.eventEqual(tx_contry.logs[0], 'SetAllowedCountryNumber', {
				_country: 4,
				_flag: true,
			});

			await expect(fifa.setAllowedCountryNumber(4, true, { from: owner })).to.be.revertedWith(
				'Already in that state'
			);

			const tx_contry_name = await fifa.setCountryNameByNumber(4, 'Ghana', { from: owner });

			// check if event is emited
			assert.eventEqual(tx_contry_name.logs[0], 'SetCountryNameByNumber', {
				_country: 4,
				_name: 'Ghana',
			});

			await expect(fifa.setCountryNameByNumber(4, 'Ghana', { from: owner })).to.be.revertedWith(
				'Same as before'
			);

			const tx_staking = await fifa.setStakingAddress(third, { from: owner });

			// check if event is emited
			assert.eventEqual(tx_staking.logs[0], 'NewStakingAddress', {
				_staking: third,
			});

			const tx_minimum_stake = await fifa.setMinimumStakeAmount(toUnit('30'), { from: owner });

			// check if event is emited
			assert.eventEqual(tx_minimum_stake.logs[0], 'NewMinimumStakeAmount', {
				_minimumAmount: toUnit('30'),
			});
		});
	});
});
