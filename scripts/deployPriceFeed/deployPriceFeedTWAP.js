const { ethers, upgrades } = require('hardhat');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');
const { toBytes32 } = require('../../index');
const { setTargetAddress } = require('../helpers');

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
		networkObj.name = 'optimistic';
		network = 'optimistic';
	}

	console.log('Account is: ' + owner.address);
	console.log('Network:' + network);
	console.log('Network id:' + networkObj.chainId);

	const PriceFeed = await ethers.getContractFactory('PriceFeed');
	const priceFeed = await upgrades.deployProxy(PriceFeed, [owner.address]);
	await priceFeed.deployed();

	console.log('PriceFeed deployed to:', priceFeed.address);
	setTargetAddress('PriceFeedTwap', network, priceFeed.address);

	const priceFeedImplementation = await getImplementationAddress(
		ethers.provider,
		priceFeed.address
	);
	setTargetAddress('PriceFeedTwapImplementation', network, priceFeedImplementation);

	let tx = await priceFeed.addPool(toBytes32('LYRA'), '0xf334f6104a179207ddacfb41fa3567feea8595c2');
	await tx.wait().then(e => {
		console.log('PriceFeed: addPool for LYRA');
	});

	 tx = await priceFeed.addPool(toBytes32('PERP'), '0x535541f1aa08416e69dc4d610131099fa2ae7222');
	await tx.wait().then(e => {
		console.log('PriceFeed: addPool for PERP');
	});

	tx = await priceFeed.addPool(toBytes32('AELIN'), '0x5e8b0fc35065a5d980c11f96cb52381de390b13f');
	await tx.wait().then(e => {
		console.log('PriceFeed: addPool for AELIN');
	});

	try {
		await hre.run('verify:verify', {
			address: priceFeedImplementation,
		});
	} catch (e) {
		console.log(e);
	}

	try {
		await hre.run('verify:verify', {
			address: priceFeed.address,
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
