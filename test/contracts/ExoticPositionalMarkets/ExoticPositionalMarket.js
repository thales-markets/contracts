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
const ThalesContract = artifacts.require('contracts/Token/OpThales_L1.sol:OpThales');
let ExoticPositionalMarket;
let ExoticPositionalMarketManager;
let Thales;
let answer;
let minimumPositioningDuration = 0;
let minimumMarketMaturityDuration = 0;

let marketQuestion,
	endOfPositioning,
	marketMaturity,
	fixedTicketPrice,
	withdrawalFeePercentage,
	tag,
	paymentToken,
    phrase1,
    phrase2,
    phrase3,
	deployedMarket

contract('Exotic Positional market', async accounts => {
	const [manager, owner, userOne, userTwo, dummyContractAddress] = accounts;
	let initializeData;
	beforeEach(async () => {
		ExoticPositionalMarket = await ExoticPositionalMarketContract.new();
		ExoticPositionalMarketManager = await ExoticPositionalMarketManagerContract.new();
		Thales = await ThalesContract.new({from:owner});
		await ExoticPositionalMarketManager.initialize(
			manager,
			minimumPositioningDuration,
			minimumMarketMaturityDuration,
			ExoticPositionalMarket.address,
			{from: manager}
		);

		await Thales.transfer(userOne, toUnit("1000"), {from: owner});
		await Thales.transfer(userTwo, toUnit("1000"), {from: owner});
	});

	describe('initialized', function() {
		it('has not been initialized', async function() {
			answer = await ExoticPositionalMarket.tag();
			assert.equal(answer, "0");
		});
	});
	
	describe('create Exotic market', function() {
		beforeEach(async () => {
			marketQuestion = "Who will win the el clasico which will be played on 2022-02-22?";
			endOfPositioning = "100";
			marketMaturity = "200";
			fixedTicketPrice = "10";
			withdrawalFeePercentage = "5";
			tag = ["1","2","3"];
			paymentToken = Thales.address;
			phrase1 = "Real Madrid";
			phrase2 = "FC Barcelona";
			phrase3 = "It will be a draw";

			answer = await ExoticPositionalMarketManager.createExoticMarketThree(
				marketQuestion,
				endOfPositioning,
				marketMaturity,
				fixedTicketPrice,
				withdrawalFeePercentage,
				tag,
				paymentToken,
				phrase1,
				phrase2,
				phrase3,
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
			answer = await deployedMarket.creationTime();
			let creationTime = parseInt(answer.toString());
			answer = await deployedMarket.endOfPositioning();
			assert.equal(answer.toString(),creationTime + parseInt(endOfPositioning));
			answer = await deployedMarket.marketMaturity();
			assert.equal(answer.toString(), creationTime + parseInt(marketMaturity));
		});
		
		it('can position', async function() {
			answer = await deployedMarket.canUsersPlacePosition();
			assert.equal(answer, true);
		});
		
		it('can not resolve', async function() {
			answer = await deployedMarket.canMarketBeResolved();
			assert.equal(answer, false);
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
			assert.equal(answer.toString(), phrase1);

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
