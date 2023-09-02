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

const { toWei } = require('web3-utils');
const toUnitSix = (amount) => toBN(toWei(amount.toString(), 'ether') / 1e12);

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

			let ExoticUSDC = artifacts.require('ExoticUSDC');
			let exoticUSDC = await ExoticUSDC.new();
			await exoticUSDC.mintForUser(user);

			let CurveMock = artifacts.require('CurveMock');
			let curveMock = await CurveMock.new(
				exoticUSD.address,
				exoticUSDC.address,
				exoticUSDC.address,
				exoticUSDC.address
			);

			await multiCollateralOnOffRamp.setCurveSUSD(
				curveMock.address,
				exoticUSDC.address,
				exoticUSDC.address,
				exoticUSDC.address,
				true,
				toUnit('0.01')
			);

			await MockPriceFeedDeployed.setPricetoReturn(toUnit(1));

			let minimumNeeded = await multiCollateralOnOffRamp.getMinimumNeeded(
				exoticOP.address,
				toUnit(10)
			);
			console.log('minimumNeeded OP to receive 10 sUSD at rate 1 is ' + minimumNeeded / 1e18);

			assert.bnEqual(minimumNeeded, toUnit('10.1'));

			await MockPriceFeedDeployed.setPricetoReturn(toUnit(2));

			minimumNeeded = await multiCollateralOnOffRamp.getMinimumNeeded(exoticOP.address, toUnit(10));
			console.log('minimumNeeded OP to receive 10 sUSD at rate 2 is ' + minimumNeeded / 1e18);
			assert.bnEqual(minimumNeeded, toUnit('5.05'));

			await MockPriceFeedDeployed.setPricetoReturn(toUnit(0.5));

			minimumNeeded = await multiCollateralOnOffRamp.getMinimumNeeded(exoticOP.address, toUnit(10));
			console.log('minimumNeeded OP to receive 10 sUSD at rate 0.5 is ' + minimumNeeded / 1e18);
			assert.bnEqual(minimumNeeded, toUnit('20.2'));

			minimumNeeded = await multiCollateralOnOffRamp.getMinimumNeeded(
				exoticUSDC.address,
				toUnit(10)
			);
			console.log('minimumNeeded USDC to receive 10 sUSD is ' + minimumNeeded / 1e6);
			assert.bnEqual(minimumNeeded, toUnitSix('10.1'));

			let MockWeth = artifacts.require('MockWeth');
			let mockWeth = await MockWeth.new();
			await multiCollateralOnOffRamp.setWETH(mockWeth.address);

			await MockPriceFeedDeployed.setPricetoReturn(toUnit(2000));
			minimumNeeded = await multiCollateralOnOffRamp.getMinimumNeeded(
				mockWeth.address,
				toUnit(1000)
			);
			console.log('minimumNeeded WETH to receive 1000 sUSD at rate 2k is ' + minimumNeeded / 1e18);
			assert.bnEqual(minimumNeeded, toUnit('0.505'));

			await expect(
				multiCollateralOnOffRamp.offramp(exoticUSDC.address, toUnit(10), { from: user })
			).to.be.revertedWith('Unsupported collateral');

			await multiCollateralOnOffRamp.setSupportedCollateral(exoticUSDC.address, true);

			await exoticUSD.mintForUser(user);
			await exoticUSD.approve(multiCollateralOnOffRamp.address, toUnit(100), { from: user });

			await exoticUSDC.mintForUser(proxyUser);
			await exoticUSDC.transfer(curveMock.address, toUnitSix(100), { from: proxyUser });

			balance = await exoticUSD.balanceOf(user);
			console.log('Balance exoticUSD user before ' + balance / 1e18);
			balance = await exoticUSDC.balanceOf(user);
			console.log('Balance exoticUSDC user before ' + balance / 1e6);
			balance = await exoticUSDC.balanceOf(curveMock.address);
			console.log('Balance exoticUSDC curveMock before ' + balance / 1e6);

			let minimumReceivedOfframp = await multiCollateralOnOffRamp.getMinimumReceivedOfframp(
				exoticUSDC.address,
				toUnit(10)
			);
			console.log('minimumReceivedOfframp USDC for 10 sUSD is ' + minimumReceivedOfframp / 1e6);

			await multiCollateralOnOffRamp.offramp(exoticUSDC.address, toUnit(10), { from: user });

			balance = await exoticUSD.balanceOf(user);
			console.log('Balance exoticUSD user after ' + balance / 1e18);
			balance = await exoticUSDC.balanceOf(user);
			console.log('Balance exoticUSDC user after ' + balance / 1e6);
		});
	});
});
