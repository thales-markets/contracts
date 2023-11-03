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
	if (networkObj.chainId == 42161) {
		networkObj.name = 'arbitrumOne';
		network = 'arbitrumOne';
		PaymentToken = getTargetAddress('ExoticUSD', network);
	}
	if (networkObj.chainId == 8453) {
		networkObj.name = 'baseMainnet';
		network = 'baseMainnet';
		PaymentToken = getTargetAddress('ProxyUSDC', network);
	}

	const SportsAMMContract = getTargetAddress('SportsAMM', network);
	const riskManagerAddress = getTargetAddress('SportAMMRiskManager', network);
	console.log('Found SportsAMM at:', SportsAMMContract);
	console.log('Found SportAMMRiskManager at:', riskManagerAddress);
	const SportsAMMCancellationPool = await ethers.getContractFactory('SportsAMMCancellationPool');
	const SportsAMMCancellationPoolAddress = getTargetAddress('SportsAMMCancellationPool', network);

	if (
		networkObj.chainId == 10 ||
		networkObj.chainId == 5 ||
		networkObj.chainId == 42161 ||
		networkObj.chainId == 8453
	) {
		const implementation = await upgrades.prepareUpgrade(
			SportsAMMCancellationPoolAddress,
			SportsAMMCancellationPool,
			{ gasLimit: 15000000 }
		);
		await delay(5000);

		console.log('ParlayMarketData upgraded');

		console.log('Implementation SportsAMMCancellationPool: ', implementation);
		setTargetAddress('SportsAMMCancellationPoolImplementation', network, implementation);
		try {
			await hre.run('verify:verify', {
				address: implementation,
			});
		} catch (e) {
			console.log(e);
		}
	} else {
		await upgrades.upgradeProxy(SportsAMMCancellationPoolAddress, SportsAMMCancellationPool);

		await delay(60000);

		const SportsAMMCancellationPoolImplementation = await getImplementationAddress(
			ethers.provider,
			SportsAMMCancellationPoolAddress
		);

		console.log(
			'Implementation SportsAMMCancellationPool: ',
			SportsAMMCancellationPoolImplementation
		);
		setTargetAddress(
			'SportsAMMCancellationPoolImplementation',
			network,
			SportsAMMCancellationPoolImplementation
		);

		await delay(2000);

		try {
			await hre.run('verify:verify', {
				address: SportsAMMCancellationPoolImplementation,
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
