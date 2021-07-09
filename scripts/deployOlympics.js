const { ethers } = require('hardhat');
const w3utils = require('web3-utils');
const snx = require('synthetix');
const { artifacts, contract, web3 } = require('hardhat');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	if (network == 'homestead') {
		network = 'mainnet';
	}

	console.log('Account is:' + owner.address);
	console.log('Network name:' + networkObj.name);

	// We get the contract to deploy
	const olympicsFeed = await ethers.getContractFactory('OlympicsFeed');
	const olympicsFeedDeployed = await olympicsFeed.deploy();
	await olympicsFeedDeployed.deployed();

	console.log('olympicsFeedDeployed deployed to:', olympicsFeedDeployed.address);

	await hre.run('verify:verify', {
		address: olympicsFeedDeployed.address,
	});
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});
