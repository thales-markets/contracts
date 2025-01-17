const { ethers, upgrades } = require('hardhat');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');
const snx = require('synthetix-2.50.4-ovm');
const { artifacts, contract, web3 } = require('hardhat');
const { getTargetAddress, setTargetAddress } = require('../../helpers');
const { toBytes32 } = require('../../../index');
const w3utils = require('web3-utils');

const DAY = 24 * 60 * 60;
const MINUTE = 60;
const rate = '300000000';

async function main() {
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	let thalesAddress, ProxyERC20sUSDaddress;

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

	if (networkObj.chainId == 42161) {
		networkObj.name = 'arbitrumOne';
		network = 'arbitrumOne';
	}
	if (networkObj.chainId == 8453) {
		networkObj.name = 'baseMainnet';
		network = 'baseMainnet';
		ProxyERC20sUSDaddress = getTargetAddress('USDC', network);
		thalesAddress = getTargetAddress('OVER', network);
	}

	let accounts = await ethers.getSigners();
	let owner = accounts[0];

	console.log('Owner is: ' + owner.address);
	console.log('Network:' + network);
	console.log('Network id:' + networkObj.chainId);

	const SafeBoxBuyback = await ethers.getContractFactory('SafeBoxBuyback');
	let SafeBoxDeployed = await upgrades.deployProxy(SafeBoxBuyback, [
		owner.address,
		ProxyERC20sUSDaddress,
	]);
	await SafeBoxDeployed.deployed();

	console.log('SafeBoxBuyback proxy:', SafeBoxDeployed.address);

	const SafeBoxBuybackImplementation = await getImplementationAddress(
		ethers.provider,
		SafeBoxDeployed.address
	);

	console.log('Implementation SafeBoxBuyback: ', SafeBoxBuybackImplementation);

	setTargetAddress('SafeBoxBuyback', network, SafeBoxDeployed.address);
	setTargetAddress('SafeBoxBuybackImplementation', network, SafeBoxBuybackImplementation);

	delay(5000);

	// contract settings
	let tx = await SafeBoxDeployed.setTickRate(rate);
	await tx.wait().then((e) => {
		console.log('SafeBoxBuyback: setTickRate');
	});

	delay(5000);
	delay(5000);

	tx = await SafeBoxDeployed.setTickLength('14400');
	await tx.wait().then((e) => {
		console.log('SafeBoxBuyback: setTickLength');
	});

	delay(5000);

	tx = await SafeBoxDeployed.setThalesToken(thalesAddress);
	await tx.wait().then((e) => {
		console.log('SafeBoxBuyback: setThalesToken');
	});
	delay(5000);

	tx = await SafeBoxDeployed.setWETHAddress('0x4200000000000000000000000000000000000006');
	await tx.wait().then((e) => {
		console.log('SafeBoxBuyback: setWETHAddress');
	});
	delay(5000);

	tx = await SafeBoxDeployed.setSwapRouter(getTargetAddress('SwapRouter', network));
	await tx.wait().then((e) => {
		console.log('SafeBoxBuyback: setSwapRouter');
	});

	delay(5000);

	tx = await SafeBoxDeployed.setBuybacksEnabled(false);
	await tx.wait().then((e) => {
		console.log('SafeBoxBuyback: setBuybacksEnabled');
	});

	delay(5000);

	tx = await SafeBoxDeployed.setUniswapV3Factory(getTargetAddress('UniswapV3Factory', network));
	await tx.wait().then((e) => {
		console.log('SafeBoxBuyback: setUniswapV3Factory');
	});

	try {
		await hre.run('verify:verify', {
			address: SafeBoxBuybackImplementation,
		});
	} catch (e) {
		console.log(e);
	}

	try {
		await hre.run('verify:verify', {
			address: SafeBoxDeployed.address,
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
