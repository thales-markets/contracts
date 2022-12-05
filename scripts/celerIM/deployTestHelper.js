const path = require('path');
const { ethers, upgrades } = require('hardhat');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');

const { getTargetAddress, setTargetAddress } = require('../helpers');

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

	const ContractTest = await ethers.getContractFactory('ContractTest');
	const Invoker = await ethers.getContractFactory('Invoker');

	const ContractTestDeployed = await ContractTest.deploy();
	await ContractTestDeployed.deployed();

	const InvokerDeployed = await Invoker.deploy(ContractTestDeployed.address);
	await InvokerDeployed.deployed();
	console.log('TestContract: ', ContractTestDeployed.address);
	console.log('InvokerDeployed: ', InvokerDeployed.address);

	await delay(5000);
	try {
		await hre.run('verify:verify', {
			address: ContractTestDeployed.address,
			// contract: 'contracts/SportMarkets/Parlay/ParlayMarketMastercopy.sol:ParlayMarketMastercopy',
		});
	} catch (e) {
		console.log(e);
	}
	try {
		await hre.run('verify:verify', {
			address: InvokerDeployed.address,
			constructorArguments: [ContractTestDeployed.address],
			// contract: 'contracts/SportMarkets/Parlay/ParlayMarketMastercopy.sol:ParlayMarketMastercopy',
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
