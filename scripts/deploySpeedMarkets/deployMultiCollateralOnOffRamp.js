const { ethers, upgrades } = require('hardhat');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');
const snx = require('synthetix-2.50.4-ovm');
const { artifacts, contract, web3 } = require('hardhat');
const { getTargetAddress, setTargetAddress } = require('../helpers');
const { toBytes32 } = require('../../index');
const w3utils = require('web3-utils');

async function main() {
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	let thalesAddress, ProxyERC20sUSDaddress;

	let proxySUSD;

	if (network === 'unknown') {
		network = 'localhost';
	}

	if (network == 'homestead') {
		network = 'mainnet';
	}

	if (networkObj.chainId == 10) {
		networkObj.name = 'optimisticEthereum';
		network = 'optimisticEthereum';
		proxySUSD = getTargetAddress('ProxysUSD', network);
	}

	if (networkObj.chainId == 420) {
		networkObj.name = 'optimisticGoerli';
		network = 'optimisticGoerli';
		proxySUSD = getTargetAddress('ExoticUSD', network);
	}

	if (networkObj.chainId == 42161) {
		networkObj.name = 'arbitrumOne';
		network = 'arbitrumOne';
		proxySUSD = getTargetAddress('ProxyUSDC', network);
	}

	let accounts = await ethers.getSigners();
	let owner = accounts[0];

	console.log('Owner is: ' + owner.address);
	console.log('Network:' + network);
	console.log('Network id:' + networkObj.chainId);

	const MultiCollateralOnOffRamp = await ethers.getContractFactory('MultiCollateralOnOffRamp');
	let MultiCollateralOnOffRampDeployed = await upgrades.deployProxy(MultiCollateralOnOffRamp, [
		owner.address,
		proxySUSD,
	]);
	await MultiCollateralOnOffRampDeployed.deployed();

	console.log('MultiCollateralOnOffRamp proxy:', MultiCollateralOnOffRampDeployed.address);

	const MultiCollateralOnOffRampImplementation = await getImplementationAddress(
		ethers.provider,
		MultiCollateralOnOffRampDeployed.address
	);

	console.log('Implementation MultiCollateralOnOffRamp: ', MultiCollateralOnOffRampImplementation);

	setTargetAddress('MultiCollateralOnOffRamp', network, MultiCollateralOnOffRampDeployed.address);
	setTargetAddress(
		'MultiCollateralOnOffRampImplementation',
		network,
		MultiCollateralOnOffRampImplementation
	);

	delay(5000);

	try {
		await hre.run('verify:verify', {
			address: MultiCollateralOnOffRampImplementation,
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
