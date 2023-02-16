const path = require('path');
const { ethers, upgrades } = require('hardhat');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');
const ObjectsToCsv = require('objects-to-csv');

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
		PaymentToken = getTargetAddress('ProxyUSDC', network);
	}

	const SportMarketManager = await ethers.getContractFactory('SportPositionalMarketManager');
	const SportMarketManagerAddress = getTargetAddress('SportPositionalMarketManager', network);
	const SportMarketManagerDeployed = await SportMarketManager.attach(SportMarketManagerAddress);

	const PaymentTokenContract = await ethers.getContractFactory(
		'@openzeppelin/contracts-4.4.1/token/ERC20/ERC20.sol:ERC20'
	);
	const PaymentTokenDeployed = await PaymentTokenContract.attach(PaymentToken);
	const SportMarketFactoryAddress = getTargetAddress('SportPositionalMarketFactory', network);
	const SportMarketFactory = await ethers.getContractFactory('SportPositionalMarketFactory');
	const SportMarketFactoryDeployed = await SportMarketFactory.attach(SportMarketFactoryAddress);

	const SportPositionalMarket = await ethers.getContractFactory('SportPositionalMarketMastercopy');

	const MultiSend = await ethers.getContractFactory('MultiSend');
	const MultiSendAddress = getTargetAddress('MultiSend', network);

	// USE THIS CODE IF MULTI SEND IS NOT DEPLOYED:
	// const MultiSendDeployed = await MultiSend.deploy();
	// await MultiSendDeployed.deployed();
	// setTargetAddress(
	// 	'MultiSend',
	// 	network,
	// 	MultiSendDeployed.address
	// );
	// await PaymentTokenDeployed.approve(MultiSendDeployed.address, 200000);

	const MultiSendDeployed = await MultiSend.attach(MultiSendAddress);
	console.log('MutiSend address: ', MultiSendDeployed.address);

	if (networkObj.chainId == 42161) {
		let numOfActiveMarkets = await SportMarketManagerDeployed.numActiveMarkets();
		let numOfMaturedMarkets = await SportMarketManagerDeployed.numMaturedMarkets();
		let usdc_balance = await PaymentTokenDeployed.balanceOf(owner.address);
		console.log('Total active markets: ', parseInt(numOfActiveMarkets.toString()));
		console.log('Total matured markets: ', parseInt(numOfMaturedMarkets.toString()));
		console.log('Owner USDC balance: ', parseInt(usdc_balance.toString()));
		let fundingAmount = 10;
		let batches = [];
		let activeMarkets = await SportMarketManagerDeployed.activeMarkets(0, numOfActiveMarkets);
		let maturedMarkets = await SportMarketManagerDeployed.maturedMarkets(0, numOfMaturedMarkets);
		console.log('Total active markets: ', activeMarkets.length);
		console.log('Total matured markets: ', maturedMarkets.length);
		for (let i = 0; i < activeMarkets.length; i++) {
			batches.push(activeMarkets[i]);
			if (batches.length == 20) {
				console.log(i);
				await MultiSendDeployed.sendToMultipleAddresses(
					batches,
					fundingAmount,
					PaymentTokenDeployed.address
				);
				await delay(2000);
				console.log('Sent to markets:');
				console.log(batches);
				batches = [];
			}
			if (i == activeMarkets.length - 1) {
				await MultiSendDeployed.sendToMultipleAddresses(
					batches,
					fundingAmount,
					PaymentTokenDeployed.address
				);
				await delay(2000);
				console.log('Sent to markets:');
				console.log(batches);
				batches = [];
			}
		}
		let balanceOfMaturedMarket;
		for (let i = 0; i < maturedMarkets.length; i++) {
			balanceOfMaturedMarket = await PaymentTokenDeployed.balanceOf(maturedMarkets[i]);
			if (parseInt(balanceOfMaturedMarket.toString()) > 0) {
				batches.push(maturedMarkets[i]);
				if (batches.length == 20) {
					console.log(i);
					await MultiSendDeployed.sendToMultipleAddresses(
						batches,
						fundingAmount,
						PaymentTokenDeployed.address
					);
					await delay(2000);
					console.log('Sent to markets:');
					console.log(batches);
					batches = [];
				}
				if (i == maturedMarkets.length - 1) {
					await MultiSendDeployed.sendToMultipleAddresses(
						batches,
						fundingAmount,
						PaymentTokenDeployed.address
					);
					await delay(2000);
					console.log('Sent to markets:');
					console.log(batches);
					batches = [];
				}
			}
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
