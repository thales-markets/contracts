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

	console.log('Account is: ' + owner.address);
	console.log('Network:' + network);
	console.log('Network id:' + networkObj.chainId);

	let thalesAMM = getTargetAddress('ThalesAMM', network);

	console.log('Found ProxyERC20sUSD at:' + proxySUSD);

	const week = 7 * 24 * 60 * 60;

	const Vault = await ethers.getContractFactory('AmmVault');
	const vault = await upgrades.deployProxy(Vault, [
		{
			_owner: owner.address,
			_thalesAmm: thalesAMM,
			_sUSD: proxySUSD,
			_roundLength: week,
			_priceLowerLimit: w3utils.toWei('0.10'),
			_priceUpperLimit: w3utils.toWei('0.90'),
			_skewImpactLimit: w3utils.toWei('-0.05'), // -3% skew impact
			_allocationLimitsPerMarketPerRound: w3utils.toWei('5'), // 10% limit per market
			_maxAllowedDeposit: w3utils.toWei('20000'), // 10k% max deposit per round
			_utilizationRate: w3utils.toWei('0.10'), // 50% utilization rate
			_minDepositAmount: w3utils.toWei('20'), // min deposit
			_maxAllowedUsers: 100, // maximum 100 users allowed at a time in the vault
			_minTradeAmount: w3utils.toWei('3'), // minimum trade amount
		},
	]);

	await vault.deployed();

	console.log('Vault deployed to:', vault.address);
	setTargetAddress('AmmVaultDegen', network, vault.address);

	const implementation = await getImplementationAddress(ethers.provider, vault.address);
	console.log('VaultImplementation: ', implementation);
	setTargetAddress('AmmVaultDegenImplementation', network, implementation);

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
