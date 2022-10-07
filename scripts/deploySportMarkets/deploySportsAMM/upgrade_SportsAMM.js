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

	const SportsAMMAddress = getTargetAddress('SportsAMM', network);
	const SportsAMM = await ethers.getContractFactory('SportsAMM');

	if (networkObj.chainId == 42 || networkObj.chainId == 5 || networkObj.chainId == 420) {
		await upgrades.upgradeProxy(SportsAMMAddress, SportsAMM);
		await delay(15000);

		const SportsAMMImplementation = await getImplementationAddress(
			ethers.provider,
			SportsAMMAddress
		);
		console.log('SportsAMM upgraded');

		console.log('Implementation SportsAMM: ', SportsAMMImplementation);
		setTargetAddress('SportsAMMImplementation', network, SportsAMMImplementation);

		try {
			await hre.run('verify:verify', {
				address: SportsAMMImplementation,
			});
		} catch (e) {
			console.log(e);
		}
	}

	if (networkObj.chainId == 10) {
		const implementation = await upgrades.prepareUpgrade(SportsAMMAddress, SportsAMM);
		await delay(5000);

		console.log('SportsAMM upgraded');

		console.log('Implementation SportsAMM: ', implementation);
		setTargetAddress('SportsAMMImplementation', network, implementation);
		try {
			await hre.run('verify:verify', {
				address: implementation,
			});
		} catch (e) {
			console.log(e);
		}
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
