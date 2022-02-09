'use strict';

const { artifacts, contract, web3 } = require('hardhat');

const { assert } = require('../../utils/common');

const { currentTime, toUnit, bytesToString } = require('../../utils')();

const {
	onlyGivenAddressCanInvoke,
	convertToDecimals,
	encodeCall,
	assertRevert,
} = require('../../utils/helpers');

const { expect } = require('chai');

const ZERO_ADDRESS = '0x' + '0'.repeat(40);
const MAX_NUMBER = '115792089237316195423570985008687907853269984665640564039457584007913129639935';

const ExoticPositionalMarketContract = artifacts.require('ExoticPositionalMarket');
let ExoticPositionalMarket;
let answer;
contract('Exotic Positional market', async accounts => {
	const [owner, userOne, userTwo, dummyContractAddress] = accounts;
	let initializeData;
	beforeEach(async () => {
		ExoticPositionalMarket = await ExoticPositionalMarketContract.new();
				
	});

	describe('initialized', function() {
		it('has not been initialized', async function() {
			answer = await ExoticPositionalMarket.tag();
			assert.equal(answer, "0");
		});
	});

	// describe('transferOwnership', function() {
	// 	describe('when the new proposed owner is not the zero address', function() {
	// 		const newOwner = userTwo;

	// 		describe('when the sender is the owner', function() {
	// 			const from = proxyOwner;

	// 			it('transfers the ownership', async function() {
	// 				await Proxy.transferProxyOwnership(newOwner, { from: proxyOwner });

	// 				const _owner = await Proxy.proxyOwner();
	// 				assert.equal(_owner, newOwner);
	// 			});

	// 			it('emits an event', async function() {
	// 				const { logs } = await Proxy.transferProxyOwnership(newOwner, { from: proxyOwner });

	// 				assert.equal(logs.length, 1);
	// 				assert.equal(logs[0].event, 'ProxyOwnershipTransferred');
	// 				assert.equal(logs[0].args.previousOwner, proxyOwner);
	// 				assert.equal(logs[0].args.newOwner, newOwner);
	// 			});
	// 		});

	
	
});
