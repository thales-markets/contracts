const path = require('path');
const { ethers, upgrades } = require('hardhat');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');
const w3utils = require('web3-utils');

const { getTargetAddress, setTargetAddress } = require('../../helpers');
const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers/src/constants');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	let mainnetNetwork = 'mainnet';
	let PaymentToken;
	let SportsAMMContract;

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
	}
	if (networkObj.chainId == 5) {
		networkObj.name = 'goerli';
		network = 'goerli';
		PaymentToken = getTargetAddress('ExoticUSD', network);
		SportsAMMContract = getTargetAddress('SportsAMM', network);
	}
	if (networkObj.chainId == 420) {
		networkObj.name = 'optimisticGoerli';
		network = 'optimisticGoerli';
		PaymentToken = getTargetAddress('ExoticUSD', network);
		SportsAMMContract = getTargetAddress('SportsAMM', network);
	}
	if (networkObj.chainId == 42161) {
		networkObj.name = 'arbitrumOne';
		network = 'arbitrumOne';
		PaymentToken = getTargetAddress('ProxyUSDC', network);
	}

	const parlayAMMfee = '5';
	const maxSupportedAmount = w3utils.toWei('20000');
	const maxSupportedOdds = w3utils.toWei('0.005');
	const safeBoxImpact = '5';

	const ParlayAMMAddress = getTargetAddress('ParlayAMM', network);

	const ParlayAMM = await ethers.getContractFactory('ParlayMarketsAMM');

	if (networkObj.chainId == 10 || networkObj.chainId == 5 || networkObj.chainId == 42161) {
		console.log('HERE');
		const implementation = await upgrades.prepareUpgrade(ParlayAMMAddress, ParlayAMM);
		await delay(5000);

		console.log('ParlayAMM upgraded');

		console.log('Implementation ParlayAMM: ', implementation);
		setTargetAddress('ParlayAMMImplementation', network, implementation);
		try {
			await hre.run('verify:verify', {
				address: implementation,
			});
		} catch (e) {
			console.log(e);
		}
	} else {
		await upgrades.upgradeProxy(ParlayAMMAddress, ParlayAMM);

		await delay(10000);

		const ParlayAMMImplementation = await getImplementationAddress(
			ethers.provider,
			ParlayAMMAddress
		);

		console.log('Implementation ParlayAMM: ', ParlayAMMImplementation);
		setTargetAddress('ParlayAMMImplementation', network, ParlayAMMImplementation);

		await delay(2000);
		try {
			await hre.run('verify:verify', {
				address: ParlayAMMImplementation,
			});
		} catch (e) {
			console.log(e);
		}
	}

	// const ReferralsContract = getTargetAddress('Referrals', network);
	// const ParlayMarketDataContract = getTargetAddress('ParlayMarketData', network);
	// const ParlayVerifierContract = getTargetAddress('ParlayVerifier', network);
	// const ParlayAMMDeployed = ParlayAMM.attach(ParlayAMMAddress);

	// await ParlayAMMDeployed.setAddresses(
	// 	SportsAMMContract,
	// 	ZERO_ADDRESS,
	// 	owner.address,
	// 	ReferralsContract,
	// 	ParlayMarketDataContract,
	// 	ParlayVerifierContract,
	// 	{from:owner.address}
	// 	);
	// 	console.log('Addresses set');
	// await delay(2000);
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
