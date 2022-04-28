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

	const vestingEscrowProxyAddress = getTargetAddress('VestingEscrowCC', network);
	console.log('Found VestingEscrowCC at:', vestingEscrowProxyAddress);

	const VestingEscrowProxy = await ethers.getContractFactory('VestingEscrowCC');
	let implementation = await upgrades.prepareUpgrade(vestingEscrowProxyAddress, VestingEscrowProxy);

	if(networkObj.chainId == 69) {
		await upgrades.upgradeProxy(vestingEscrowProxyAddress, VestingEscrowProxy);
		implementation = await getImplementationAddress(
			ethers.provider,
			vestingEscrowProxyAddress
		);
        console.log('VestingEscrowCC upgraded');

	}

	console.log('VestingEscrowCCImplementation:', implementation);
    setTargetAddress('VestingEscrowCCImplementation', network, implementation);

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