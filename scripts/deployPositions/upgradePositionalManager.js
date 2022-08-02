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

	if (networkObj.chainId == 10) {
		network = 'optimisticEthereum';
	} else if (networkObj.chainId == 69) {
		network = 'optimisticKovan';
	}

	console.log('Account is:' + owner.address);
	console.log('Network name:' + network);

	priceFeedAddress = getTargetAddress('PriceFeed', network);
	console.log('Found PriceFeed at:' + priceFeedAddress);

	// // We get the contract to deploy

	const positionalManagerAddress = getTargetAddress('PositionalMarketManager', network);
	console.log('Found positionalManagerAddress at:', positionalManagerAddress);

	const PositionalMarketManager = await ethers.getContractFactory('PositionalMarketManager');

	let PositionalMarketManagerImplementation = await upgrades.prepareUpgrade(
		positionalManagerAddress,
		PositionalMarketManager
	);

	console.log(
		'Implementation PositionalMarketManagerImplementation: ',
		PositionalMarketManagerImplementation
	);

	setTargetAddress(
		'PositionalMarketManagerImplementation',
		network,
		PositionalMarketManagerImplementation
	);

	try {
		await hre.run('verify:verify', {
			address: PositionalMarketManagerImplementation,
		});
	} catch (e) {
		console.log(e);
	}

	function delay(time) {
		return new Promise(function(resolve) {
			setTimeout(resolve, time);
		});
	}
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});
