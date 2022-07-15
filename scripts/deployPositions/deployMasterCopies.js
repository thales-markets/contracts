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
		ProxyERC20sUSDaddress = getTargetAddress('ProxysUSD', network);
		network = 'optimisticEthereum';
	} else if (networkObj.chainId == 69) {
		network = 'optimisticKovan';
		ProxyERC20sUSDaddress = getTargetAddress('ProxysUSD', network);
	}
	if (networkObj.chainId == 80001 || networkObj.chainId == 137) {
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

	const PositionalMarketFactory = await ethers.getContractFactory('PositionalMarketFactory');
	const PositionalMarketFactoryDeployed = PositionalMarketFactory.attach(
		getTargetAddress('PositionalMarketFactory', network)
	);

	let tx = await PositionalMarketFactoryDeployed.setPositionalMarketMastercopy(
		PositionalMarketMastercopyDeployed.address
	);
	await tx.wait().then(e => {
		console.log('PositionalMarketFactory: setPositionalMarketMastercopy');
	});

	const positionalManagerAddress = getTargetAddress('PositionalMarketManager', network);
	console.log('Found positionalManagerAddress at:', positionalManagerAddress);

	const PositionalMarketManager = await ethers.getContractFactory('PositionalMarketManager');
	upgrades.prepareUpgrade;
	await upgrades.upgradeProxy(positionalManagerAddress, PositionalMarketManager);

	console.log('PositionalMarketManager upgraded');

	const PositionalMarketManagerImplementation = await getImplementationAddress(
		ethers.provider,
		positionalManagerAddress
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

	const PositionalMarketData = await ethers.getContractFactory('PositionalMarketData');
	const positionalMarketData = await PositionalMarketData.deploy();

	console.log('PositionalMarketData deployed to:', positionalMarketData.address);
	setTargetAddress('PositionalMarketData', network, positionalMarketData.address);

	const thalesAmmAddress = getTargetAddress('ThalesAMM', network);
	console.log('Found ThalesAMM at:', thalesAmmAddress);

	const ThalesAMM = await ethers.getContractFactory('ThalesAMM');
	upgrades.prepareUpgrade;
	await upgrades.upgradeProxy(thalesAmmAddress, ThalesAMM);

	console.log('ThalesAMM upgraded');

	const ThalesAMMImplementation = await getImplementationAddress(ethers.provider, thalesAmmAddress);

	console.log('Implementation ThalesAMM: ', ThalesAMMImplementation);

	setTargetAddress('ThalesAMMImplementation', network, ThalesAMMImplementation);

	try {
		await hre.run('verify:verify', {
			address: PositionalMarketManagerImplementation,
		});
	} catch (e) {
		console.log(e);
	}

	try {
		await hre.run('verify:verify', {
			address: ThalesAMMImplementation,
		});
	} catch (e) {
		console.log(e);
	}

	await hre.run('verify:verify', {
		address: PositionalMarketMastercopyDeployed.address,
		constructorArguments: [],
		contract: 'contracts/Positions/PositionalMarketMastercopy.sol:PositionalMarketMastercopy',
	});

	await hre.run('verify:verify', {
		address: positionalMarketData.address,
		constructorArguments: [],
	});

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
