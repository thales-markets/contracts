const path = require('path');
const { ethers, upgrades } = require('hardhat');
const w3utils = require('web3-utils');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');


const { getTargetAddress, setTargetAddress } = require('../helpers');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	let mainnetNetwork = 'mainnet';

	if (network == 'homestead') {
		console.log("Error L1 network used! Deploy only on L2 Optimism. \nTry using \'--network optimistic\'")
		return 0;
	}
	if (networkObj.chainId == 42) {
		networkObj.name = 'kovan';
		network = 'kovan';
	}
	if (networkObj.chainId == 69) {
		networkObj.name = 'optimisticKovan';
		network = 'optimisticKovan';
		mainnetNetwork = 'kovan';
	}
	if (networkObj.chainId == 10) {
		networkObj.name = 'optimistic';
		network = 'optimistic';
	}
	
    const ExoticMarketMastercopyAddress = getTargetAddress("ExoticMarketMasterCopy", network);
    const ExoticMarketManagerAddress = getTargetAddress("ExoticMarketManager", network);
    const ExoticMarketManager = await ethers.getContractFactory('ExoticPositionalMarketManager');
	let tx;
	const ExoticManagerDeployed = await ExoticMarketManager.attach(ExoticMarketManagerAddress);
	
	tx = await ExoticManagerDeployed.setArbitraryRewardForDisputor(w3utils.toWei("0.2", "ether"), {from: owner.address});
    await tx.wait().then(e => {
        console.log('\n setArbitraryRewardForDisputor: 0.2');
    });
    await delay(1000);
	
    tx = await ExoticManagerDeployed.setDefaultBackstopTimeout("3600", {from: owner.address});
    await tx.wait().then(e => {
        console.log('\n setDefaultBackstopTimeout: 3600');
    });
    await delay(1000);
    
    tx = await ExoticManagerDeployed.setClaimTimeoutDefaultPeriod("120", {from: owner.address});
    await tx.wait().then(e => {
        console.log('\n setClaimTimeoutDefaultPeriod: 120');
    });
    await delay(1000);
    
    tx = await ExoticManagerDeployed.setDisputePrice(w3utils.toWei("1", "ether"), {from: owner.address});
    await tx.wait().then(e => {
        console.log('\n setDisputePrice: 1');
    });
    await delay(1000);
    
    tx = await ExoticManagerDeployed.setDisputeStringLengthLimit("1100", {from: owner.address});
    await tx.wait().then(e => {
        console.log('\n setDisputeStringLengthLimit: 1100');
    });
    await delay(1000);
   
    tx = await ExoticManagerDeployed.setMarketPositionStringLimit("60", {from: owner.address});
    await tx.wait().then(e => {
        console.log('\n setMarketPositionStringLimit: 60');
    });
    await delay(1000);
   
    tx = await ExoticManagerDeployed.setMarketQuestionStringLimit("220", {from: owner.address});
    await tx.wait().then(e => {
        console.log('\n setMarketQuestionStringLimit: 220');
    });
    await delay(1000);
   
    tx = await ExoticManagerDeployed.setMarketSourceStringLimit("220", {from: owner.address});
    await tx.wait().then(e => {
        console.log('\n setMarketSourceStringLimit: 220');
    });
    await delay(1000);
   
    tx = await ExoticManagerDeployed.setMaximumPositionsAllowed("8", {from: owner.address});
    await tx.wait().then(e => {
        console.log('\n setMaximumPositionsAllowed: 8');
    });
    await delay(1000);
    
    tx = await ExoticManagerDeployed.setMinimumPositioningDuration("60", {from: owner.address});
    await tx.wait().then(e => {
        console.log('\n setMinimumPositioningDuration: 8');
    });
    await delay(1000);
    
    tx = await ExoticManagerDeployed.setOpenBidAllowed(true, {from: owner.address});
    await tx.wait().then(e => {
        console.log('\n setOpenBidAllowed: True');
    });
    await delay(1000);
    
    tx = await ExoticManagerDeployed.setSafeBoxAddress(owner.address, {from: owner.address});
    await tx.wait().then(e => {
        console.log('\n setSafeBoxAddress: ', owner.address);
    });
    await delay(1000);

    tx = await ExoticManagerDeployed.setSafeBoxLowAmount(w3utils.toWei("0.1", "ether"), {from: owner.address});
    await tx.wait().then(e => {
        console.log('\n setSafeBoxLowAmount: 0.1');
    });
    await delay(1000);
    
    tx = await ExoticManagerDeployed.setFixedBondAmount(w3utils.toWei("2", "ether"), {from: owner.address});
    await tx.wait().then(e => {
        console.log('\n setFixedBondAmount: 2');
    });
    await delay(1000);

	tx = await ExoticManagerDeployed.setMinimumFixedTicketAmount(w3utils.toWei("10", "ether"), {from: owner.address});
    await tx.wait().then(e => {
        console.log('\nsetMinimumFixedTicketAmount: 10');
    });
    await delay(1000);
	
	
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});

    
function delay(time) {
	return new Promise(function(resolve) {
		setTimeout(resolve, time);
	});
}
