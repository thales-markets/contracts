const { ethers, upgrades } = require('hardhat');
const { getTargetAddress } = require('../../helpers');

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

	const thalesRoyalePrivateRoomsAddress = getTargetAddress('ThalesRoyalePrivateRoom', network);
	console.log('Found ThalesRoyalePrivateRoom at:', thalesRoyalePrivateRoomsAddress);

	const ThalesRoyalePrivateRoom = await ethers.getContractFactory('ThalesRoyalePrivateRoom');
	await upgrades.upgradeProxy(thalesRoyalePrivateRoomsAddress, ThalesRoyalePrivateRoom);

	console.log('ThalesRoyalePrivateRoom upgraded');
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});