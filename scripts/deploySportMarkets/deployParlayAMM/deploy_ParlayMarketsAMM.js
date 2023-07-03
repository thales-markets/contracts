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
	let SportsAMMContract;
	let SportManagerContract;
	let SafeBox;

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
	}

	if (networkObj.chainId == 42161) {
		networkObj.name = 'arbitrumOne';
		network = 'arbitrumOne';
		PaymentToken = getTargetAddress('ProxyUSDC', network);
		SportsAMMContract = getTargetAddress('SportsAMM', network);
		SportManagerContract = getTargetAddress('SportPositionalMarketManager', network);
		SafeBox = getTargetAddress('SafeBox', network);
	}

	const parlayAMMfee = w3utils.toWei('0.03');
	const safeBoxImpact = w3utils.toWei('0.03');
	const maxSupportedAmount = w3utils.toWei('5000');
	const maxSupportedOdds = w3utils.toWei('0.05');

	const ParlayAMM = await ethers.getContractFactory('ParlayMarketsAMM');

	const ParlayAMMDeployed = await upgrades.deployProxy(ParlayAMM, [
		owner.address,
		SportsAMMContract,
		SportManagerContract,
		parlayAMMfee,
		maxSupportedAmount,
		maxSupportedOdds,
		PaymentToken,
		SafeBox,
		safeBoxImpact,
	]);
	await ParlayAMMDeployed.deployed();

	await delay(10000);
	console.log('ParlayAMM Deployed on', ParlayAMMDeployed.address);
	setTargetAddress('ParlayAMM', network, ParlayAMMDeployed.address);
	await delay(60000);

	const ParlayAMMImplementation = await getImplementationAddress(
		ethers.provider,
		ParlayAMMDeployed.address
	);

	console.log('Implementation ParlayAMM: ', ParlayAMMImplementation);
	setTargetAddress('ParlayAMMImplementation', network, ParlayAMMImplementation);

	await delay(2000);

	try {
		await hre.run('verify:verify', {
			address: ParlayAMMDeployed.address,
		});
	} catch (e) {
		console.log(e);
	}

	try {
		await hre.run('verify:verify', {
			address: ParlayAMMImplementation,
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
