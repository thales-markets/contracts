const { ethers } = require('hardhat');

const { getTargetAddress, setTargetAddress } = require('../helpers');

const { toBytes32 } = require('../../index');

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

	const OwnedUpgradeabilityProxy = await ethers.getContractFactory('OwnedUpgradeabilityProxy');
	const OwnedUpgradeabilityProxyDeployed = await OwnedUpgradeabilityProxy.deploy();

	await OwnedUpgradeabilityProxyDeployed.deployed();
	console.log('Owned proxy deployed on:', OwnedUpgradeabilityProxyDeployed.address);

	const PriceFeedDeployed = await PriceFeed.deploy();
	await PriceFeedDeployed.deployed();

	console.log('PriceFeed logic contract deployed on:', PriceFeedDeployed.address);
	setTargetAddress('PriceFeed', network, PriceFeedDeployed.address);

	let tx = await OwnedUpgradeabilityProxyDeployed.upgradeTo(PriceFeedDeployed.address);

	await tx.wait().then(e => {
		console.log('Proxy updated');
	});

	const ProxyPriceFeedDeployed = PriceFeed.attach(OwnedUpgradeabilityProxyDeployed.address);

	tx = await ProxyPriceFeedDeployed.initialize(owner.address);

	await tx.wait().then(e => {
		console.log('ProxyPriceFeed deployed on:', ProxyPriceFeedDeployed.address);
	});

	setTargetAddress('ProxyPriceFeed', network, ProxyPriceFeedDeployed.address);

	const aggregators = require(`./aggregators/${network}.json`);
	for (let [key, aggregator] of Object.entries(aggregators)) {
		let tx = await ProxyPriceFeedDeployed.addAggregator(toBytes32(key), aggregator);
		await tx.wait().then(e => {
			console.log('PriceFeed: addAggregator for', key);
		});
	}

	// verify logic contract 
	await hre.run('verify:verify', {
		address: PriceFeed.address,
		constructorArguments: [],
	});
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});

function delay(time) {
	return new Promise(function(resolve) {
		setTimeout(resolve, time);
	});
}
