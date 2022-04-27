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
		networkObj.name = 'optimisticEthereum';
		network = 'optimisticEthereum';
	}
	
    const ExoticManagerData = await ethers.getContractFactory('ExoticManagerData');
   
    const ExoticManagerDataDeployed = await upgrades.deployProxy(ExoticManagerData, [
        owner.address
	]);
	await ExoticManagerDataDeployed.deployed;
    
    console.log("ExoticManagerData Deployed on", ExoticManagerDataDeployed.address);
    setTargetAddress('ExoticManagerData', network, ExoticManagerDataDeployed.address);

	const ExoticManagerDataImplementation = await getImplementationAddress(
		ethers.provider,
		ExoticManagerDataDeployed.address
	);

	console.log('Implementation ExoticManagerData: ', ExoticManagerDataImplementation);
	setTargetAddress('ExoticManagerDataImplementation', network, ExoticManagerDataImplementation);
	
    
    try {
		await hre.run('verify:verify', {
			address: ExoticManagerDataDeployed.address,
		});
	} catch (e) {
		console.log(e);
	}

    try {
		await hre.run('verify:verify', {
			address: ExoticManagerDataImplementation,
		});
	} catch (e) {
		console.log(e);
	}

    tx = await ExoticManagerDataDeployed.setManagerDummyData(
        {
            fixedBondAmount: "1000",
            backstopTimeout: "10",
            minimumPositioningDuration: "10"
        }, 
        {from: owner.address});
    await tx.wait().then(e => {
        console.log('\n setManagerDummyData: success');
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
