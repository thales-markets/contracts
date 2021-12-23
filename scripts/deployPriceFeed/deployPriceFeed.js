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
	setTargetAddress('PriceFeed', network, priceFeed.address);

	const priceFeedImplementation = await getImplementationAddress(
		ethers.provider,
		priceFeed.address
	);
	setTargetAddress('PriceFeedImplementation', network, priceFeedImplementation);

	const aggregators = require(`./aggregators/${network}.json`);
	for (let [key, aggregator] of Object.entries(aggregators)) {
		let tx = await priceFeed.addAggregator(toBytes32(key), aggregator);
		await tx.wait().then(e => {
			console.log('PriceFeed: addAggregator for', key);
		});
	}

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
