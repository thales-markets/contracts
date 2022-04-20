const path = require('path');
const { ethers, upgrades } = require('hardhat');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');
const w3utils = require('web3-utils');

const { getTargetAddress, setTargetAddress } = require('../helpers');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	let mainnetNetwork = 'mainnet';
	let ThalesName;
    let PaymentTokenAddress;
    let SafeBoxAddress;
    let OracleCouncilAddress;
    let ThalesBondsAddress;
    let ExoticTagsAddress;
    let MarketDataAddress;
    let ExoticRewardsAddress;
    let OpenBidMastercopy;
    let FixedBidMastercopy;

	if (network == 'homestead') {
		console.log("Error L1 network used! Deploy only on L2 Optimism. \nTry using \'--network optimistic\'")
		return 0;
	}
	if (networkObj.chainId == 42) {
		networkObj.name = 'kovan';
		network = 'kovan';
		ThalesName = "OpThales_L1";
	}
	if (networkObj.chainId == 69) {
		networkObj.name = 'optimisticKovan';
		network = 'optimisticKovan';
		mainnetNetwork = 'kovan';
		ThalesName = "OpThales_L2";
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
	}
	
    const ExoticManagerData = await ethers.getContractFactory('ExoticManagerData');
   
    const ExoticManagerDataAddress = getTargetAddress("ExoticManagerData", network);
    const ExoticManagerDataDeployed = await ExoticManagerData.attach(ExoticManagerDataAddress);

    

    const items = ethers.utils.AbiCoder.prototype.encode(
        [
         'uint', 
         'uint', 
         'uint', 
         'uint',
         'uint', 
         'uint',
         'uint', 
         'uint', 
         'uint',
         'uint', 
         'uint',
         'uint', 
         'uint', 
         'uint',
         'uint', 
         'uint',
         'uint', 
         'uint', 
         'uint',
         'uint', 
         'uint',
         'uint', 
         'uint',
         'bool',
         'bool',
         'address',
         'address',
         'address',
         'address',
         'address',
         'address',
         'address',
         'address',
         'address',
         'address'
        ],
        [
            w3utils.toWei("2", "ether"), 
            "300", 
            "300",
            '600',
            '172800', 
            '1',
            '1', 
            '1', 
            '6',
            '8', 
            w3utils.toWei("1.5", "ether"),
            '5', 
            '5', 
            w3utils.toWei("0.1", "ether"),
            w3utils.toWei("0.2", "ether"), 
            w3utils.toWei("1", "ether"),
            '1000', 
            '220', 
            '220',
            '60', 
            '300',
            '100', 
            '10',
            false,
            true,
            FixedBidMastercopy,
            OpenBidMastercopy,
            OracleCouncilAddress,
            SafeBoxAddress,
            SafeBoxAddress,
            PaymentTokenAddress,
            ExoticTagsAddress,
            SafeBoxAddress,
            MarketDataAddress,
            ExoticRewardsAddress
        ]
    );
    
    tx = await ExoticManagerDataDeployed.setManagerDummyData(
        {
            fixedBondAmount: "101110",
            backstopTimeout: "1",
            minimumPositioningDuration: "1111"
        }, 
        {from: owner.address});
        await tx.wait().then(e => {
            console.log('\n setManagerDummyData: success');
        });
        await delay(1000);

    // const dummyItems = ethers.utils.AbiCoder.prototype.encode(
    //     [
    //      'uint', 
    //      'uint', 
    //      'uint'
    //     ],
    //     [
    //         '20', 
    //         '300', 
    //         '300'
    //     ]
    // );
    // // console.log(items);
    // tx = await ExoticManagerDataDeployed.setManagerDummyData(dummyItems, {from:owner.address});

    // await tx.wait().then(e => {
    //     console.log('\n setManagerData: success');
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
