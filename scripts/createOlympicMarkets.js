const { ethers } = require('hardhat');
const w3utils = require('web3-utils');
const snx = require('synthetix');
const { artifacts, contract, web3 } = require('hardhat');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	if (network == 'homestead') {
		network = 'mainnet';
	}

	console.log('Account is:' + owner.address);
	console.log('Network name:' + networkObj.name);

	let IntegersContract = await ethers.getContractFactory('Integers');
	const integersDeployed = await IntegersContract.deploy();
	await integersDeployed.deployed();

	console.log('integersDeployed deployed to:', integersDeployed.address);

	let SportFeedContract = await ethers.getContractFactory('SportFeed');
	const sportFeedContractDeployed = await SportFeedContract.deploy(owner.address);
	await sportFeedContractDeployed.deployed();

	await sportFeedContractDeployed.setResult(
		'0x5b22555341222c2243484e222c22474252225d00000000000000000000000000',
		{
			from: owner.address,
		}
	);

	console.log('sportFeedContractDeployed deployed to:', sportFeedContractDeployed.address);

	let SportFeedOracleInstanceContract = await ethers.getContractFactory('SportFeedOracleInstance', {
		libraries: {
			Integers: integersDeployed.address,
		},
	});
	const sportFeedOracleInstanceContractDeployed = await SportFeedOracleInstanceContract.deploy(
		owner.address,
		sportFeedContractDeployed.address,
		'USA',
		'1',
		'Olympics Medal Count'
	);
	await sportFeedOracleInstanceContractDeployed.deployed();

	console.log(
		'sportFeedOracleInstanceContractDeployed deployed to:',
		sportFeedOracleInstanceContractDeployed.address
	);

	// const day = 24 * 60 * 60;
	// const maxOraclePriceAge = 120 * 60; // Price updates are accepted from up to two hours before maturity to allow for delayed chainlink heartbeats.
	// const expiryDuration = 26 * 7 * day; // Six months to exercise options before the market is destructible.
	// const maxTimeToMaturity = 730 * day; // Markets may not be deployed more than two years in the future.

	await hre.run('verify:verify', {
		address: integersDeployed.address,
	});

	await hre.run('verify:verify', {
		address: sportFeedContractDeployed.address,
		constructorArguments: [owner.address],
	});

	await hre.run('verify:verify', {
		address: sportFeedOracleInstanceContractDeployed.address,
		constructorArguments: [
			owner.address,
			sportFeedContractDeployed.address,
			'USA',
			'1',
			'Olympics Medal Count',
		],
	});
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});
