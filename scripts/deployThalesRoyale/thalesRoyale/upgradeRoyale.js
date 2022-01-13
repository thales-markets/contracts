const { ethers, upgrades } = require('hardhat');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');
const { getTargetAddress, setTargetAddress } = require('../../helpers');

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

	const thalesRoyaleAddress = getTargetAddress('ThalesRoyale', network);
	console.log('Found ThalesRoyale at:', thalesRoyaleAddress);

	const ThalesRoyale = await ethers.getContractFactory('ThalesRoyale');
	await upgrades.upgradeProxy(thalesRoyaleAddress, ThalesRoyale);

	console.log('ThalesRoyale upgraded');

	const implementation = await getImplementationAddress(ethers.provider, thalesRoyaleAddress);
	console.log('ThalesRoyaleImplementation: ', implementation);
    setTargetAddress('ThalesRoyaleImplementation', network, implementation);

    await hre.run('verify:verify', {
        address: implementation
    });
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});