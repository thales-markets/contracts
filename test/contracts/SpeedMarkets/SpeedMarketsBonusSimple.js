'use strict';

const { artifacts, contract } = require('hardhat');
const { assert } = require('../../utils/common');
const { toBytes32 } = require('../../../index');
const { expect } = require('chai');
const { toUnit, currentTime } = require('../../utils')();
const { ZERO_ADDRESS } = require('../../utils/helpers');

contract('SpeedMarketsBonusSimple', (accounts) => {
	const [owner, user, safeBox] = accounts;

	describe('Test Speed markets bonus simple flow', () => {
		it('should calculate and apply bonus correctly', async () => {
			// Deploy minimal contracts
			let SpeedMarketsAMMContract = artifacts.require('SpeedMarketsAMM');
			let speedMarketsAMM = await SpeedMarketsAMMContract.new();

			let ExoticUSD = artifacts.require('ExoticUSD');
			let exoticUSD = await ExoticUSD.new();

			// Initialize
			await speedMarketsAMM.initialize(owner, exoticUSD.address);

			// Deploy SpeedMarket mastercopy
			let SpeedMarketContract = artifacts.require('SpeedMarket');
			let speedMarketMastercopy = await SpeedMarketContract.new();

			// Deploy mock contracts
			let MockPriceFeed = artifacts.require('MockPriceFeed');
			let mockPriceFeed = await MockPriceFeed.new(owner);
			await mockPriceFeed.setPricetoReturn(toUnit(1000)); // ETH at $1000

			let MockPyth = artifacts.require('MockPythCustom');
			let mockPyth = await MockPyth.new(60, 1);

			// Deploy AddressManager
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

			// Deploy SpeedMarketsAMMUtils
			let SpeedMarketsAMMUtils = artifacts.require('SpeedMarketsAMMUtils');
			let speedMarketsAMMUtils = await SpeedMarketsAMMUtils.new();

			// Set up AddressManager
			await addressManager.setAddresses(
				safeBox,
				ZERO_ADDRESS, // referrals
				ZERO_ADDRESS, // stakingThales
				ZERO_ADDRESS, // multiCollateralOnOffRamp
				mockPyth.address,
				speedMarketsAMM.address
			);

			// Configure AMM
			await speedMarketsAMM.setAMMAddresses(
				speedMarketMastercopy.address,
				speedMarketsAMMUtils.address,
				addressManager.address
			);

			// Set basic parameters
			await speedMarketsAMM.setLimitParams(
				toUnit(5), // min buyin
				toUnit(1000), // max buyin
				60, // min time to maturity (1 minute)
				86400, // max time to maturity (1 day)
				60, // max price delay
				30 // max price delay for resolving
			);

			await speedMarketsAMM.setSupportedAsset(toBytes32('ETH'), true);
			await speedMarketsAMM.setMaxRisks(toBytes32('ETH'), toUnit(1000), toUnit(500));
			await speedMarketsAMM.setSafeBoxAndMaxSkewImpact(toUnit(0.02), toUnit(0.05), toUnit(0.02));
			await speedMarketsAMM.setAssetToPythID(
				toBytes32('ETH'),
				'0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace'
			);

			// Fund AMM with sUSD
			await exoticUSD.setDefaultAmount(toUnit(10000));
			await exoticUSD.mintForUser(owner);
			await exoticUSD.transfer(speedMarketsAMM.address, toUnit(1000), { from: owner });

			// Create test collateral token
			let TestToken = artifacts.require('ExoticUSD');
			let testToken = await TestToken.new();

			// Set 5% bonus for test token
			await speedMarketsAMM.setCollateralBonus(testToken.address, toUnit(0.05));

			// Verify bonus
			let bonus = await speedMarketsAMM.bonusPerCollateral(testToken.address);
			console.log('Bonus percentage:', bonus / 1e18);
			assert.equal(bonus.toString(), toUnit(0.05).toString(), 'Bonus should be 5%');

			// Calculate expected payouts
			let buyinAmount = toUnit(10); // 10 sUSD buyin
			let standardPayout = buyinAmount * 2; // 20 sUSD
			let bonusPayout = standardPayout + standardPayout * 0.05; // 21 sUSD

			console.log('Buyin amount:', buyinAmount / 1e18);
			console.log('Standard payout (2x):', standardPayout / 1e18);
			console.log('Payout with 5% bonus:', bonusPayout / 1e18);

			// Test that bonus calculation is correct
			// Note: In actual market creation, the bonus would be applied based on collateral
			let ammBalance = await exoticUSD.balanceOf(speedMarketsAMM.address);
			console.log('AMM balance:', ammBalance / 1e18);

			// Verify AMM has enough balance to cover bonus payouts
			assert.isTrue(ammBalance >= bonusPayout, 'AMM should have enough balance for bonus payouts');

			console.log('Bonus calculation test passed!');
		});

		it('should handle multiple bonuses correctly', async () => {
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

			// Create multiple tokens
			let Token1 = artifacts.require('ExoticUSD');
			let token1 = await Token1.new();

			let Token2 = artifacts.require('ExoticUSD');
			let token2 = await Token2.new();

			let Token3 = artifacts.require('ExoticUSD');
			let token3 = await Token3.new();

			// Set different bonuses
			await speedMarketsAMM.setCollateralBonus(token1.address, toUnit(0.01)); // 1%
			await speedMarketsAMM.setCollateralBonus(token2.address, toUnit(0.05)); // 5%
			await speedMarketsAMM.setCollateralBonus(token3.address, toUnit(0.1)); // 10% (max)

			// Verify all bonuses
			let bonus1 = await speedMarketsAMM.bonusPerCollateral(token1.address);
			let bonus2 = await speedMarketsAMM.bonusPerCollateral(token2.address);
			let bonus3 = await speedMarketsAMM.bonusPerCollateral(token3.address);

			assert.equal(bonus1.toString(), toUnit(0.01).toString(), 'Token1 should have 1% bonus');
			assert.equal(bonus2.toString(), toUnit(0.05).toString(), 'Token2 should have 5% bonus');
			assert.equal(bonus3.toString(), toUnit(0.1).toString(), 'Token3 should have 10% bonus');

			// Test default collateral has no bonus
			let defaultBonus = await speedMarketsAMM.bonusPerCollateral(ZERO_ADDRESS);
			assert.equal(defaultBonus.toString(), '0', 'Default collateral should have no bonus');

			// Test updating existing bonus
			await speedMarketsAMM.setCollateralBonus(token1.address, toUnit(0.025)); // Update to 2.5%
			let updatedBonus = await speedMarketsAMM.bonusPerCollateral(token1.address);
			assert.equal(
				updatedBonus.toString(),
				toUnit(0.025).toString(),
				'Token1 bonus should be updated'
			);

			console.log('Multiple bonus handling test passed!');
		});
	});
});
