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

	if (networkObj.chainId == 10) {
		networkObj.name = 'optimisticEthereum';
		network = 'optimisticEthereum';
	}

	if (networkObj.chainId == 420) {
		networkObj.name = 'optimisticGoerli';
		network = 'optimisticGoerli';
	}

	if (networkObj.chainId == 137) {
		networkObj.name = 'polygon';
		network = 'polygon';
	}

	if (networkObj.chainId == 42161) {
		networkObj.name = 'arbitrumOne';
		network = 'arbitrumOne';
	}

	if (networkObj.chainId == 8453) {
		networkObj.name = 'baseMainnet';
		network = 'baseMainnet';
	}

	console.log('Account is:' + owner.address);
	console.log('Network name:' + network);

	const SwapRouterThales = await ethers.getContractFactory('SwapRouterThales');
	const SwapRouterThalesDeployed = await SwapRouterThales.deploy(
		'0x33128a8fC17869897dcE68Ed026d694621f6FDfD',
		'0x4200000000000000000000000000000000000006'
	);
	await SwapRouterThalesDeployed.deployed();

	console.log('SwapRouterThales deployed to:', SwapRouterThalesDeployed.address);
	setTargetAddress('SwapRouter', network, SwapRouterThalesDeployed.address);

	try {
		await hre.run('verify:verify', {
			address: SwapRouterThalesDeployed.address,
		});
	} catch (e) {
		console.log(e);
	}

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
