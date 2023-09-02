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

			await exoticUSD.mintForUser(proxyUser);
			await exoticUSD.transfer(curveMock.address, toUnit(100), { from: proxyUser });
			balance = await exoticUSD.balanceOf(curveMock.address);
			console.log('Balance of curve router is ' + balance / 1e18);

			balance = await exoticUSDC.balanceOf(user);
			console.log('USDC Balance of user is ' + balance / 1e6);

			await exoticUSDC.approve(multiCollateralOnOffRamp.address, toUnitSix(100), { from: user });

			await expect(
				multiCollateralOnOffRamp.onramp(exoticUSDC.address, toUnitSix(10), { from: user })
			).to.be.revertedWith('Unsupported collateral');
			await multiCollateralOnOffRamp.setSupportedCollateral(exoticUSDC.address, true);

			balance = await exoticUSD.balanceOf(curveMock.address);
			console.log('Balance exoticUSD curveMock.address before ' + balance / 1e18);
			balance = await exoticUSDC.balanceOf(curveMock.address);
			console.log('Balance exoticUSDC curveMock.address before ' + balance / 1e6);

			balance = await exoticUSD.balanceOf(multiCollateralOnOffRamp.address);
			console.log('Balance exoticUSD multiCollateralOnOffRamp.address before ' + balance / 1e18);
			balance = await exoticUSDC.balanceOf(multiCollateralOnOffRamp.address);
			console.log('Balance exoticUSDC multiCollateralOnOffRamp.address before ' + balance / 1e6);

			balance = await exoticUSD.balanceOf(user);
			console.log('Balance exoticUSD user before ' + balance / 1e18);
			balance = await exoticUSDC.balanceOf(user);
			console.log('Balance exoticUSDC user before ' + balance / 1e6);

			await multiCollateralOnOffRamp.onramp(exoticUSDC.address, toUnitSix(10), { from: user });

			balance = await exoticUSD.balanceOf(curveMock.address);
			console.log('Balance exoticUSD curveMock.address after ' + balance / 1e18);
			balance = await exoticUSDC.balanceOf(curveMock.address);
			console.log('Balance exoticUSDC curveMock.address after ' + balance / 1e6);

			balance = await exoticUSD.balanceOf(multiCollateralOnOffRamp.address);
			console.log('Balance exoticUSD multiCollateralOnOffRamp.address after ' + balance / 1e18);
			balance = await exoticUSDC.balanceOf(multiCollateralOnOffRamp.address);
			console.log('Balance exoticUSDC multiCollateralOnOffRamp.address after ' + balance / 1e6);

			balance = await exoticUSD.balanceOf(user);
			console.log('Balance exoticUSD user after ' + balance / 1e18);
			balance = await exoticUSDC.balanceOf(user);
			console.log('Balance exoticUSDC user after ' + balance / 1e6);

			await curveMock.setMultiplier(2);
			await expect(
				multiCollateralOnOffRamp.onramp(exoticUSDC.address, toUnitSix(10), { from: user })
			).to.be.revertedWith('Amount above max allowed peg slippage');

			let MockWeth = artifacts.require('MockWeth');
			let mockWeth = await MockWeth.new();
			let userEthBalance = await web3.eth.getBalance(user);
			console.log('userEthBalance ' + userEthBalance);

			await multiCollateralOnOffRamp.setWETH(mockWeth.address);

			balance = await mockWeth.balanceOf(user);
			console.log('Balance weth user' + balance / 1e18);

			balance = await exoticUSD.balanceOf(user);
			console.log('Balance exoticUSD user before ' + balance / 1e18);

			await expect(
				multiCollateralOnOffRamp.onrampWithEth(toUnit('1'), { from: user, value: toUnit('1') })
			).to.be.revertedWith('Unsupported collateral');

			await multiCollateralOnOffRamp.setSupportedCollateral(mockWeth.address, true);

			await swapRouterMock.setDefaults(mockWeth.address, exoticUSD.address);
			await expect(
				multiCollateralOnOffRamp.onrampWithEth(toUnit('1'), { from: user, value: toUnit('1') })
			).to.be.revertedWith('Amount above max allowed peg slippage');

			await swapRouterMock.setMultiplier(1);
			await multiCollateralOnOffRamp.onrampWithEth(toUnit('1'), { from: user, value: toUnit('1') });

			balance = await exoticUSD.balanceOf(user);
			console.log('Balance exoticUSD user after ' + balance / 1e18);

			userEthBalance = await web3.eth.getBalance(user);
			console.log('userEthBalance after' + userEthBalance);

			await MockPriceFeedDeployed.setPricetoReturn(toUnit(2));

			let minimumNeeded = await multiCollateralOnOffRamp.getMinimumNeeded(
				exoticOP.address,
				toUnit(10)
			);
			console.log('minimumNeeded OP to receive 10 sUSD at rate 2 is ' + minimumNeeded / 1e18);

			await MockPriceFeedDeployed.setPricetoReturn(toUnit(1));

			minimumNeeded = await multiCollateralOnOffRamp.getMinimumNeeded(exoticOP.address, toUnit(10));
			console.log('minimumNeeded OP to receive 10 sUSD is ' + minimumNeeded / 1e18);

			assert.bnEqual(minimumNeeded, toUnit('10.1'));
		});
	});
});
