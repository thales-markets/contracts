const path = require('path');
const { ethers, upgrades } = require('hardhat');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');
const w3utils = require('web3-utils');
const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers/src/constants');

const { getTargetAddress, setTargetAddress } = require('../helpers');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	let mainnetNetwork = 'mainnet';
	let PaymentToken;
	let SportsAMMContract;
	let SportManagerContract;
	let SafeBox;
	let CCIP_Router;
	let masterCollector;
	let masterChainSelector;
	const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

	if (network == 'homestead') {
		console.log(
			"Error L1 network used! Deploy only on L2 Optimism. \nTry using '--network optimistic'"
		);
		return 0;
	}
	if (networkObj.chainId == 42) {
		networkObj.name = 'kovan';
		network = 'kovan';
		PaymentToken = getTargetAddress('ExoticUSD', network);
	}
	if (networkObj.chainId == 69) {
		networkObj.name = 'optimisticKovan';
		network = 'optimisticKovan';
		mainnetNetwork = 'kovan';
		PaymentToken = getTargetAddress('ExoticUSD', network);
	}
	if (networkObj.chainId == 10) {
		networkObj.name = 'optimisticEthereum';
		network = 'optimisticEthereum';
		PaymentToken = getTargetAddress('ProxysUSD', network);
		SportsAMMContract = getTargetAddress('SportsAMM', network);
		SportManagerContract = getTargetAddress('SportPositionalMarketManager', network);
		SafeBox = getTargetAddress('SafeBox', network);
	}
	if (networkObj.chainId == 5) {
		networkObj.name = 'goerli';
		network = 'goerli';
		PaymentToken = getTargetAddress('ExoticUSD', network);
		SportsAMMContract = getTargetAddress('SportsAMM', network);
		SportManagerContract = getTargetAddress('SportPositionalMarketManager', network);
	}
	if (networkObj.chainId == 420) {
		networkObj.name = 'optimisticGoerli';
		network = 'optimisticGoerli';
		PaymentToken = getTargetAddress('ExoticUSD', network);
		SportsAMMContract = getTargetAddress('SportsAMM', network);
		SportManagerContract = getTargetAddress('SportPositionalMarketManager', network);
		SafeBox = owner.address;
		CCIP_Router = getTargetAddress('CCIPRouter', network);
		masterCollector = true;
		masterChainSelector = '2664363617261496610';
	}

	if (networkObj.chainId == 42161) {
		networkObj.name = 'arbitrumOne';
		network = 'arbitrumOne';
		PaymentToken = getTargetAddress('ProxyUSDC', network);
		SportsAMMContract = getTargetAddress('SportsAMM', network);
		SportManagerContract = getTargetAddress('SportPositionalMarketManager', network);
		SafeBox = getTargetAddress('SafeBox', network);
	}

	if (networkObj.chainId == 8453) {
		networkObj.name = 'baseMainnet';
		network = 'baseMainnet';
		PaymentToken = getTargetAddress('ProxyUSDC', network);
		SportsAMMContract = getTargetAddress('SportsAMM', network);
		SportManagerContract = getTargetAddress('SportPositionalMarketManager', network);
		SafeBox = getTargetAddress('SafeBox', network);
	}

	if (networkObj.chainId == 84531) {
		networkObj.name = 'baseGoerli';
		network = 'baseGoerli';
		CCIP_Router = getTargetAddress('CCIPRouter', network);
		masterCollector = false;
		masterChainSelector = '0';
	}

	if (networkObj.chainId == 421613) {
		networkObj.name = 'arbitrumGoerli';
		network = 'arbitrumGoerli';
		CCIP_Router = getTargetAddress('CCIPRouter', network);
		masterCollector = false;
		masterChainSelector = '0';
	}

	const CrossChainCollector = await ethers.getContractFactory('CrossChainCollector');
	const CrossChainCollectorDeployed = await upgrades.deployProxy(CrossChainCollector, [
		CCIP_Router,
		masterCollector,
		masterChainSelector,
	]);
	await delay(2000);
	await CrossChainCollectorDeployed.deployed();

	console.log('CrossChainCollector Deployed on', CrossChainCollectorDeployed.address);
	setTargetAddress('CrossChainCollector', network, CrossChainCollectorDeployed.address);

	await delay(65000);
	const CrossChainCollectorImplementation = await getImplementationAddress(
		ethers.provider,
		CrossChainCollectorDeployed.address
	);

	console.log('Implementation CrossChainCollector: ', CrossChainCollectorImplementation);
	setTargetAddress('CrossChainCollectorImplementation', network, CrossChainCollectorImplementation);

	await delay(5000);

	// if (networkObj.chainId == 10 || networkObj.chainId == 42161 || networkObj.chainId == 8453) {
	// } else {
	// 	await ParlayAMMDeployed.setPolicyAddresses(ParlayPolicyDeployed.address, {
	// 		from: owner.address,
	// 	});

	// 	console.log('ParlayPolicy address set on ParlayAMM');
	// }
	await delay(5000);

	try {
		await hre.run('verify:verify', {
			address: CrossChainCollectorImplementation,
		});
	} catch (e) {
		console.log(e);
	}
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});

function delay(time) {
	return new Promise(function (resolve) {
		setTimeout(resolve, time);
	});
}
