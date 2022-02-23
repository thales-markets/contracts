const { ethers, upgrades } = require('hardhat');
const { toBytes32 } = require('../../../index');
const { getTargetAddress, setTargetAddress } = require('../../helpers');
const w3utils = require('web3-utils');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');
const snx = require('synthetix-2.50.4-ovm');

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

	sUSDAddress = getTargetAddress('ProxysUSD', network);
	console.log('ProxysUSD :', sUSDAddress);

	royaleAddress = getTargetAddress('ThalesRoyale', network);
	console.log('Found ThalesRoyale at:' + royaleAddress);

	const price = w3utils.toWei('30');
	const uri = 'http://my-json-server.typicode.com/abcoathup/samplenft/tokens/0';

	const ThalesRoyalePass = await ethers.getContractFactory('ThalesRoyalePass');
	const ThalesRoyalePassDeployed = await ThalesRoyalePass.deploy(
		sUSDAddress,
		price,
		uri,
		royaleAddress
	);
	await ThalesRoyalePassDeployed.deployed();
	setTargetAddress('ThalesRoyalePass', network, ThalesRoyalePassDeployed.address);

	console.log('ThalesRoyalePass deployed to:', ThalesRoyalePassDeployed.address);

	await hre.run('verify:verify', {
		address: ThalesRoyalePassDeployed.address,
		constructorArguments: [sUSDAddress, price, uri, royaleAddress],
	});
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});
