const path = require('path');
const { ethers, upgrades } = require('hardhat');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');

const { getTargetAddress, setTargetAddress } = require('../../helpers');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	let mainnetNetwork = 'mainnet';
	let PaymentToken;
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
	}
	if (networkObj.chainId == 5) {
		networkObj.name = 'goerli';
		network = 'goerli';
		PaymentToken = getTargetAddress('ExoticUSD', network);
	}
	if (networkObj.chainId == 420) {
		networkObj.name = 'optimisticGoerli';
		network = 'optimisticGoerli';
		PaymentToken = getTargetAddress('ExoticUSD', network);
	}

	const ParlayAMM = await ethers.getContractFactory('ParlayMarketsAMM');
	const ParlayAMMAddress = getTargetAddress('ParlayAMM', network);
	const ParlayAMMDeployed = await ParlayAMM.attach(ParlayAMMAddress);
	console.log('ParlayAMM found at: ', ParlayAMMAddress);

	const ParlayMarketData = await ethers.getContractFactory('ParlayMarketData');

	await delay(2000);
	const ParlayMarketDataDeployed = await upgrades.deployProxy(ParlayMarketData, [
		owner.address,
		ParlayAMMAddress,
	]);
	await delay(2000);
	await ParlayMarketDataDeployed.deployed();

	console.log('ParlayMarketData Deployed on', ParlayMarketDataDeployed.address);
	setTargetAddress('ParlayMarketData', network, ParlayMarketDataDeployed.address);

	await delay(65000);
	const ParlayMarketDataImplementation = await getImplementationAddress(
		ethers.provider,
		ParlayMarketDataDeployed.address
	);

	console.log('Implementation ParlayMarketData: ', ParlayMarketDataImplementation);
	setTargetAddress('ParlayMarketDataImplementation', network, ParlayMarketDataImplementation);

	await delay(5000);

	let SportsAMMContract = getTargetAddress('SportsAMM', network);
	let Referrals = getTargetAddress('Referrals', network);
	let ParlayVerifier = getTargetAddress('ParlayVerifier', network);

	await ParlayAMMDeployed.setAddresses(
		SportsAMMContract,
		ZERO_ADDRESS,
		owner.address,
		Referrals,
		ParlayMarketDataDeployed.address,
		ParlayVerifier,
		{ from: owner.address }
	);

	console.log('ParlayMarketData address set on ParlayAMM');
	await delay(65000);

	try {
		await hre.run('verify:verify', {
			address: ParlayMarketDataImplementation,
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
