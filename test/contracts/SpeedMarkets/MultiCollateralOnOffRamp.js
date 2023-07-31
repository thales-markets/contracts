'use strict';

const { artifacts, contract, web3 } = require('hardhat');
const { toBN } = web3.utils;

const { assert } = require('../../utils/common');

const { toBytes32 } = require('../../../index');
const { expect } = require('chai');
const { toDecimal } = require('web3-utils');
const { setupAllContracts } = require('../../utils/setup');

const ZERO_ADDRESS = '0x' + '0'.repeat(40);

const { fastForward, toUnit, fromUnit, currentTime } = require('../../utils')();
const { encodeCall, convertToDecimals } = require('../../utils/helpers');

contract('MultiCollateralOnOffRamp', (accounts) => {
	const [owner, user, safeBox] = accounts;

	describe('Test MultiCollateralOnOffRamp  ', () => {
		it('deploy and test', async () => {
			let MultiCollateralOnOffRamp = artifacts.require('MultiCollateralOnOffRamp');
			let multiCollateralOnOffRamp = await MultiCollateralOnOffRamp.new();

			let ExoticUSD = artifacts.require('ExoticUSD');
			let exoticUSD = await ExoticUSD.new();
			await exoticUSD.setDefaultAmount(toUnit(100));
			await exoticUSD.mintForUser(user);
			let balance = await exoticUSD.balanceOf(user);
			console.log('Balance of user is ' + balance / 1e18);

			// await exoticUSD.transfer(speedMarketsAMM.address, toUnit(100), { from: user });

			// await exoticUSD.mintForUser(owner);
			// balance = await exoticUSD.balanceOf(owner);
			// console.log('Balance of user is ' + balance / 1e18);
			//
			// let balanceOfSpeedMarketAMMBefore = await exoticUSD.balanceOf(speedMarketsAMM.address);
			//
			// await exoticUSD.approve(speedMarketsAMM.address, toUnit(100));

			let MockPriceFeed = artifacts.require('MockPriceFeed');
			let MockPriceFeedDeployed = await MockPriceFeed.new(owner);
			await MockPriceFeedDeployed.setPricetoReturn(10000);

			await multiCollateralOnOffRamp.initialize(owner, exoticUSD.address);

			let ExoticOP = artifacts.require('ExoticUSD');
			let exoticOP = await ExoticUSD.new();

			await expect(multiCollateralOnOffRamp.onramp(exoticOP.address, toUnit(1))).to.be.revertedWith(
				'Unsupported collateral'
			);

			await multiCollateralOnOffRamp.setSupportedCollateral(exoticOP.address, true);
			await expect(multiCollateralOnOffRamp.onramp(exoticOP.address, toUnit(1))).to.be.revertedWith(
				'Unsupported caller'
			);

			await multiCollateralOnOffRamp.setSupportedAMM(user, true);

			await exoticOP.setDefaultAmount(toUnit(100));
			await exoticOP.mintForUser(user);
			balance = await exoticOP.balanceOf(user);
			console.log('Balance of user is ' + balance / 1e18);

			await exoticOP.approve(multiCollateralOnOffRamp.address, toUnit(100), { from: user });

			let SwapRouterMock = artifacts.require('SwapRouterMock');
			let swapRouterMock = await SwapRouterMock.new();

			await multiCollateralOnOffRamp.setSwapRouter(swapRouterMock.address);

			// await multiCollateralOnOffRamp.onramp(exoticOP.address, toUnit(1), { from: user });
		});
	});
});
