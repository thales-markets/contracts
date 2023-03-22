const { ethers, upgrades } = require('hardhat');
const { getTargetAddress, setTargetAddress } = require('../../helpers');
const w3utils = require('web3-utils');

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

	const vaultAddress = getTargetAddress('ParlayVault', network);
	console.log('Found Vault at:', vaultAddress);

	const Vault = await ethers.getContractFactory('ParlayVault');
	const Vaultdeployed = await Vault.attach(vaultAddress);

	await Vaultdeployed.setSkewImpactLimit(w3utils.toWei('-0.01'), { from: owner.address });
	// const week = 7 * 24 * 60 * 60;
	// await Vaultdeployed.setRoundLength(week, { from: owner.address });
}
main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
