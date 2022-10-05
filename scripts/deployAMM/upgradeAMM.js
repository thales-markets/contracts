const { ethers, upgrades } = require('hardhat');
const { getTargetAddress, setTargetAddress } = require('../helpers');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');

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
	}

	console.log('Account is: ' + owner.address);
	console.log('Network:' + network);

	const thalesAmmAddress = getTargetAddress('ThalesAMM', network);
	console.log('Found ThalesAMM at:', thalesAmmAddress);

	const ThalesAMM = await ethers.getContractFactory('ThalesAMM');
	const ThalesAMMImplementation = await upgrades.prepareUpgrade(thalesAmmAddress, ThalesAMM);
	// await upgrades.upgradeProxy(thalesAmmAddress, ThalesAMM);
	console.log('ThalesAMM upgraded');
	await delay(10000);

	// const ThalesAMMImplementation = await getImplementationAddress(ethers.provider, thalesAmmAddress);

	console.log('Implementation ThalesAMM: ', ThalesAMMImplementation);

	setTargetAddress('ThalesAMMImplementation', network, ThalesAMMImplementation);

	/*let ThalesAMM_deployed = ThalesAMM.attach(thalesAmmAddress);

	const safeBoxImpact = w3utils.toWei('0.01');
	let tx = await ThalesAMM_deployed.setSafeBoxImpact(safeBoxImpact);
	await tx.wait().then(e => {
		console.log('ThalesAMM: setSafeBoxImpact()');
	});

	const minSpread = w3utils.toWei('0.02');
	tx = await ThalesAMM_deployed.setMinSpread(minSpread);
	await tx.wait().then(e => {
		console.log('ThalesAMM: setMinSpread()');
	});

	const maxSpread = w3utils.toWei('0.2');
	tx = await ThalesAMM_deployed.setMaxSpread(maxSpread);
	await tx.wait().then(e => {
		console.log('ThalesAMM: setMinSpread()');
	});

	const minSupportedPrice = w3utils.toWei('0.05');
	tx = await ThalesAMM_deployed.setMinSupportedPrice(minSupportedPrice);
	await tx.wait().then(e => {
		console.log('ThalesAMM: setMinSupportedPrice()');
	});

	const maxSupportedPrice = w3utils.toWei('0.95');
	tx = await ThalesAMM_deployed.setMaxSupportedPrice(maxSupportedPrice);
	await tx.wait().then(e => {
		console.log('ThalesAMM: setMaxSupportedPrice()');
	});

	const hour = 60 * 60;
	const minimalTimeLeftToMaturity = hour * 8;
	tx = await ThalesAMM_deployed.setMinimalTimeLeftToMaturity(minimalTimeLeftToMaturity);
	await tx.wait().then(e => {
		console.log('ThalesAMM: setMinimalTimeLeftToMaturity()');
	});*/

	try {
		await hre.run('verify:verify', {
			address: ThalesAMMImplementation,
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
