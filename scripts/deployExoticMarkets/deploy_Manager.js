const path = require('path');
const { ethers, upgrades } = require('hardhat');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');


const { getTargetAddress, setTargetAddress } = require('../helpers');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	let mainnetNetwork = 'mainnet';
	let ThalesName;

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
	}
	if (networkObj.chainId == 10) {
		networkObj.name = 'optimistic';
		network = 'optimistic';
	}
	
    const ExoticMarketMastercopyAddress = getTargetAddress("ExoiticMarketMasterCopy", network);
    const ThalesAddress = getTargetAddress(ThalesName, network);
    const ExoticMarketManager = await ethers.getContractFactory('ExoticPositionalMarketManager');
    let minimumPositioningDuration = 0;
    let minimumMarketMaturityDuration = 0;

    console.log("Mastercopy at address", ExoticMarketMastercopyAddress);
    
    const ExoticMarketManagerDeployed = await upgrades.deployProxy(ExoticMarketManager, [
        owner.address,
		minimumPositioningDuration,
		ThalesAddress
	]);
	await ExoticMarketManagerDeployed.deployed;
    
    console.log("ExoticMarketManager Deployed on", ExoticMarketManagerDeployed.address);
    setTargetAddress('ExoticMarketManager', network, ExoticMarketManagerDeployed.address);

	const ExoticMarketManagerImplementation = await getImplementationAddress(
		ethers.provider,
		ExoticMarketManagerDeployed.address
	);

	console.log('Implementation ExoticMarketManager: ', ExoticMarketManagerImplementation);
	setTargetAddress('ExoticMarketManagerImplementation', network, ExoticMarketManagerImplementation);
	
    
    try {
		await hre.run('verify:verify', {
			address: ExoticMarketManagerDeployed.address,
		});
	} catch (e) {
		console.log(e);
	}

    try {
		await hre.run('verify:verify', {
			address: ExoticMarketManagerImplementation,
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
