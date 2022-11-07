'use strict';

const { artifacts, contract } = require('hardhat');

const { assert } = require('../../utils/common');

const { toUnit } = require('../../utils')();
const { toBytes32 } = require('../../../index');

contract('OvertimeWorldCupZebro', (accounts) => {
	const [first, owner, second, third] = accounts;
	let OvertimeWorldCupZebro;
	let StakingThales, SNXRewards, Thales;
	let zebro;
	const uri_srb = 'http://my-json-server.typicode.com/abcoathup/samplenft/tokens/srb.png';
	const uri_bra = 'http://my-json-server.typicode.com/abcoathup/samplenft/tokens/bra.png';
	const uri_swiss = 'http://my-json-server.typicode.com/abcoathup/samplenft/tokens/swiss.png';
	let favoriteTeams = ['Serbia', 'Brasil', 'Swiss'];
	let teamURLs = [uri_srb, uri_bra, uri_swiss];

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

		OvertimeWorldCupZebro = artifacts.require('OvertimeWorldCupZebro');

		zebro = await OvertimeWorldCupZebro.new(
			favoriteTeams,
			teamURLs,
			StakingThales.address,
			toUnit('10'),
			{
				from: owner,
			}
		);
	});

	describe('OvertimeWorldCupZebro', () => {
		it('Init checking', async () => {
			assert.bnEqual('Overtime World Cup Zebro', await zebro.name());
			assert.bnEqual('OWC', await zebro.symbol());

			assert.bnEqual(false, await zebro.allowedCountryNumber(0));
			assert.bnEqual(true, await zebro.allowedCountryNumber(1));
			assert.bnEqual(true, await zebro.allowedCountryNumber(2));
			assert.bnEqual(true, await zebro.allowedCountryNumber(3));
			assert.bnEqual(false, await zebro.allowedCountryNumber(0));

			assert.equal('', await zebro.countryNameByNumber(0));
			assert.equal('Serbia', await zebro.countryNameByNumber(1));
			assert.equal('Brasil', await zebro.countryNameByNumber(2));
			assert.equal('Swiss', await zebro.countryNameByNumber(3));
			assert.equal('', await zebro.countryNameByNumber(4));

			assert.equal('', await zebro.countryUrl(0));
			assert.equal(uri_srb, await zebro.countryUrl(1));
			assert.equal(uri_bra, await zebro.countryUrl(2));
			assert.equal(uri_swiss, await zebro.countryUrl(3));
			assert.equal('', await zebro.countryUrl(4));

			assert.bnEqual(toUnit('10'), await zebro.minimumStake());
		});

		it('Set paused, can not mint', async () => {
			await expect(zebro.setPause(true, { from: first })).to.be.revertedWith(
				'Ownable: caller is not the owner'
			);

			await expect(zebro.setPause(false, { from: owner })).to.be.revertedWith(
				'Already in that state'
			);

			const tx = await zebro.setPause(true, { from: owner });

			// check if event is emited
			assert.eventEqual(tx.logs[0], 'Paused', {
				_state: true,
			});

			await expect(zebro.mint(first, 1, { from: first })).to.be.revertedWith(
				'Cant mint while paused'
			);
		});

		it('Can not mint not allowed country', async () => {
			await expect(zebro.mint(first, 0, { from: first })).to.be.revertedWith('Country not allowed');
			await expect(zebro.mint(first, 4, { from: first })).to.be.revertedWith('Country not allowed');
		});

		it('Can not mint user not whitelisted', async () => {
			await expect(zebro.mint(first, 3, { from: first })).to.be.revertedWith(
				'User is not allowed to mint this NFT'
			);
		});

		it('Set whitelisted address, mint, check data', async () => {
			await expect(zebro.mint(first, 3, { from: first })).to.be.revertedWith(
				'User is not allowed to mint this NFT'
			);

			assert.equal(false, await zebro.isMinterEligibleToMint(first));

			const tx_WL = await zebro.setWhitelistedAddresses([first], true, { from: owner });

			assert.equal(true, await zebro.isMinterEligibleToMint(first));

			// check if event is emited
			assert.eventEqual(tx_WL.logs[0], 'AddedIntoWhitelist', {
				_whitelistAddress: first,
				_flag: true,
			});

			const tx_mint = await zebro.mint(first, 1, { from: first });

			assert.equal(1, await zebro.usersFavoriteTeamId(first));
			assert.equal('Serbia', await zebro.usersFavoriteTeamName(first));
			assert.equal(first, await zebro.listOfUsersByCountry(1, 0));

			let list_1 = await zebro.getListOfUsersPerTeam(1);
			assert.equal(1, list_1.length);
			let list_2 = await zebro.getListOfUsersPerTeam(2);
			assert.equal(0, list_2.length);

			// check if event is emited
			assert.eventEqual(tx_mint.logs[1], 'Mint', {
				_recipient: first,
				_id: 1,
				_country: 1,
				_countryName: 'Serbia',
				_url: uri_srb,
			});

			await expect(zebro.mint(first, 3, { from: first })).to.be.revertedWith(
				'Recipient has picked the team'
			);

			await zebro.setWhitelistedAddresses([second], true, { from: owner });
			await zebro.mint(second, 3, { from: second });

			assert.equal(second, await zebro.ownerOf(2));

			assert.equal(3, await zebro.usersFavoriteTeamId(second));
			assert.equal('Swiss', await zebro.usersFavoriteTeamName(second));
		});

		it('Mint for others, can not do', async () => {
			await zebro.setWhitelistedAddresses([first], true, { from: owner });
			await expect(zebro.mint(first, 1, { from: second })).to.be.revertedWith(
				'Soulbound NFT can be only minted for his owner'
			);
		});

		it('Mint, try to transfer, can not be done', async () => {
			await zebro.setWhitelistedAddresses([first], true, { from: owner });
			await zebro.mint(first, 1, { from: first });

			assert.equal(first, await zebro.ownerOf(1));

			assert.equal(1, await zebro.usersFavoriteTeamId(first));
			assert.equal('Serbia', await zebro.usersFavoriteTeamName(first));
			assert.equal(uri_srb, await zebro.usersFavoriteTeamUrl(first));

			let team = await zebro.getFavoriteTeamForUser(first);

			assert.equal(1, team[0]);
			assert.equal('Serbia', team[1]);
			assert.equal(uri_srb, team[2]);

			await expect(zebro.transferFrom(first, second, 1, { from: first })).to.be.revertedWith(
				'Can not transfer NFT, only mint and burn'
			);

			await expect(zebro.safeTransferFrom(first, second, 1, { from: first })).to.be.revertedWith(
				'Can not transfer NFT, only mint and burn'
			);
		});

		it('Burn, try to burn not owner, burn owner, and try to burn after burn', async () => {
			await zebro.setWhitelistedAddresses([first], true, { from: owner });
			await zebro.mint(first, 1, { from: first });

			assert.equal(first, await zebro.ownerOf(1));

			assert.equal(1, await zebro.usersFavoriteTeamId(first));
			assert.equal('Serbia', await zebro.usersFavoriteTeamName(first));

			await expect(zebro.burn(1, { from: second })).to.be.revertedWith('Not owner');
			const tx_burn = await zebro.burn(1, { from: first });
			await expect(zebro.burn(1, { from: second })).to.be.revertedWith('ERC721: invalid token ID');

			// check if event is emited
			assert.eventEqual(tx_burn.logs[2], 'Burn', {
				_tokenId: 1,
				_exHolder: first,
			});
		});

		it('Set owner functions', async () => {
			const tx_contry = await zebro.setAllowedCountryNumber(4, true, { from: owner });

			// check if event is emited
			assert.eventEqual(tx_contry.logs[0], 'SetAllowedCountryNumber', {
				_country: 4,
				_flag: true,
			});

			await expect(zebro.setAllowedCountryNumber(4, true, { from: owner })).to.be.revertedWith(
				'Already in that state'
			);

			const tx_contry_name = await zebro.setCountryNameByNumber(4, 'Ghana', { from: owner });

			// check if event is emited
			assert.eventEqual(tx_contry_name.logs[0], 'SetCountryNameByNumber', {
				_country: 4,
				_name: 'Ghana',
			});

			await expect(zebro.setCountryNameByNumber(4, 'Ghana', { from: owner })).to.be.revertedWith(
				'Same as before'
			);

			const tx_staking = await zebro.setStakingAddress(third, { from: owner });

			// check if event is emited
			assert.eventEqual(tx_staking.logs[0], 'NewStakingAddress', {
				_staking: third,
			});

			const tx_minimum_stake = await zebro.setMinimumStakeAmount(toUnit('30'), { from: owner });

			// check if event is emited
			assert.eventEqual(tx_minimum_stake.logs[0], 'NewMinimumStakeAmount', {
				_minimumAmount: toUnit('30'),
			});

			const tx_contry_url = await zebro.setCountryURL(1, uri_bra, { from: owner });

			// check if event is emited
			assert.eventEqual(tx_contry_url.logs[0], 'SetCountryURLByNumber', {
				_country: 1,
				_url: uri_bra,
			});

			await expect(zebro.setCountryURL(2, uri_bra, { from: owner })).to.be.revertedWith(
				'Same as before'
			);
		});
	});
});
