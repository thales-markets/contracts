const { ethers, upgrades } = require('hardhat');
const w3utils = require('web3-utils');
const snx = require('synthetix-2.50.4-ovm');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');
const { getTargetAddress, setTargetAddress } = require('../helpers');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	let priceFeedAddress, ProxyERC20sUSDaddress;

	if (network === 'unknown') {
		network = 'localhost';
	}

	if (network == 'homestead') {
		network = 'mainnet';
	}

	if (networkObj.chainId == 80001) {
		networkObj.name = 'polygonMumbai';
		network = 'polygonMumbai';
	}

	if (networkObj.chainId == 137) {
		networkObj.name = 'polygon';
		network = 'polygon';
	}

	if (networkObj.chainId == 42161) {
		networkObj.name = 'arbitrumOne';
		network = 'arbitrumOne';
	}

	console.log('Account is:' + owner.address);
	console.log('Network name:' + network);

	// // We get the contract to deploy

	const PositionalMarketMastercopy = await ethers.getContractFactory('PositionalMarketMastercopy');
	const PositionalMarketMastercopyDeployed = await PositionalMarketMastercopy.deploy();
	await PositionalMarketMastercopyDeployed.deployed();

	console.log(
		'PositionalMarketMastercopy deployed to:',
		PositionalMarketMastercopyDeployed.address
	);
	setTargetAddress(
		'PositionalMarketMastercopy',
		network,
		PositionalMarketMastercopyDeployed.address
	);

	const PositionMastercopy = await ethers.getContractFactory('PositionMastercopy');
	const PositionMastercopyDeployed = await PositionMastercopy.deploy();
	await PositionMastercopyDeployed.deployed();

	console.log('PositionMastercopy deployed to:', PositionMastercopyDeployed.address);
	setTargetAddress('PositionMastercopy', network, PositionMastercopyDeployed.address);

	await hre.run('verify:verify', {
		address: PositionalMarketMastercopyDeployed.address,
		constructorArguments: [],
		contract: 'contracts/Positions/PositionalMarketMastercopy.sol:PositionalMarketMastercopy',
	});

	await hre.run('verify:verify', {
		address: PositionMastercopyDeployed.address,
		constructorArguments: [],
		contract: 'contracts/Positions/PositionMastercopy.sol:PositionMastercopy',
	});

	function delay(time) {
		return new Promise(function (resolve) {
			setTimeout(resolve, time);
		});
	}
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
