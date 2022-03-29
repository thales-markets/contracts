const path = require('path');
const { ethers } = require('hardhat');

const user_key = process.env.PRIVATE_KEY;


const L2_BRIDGE_ADDRESS = '0x4200000000000000000000000000000000000010';

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
	

	const ExoticMarket = await ethers.getContractFactory('ExoticPositionalOpenBidMarket');
	const ExoticMarketDeployed = await ExoticMarket.deploy();
    await ExoticMarketDeployed.deployed();
	console.log("ExoticOpenBidMarket Deployed on", ExoticMarketDeployed.address);
	setTargetAddress('ExoticMarketOpenBidMastercopy', network, ExoticMarketDeployed.address);
	
	const ExoticMarketManagerAddress = getTargetAddress("ExoticMarketManager", network);
    const ExoticMarketManager = await ethers.getContractFactory('ExoticPositionalMarketManager');
    const ExoticMarketManagerDeployed = await ExoticMarketManager.attach(ExoticMarketManagerAddress);
    
	
    await ExoticMarketManagerDeployed.setExoticMarketOpenBidMastercopy(ExoticMarketDeployed.address);
	console.log("ExoticOpenBidMarket Mastercopy updated");
	
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
