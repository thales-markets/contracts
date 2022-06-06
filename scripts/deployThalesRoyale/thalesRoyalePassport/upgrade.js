const { ethers, upgrades } = require('hardhat');
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

	const thalesRoyalePassportAddress = getTargetAddress('ThalesRoyalePassport', network);
	console.log('Found ThalesRoyalePassport at:', thalesRoyalePassportAddress);

	const ThalesRoyalePassport = await ethers.getContractFactory('ThalesRoyalePassport');
	const implementation = await upgrades.prepareUpgrade(thalesRoyalePassportAddress, ThalesRoyalePassport);

	if(networkObj.chainId == 69) {
		await upgrades.upgradeProxy(thalesRoyalePassportAddress, ThalesRoyalePassport);
	}

	console.log('ThalesRoyalePassport upgraded');

	console.log('ThalesRoyalePassportImplementation: ', implementation);
    setTargetAddress('ThalesRoyalePassportImplementation', network, implementation);

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