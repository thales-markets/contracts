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
    let TheRundownConsumer;

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
        TheRundownConsumer =  getTargetAddress("TherundownConsumer", network);
	}
	if (networkObj.chainId == 10) {
		networkObj.name = 'optimisticEthereum';
		network = 'optimisticEthereum';
        PaymentTokenAddress = getTargetAddress("ProxysUSD", network); // sUSD on OP
        SafeBoxAddress =  getTargetAddress("SafeBox", network);
        OracleCouncilAddress =  getTargetAddress("ThalesOracleCouncil", network);
        ThalesBondsAddress =  getTargetAddress("ThalesBonds", network);
        ExoticTagsAddress =  getTargetAddress("ExoticPositionalTags", network);
        MarketDataAddress =  getTargetAddress("ExoticPositionalMarketData", network);
        ExoticRewardsAddress =  getTargetAddress("ExoticRewards", network);
        OpenBidMastercopy =  getTargetAddress("ExoticMarketOpenBidMastercopy", network);
        FixedBidMastercopy =  getTargetAddress("ExoticMarketMasterCopy", network);
        TheRundownConsumer =  getTargetAddress("TherundownConsumer", network);
	}
	

    const ExoticMarketMastercopyAddress = getTargetAddress("ExoticMarketMasterCopy", network);
    const ExoticMarketOpenBidMastercopyAddress = getTargetAddress("ExoticMarketOpenBidMastercopy", network);
    const ExoticMarketManagerAddress = getTargetAddress("ExoticMarketManager", network);
    const ExoticMarketManager = await ethers.getContractFactory('ExoticPositionalMarketManager');
    const OracleCouncil = await OracleCouncilContract.attach(OracleCouncilAddress);
    const ThalesBonds = await ThalesBondsContract.attach(ThalesBondsAddress);
    const ExoticTags = await ExoticTagsContract.attach(ExoticTagsAddress);
    const MarketData = await MarketDataContract.attach(MarketDataAddress);
    const ExoticRewards = await ExoticRewardsContract.attach(ExoticRewardsAddress);
    
	let tx;
	const ExoticManagerDeployed = await ExoticMarketManager.attach(ExoticMarketManagerAddress);

    
    // PERCENTAGES
    const safeBoxPercentage = '1';
    const creatorPercentage = '1';
    const resolverPercentage = '1';
    const withdrawalPercentage = '6';
    const maxFinalWithdrawPercentage = '10';

    // DURATIONS 
	const defaultBackstopTimeout = '14400';
    const minimumPositioningDuration = '28800';
    const withdrawalTimePeriod = '28800';
    const pDAOResolveTimePeriod = '172800';
    const claimTimeoutDefaultPeriod = '86400';
   
    // LIMITS
	const marketQuestionStringLimit = '220';
    const marketSourceStringLimit = '220';
    const marketPositionStringLimit = '60';
    const disputeStringLengthLimit = '1000';
    const maximumPositionsAllowed = '8';
    const maxNumberOfTags = '5';
    const maxOracleCouncilMembers = '5';
   
    // AMOUNTS
	const minFixedTicketPrice = w3utils.toWei("10", "ether");
    const maxFixedTicketPrice = w3utils.toWei("1000", "ether");
    const disputePrice = w3utils.toWei("100", "ether");
    const fixedBondAmount = w3utils.toWei("100", "ether");
    const safeBoxLowAmount = w3utils.toWei("10", "ether");
    const arbitraryRewardForDisputor = w3utils.toWei("50", "ether");
    const maxAmountForOpenBidPosition = w3utils.toWei("1000", "ether");

    // FLAGS
	const creationRestrictedToOwner = false;
    const openBidAllowed = false;

	tx = await ExoticManagerDeployed.setPercentages(
        safeBoxPercentage, 
        creatorPercentage,
        resolverPercentage,
        withdrawalPercentage,
        maxFinalWithdrawPercentage,
        {from: owner.address});
    await tx.wait().then(e => {
        console.log('\n setPercentages: \n',
        'safeBoxPercentage: ',safeBoxPercentage, '\n',
        'creatorPercentage: ',creatorPercentage, '\n',
        'resolverPercentage: ',resolverPercentage, '\n',
        'withdrawalPercentage: ',withdrawalPercentage, '\n',
        'maxFinalWithdrawPercentage: ',maxFinalWithdrawPercentage, '\n',
        );
    });
    await delay(1000);

    
	
    tx = await ExoticManagerDeployed.setDurations(
        defaultBackstopTimeout,
        minimumPositioningDuration,
        withdrawalTimePeriod,
        pDAOResolveTimePeriod,
        claimTimeoutDefaultPeriod,
        {from: owner.address});
    await tx.wait().then(e => {
        console.log('\n setDurations: \n',
        'defaultBackstopTimeout: ', defaultBackstopTimeout, '\n',
        'minimumPositioningDuration: ', minimumPositioningDuration, '\n',
        'withdrawalTimePeriod: ', withdrawalTimePeriod, '\n',
        'pDAOResolveTimePeriod: ', pDAOResolveTimePeriod, '\n',
        'claimTimeoutDefaultPeriod: ', claimTimeoutDefaultPeriod, '\n',
        );
    });
    await delay(1000);
   
    tx = await ExoticManagerDeployed.setLimits(
        marketQuestionStringLimit,
        marketSourceStringLimit,
        marketPositionStringLimit,
        disputeStringLengthLimit,
        maximumPositionsAllowed,
        maxNumberOfTags,
        maxOracleCouncilMembers,
        {from: owner.address});
    await tx.wait().then(e => {
        console.log('\n setLimits: \n',
        'marketQuestionStringLimit: ', marketQuestionStringLimit, '\n',
        'marketSourceStringLimit: ', marketSourceStringLimit, '\n',
        'marketPositionStringLimit: ', marketPositionStringLimit, '\n',
        'disputeStringLengthLimit: ', disputeStringLengthLimit, '\n',
        'maximumPositionsAllowed: ', maximumPositionsAllowed, '\n',
        'maxNumberOfTags: ', maxNumberOfTags, '\n',
        'maxOracleCouncilMembers: ', maxOracleCouncilMembers, '\n',
        );
    });
    await delay(1000);
    
    tx = await ExoticManagerDeployed.setAmounts(
        minFixedTicketPrice,
        maxFixedTicketPrice,
        disputePrice,
        fixedBondAmount,
        safeBoxLowAmount,
        arbitraryRewardForDisputor,
        maxAmountForOpenBidPosition,
        {from: owner.address});
    await tx.wait().then(e => {
        console.log('\n setAmounts: \n',
        'minFixedTicketPrice: ', minFixedTicketPrice, '\n',
        'maxFixedTicketPrice: ', maxFixedTicketPrice, '\n',
        'disputePrice: ', disputePrice, '\n',
        'fixedBondAmount: ', fixedBondAmount, '\n',
        'safeBoxLowAmount: ', safeBoxLowAmount, '\n',
        'arbitraryRewardForDisputor: ', arbitraryRewardForDisputor, '\n',
        'maxAmountForOpenBidPosition: ', maxAmountForOpenBidPosition, '\n',
        );
    });
    await delay(1000);
    
    tx = await ExoticManagerDeployed.setFlags(
        creationRestrictedToOwner,
        openBidAllowed,
        {from: owner.address});
    await tx.wait().then(e => {
        console.log('\n setFlags: \n',
        'creationRestrictedToOwner: ', creationRestrictedToOwner, '\n',
        'openBidAllowed: ', openBidAllowed, '\n',
        );
    });
    await delay(1000);

    // tx = await ExoticManagerDeployed.setAddresses(
    //     FixedBidMastercopy,
    //     OpenBidMastercopy,
    //     OracleCouncilAddress,
    //     PaymentTokenAddress,
    //     ExoticTagsAddress,
    //     TheRundownConsumer,
    //     MarketDataAddress,
    //     ExoticRewardsAddress,
    //     SafeBoxAddress,
    //     {from: owner.address});
    // await tx.wait().then(e => {
        // console.log('\n setAddresses: \n',
        // 'FixedBidMastercopy: ', FixedBidMastercopy, '\n',
        // 'OpenBidMastercopy: ', OpenBidMastercopy, '\n',
        // 'OracleCouncilAddress: ', OracleCouncilAddress, '\n',
        // 'PaymentTokenAddress: ', PaymentTokenAddress, '\n',
        // 'ExoticTagsAddress: ', ExoticTagsAddress, '\n',
        // 'TheRundownConsumer: ', TheRundownConsumer, '\n',
        // 'MarketDataAddress: ', MarketDataAddress, '\n',
        // 'ExoticRewardsAddress: ', ExoticRewardsAddress, '\n',
        // 'SafeBoxAddress: ', SafeBoxAddress, '\n',
        // );
        // });
    // await delay(1000);

    // tx = await ExoticManagerDeployed.setThalesBonds(ThalesBondsAddress, {from: owner.address});
    // await tx.wait().then(e => {
    //     console.log('\n setThalesBonds: ', ThalesBondsAddress);
    // });
    // await delay(1000);  

    // tx = await OracleCouncil.setMarketManager(ExoticManagerDeployed.address, {from: owner.address});
    // await tx.wait().then(e => {
    //     console.log('\n Council setMarketManager: ', ExoticManagerDeployed.address);
    // });
    // await delay(1000);    
    
    // tx = await ThalesBonds.setMarketManager(ExoticManagerDeployed.address, {from: owner.address});
    // await tx.wait().then(e => {
    //     console.log('\n Bonds setMarketManager: ', ExoticManagerDeployed.address);
    // });
    // await delay(1000);    
    
    // tx = await MarketData.setMarketManager(ExoticManagerDeployed.address, {from: owner.address});
    // await tx.wait().then(e => {
    //     console.log('\n MarketData setMarketManager: ', ExoticManagerDeployed.address);
    // });
    // await delay(1000);    
    
    // tx = await ExoticRewards.setMarketManager(ExoticManagerDeployed.address, {from: owner.address});
    // await tx.wait().then(e => {
    //     console.log('\n ExoticRewards setMarketManager: ', ExoticManagerDeployed.address);
    // });
    // await delay(1000);    
	
	
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
