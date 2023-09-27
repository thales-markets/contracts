const path = require('path');
const { ethers, upgrades } = require('hardhat');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');
const w3utils = require('web3-utils');

const { getTargetAddress, setTargetAddress } = require('../../helpers');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	let mainnetNetwork = 'mainnet';
	let PaymentToken;
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
	}
	if (networkObj.chainId == 5) {
		networkObj.name = 'goerli';
		network = 'goerli';
		PaymentToken = getTargetAddress('ExoticUSD', network);
	}
	if (networkObj.chainId == 420) {
		networkObj.name = 'optimisticGoerli';
		network = 'optimisticGoerli';
		PaymentToken = getTargetAddress('ExoticUSD', network);
	}

	if (networkObj.chainId == 42161) {
		networkObj.name = 'arbitrumOne';
		network = 'arbitrumOne';
		PaymentToken = getTargetAddress('ProxysUSD', network);
	}
	if (networkObj.chainId == 8453) {
		networkObj.name = 'baseMainnet';
		network = 'baseMainnet';
		PaymentToken = getTargetAddress('ProxyUSDC', network);
	}

	const SportsAMMAddress = getTargetAddress('SportsAMM', network);
	const SportsAMM = await ethers.getContractFactory('SportsAMM');
	const SportsAMMDeployed = SportsAMM.attach(SportsAMMAddress);

	const SportsAMMUtils = await ethers.getContractFactory('SportsAMMUtils');
	const SportsAMMUtilsDeployed = await SportsAMMUtils.deploy(SportsAMMAddress);
	await SportsAMMUtilsDeployed.deployed();

	console.log('Implementation SportsAMMUtils: ', SportsAMMUtilsDeployed.address);
	setTargetAddress('SportsAMMUtils', network, SportsAMMUtilsDeployed.address);

	await delay(12000);

	if (networkObj.chainId != 10 && networkObj.chainId != 42161 && networkObj.chainId != 8453) {
		await SportsAMMDeployed.setAmmUtils(SportsAMMUtilsDeployed.address, { from: owner.address });
		console.log('set SportsAMMUtils in SportsAMM');
	}
	await delay(5000);

	try {
		await hre.run('verify:verify', {
			address: SportsAMMUtilsDeployed.address,
			constructorArguments: [SportsAMMAddress],
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
