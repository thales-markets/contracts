const { ethers } = require('hardhat');
const { getTargetAddress, setTargetAddress } = require('../../helpers');
const w3utils = require('web3-utils');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	let stakingAddress;

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
	if (networkObj.chainId == 420) {
		networkObj.name = 'optimisticGoerli';
		network = 'optimisticGoerli';
	}

	if (networkObj.chainId == 5) {
		networkObj.name = 'goerli';
		network = 'goerli';
	}

	if (networkObj.chainId == 42161) {
		networkObj.name = 'arbitrumOne';
		network = 'arbitrumOne';
	}

	console.log('Account is: ' + owner.address);
	console.log('Network:' + network);

	stakingAddress = getTargetAddress('StakingThales', network);
	console.log('Found stakingAddress at:' + stakingAddress);

	const uriAddress = 'https://thales-protocol.s3.eu-north-1.amazonaws.com/TaleOfThales/{id}.json';

	const TaleOfThalesContract = await ethers.getContractFactory('TaleOfThalesNFTs');
	const TaleOfThalesDeployed = await TaleOfThalesContract.deploy(stakingAddress, uriAddress);

	await TaleOfThalesDeployed.deployed();
	setTargetAddress('TaleOfThalesNFTs', network, TaleOfThalesDeployed.address);

	console.log('TaleOfThalesDeployed deployed to:', TaleOfThalesDeployed.address);

	await hre.run('verify:verify', {
		address: TaleOfThalesDeployed.address,
		constructorArguments: [stakingAddress, uriAddress],
	});
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
