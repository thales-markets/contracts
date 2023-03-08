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

	console.log('Account is: ' + owner.address);
	console.log('Network:' + network);
	console.log('Network id:' + networkObj.chainId);

	let parlayAMM = getTargetAddress('ParlayAMM', network);

	console.log('Found ProxyERC20sUSD at:' + proxySUSD);

	const week = 7 * 24 * 60 * 60;

	const Vault = await ethers.getContractFactory('ParlayVault');
	const vault = await upgrades.deployProxy(Vault, [
		{
			_owner: owner.address,
			_parlayAMM: parlayAMM,
			_sUSD: proxySUSD,
			_roundLength: week,
			_priceLowerLimit: w3utils.toWei('0.3'),
			_priceUpperLimit: w3utils.toWei('0.95'),
			_skewImpactLimit: w3utils.toWei('-0.25'), // -2.5% skew impact
			_maxAllowedDeposit: w3utils.toWei('10000'), // 10k% max deposit per round
			_utilizationRate: w3utils.toWei('0.50'), // 50% utilization rate
			_maxTradeRate: w3utils.toWei('0.02'), // 2% max trade rate
			_minDepositAmount: w3utils.toWei('20'), // min deposit
			_maxAllowedUsers: 100, // maximum 100 users allowed at a time in the vault
			_minTradeAmount: w3utils.toWei('5'), // minimum trade amount
			_maxMarketNumberPerRound: 5, // max market tickets per round
		},
	]);

	await vault.deployed();

	console.log('ParlayVault deployed to:', vault.address);
	setTargetAddress('ParlayVault', network, vault.address);

	const implementation = await getImplementationAddress(ethers.provider, vault.address);
	console.log('ParlayVaultImplementation: ', implementation);
	setTargetAddress('ParlayVaultImplementation', network, implementation);

	try {
		await hre.run('verify:verify', {
			address: implementation,
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
