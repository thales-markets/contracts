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
    let PaymentTokenAddress;
    let SafeBoxAddress;
    let OracleCouncilAddress;
    let ThalesBondsAddress;
    let ExoticTagsAddress;
    let MarketDataAddress;
    let ExoticRewardsAddress;
    let OpenBidMastercopy;
    let FixedBidMastercopy;

    const OracleCouncilContract = await ethers.getContractFactory('ThalesOracleCouncil');
    const ThalesBondsContract = await ethers.getContractFactory('ThalesBonds');
    const ExoticTagsContract = await ethers.getContractFactory('ExoticPositionalTags');
    const MarketDataContract = await ethers.getContractFactory('ExoticPositionalMarketData');
    const ExoticRewardsContract = await ethers.getContractFactory('ExoticRewards');


	if (network == 'homestead') {
		console.log("Error L1 network used! Deploy only on L2 Optimism. \nTry using \'--network optimistic\'")
		return 0;
	}
	if (networkObj.chainId == 42) {
		networkObj.name = 'kovan';
		network = 'kovan';
        PaymentTokenAddress =  getTargetAddress("OpThales_L1", network);
        SafeBoxAddress = owner.address;
	}
	if (networkObj.chainId == 69) {
		networkObj.name = 'optimisticKovan';
		network = 'optimisticKovan';
		mainnetNetwork = 'kovan';
        PaymentTokenAddress =  getTargetAddress("ExoticUSD", network);
        SafeBoxAddress = owner.address;
        OracleCouncilAddress =  getTargetAddress("ThalesOracleCouncil", network);
        ThalesBondsAddress =  getTargetAddress("ThalesBonds", network);
        ExoticTagsAddress =  getTargetAddress("ExoticPositionalTags", network);
        MarketDataAddress =  getTargetAddress("ExoticPositionalMarketData", network);
        ExoticRewardsAddress =  getTargetAddress("ExoticRewards", network);
        OpenBidMastercopy =  getTargetAddress("ExoticMarketOpenBidMastercopy", network);
        FixedBidMastercopy =  getTargetAddress("ExoticMarketMasterCopy", network);
	}
	if (networkObj.chainId == 10) {
		networkObj.name = 'optimisticEthereum';
		network = 'optimisticEthereum';
        PaymentTokenAddress = getTargetAddress("ProxysUSD", network); // sUSD on OP
        SafeBoxAddress =  getTargetAddress("SafeBox", network);
	}
	

    const ExoticMarketMastercopyAddress = getTargetAddress("ExoticMarketMasterCopy", network);
    const ExoticMarketManagerAddress = getTargetAddress("ExoticMarketManager", network);
    const ExoticMarketManager = await ethers.getContractFactory('ExoticPositionalMarketManager');
    const OracleCouncil = await OracleCouncilContract.attach(OracleCouncilAddress);
    const ThalesBonds = await ThalesBondsContract.attach(ThalesBondsAddress);
    const ExoticTags = await ExoticTagsContract.attach(ExoticTagsAddress);
    const MarketData = await MarketDataContract.attach(MarketDataAddress);
    const ExoticRewards = await ExoticRewardsContract.attach(ExoticRewardsAddress);
    
	let tx;
	const ExoticManagerDeployed = await ExoticMarketManager.attach(ExoticMarketManagerAddress);
	
	tx = await ExoticManagerDeployed.setArbitraryRewardForDisputor(w3utils.toWei("0.2", "ether"), {from: owner.address});
    await tx.wait().then(e => {
        console.log('\n setArbitraryRewardForDisputor: 0.2 -> tip28: 10');
    });
    await delay(1000);
	
    tx = await ExoticManagerDeployed.setDefaultBackstopTimeout("300", {from: owner.address});
    await tx.wait().then(e => {
        console.log('\n setDefaultBackstopTimeout: 300 -> tip28: 14400 (4 hours)');
    });
    await delay(1000);
    
    tx = await ExoticManagerDeployed.setClaimTimeoutDefaultPeriod("600", {from: owner.address});
    await tx.wait().then(e => {
        console.log('\n setClaimTimeoutDefaultPeriod: 600 -> tip28: 86400 (24 hours)');
    });
    await delay(1000);
    
    tx = await ExoticManagerDeployed.setCreatorPercentage("1", {from: owner.address});
    await tx.wait().then(e => {
        console.log('\n setCreatorPercentage: 1');
    });
    await delay(1000);
    
    
    tx = await ExoticManagerDeployed.setDisputePrice(w3utils.toWei("1.5", "ether"), {from: owner.address});
    await tx.wait().then(e => {
        console.log('\n setDisputePrice: 1.5 -> tip28: 100');
    });
    await delay(1000);
    
    tx = await ExoticManagerDeployed.setDisputeStringLengthLimit("1100", {from: owner.address});
    await tx.wait().then(e => {
        console.log('\n setDisputeStringLengthLimit: 1100');
    });
    await delay(1000);

    tx = await ExoticManagerDeployed.setFixedBondAmount(w3utils.toWei("2", "ether"), {from: owner.address});
    await tx.wait().then(e => {
        console.log('\n setFixedBondAmount: 2 -> tip28:  100');
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
   
    tx = await ExoticManagerDeployed.setMaxNumberOfTags("5", {from: owner.address});
    await tx.wait().then(e => {
        console.log('\n setMaxNumberOfTags: 5');
    });
    await delay(1000);
    
    tx = await ExoticManagerDeployed.setMaxOracleCouncilMembers("5", {from: owner.address});
    await tx.wait().then(e => {
        console.log('\n setMaxOracleCouncilMembers: 5');
    });
    await delay(1000);

    tx = await ExoticManagerDeployed.setMaximumPositionsAllowed("8", {from: owner.address});
    await tx.wait().then(e => {
        console.log('\n setMaximumPositionsAllowed: 8');
    });
    await delay(1000);

    tx = await ExoticManagerDeployed.setMinimumFixedTicketAmount(w3utils.toWei("1", "ether"), {from: owner.address});
    await tx.wait().then(e => {
        console.log('\n setMinimumFixedTicketAmount: 1 -> tip28:  10');
    });
    await delay(1000);
    
    tx = await ExoticManagerDeployed.setMinimumPositioningDuration("300", {from: owner.address});
    await tx.wait().then(e => {
        console.log('\n setMinimumPositioningDuration: 300 -> tip28:  28800 (8 hours)');
    });
    await delay(1000);
    
    tx = await ExoticManagerDeployed.setOpenBidAllowed(false, {from: owner.address});
    await tx.wait().then(e => {
        console.log('\n setOpenBidAllowed: false');
    });
    await delay(1000);
    
    tx = await ExoticManagerDeployed.setPDAOResolveTimePeriod("172800", {from: owner.address});
    await tx.wait().then(e => {
        console.log('\n setPDAOResolveTimePeriod: 172800 (48 hours)');
    });
    await delay(1000);    
    
    tx = await ExoticManagerDeployed.setPaymentToken(PaymentTokenAddress, {from: owner.address});
    await tx.wait().then(e => {
        console.log('\n setPaymentToken: ', PaymentTokenAddress);
    });
    await delay(1000);

    tx = await ExoticManagerDeployed.setResolverPercentage("1", {from: owner.address});
    await tx.wait().then(e => {
        console.log('\n setResolverPercentage: 1');
    });
    await delay(1000);    
    
    tx = await ExoticManagerDeployed.setSafeBoxAddress(SafeBoxAddress, {from: owner.address});
    await tx.wait().then(e => {
        console.log('\n setSafeBoxAddress: ', SafeBoxAddress);
    });
    await delay(1000);

    tx = await ExoticManagerDeployed.setSafeBoxLowAmount(w3utils.toWei("0.1", "ether"), {from: owner.address});
    await tx.wait().then(e => {
        console.log('\n setSafeBoxLowAmount: 0.1 -> tip28: 10');
    });
    await delay(1000);
    
    tx = await ExoticManagerDeployed.setSafeBoxPercentage("1", {from: owner.address});
    await tx.wait().then(e => {
        console.log('\n setSafeBoxPercentage: 1');
    });
    await delay(1000);    
    
    tx = await ExoticManagerDeployed.setWithdrawalPercentage("6", {from: owner.address});
    await tx.wait().then(e => {
        console.log('\n setWithdrawalPercentage: 6');
    });
    await delay(1000);    
   
    tx = await ExoticManagerDeployed.setWithdrawalTimePeriod("300", {from: owner.address});
    await tx.wait().then(e => {
        console.log('\n setWithdrawalTimePeriod: 300 -> tip28: 28800 - 8h');
    });
    await delay(1000);    
	
    tx = await ExoticManagerDeployed.setMaxAmountForOpenBidPosition(w3utils.toWei("100", "ether"), "10", {from: owner.address});
    await tx.wait().then(e => {
        console.log('\n setMaxAmountForOpenBidPosition: 100 -> tip28: 1000 ');
    });
    await delay(1000);    
	
    tx = await ExoticManagerDeployed.setMaxFinalWithdrawPercentage("10", {from: owner.address});
    await tx.wait().then(e => {
        console.log('\n setWithdrawalTimePeriod: 10% -> tip28: 10% ');
    });
    await delay(1000);    
    
    tx = await ExoticManagerDeployed.setOracleCouncilAddress(OracleCouncilAddress, {from: owner.address});
    await tx.wait().then(e => {
        console.log('\n setOracleCouncilAddress: ', OracleCouncilAddress);
    });
    await delay(1000);    
    
    tx = await ExoticManagerDeployed.setThalesBonds(ThalesBondsAddress, {from: owner.address});
    await tx.wait().then(e => {
        console.log('\n setThalesBonds: ', ThalesBondsAddress);
    });
    await delay(1000);    
   
    tx = await ExoticManagerDeployed.setTagsAddress(ExoticTagsAddress, {from: owner.address});
    await tx.wait().then(e => {
        console.log('\n setTagsAddress: ', ExoticTagsAddress);
    });
    await delay(1000);    
   
    tx = await ExoticManagerDeployed.setMarketDataAddress(MarketDataAddress, {from: owner.address});
    await tx.wait().then(e => {
        console.log('\n setMarketDataAddress: ', MarketDataAddress);
    });
    await delay(1000);    

    tx = await ExoticManagerDeployed.setExoticRewards(ExoticRewardsAddress, {from: owner.address});
    await tx.wait().then(e => {
        console.log('\n setExoticRewards: ', ExoticRewardsAddress);
    });
    await delay(1000);    
    
    tx = await ExoticManagerDeployed.setExoticMarketMastercopy(FixedBidMastercopy, {from: owner.address});
    await tx.wait().then(e => {
        console.log('\n setExoticMarketMastercopy: ', FixedBidMastercopy);
    });
    await delay(1000);    
    
    tx = await ExoticManagerDeployed.setExoticMarketOpenBidMastercopy(OpenBidMastercopy, {from: owner.address});
    await tx.wait().then(e => {
        console.log('\n setExoticMarketOpenBidMastercopy: ', OpenBidMastercopy);
    });
    await delay(1000);    
   
    tx = await OracleCouncil.setMarketManager(ExoticManagerDeployed.address, {from: owner.address});
    await tx.wait().then(e => {
        console.log('\n Council setMarketManager: ', ExoticManagerDeployed.address);
    });
    await delay(1000);    
    
    tx = await ThalesBonds.setMarketManager(ExoticManagerDeployed.address, {from: owner.address});
    await tx.wait().then(e => {
        console.log('\n Bonds setMarketManager: ', ExoticManagerDeployed.address);
    });
    await delay(1000);    
    
    tx = await MarketData.setMarketManager(ExoticManagerDeployed.address, {from: owner.address});
    await tx.wait().then(e => {
        console.log('\n MarketData setMarketManager: ', ExoticManagerDeployed.address);
    });
    await delay(1000);    
    
    tx = await ExoticRewards.setMarketManager(ExoticManagerDeployed.address, {from: owner.address});
    await tx.wait().then(e => {
        console.log('\n ExoticRewards setMarketManager: ', ExoticManagerDeployed.address);
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
