'use strict';

const { artifacts, contract } = require('hardhat');
const { assert } = require('../../utils/common');
const { toBytes32 } = require('../../../index');
const { expect } = require('chai');
const { toUnit, currentTime } = require('../../utils')();
const { ZERO_ADDRESS } = require('../../utils/helpers');

contract('SpeedMarketsBonus', (accounts) => {
	const [owner, user, safeBox] = accounts;

	describe('Test Speed markets bonus configuration', () => {
		it('should set and get bonus correctly', async () => {
			// Deploy minimal contracts
			let SpeedMarketsAMMContract = artifacts.require('SpeedMarketsAMM');
			let speedMarketsAMM = await SpeedMarketsAMMContract.new();

			let ExoticUSD = artifacts.require('ExoticUSD');
			let exoticUSD = await ExoticUSD.new();

			// Deploy minimal requirements for initialization
			let MockPyth = artifacts.require('MockPythCustom');
			let mockPyth = await MockPyth.new(60, 1);

			let AddressManager = artifacts.require('AddressManager');
			let addressManager = await AddressManager.new();
			await addressManager.initialize(
				owner,
				safeBox,
				ZERO_ADDRESS, // referrals
				ZERO_ADDRESS, // stakingThales
				ZERO_ADDRESS, // multiCollateralOnOffRamp
				mockPyth.address,
				speedMarketsAMM.address
			);

			await speedMarketsAMM.initialize(owner, exoticUSD.address);
			await speedMarketsAMM.setAMMAddresses(
				ZERO_ADDRESS, // mastercopy not needed for this test
				ZERO_ADDRESS, // utils not needed for this test
				addressManager.address
			);

			// Create test collateral token
			let TestToken = artifacts.require('ExoticUSD');
			let testToken = await TestToken.new();

			// Test setting bonus
			await speedMarketsAMM.setCollateralBonus(testToken.address, toUnit(0.02)); // 2%
			let bonus = await speedMarketsAMM.bonusPerCollateral(testToken.address);
			assert.equal(bonus.toString(), toUnit(0.02).toString(), 'Bonus should be 2%');

			// Test updating bonus
			await speedMarketsAMM.setCollateralBonus(testToken.address, toUnit(0.05)); // 5%
			bonus = await speedMarketsAMM.bonusPerCollateral(testToken.address);
			assert.equal(bonus.toString(), toUnit(0.05).toString(), 'Bonus should be updated to 5%');

			// Test removing bonus
			await speedMarketsAMM.setCollateralBonus(testToken.address, 0);
			bonus = await speedMarketsAMM.bonusPerCollateral(testToken.address);
			assert.equal(bonus.toString(), '0', 'Bonus should be removed');
		});

		it('should enforce bonus limits', async () => {
			let SpeedMarketsAMMContract = artifacts.require('SpeedMarketsAMM');
			let speedMarketsAMM = await SpeedMarketsAMMContract.new();

			let ExoticUSD = artifacts.require('ExoticUSD');
			let exoticUSD = await ExoticUSD.new();

			// Deploy minimal requirements
			let MockPyth = artifacts.require('MockPythCustom');
			let mockPyth = await MockPyth.new(60, 1);

			let AddressManager = artifacts.require('AddressManager');
			let addressManager = await AddressManager.new();
			await addressManager.initialize(
				owner,
				safeBox,
				ZERO_ADDRESS,
				ZERO_ADDRESS,
				ZERO_ADDRESS,
				mockPyth.address,
				speedMarketsAMM.address
			);

			await speedMarketsAMM.initialize(owner, exoticUSD.address);
			await speedMarketsAMM.setAMMAddresses(ZERO_ADDRESS, ZERO_ADDRESS, addressManager.address);

			let TestToken = artifacts.require('ExoticUSD');
			let testToken = await TestToken.new();

			// Test maximum bonus (10%)
			await speedMarketsAMM.setCollateralBonus(testToken.address, toUnit(0.1)); // Should work
			let bonus = await speedMarketsAMM.bonusPerCollateral(testToken.address);
			assert.equal(bonus.toString(), toUnit(0.1).toString(), 'Should accept 10% bonus');

			// Test exceeding maximum
			await expect(
				speedMarketsAMM.setCollateralBonus(testToken.address, toUnit(0.11)) // 11%
			).to.be.revertedWith('Bonus too high');
		});

		it('should enforce access control', async () => {
			let SpeedMarketsAMMContract = artifacts.require('SpeedMarketsAMM');
			let speedMarketsAMM = await SpeedMarketsAMMContract.new();

			let ExoticUSD = artifacts.require('ExoticUSD');
			let exoticUSD = await ExoticUSD.new();

			// Deploy minimal requirements
			let MockPyth = artifacts.require('MockPythCustom');
			let mockPyth = await MockPyth.new(60, 1);

			let AddressManager = artifacts.require('AddressManager');
			let addressManager = await AddressManager.new();
			await addressManager.initialize(
				owner,
				safeBox,
				ZERO_ADDRESS,
				ZERO_ADDRESS,
				ZERO_ADDRESS,
				mockPyth.address,
				speedMarketsAMM.address
			);

			await speedMarketsAMM.initialize(owner, exoticUSD.address);
			await speedMarketsAMM.setAMMAddresses(ZERO_ADDRESS, ZERO_ADDRESS, addressManager.address);

			let TestToken = artifacts.require('ExoticUSD');
			let testToken = await TestToken.new();

			// Test only owner can set bonus
			await expect(
				speedMarketsAMM.setCollateralBonus(testToken.address, toUnit(0.05), { from: user })
			).to.be.revertedWith('Only the contract owner may perform this action');
		});
	});
});
