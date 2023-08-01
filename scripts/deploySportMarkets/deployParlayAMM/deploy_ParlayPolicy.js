const path = require('path');
const { ethers, upgrades } = require('hardhat');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');
const w3utils = require('web3-utils');
const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers/src/constants');

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
	}

	if (networkObj.chainId == 42161) {
		networkObj.name = 'arbitrumOne';
		network = 'arbitrumOne';
		PaymentToken = getTargetAddress('ProxyUSDC', network);
		SportsAMMContract = getTargetAddress('SportsAMM', network);
		SportManagerContract = getTargetAddress('SportPositionalMarketManager', network);
		SafeBox = getTargetAddress('SafeBox', network);
	}

	const ParlayAMM = await ethers.getContractFactory('ParlayMarketsAMM');
	const ParlayAMMAddress = getTargetAddress('ParlayAMM', network);
	const ParlayAMMDeployed = await ParlayAMM.attach(ParlayAMMAddress);
	console.log('ParlayAMM found at: ', ParlayAMMAddress);

	// const ParlayPolicy = await ethers.getContractFactory('ParlayPolicy');

	// await delay(2000);
	// const ParlayPolicyDeployed = await upgrades.deployProxy(ParlayPolicy, [
	// 	owner.address,
	// 	ParlayAMMAddress,
	// ]);
	// await delay(2000);
	// await ParlayPolicyDeployed.deployed();

	// console.log('ParlayPolicy Deployed on', ParlayPolicyDeployed.address);
	// setTargetAddress('ParlayPolicy', network, ParlayPolicyDeployed.address);

	// await delay(65000);
	// const ParlayPolicyImplementation = await getImplementationAddress(
	// 	ethers.provider,
	// 	ParlayPolicyDeployed.address
	// );

	// console.log('Implementation ParlayPolicy: ', ParlayPolicyImplementation);
	// setTargetAddress('ParlayPolicyImplementation', network, ParlayPolicyImplementation);

	await delay(5000);
    let ParlayPolicyAddress = getTargetAddress('ParlayPolicy', network);


	if (networkObj.chainId != 10 || networkObj.chainId != 42161) {
		await ParlayAMMDeployed.setPolicyAddresses(
			ParlayPolicyAddress,
			{ from: owner.address }
		);

		console.log('ParlayPolicy address set on ParlayAMM');
	}
	await delay(5000);

	try {
		await hre.run('verify:verify', {
			address: ParlayPolicyImplementation,
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
