const { ethers } = require('hardhat');

const w3utils = require('web3-utils');

const { toBytes32 } = require('../../../index');

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

	const priceFeed = await ethers.getContractFactory('PriceFeed');
	let priceFeedAddress = getTargetAddress('PriceFeed', network);

	const min = 60;
	const hour = 60 * 60;
	const day = 24 * 60 * 60;

	// use ThalesRoyalePrivateRoom.sol
	const ThalesRoyalePrivateRoom = await ethers.getContractFactory('ThalesRoyalePrivateRoom');
	const ThalesRoyalePrivateRoomDeployed = await ThalesRoyalePrivateRoom.deploy(
		owner.address,
		priceFeedAddress,
		priceFeedAddress
	);
	await ThalesRoyalePrivateRoomDeployed.deployed();
	// update deployments.json file
	setTargetAddress('ThalesRoyalePrivateRoom', network, ThalesRoyalePrivateRoomDeployed.address);

	console.log('ThalesRoyalePrivateRoom deployed to:', ThalesRoyalePrivateRoomDeployed.address);

	await hre.run('verify:verify', {
		address: ThalesRoyalePrivateRoomDeployed.address,
		constructorArguments: [
			owner.address,
			priceFeedAddress,
			priceFeedAddress
		],
	});
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});
