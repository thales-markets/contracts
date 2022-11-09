const { ethers, upgrades } = require('hardhat');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');
const snx = require('synthetix-2.50.4-ovm');
const { artifacts, contract, web3 } = require('hardhat');
const { getTargetAddress, setTargetAddress } = require('../helpers');
const { toBytes32 } = require('../../index');
const w3utils = require('web3-utils');

async function main() {
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	let priceFeedAddress, ProxyERC20sUSDaddress;

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
	}

	if (networkObj.chainId == 80001) {
		networkObj.name = 'polygonMumbai';
		network = 'polygonMumbai';
	}

	if (networkObj.chainId == 137) {
		networkObj.name = 'polygon';
		network = 'polygon';
	}

	if (networkObj.chainId == 42) {
		networkObj.name = 'kovan';
		network = 'kovan';
	}

	if (networkObj.chainId == 56) {
		networkObj.name = 'bsc';
		network = 'bsc';
	}

	if (networkObj.chainId == 42161) {
		networkObj.name = 'arbitrumOne';
		network = 'arbitrumOne';
	}

	if (networkObj.chainId == 420) {
		networkObj.name = 'optimisticGoerli';
		network = 'optimisticGoerli';
		PaymentToken = getTargetAddress('ExoticUSD', network);
	}

	if (networkObj.chainId == 5) {
		networkObj.name = 'goerli';
		network = 'goerli';
		PaymentToken = getTargetAddress('ExoticUSD', network);
	}

	let accounts = await ethers.getSigners();
	let owner = accounts[0];

	console.log('Owner is: ' + owner.address);
	console.log('Network:' + network);
	console.log('Network id:' + networkObj.chainId);

	let thalesAMM = getTargetAddress('ThalesAMM', network);
	let rangedAMM = getTargetAddress('RangedAMM', network);

	const Referrals = await ethers.getContractFactory('Referrals');
	let ReferralsDeployed = await upgrades.deployProxy(Referrals, [
		owner.address,
		owner.address,
		owner.address,
	]);
	await ReferralsDeployed.deployed();

	console.log('Referrals proxy:', ReferralsDeployed.address);

	const ReferralsImplementation = await getImplementationAddress(
		ethers.provider,
		ReferralsDeployed.address
	);

	console.log('Implementation Referrals: ', ReferralsImplementation);

	setTargetAddress('Referrals', network, ReferralsDeployed.address);
	setTargetAddress('ReferralsImplementation', network, ReferralsImplementation);

	//TODO: add fillip up already traded addresses
	const SportsAMMAddress = getTargetAddress('SportsAMM', network);
	const ParlayAMMAddress = getTargetAddress('ParlayAMM', network);
	await ReferralsDeployed.setSportsAMM(SportsAMMAddress, ParlayAMMAddress, {
		from: owner.address,
	});
	console.log('Sports and Parlay updated');

	try {
		await hre.run('verify:verify', {
			address: ReferralsImplementation,
		});
	} catch (e) {
		console.log(e);
	}

	try {
		await hre.run('verify:verify', {
			address: ReferralsDeployed.address,
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
