const { ethers } = require('hardhat');
const { getTargetAddress, setTargetAddress } = require('../../helpers');
const w3utils = require('web3-utils');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	let sUSDAddress;
	let royaleAddress;

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
    const royale = await ThalesRoyale.attach(
		thalesRoyaleAddress
	);

	const ThalesRoyalePassport = await ethers.getContractFactory('ThalesRoyalePassport');
	const ThalesRoyalePassportDeployed = await ThalesRoyalePassport.deploy(thalesRoyaleAddress);
	await ThalesRoyalePassportDeployed.deployed();
	setTargetAddress('ThalesRoyalePassport', network, ThalesRoyalePassportDeployed.address);

	console.log('ThalesRoyalePassport deployed to:', ThalesRoyalePassportDeployed.address);

    // set passport address
	let tx = await royale.setThalesRoyalePassport(ThalesRoyalePassportDeployed.address);
	
	await tx.wait().then(e => {
		console.log('ThalesRoyalePassport address successfully updated in ThalesRoyale');
	});


	await hre.run('verify:verify', {
		address: ThalesRoyalePassportDeployed.address,
		constructorArguments: [thalesRoyaleAddress],
	});
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});