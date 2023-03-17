const { ethers, upgrades } = require('hardhat');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');
const snx = require('synthetix-2.50.4-ovm');
const { artifacts, contract, web3 } = require('hardhat');
const { getTargetAddress, setTargetAddress } = require('../../helpers');
const { toBytes32 } = require('../../../index');
const w3utils = require('web3-utils');

const DAY = 24 * 60 * 60;
const MINUTE = 60;
const rate = w3utils.toWei('1');

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

	if (networkObj.chainId == 69) {
		networkObj.name = 'optimisticKovan';
		network = 'optimisticKovan';
	}
	if (networkObj.chainId == 10) {
		networkObj.name = 'optimisticEthereum';
		network = 'optimisticEthereum';
		proxySUSD = getTargetAddress('ProxysUSD', network);
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

	const DefaultLiquidityProvider = await ethers.getContractFactory('DefaultLiquidityProvider');
	let DefaultLiquidityProviderDeployed = await upgrades.deployProxy(DefaultLiquidityProvider, [
		owner.address,
		proxySUSD,
		getTargetAddress('SportAMMLiquidityPool', network),
	]);
	await DefaultLiquidityProviderDeployed.deployed();

	console.log('DefaultLiquidityProvider proxy:', DefaultLiquidityProviderDeployed.address);

	const DefaultLiquidityProviderImplementation = await getImplementationAddress(
		ethers.provider,
		DefaultLiquidityProviderDeployed.address
	);

	console.log('Implementation DefaultLiquidityProvider: ', DefaultLiquidityProviderImplementation);

	setTargetAddress('DefaultLiquidityProvider', network, DefaultLiquidityProviderDeployed.address);
	setTargetAddress(
		'DefaultLiquidityProviderImplementation',
		network,
		DefaultLiquidityProviderImplementation
	);

	delay(5000);

	try {
		await hre.run('verify:verify', {
			address: DefaultLiquidityProviderImplementation,
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
