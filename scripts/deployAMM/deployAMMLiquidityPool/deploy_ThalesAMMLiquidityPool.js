const { ethers, upgrades } = require('hardhat');
const { toBytes32 } = require('../../../index');
const { getTargetAddress, setTargetAddress } = require('../../helpers');
const w3utils = require('web3-utils');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;

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

	console.log('Account is: ' + owner.address);
	console.log('Network:' + network);
	console.log('Network id:' + networkObj.chainId);

	let thalesAMM = getTargetAddress('ThalesAMM', network);

	console.log('Found ProxyERC20sUSD at:' + proxySUSD);

	const week = 7 * 24 * 60 * 60;

	const ThalesAMMLiquidityPool = await ethers.getContractFactory('ThalesAMMLiquidityPool');
	const thalesAMMLiquidityPool = await upgrades.deployProxy(ThalesAMMLiquidityPool, [
		{
			_owner: owner.address,
			_thalesAMM: thalesAMM,
			_sUSD: proxySUSD,
			_roundLength: week,
			_maxAllowedDeposit: w3utils.toWei('20000'), // 10k% max deposit per round
			_minDepositAmount: w3utils.toWei('20'), // min deposit
			_maxAllowedUsers: 100, // maximum 100 users allowed at a time in the vault
			_needsTransformingCollateral: true,
		},
	]);

	await thalesAMMLiquidityPool.deployed();

	console.log('thalesAMMLiquidityPool deployed to:', thalesAMMLiquidityPool.address);
	setTargetAddress('ThalesAMMLiquidityPool', network, thalesAMMLiquidityPool.address);

	const implementation = await getImplementationAddress(
		ethers.provider,
		thalesAMMLiquidityPool.address
	);
	console.log('ThalesAMMLiquidityPoolImplementation: ', implementation);
	setTargetAddress('ThalesAMMLiquidityPoolImplementation', network, implementation);

	const ThalesAMMLiquidityPoolRoundMastercopy = await ethers.getContractFactory(
		'ThalesAMMLiquidityPoolRoundMastercopy'
	);
	const ThalesAMMLiquidityPoolRoundMastercopyDeployed =
		await ThalesAMMLiquidityPoolRoundMastercopy.deploy();
	await ThalesAMMLiquidityPoolRoundMastercopyDeployed.deployed();

	console.log(
		'ThalesAMMLiquidityPoolRoundMastercopy deployed to:',
		ThalesAMMLiquidityPoolRoundMastercopyDeployed.address
	);

	setTargetAddress(
		'ThalesAMMLiquidityPoolRoundMastercopy',
		network,
		ThalesAMMLiquidityPoolRoundMastercopyDeployed.address
	);

	try {
		await hre.run('verify:verify', {
			address: implementation,
		});
	} catch (e) {
		console.log(e);
	}

	try {
		await hre.run('verify:verify', {
			address: ThalesAMMLiquidityPoolRoundMastercopyDeployed.address,
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
