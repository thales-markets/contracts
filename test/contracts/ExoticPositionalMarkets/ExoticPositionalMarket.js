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
const ExoticPositionalMarketManagerContract = artifacts.require('ExoticPositionalMarketManager');
const ThalesOracleCouncilContract = artifacts.require('ThalesOracleCouncil');
const ThalesContract = artifacts.require('contracts/Token/OpThales_L1.sol:OpThales');
let ExoticPositionalMarket;
let ExoticPositionalMarketManager;
let ThalesOracleCouncil;
let Thales;
let answer;
let minimumPositioningDuration = 0;
let minimumMarketMaturityDuration = 0;

let marketQuestion,
	endOfPositioning,
	fixedTicketPrice,
	withdrawalFeePercentage,
	tag,
	paymentToken,
    phrases = [],
	deployedMarket

contract('Exotic Positional market', async accounts => {
	const [manager, owner, userOne, userTwo, dummyContractAddress] = accounts;
	let initializeData;
	beforeEach(async () => {
		ExoticPositionalMarket = await ExoticPositionalMarketContract.new();
		ExoticPositionalMarketManager = await ExoticPositionalMarketManagerContract.new();
		ThalesOracleCouncil = await ThalesOracleCouncilContract.new();
		Thales = await ThalesContract.new({from:owner});
		await ExoticPositionalMarketManager.initialize(
			manager,
			minimumPositioningDuration,
			ExoticPositionalMarket.address,
			{from: manager}
		);
		await ExoticPositionalMarketManager.setOracleCouncilAddress(ThalesOracleCouncil.address);
		await Thales.transfer(userOne, toUnit("1000"), {from: owner});
		await Thales.transfer(userTwo, toUnit("1000"), {from: owner});
	});

	describe('initial deploy', function() {
		it('deployed', async function() {
			assert.notEqual(ExoticPositionalMarket.address, ZERO_ADDRESS);
		});
	});
	
	describe('create Exotic market', function() {
		beforeEach(async () => {
			marketQuestion = "Who will win the el clasico which will be played on 2022-02-22?";
			endOfPositioning = "100";
			fixedTicketPrice = "10";
			withdrawalFeePercentage = "5";
			tag = [1,2,3];
			paymentToken = Thales.address;
			phrases = ["Real Madrid", "FC Barcelona", "It will be a draw"];
			

			answer = await ExoticPositionalMarketManager.createExoticMarket(
				marketQuestion,
				endOfPositioning,
				fixedTicketPrice,
				withdrawalFeePercentage,
				tag,
				paymentToken,
				phrases,
				{from: owner}
			);
			
			answer = await ExoticPositionalMarketManager.getMarketAddress("0");
			deployedMarket = await ExoticPositionalMarketContract.at(answer);
		});
		it('new market', async function() {
			answer = await ExoticPositionalMarketManager.numOfActiveMarkets();
			assert.equal(answer, "1");
		});
		
		it('new market is active?', async function() {
			answer = await ExoticPositionalMarketManager.isActiveMarket(deployedMarket.address);
			console.log("Market address: ", deployedMarket.address);
			assert.equal(answer, true);
			answer = await deployedMarket.endOfPositioning();
			assert.equal(answer.toString(),endOfPositioning);
		});
		
		it('can position', async function() {
			answer = await deployedMarket.canUsersPlacePosition();
			assert.equal(answer, true);
		});
		
		it('can not resolve', async function() {
			answer = await deployedMarket.canMarketBeResolved();
			assert.equal(answer, false);
		});
		
		it('tags match', async function() {
			answer = await deployedMarket.getTagCount();
			assert.equal(answer.toString(), tag.length.toString());
			for(let i=0; i<tag.length; i++) {
				answer = await deployedMarket.tag(i.toString());
				assert.equal(answer.toString(), tag[i].toString());
			}
		});
		
		it('userOne takes position', async function() {
			answer = await Thales.increaseAllowance(deployedMarket.address, toUnit("100"), {from: userOne});
			answer = await deployedMarket.takeAPosition("1", {from: userOne});
			answer = await deployedMarket.totalTicketHolders();
			assert.equal(answer, "1");
			
			answer = await deployedMarket.getTicketHolderPosition(userOne);
			assert.equal(answer.toString(), "1");
			
			answer = await deployedMarket.getTicketHolderPositionPhrase(userOne);
			console.log("Position phrase: ", answer.toString());
			assert.equal(answer.toString(), phrases[0]);

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
