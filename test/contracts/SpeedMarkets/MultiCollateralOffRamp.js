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
			assert.bnEqual(balance, toUnit('90'));

			balance = await exoticUSDC.balanceOf(user);
			console.log('Balance exoticUSDC user after ' + balance / 1e6);
			assert.bnEqual(balance, toUnitSix('109.999'));

			console.log('TEST OP OFFRAMP!!!!!!!!!!!!!!!!!!!');

			await exoticOP.mintForUser(proxyUser);
			await exoticOP.transfer(swapRouterMock.address, toUnit(100), { from: proxyUser });

			balance = await exoticUSD.balanceOf(user);
			console.log('Balance exoticUSD user before ' + balance / 1e18);
			balance = await exoticOP.balanceOf(user);
			console.log('Balance exoticOP user before ' + balance / 1e18);

			await MockPriceFeedDeployed.setPricetoReturn(toUnit(1));
			await swapRouterMock.setMultiplier(1);

			minimumReceivedOfframp = await multiCollateralOnOffRamp.getMinimumReceivedOfframp(
				exoticOP.address,
				toUnit(10)
			);
			console.log('minimumReceivedOfframp OP for 10 sUSD is ' + minimumReceivedOfframp / 1e18);

			await multiCollateralOnOffRamp.setSupportedCollateral(exoticOP.address, true);
			await swapRouterMock.setDefaults(exoticUSD.address, exoticOP.address);

			await multiCollateralOnOffRamp.offramp(exoticOP.address, toUnit(10), { from: user });

			balance = await exoticUSD.balanceOf(user);
			console.log('Balance exoticUSD user after ' + balance / 1e18);
			assert.bnEqual(balance, toUnit('80'));
			balance = await exoticOP.balanceOf(user);
			console.log('Balance exoticOP user after ' + balance / 1e18);
			assert.bnEqual(balance, toUnit('109.9'));

			console.log('TEST OP OFFRAMP rate 0.5!!!!!!!!!!!!!!!!!!!');

			await MockPriceFeedDeployed.setPricetoReturn(toUnit(0.5));

			minimumReceivedOfframp = await multiCollateralOnOffRamp.getMinimumReceivedOfframp(
				exoticOP.address,
				toUnit(10)
			);
			console.log('minimumReceivedOfframp OP for 10 sUSD is ' + minimumReceivedOfframp / 1e18);

			let maximumReceivedOfframp = await multiCollateralOnOffRamp.getMaximumReceivedOfframp(
				exoticOP.address,
				toUnit(10)
			);
			console.log('maximumReceivedOfframp OP for 10 sUSD is ' + maximumReceivedOfframp / 1e18);

			await multiCollateralOnOffRamp.offramp(exoticOP.address, toUnit(10), { from: user });

			balance = await exoticUSD.balanceOf(user);
			console.log('Balance exoticUSD user after ' + balance / 1e18);
			assert.bnEqual(balance, toUnit('70'));
			balance = await exoticOP.balanceOf(user);
			console.log('Balance exoticOP user after ' + balance / 1e18);
			assert.bnEqual(balance, toUnit('129.7'));

			console.log('TEST ETH OFFRAMP at rate 100!!!!!!!!!!!!!!!!!!!');

			await MockPriceFeedDeployed.setPricetoReturn(toUnit(100));

			let userEthBalance = await web3.eth.getBalance(user);
			console.log('userEthBalance ' + userEthBalance);

			await mockWeth.deposit({ value: toUnit(1), from: user });

			userEthBalance = await web3.eth.getBalance(user);
			console.log('userEthBalance ' + userEthBalance);

			let userWethBalance = await mockWeth.balanceOf(user);
			console.log('userWethBalance ' + userWethBalance / 1e18);

			let mockWethBalanceETH = await web3.eth.getBalance(mockWeth.address);
			console.log('mockWethBalanceETH ' + mockWethBalanceETH);

			await mockWeth.withdraw(toUnit(0.1), { from: user });

			userEthBalance = await web3.eth.getBalance(user);
			console.log('userEthBalance ' + userEthBalance);

			mockWethBalanceETH = await web3.eth.getBalance(mockWeth.address);
			console.log('mockWethBalanceETH ' + mockWethBalanceETH);

			minimumReceivedOfframp = await multiCollateralOnOffRamp.getMinimumReceivedOfframp(
				mockWeth.address,
				toUnit(10)
			);
			console.log('minimumReceivedOfframp WETH for 10 sUSD is ' + minimumReceivedOfframp / 1e18);

			maximumReceivedOfframp = await multiCollateralOnOffRamp.getMaximumReceivedOfframp(
				mockWeth.address,
				toUnit(10)
			);
			console.log('maximumReceivedOfframp WETH for 10 sUSD is ' + maximumReceivedOfframp / 1e18);

			await multiCollateralOnOffRamp.setSupportedCollateral(mockWeth.address, true);
			await swapRouterMock.setDefaults(exoticUSD.address, mockWeth.address);

			await mockWeth.transfer(swapRouterMock.address, toUnit(0.5), { from: user });

			let swapRouterMockWethBalance = await mockWeth.balanceOf(swapRouterMock.address);
			console.log('swapRouterMockWethBalance before ' + swapRouterMockWethBalance / 1e18);

			mockWethBalanceETH = await web3.eth.getBalance(mockWeth.address);
			console.log('mockWethBalanceETH before' + mockWethBalanceETH);

			userEthBalance = await web3.eth.getBalance(user);
			console.log('userEthBalance before' + userEthBalance);

			await multiCollateralOnOffRamp.offrampIntoEth(toUnit(10), { from: user });

			let mockWethBalanceETHAfter = await web3.eth.getBalance(mockWeth.address);
			console.log('mockWethBalanceETH after ' + mockWethBalanceETHAfter);

			balance = await exoticUSD.balanceOf(user);
			console.log('Balance exoticUSD user after ' + balance / 1e18);
			assert.bnEqual(balance, toUnit('60'));

			let userEthBalanceAfter = await web3.eth.getBalance(user);
			console.log('userEthBalance after ' + userEthBalanceAfter);

			let userEthBalanceDiff = userEthBalanceAfter / 1e18 - userEthBalance / 1e18;
			console.log('userEthBalanceDiff ' + userEthBalanceDiff);

			let mockWethEthBalanceDiff = mockWethBalanceETH / 1e18 - mockWethBalanceETHAfter / 1e18;
			console.log('mockWethEthBalanceDiff ' + mockWethEthBalanceDiff);

			assert.bnGte(toUnit(mockWethEthBalanceDiff), toUnit('0.09'));
			assert.bnLte(toUnit(mockWethEthBalanceDiff), toUnit('0.11'));
		});
	});
});
