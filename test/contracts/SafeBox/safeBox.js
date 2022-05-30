'use strict';

const { artifacts, contract, web3 } = require('hardhat');
const { BigNumber } = require('ethers');

const { assert } = require('../../utils/common');

const { currentTime, toUnit, bytesToString, fastForward } = require('../../utils')();

const { setupAllContracts } = require('../../utils/setup');
const {
	convertToDecimals,
	encodePriceSqrt,
	onlyGivenAddressCanInvoke,
	encodeCall,
} = require('../../utils/helpers');

const ZERO_ADDRESS = '0x' + '0'.repeat(40);
const DAY = 24 * 60 * 60;
const rate = toUnit(100);

const MockUniswapV3Factory = artifacts.require('MockUniswapV3Factory');

const approveValue = toUnit(1000000);

contract('SafeBox', async accounts => {
	const [owner, initialCreator, dummy] = accounts;
	let uniswapFactory,
		thalesToken,
		mockWethToken,
		mocksUSDToken,
		swapRouter,
		nonfungiblePositionManager,
		pool_WETH_someToken,
		pool_WETH_THALES,
		price_WETH_someToken,
		price_WETH_THALES,
		ProxySafeBoxDeployed,
		SafeBoxImplementation,
		SafeBoxDeployed,
		initializeData;

	async function createPool(tokenAddressA, tokenAddressB) {
		if (tokenAddressA.toLowerCase() > tokenAddressB.toLowerCase())
			[tokenAddressA, tokenAddressB] = [tokenAddressB, tokenAddressA];

		const MockUniswapV3Pool = await ethers.getContractFactory('MockUniswapV3Pool');
	 	await uniswapFactory.createPool(tokenAddressA, tokenAddressB, 3000);
		const poolAddress = await uniswapFactory.getPool(
			tokenAddressA,
			tokenAddressB,
			3000
		);
		let pool = MockUniswapV3Pool.attach(poolAddress);
		let price = BigNumber.from(encodePriceSqrt(1, 1));
		await pool.initialize(price);

		await swapRouter.setPool(tokenAddressA, tokenAddressB, poolAddress);

		console.log('pool', poolAddress);
	}

	before(async () => {
		let Thales = artifacts.require('Thales');
		let SafeBox = artifacts.require('MockSafeBox');
		let SwapRouter = artifacts.require('MockSwapRouter');
		let OwnedUpgradeabilityProxy = artifacts.require('OwnedUpgradeabilityProxy');

		uniswapFactory = await MockUniswapV3Factory.new({ from: owner });
		thalesToken = await Thales.new({ from: owner });
		mockWethToken = await Thales.new({ from: owner });
		mocksUSDToken = await Thales.new({ from: owner });
		swapRouter = await SwapRouter.new(uniswapFactory.address, mockWethToken.address, { from: owner });

		ProxySafeBoxDeployed = await OwnedUpgradeabilityProxy.new({ from: initialCreator });
		SafeBoxImplementation = await SafeBox.new({ from: owner });

		SafeBoxDeployed = await SafeBox.at(ProxySafeBoxDeployed.address);

		initializeData = encodeCall('initialize', ['address', 'address'], [owner, mocksUSDToken.address]);
		await ProxySafeBoxDeployed.upgradeToAndCall(SafeBoxImplementation.address, initializeData, {
			from: initialCreator,
		});

		// contract settings
		await SafeBoxDeployed.setTickRate(rate, { from: owner });
		await SafeBoxDeployed.setTickLength(DAY, { from: owner });
		await SafeBoxDeployed.setThalesToken(thalesToken.address, { from: owner });
		await SafeBoxDeployed.setWETHAddress(mockWethToken.address, { from: owner });
		await SafeBoxDeployed.setSwapRouter(swapRouter.address, { from: owner });
		await SafeBoxDeployed.setUniswapV3Factory(uniswapFactory.address, { from: owner });

		console.log('swap', await SafeBoxDeployed.swapRouter());
		console.log('factory', await swapRouter.factory());

		await createPool(mockWethToken.address, thalesToken.address);
		await createPool(mockWethToken.address, mocksUSDToken.address);

		const pool = await uniswapFactory.getPool(mockWethToken.address, thalesToken.address, 3000);
		console.log('weth thales pool', pool);
	});

	describe('Constructor & Settings', () => {
		it('should set someToken token on constructor', async () => {
			assert.equal(await SafeBoxDeployed.sUSD(), mocksUSDToken.address);
		});

		it('should set owner on constructor', async () => {
			const ownerAddress = await SafeBoxDeployed.owner();
			assert.equal(ownerAddress, owner);
		});
	});

	describe('Function permissions', () => {
		it('only owner can call setTickRate', async () => {
			let REVERT = 'Only the contract owner may perform this action';
			await assert.revert(
				SafeBoxDeployed.setTickRate(rate, {
					from: dummy,
				}),
				REVERT
			);
		});

		it('only owner address can call setTickLength', async () => {
			let REVERT = 'Only the contract owner may perform this action';
			await assert.revert(SafeBoxDeployed.setTickLength(DAY, { from: dummy }), REVERT);
		});

		it('only owner address can call setSwapRouter', async () => {
			await onlyGivenAddressCanInvoke({
				fnc: SafeBoxDeployed.setSwapRouter,
				args: [swapRouter.address],
				address: owner,
				accounts,
			});
		});
	});

	describe('executeBuyback()', () => {
		it('reverts', async () => {
			//await SafeBoxDeployed.executeBuyback({ from: dummy });
		});

		it('first time execution', async () => {
			assert.equal(await SafeBoxDeployed.lastBuyback(), 0);
			await SafeBoxDeployed.executeBuyback({ from: dummy });

			assert.ok((await SafeBoxDeployed.lastBuyback()) > 0);
		});

		it('reverts if not enough time passed since last call', async () => {
			const REVERT = 'Not enough ticks have passed since last buyback';
			fastForward(DAY);
			await SafeBoxDeployed.executeBuyback({ from: dummy });
			fastForward(DAY - 10);
			await assert.revert(SafeBoxDeployed.executeBuyback({ from: dummy }), REVERT);
		});
	});
});

function delay(time) {
	return new Promise(function(resolve) {
		setTimeout(resolve, time);
	});
}
