const { ethers, upgrades } = require('hardhat');
const { getTargetAddress, setTargetAddress } = require('../helpers');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');
const w3utils = require('web3-utils');

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

	console.log('Account is: ' + owner.address);
	console.log('Network:' + network);

	const thalesAmmAddress = getTargetAddress('ThalesAMM', network);
	console.log('Found ThalesAMM at:', thalesAmmAddress);

	const ThalesAMM = await ethers.getContractFactory('ThalesAMM');
	const implementation = await upgrades.prepareUpgrade(thalesAmmAddress, ThalesAMM);
	await upgrades.upgradeProxy(thalesAmmAddress, ThalesAMM);

	console.log('ThalesAMM upgraded');

	const ThalesAMMImplementation = await getImplementationAddress(ethers.provider, thalesAmmAddress);

	console.log('Implementation ThalesAMM: ', implementation);

	setTargetAddress('ThalesAMMImplementation', network, implementation);

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
	.catch(error => {
		console.error(error);
		process.exit(1);
	});
