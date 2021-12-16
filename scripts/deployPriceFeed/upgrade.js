const { ethers, upgrades } = require('hardhat');
const { getTargetAddress } = require('../helpers');

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

	console.log('Account is: ' + owner.address);
	console.log('Network:' + network);

	const priceFeedAddress = getTargetAddress('PriceFeed', network);
	console.log('Found PriceFeed at:', priceFeedAddress);

	const PriceFeed = await ethers.getContractFactory('PriceFeed');
	await upgrades.upgradeProxy(priceFeedAddress, PriceFeed);

	console.log('PriceFeed upgraded');
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});