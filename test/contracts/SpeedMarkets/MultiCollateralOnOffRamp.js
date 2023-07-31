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
	const [owner, user, safeBox, proxyUser] = accounts;

	describe('Test MultiCollateralOnOffRamp  ', () => {
		it('deploy and test', async () => {
			let MultiCollateralOnOffRamp = artifacts.require('MultiCollateralOnOffRamp');
			let multiCollateralOnOffRamp = await MultiCollateralOnOffRamp.new();

			let ExoticUSD = artifacts.require('ExoticUSD');
			let exoticUSD = await ExoticUSD.new();
			await exoticUSD.setDefaultAmount(toUnit(100));

			let MockPriceFeed = artifacts.require('MockPriceFeed');
			let MockPriceFeedDeployed = await MockPriceFeed.new(owner);
			await MockPriceFeedDeployed.setPricetoReturn(10000);

			await multiCollateralOnOffRamp.initialize(owner, exoticUSD.address);

			let ExoticOP = artifacts.require('ExoticUSD');
			let exoticOP = await ExoticUSD.new();

			await expect(multiCollateralOnOffRamp.onramp(exoticOP.address, toUnit(1))).to.be.revertedWith(
				'Unsupported collateral'
			);

			await multiCollateralOnOffRamp.setPriceFeed(MockPriceFeedDeployed.address);

			await multiCollateralOnOffRamp.setSupportedCollateral(exoticOP.address, true);
			await expect(multiCollateralOnOffRamp.onramp(exoticOP.address, toUnit(1))).to.be.revertedWith(
				'Unsupported caller'
			);

			await multiCollateralOnOffRamp.setSupportedAMM(user, true);

			await exoticOP.setDefaultAmount(toUnit(100));
			await exoticOP.mintForUser(user);
			let balance = await exoticOP.balanceOf(user);
			console.log('Balance of user is ' + balance / 1e18);

			await exoticOP.approve(multiCollateralOnOffRamp.address, toUnit(100), { from: user });

			let SwapRouterMock = artifacts.require('SwapRouterMock');
			let swapRouterMock = await SwapRouterMock.new();

			await multiCollateralOnOffRamp.setSwapRouter(swapRouterMock.address);
			await swapRouterMock.setDefaults(exoticOP.address, exoticUSD.address);

			await exoticUSD.mintForUser(proxyUser);
			await exoticUSD.transfer(swapRouterMock.address, toUnit(100), { from: proxyUser });
			balance = await exoticUSD.balanceOf(swapRouterMock.address);
			console.log('Balance of swap router is ' + balance / 1e18);

			await MockPriceFeedDeployed.setPricetoReturn(toUnit(1));

			balance = await exoticUSD.balanceOf(swapRouterMock.address);
			console.log('Balance exoticUSD swapRouterMock.address before ' + balance / 1e18);
			balance = await exoticOP.balanceOf(swapRouterMock.address);
			console.log('Balance exoticOP swapRouterMock.address before ' + balance / 1e18);

			balance = await exoticUSD.balanceOf(multiCollateralOnOffRamp.address);
			console.log('Balance exoticUSD multiCollateralOnOffRamp.address before ' + balance / 1e18);
			balance = await exoticOP.balanceOf(multiCollateralOnOffRamp.address);
			console.log('Balance exoticOP multiCollateralOnOffRamp.address before ' + balance / 1e18);

			balance = await exoticUSD.balanceOf(user);
			console.log('Balance exoticUSD user before ' + balance / 1e18);
			balance = await exoticOP.balanceOf(user);
			console.log('Balance exoticOP user before ' + balance / 1e18);

			await multiCollateralOnOffRamp.onramp(exoticOP.address, toUnit(10), { from: user });

			balance = await exoticUSD.balanceOf(swapRouterMock.address);
			console.log('Balance exoticUSD swapRouterMock.address after ' + balance / 1e18);
			balance = await exoticOP.balanceOf(swapRouterMock.address);
			console.log('Balance exoticOP swapRouterMock.address after ' + balance / 1e18);

			balance = await exoticUSD.balanceOf(multiCollateralOnOffRamp.address);
			console.log('Balance exoticUSD multiCollateralOnOffRamp.address after ' + balance / 1e18);
			balance = await exoticOP.balanceOf(multiCollateralOnOffRamp.address);
			console.log('Balance exoticOP multiCollateralOnOffRamp.address after ' + balance / 1e18);

			balance = await exoticUSD.balanceOf(user);
			console.log('Balance exoticUSD user after ' + balance / 1e18);
			balance = await exoticOP.balanceOf(user);
			console.log('Balance exoticOP user after ' + balance / 1e18);

			await swapRouterMock.setMultiplier(2);
			await expect(
				multiCollateralOnOffRamp.onramp(exoticOP.address, toUnit(10), { from: user })
			).to.be.revertedWith('Amount above max allowed peg slippage');
		});
	});
});
