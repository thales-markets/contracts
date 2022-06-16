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
		console.log("Kovan")
		network = 'kovan';
		networkObj.name = 'kovan';
		// return 0;
	}
	if (networkObj.chainId == 69) {
		networkObj.name = 'optimisticKovan';
		network = 'optimisticKovan';
		mainnetNetwork = 'kovan';
	}
	if (networkObj.chainId == 10) {
		networkObj.name = 'optimisticEthereum';
		network = 'optimisticEthereum';
	}
	
    const ExoticUSDContract = await ethers.getContractFactory('ExoticUSD');
	const ExoticMarketManagerAddress = getTargetAddress("ExoticMarketManager", network);
	const ExoticMarketManager = await ethers.getContractFactory('ExoticPositionalMarketManager');
    
    const ExoticUSDDeployed = await ExoticUSDContract.deploy();
	await ExoticUSDDeployed.deployed;
    
    console.log("ExoticUSD Deployed on", ExoticUSDDeployed.address);
	setTargetAddress('ExoticUSD', network, ExoticUSDDeployed.address);

	await delay(5000);
	await ExoticUSDDeployed.setDefaultAmount(w3utils.toWei("100", "ether"));
	// const ExoticMarketManagerDeployed = await ExoticMarketManager.attach(ExoticMarketManagerAddress);
	// await ExoticMarketManagerDeployed.setTagsAddress(ExoticUSDDeployed.address);
	// console.log("ExoticTags address set in ExoticMarketManager");
	await delay(5000);

    try {
		await hre.run('verify:verify', {
			address: ExoticUSDDeployed.address,
		});
	} catch (e) {
		console.log(e);
	}

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
