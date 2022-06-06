const { ethers, upgrades } = require('hardhat');
const { getTargetAddress, setTargetAddress } = require('../../helpers');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');

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
	const royale = await ThalesRoyale.attach(thalesRoyaleAddress);

	const passportURI = 'https://thales-ajlyy.s3.eu-central-1.amazonaws.com';

	const ThalesRoyalePassport = await ethers.getContractFactory('ThalesRoyalePassport');
	const thalesRoyalePassport = await upgrades.deployProxy(ThalesRoyalePassport, [
		thalesRoyaleAddress,
		passportURI,
	]);
	await thalesRoyalePassport.deployed();

	console.log('ThalesRoyalePassort deployed to:', thalesRoyalePassport.address);
	setTargetAddress('ThalesRoyalePassport', network, thalesRoyalePassport.address);

	const implementation = await getImplementationAddress(
		ethers.provider,
		thalesRoyalePassport.address
	);
	console.log('ThalesRoyalePassportImplementation: ', implementation);
	setTargetAddress('ThalesRoyalePassportImplementation', network, implementation);

	// set passport address
	let tx = await royale.setThalesRoyalePassport(thalesRoyalePassport.address);

	await tx.wait().then(e => {
		console.log('ThalesRoyalePassport address successfully updated in ThalesRoyale');
	});

	try {
		await hre.run('verify:verify', {
			address: implementation,
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
