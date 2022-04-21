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
		networkObj.name = 'optimisticEthereum';
		network = 'optimisticEthereum';
	}
	
	if (networkObj.chainId == 80001) {
		networkObj.name = 'polygonMumbai';
		network = 'polygonMumbai';
	}

	if (networkObj.chainId == 137) {
		networkObj.name = 'polygon';
		network = 'polygon';
	}

	console.log('Account is: ' + owner.address);
	console.log('Network:' + network);

	const vestingEscrowProxyAddress = getTargetAddress('VestingEscrowProxy', network);
	console.log('Found VestingEscrowProxy at:', vestingEscrowProxyAddress);

	const VestingEscrowProxy = await ethers.getContractFactory('VestingEscrowProxy');
	const implementation = await upgrades.prepareUpgrade(vestingEscrowProxyAddress, VestingEscrowProxy);

	if(networkObj.chainId == 69) {
		await upgrades.upgradeProxy(vestingEscrowProxyAddress, VestingEscrowProxy);
        console.log('VestingEscrowProxy upgraded');
	}

	console.log('VestingEscrowImplementation: ', implementation);
    setTargetAddress('VestingEscrowImplementation', network, implementation);

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