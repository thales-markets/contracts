const { ethers, upgrades } = require('hardhat');
const { toBytes32 } = require('../../../index');
const { getTargetAddress, setTargetAddress } = require('../../helpers');
const w3utils = require('web3-utils');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');
const snx = require('synthetix-2.50.4-ovm');

async function main() {
    
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	

	if (network === 'unknown') {
		network = 'localhost';
	}

	if (network == 'homestead') {
		network = 'mainnet';
	}

	if (networkObj.chainId == 69) {
		networkObj.name = 'optimisticKovan';
		network = 'optimisticKovan';
	}
	if (networkObj.chainId == 10) {
		networkObj.name = 'optimistic';
		network = 'optimistic';
	}

	console.log('Account is: ' + owner.address);
	console.log('Network:' + network);
	console.log('Network id:' + networkObj.chainId);

    const implementation = getTargetAddress('ThalesRoyaleImplementation', network);
	console.log('ThalesRoyaleImplementation: ', implementation);
    const proxy = getTargetAddress('ThalesRoyale', network);
	console.log('ThalesRoyale: ', proxy);

    
    try {
		await hre.run('verify:verify', {
            address: implementation
        });
	} catch (e) {
		console.log(e);
	}
    
    try {
		await hre.run('verify:verify', {
            address: proxy
        });
	} catch (e) {
		console.log(e);
	}

}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});