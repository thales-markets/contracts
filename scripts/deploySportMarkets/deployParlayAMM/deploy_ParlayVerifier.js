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

	const ParlayVerifier = await ethers.getContractFactory('ParlayVerifier');

	const ParlayVerifierDeployed = await ParlayVerifier.deploy();
	await ParlayVerifierDeployed.deployed();

	await delay(10000);
	console.log('ParlayVerifier Deployed on', ParlayVerifierDeployed.address);
	setTargetAddress('ParlayVerifier', network, ParlayVerifierDeployed.address);
	await delay(60000);

	const ReferralsContract = getTargetAddress('Referrals', network);
	const ParlayMarketDataContract = getTargetAddress('ParlayMarketData', network);
	const ParlayAMM = await ethers.getContractFactory('ParlayMarketsAMM');
	const ParlayAMMAddress = getTargetAddress('ParlayAMM', network);
	const ParlayAMMDeployed = ParlayAMM.attach(ParlayAMMAddress);

	if (networkObj.chainId != 10) {
		await ParlayAMMDeployed.setAddresses(
			SportsAMMContract,
			SafeBox,
			ReferralsContract,
			ZERO_ADDRESS,
			ParlayVerifierDeployed.address,
			{ from: owner.address }
		);
		console.log('Addresses set in ParlayAMM');
	}
	await delay(2000);

	try {
		await hre.run('verify:verify', {
			address: ParlayVerifierDeployed.address,
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
