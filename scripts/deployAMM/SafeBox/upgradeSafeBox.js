const { ethers, upgrades } = require('hardhat');
const { getTargetAddress, setTargetAddress } = require('../../helpers');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');
const w3utils = require('web3-utils');

const DAY = 24 * 60 * 60;
const MINUTE = 60;
const rate = w3utils.toWei('1');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
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

	if (networkObj.chainId == 80001) {
		networkObj.name = 'polygonMumbai';
		network = 'polygonMumbai';
	}

	if (networkObj.chainId == 137) {
		networkObj.name = 'polygon';
		network = 'polygon';
	}

	console.log('Account is: ' + owner.address);
	console.log('Network:' + network);

	const safeBoxAddress = getTargetAddress('SafeBox', network);
	console.log('Found SafeBox at:', safeBoxAddress);

	const SafeBox = await ethers.getContractFactory('SafeBox');
	const implementation = await upgrades.prepareUpgrade(safeBoxAddress, SafeBox);
	if (networkObj.chainId == 69) {
		await upgrades.upgradeProxy(safeBoxAddress, SafeBox);
		console.log('SafeBox upgraded');

		const SafeBoxDeployed = await SafeBox.attach(safeBoxAddress);

		delay(5000);

		// contract settings
		let tx = await SafeBoxDeployed.setTickRate(rate);
		await tx.wait().then((e) => {
			console.log('SafeBox: setTickRate');
		});

		delay(5000);

		tx = await SafeBoxDeployed.setTickLength(5 * MINUTE);
		await tx.wait().then((e) => {
			console.log('SafeBox: setTickLength');
		});

		delay(5000);

		tx = await SafeBoxDeployed.setThalesToken('0xaA5068dC2B3AADE533d3e52C6eeaadC6a8154c57'); // DAI for kovan
		await tx.wait().then((e) => {
			console.log('SafeBox: setThalesToken');
		});
		delay(5000);

		tx = await SafeBoxDeployed.setWETHAddress('0x4200000000000000000000000000000000000006');
		await tx.wait().then((e) => {
			console.log('SafeBox: setWETHAddress');
		});
		delay(5000);

		tx = await SafeBoxDeployed.setSwapRouter('0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45');
		await tx.wait().then((e) => {
			console.log('SafeBox: setSwapRouter');
		});

		delay(5000);

		tx = await SafeBoxDeployed.setUniswapV3Factory('0x1f98431c8ad98523631ae4a59f267346ea31f984');
		await tx.wait().then((e) => {
			console.log('SafeBox: setUniswapV3Factory');
		});
	}

	setTargetAddress('SafeBoxImplementation', network, implementation);

	try {
		await hre.run('verify:verify', {
			address: implementation,
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
