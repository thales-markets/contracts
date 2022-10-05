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
		ProxyERC20sUSDaddress = getTargetAddress('ProxysUSD', network);
	} else if (networkObj.chainId == 69) {
		network = 'optimisticKovan';
		ProxyERC20sUSDaddress = getTargetAddress('ProxysUSD', network);
	} else if (networkObj.chainId == 80001 || networkObj.chainId == 137) {
		ProxyERC20sUSDaddress = getTargetAddress('ProxyUSDC', network);
	} else {
		const ProxyERC20sUSD = snx.getTarget({ network, contract: 'ProxyERC20sUSD' });
		ProxyERC20sUSDaddress = ProxyERC20sUSD.address;
	}

	console.log('Account is:' + owner.address);
	console.log('Network name:' + network);

	console.log('Found ProxyERC20sUSD at:' + ProxyERC20sUSDaddress);

	priceFeedAddress = getTargetAddress('PriceFeed', network);
	console.log('Found PriceFeed at:' + priceFeedAddress);

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

	await hre.run('verify:verify', {
		address: PositionalMarketMastercopyDeployed.address,
		constructorArguments: [],
		contract: 'contracts/Positions/PositionalMarketMastercopy.sol:PositionalMarketMastercopy',
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
