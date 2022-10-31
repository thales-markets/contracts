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

	let sportsAMM = getTargetAddress('SportsAMM', network);

	console.log('Found ProxyERC20sUSD at:' + proxySUSD);

	const week = 7 * 24 * 60 * 60;

	const Vault = await ethers.getContractFactory('SportVault');
	const vault = await upgrades.deployProxy(Vault, [
		owner.address,
		sportsAMM,
		proxySUSD,
		week,
		w3utils.toWei('0.50'),
		w3utils.toWei('0.95'),
		w3utils.toWei('-0.03'), // -3% skew impact
		w3utils.toWei('10'), // 10% limit per market
		w3utils.toWei('20000'), // 10k% max deposit per round
		w3utils.toWei('0.50'), // 50% utilization rate
		w3utils.toWei('20'), // min deposit
		100, // maximum 100 users allowed at a time in the vault
		w3utils.toWei('10'), // minimum trade amount
	]);

	//	await vault.initialize({
	// 			_owner: owner,
	// 			_sportsAmm: SportsAMM.address,
	// 			_sUSD: Thales.address,
	// 			_roundLength: week,
	// 			_priceLowerLimit: toUnit(0.2).toString(),
	// 			_priceUpperLimit: toUnit(1).toString(),
	// 			_skewImpactLimit: toUnit(-0.03).toString(), // 40%
	// 			_allocationLimitsPerMarketPerRound: toUnit(10).toString(), // 40%
	// 			_maxAllowedDeposit: toUnit(1000).toString(), // 20%
	// 			_utilizationRate: toUnit(0.5).toString(),
	// 			_minDepositAmount: toUnit(100).toString(),
	// 			_maxAllowedUsers: 100,
	// 			_minTradeAmount: toUnit(10).toString(),
	// 		});

	await vault.deployed();

	console.log('Vault deployed to:', vault.address);
	setTargetAddress('SportVault', network, vault.address);

	const implementation = await getImplementationAddress(ethers.provider, vault.address);
	console.log('VaultImplementation: ', implementation);
	setTargetAddress('SportVaultImplementation', network, implementation);

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
