const { ethers } = require('hardhat');
const w3utils = require('web3-utils');
const snx = require('synthetix-2.50.4-ovm');
const { artifacts, contract, web3 } = require('hardhat');
const { setTargetAddress, getTargetAddress } = require('../helpers');

const { getImplementationAddress } = require('@openzeppelin/upgrades-core');

const { toBN } = web3.utils;

const { toBytes32 } = require('../../index');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	if (network == 'homestead') {
		network = 'mainnet';
	}

	console.log('Account is:' + owner.address);
	console.log('Network name:' + networkObj.name);

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
	}
	if (networkObj.chainId == 420) {
		networkObj.name = 'optimisticGoerli';
		network = 'optimisticGoerli';
	}

	if (networkObj.chainId == 80001) {
		networkObj.name = 'polygonMumbai';
		network = 'polygonMumbai';
	}

	if (networkObj.chainId == 137) {
		networkObj.name = 'polygon';
		network = 'polygon';
	}

	if (networkObj.chainId == 42161) {
		networkObj.name = 'arbitrumOne';
		network = 'arbitrumOne';
	}

	/* ========== PROPERTIES FOR INITIALIZE ========== */

	const manager = await ethers.getContractFactory('SportPositionalMarketManager');
	let managerAddress = getTargetAddress('SportPositionalMarketManager', network);

	console.log('SportPositionalMarketManager address: ', managerAddress);

	let maxCap = w3utils.toWei('20000');
	let maxRisk = 5;
	let defaultCapPerGame = w3utils.toWei('1000');
	let defaultRiskMultiplier = 3;

	let sportIds = [
		9001, 9002, 9003, 9004, 9005, 9006, 9007, 9010, 9011, 9012, 9013, 9014, 9015, 9016, 9017, 9018,
		9019, 9020, 9021, 9033, 9042, 9045, 9050, 9057, 9061, 9073, 9076, 9153, 9156, 9268, 9288, 9296,
		9399, 9409, 9445, 9497, 9536, 18196, 18806, 18821, 18977, 18983, 19138, 19216, 109021, 109121,
	];
	let capsPerSportIds = [
		w3utils.toWei('3000'),
		w3utils.toWei('3000'),
		w3utils.toWei('6000'),
		w3utils.toWei('1000'),
		w3utils.toWei('3500'),
		w3utils.toWei('4000'),
		w3utils.toWei('3000'),
		w3utils.toWei('3000'),
		w3utils.toWei('5000'),
		w3utils.toWei('4000'),
		w3utils.toWei('4000'),
		w3utils.toWei('4000'),
		w3utils.toWei('4000'),
		w3utils.toWei('4000'),
		w3utils.toWei('4000'),
		w3utils.toWei('1000'),
		w3utils.toWei('2000'),
		w3utils.toWei('2000'),
		w3utils.toWei('2000'),
		w3utils.toWei('1000'),
		w3utils.toWei('2000'),
		w3utils.toWei('3000'),
		w3utils.toWei('4000'),
		w3utils.toWei('2000'),
		w3utils.toWei('2000'),
		w3utils.toWei('2000'),
		w3utils.toWei('2000'),
		w3utils.toWei('3000'),
		w3utils.toWei('1000'),
		w3utils.toWei('1500'),
		w3utils.toWei('4000'),
		w3utils.toWei('1000'),
		w3utils.toWei('2000'),
		w3utils.toWei('1000'),
		w3utils.toWei('3000'),
		w3utils.toWei('3000'),
		w3utils.toWei('1500'),
		w3utils.toWei('1000'),
		w3utils.toWei('5000'),
		w3utils.toWei('5000'),
		w3utils.toWei('1000'),
		w3utils.toWei('1000'),
		w3utils.toWei('1000'),
		w3utils.toWei('2000'),
		w3utils.toWei('1000'),
		w3utils.toWei('5000'),
	];

	let sportIdsForChilds = []; // TODO add if needed
	let childIds = []; // TODO add if needed
	let capsForChilds = []; // TODO add if needed

	let riskMultiplierSportIds = []; // TODO add if needed
	let riskMultiplierforSportIds = []; // TODO add if needed

	/* ========== DEPLOY CONTRACT ========== */

	if (
		sportIds.length == capsPerSportIds.length &&
		riskMultiplierSportIds.length == riskMultiplierforSportIds.length
	) {
		let SportAMMRiskManager = await ethers.getContractFactory('SportAMMRiskManager');
		const riskManager = await upgrades.deployProxy(SportAMMRiskManager, [
			owner.address,
			managerAddress,
			defaultCapPerGame,
			sportIds,
			capsPerSportIds,
			sportIdsForChilds,
			childIds,
			capsForChilds,
			defaultRiskMultiplier,
			riskMultiplierSportIds,
			riskMultiplierforSportIds,
		]);

		await riskManager.deployed();

		console.log('SportAMMRiskManager deployed to:', riskManager.address);
		setTargetAddress('SportAMMRiskManager', network, riskManager.address);

		const implementation = await getImplementationAddress(ethers.provider, riskManager.address);
		console.log('SportAMMRiskManagerImplementation: ', implementation);
		setTargetAddress('SportAMMRiskManagerImplementation', network, implementation);
		await delay(2000);
		await hre.run('verify:verify', {
			address: implementation,
		});
	} else {
		console.log('Array length not OK!');
	}
}

function delay(time) {
	return new Promise(function (resolve) {
		setTimeout(resolve, time);
	});
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
