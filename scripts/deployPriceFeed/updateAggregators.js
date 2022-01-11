const { ethers } = require('hardhat');
const { toBytes32 } = require('synthetix-2.50.4-ovm');
const { getTargetAddress } = require('../helpers');

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

    const PriceFeed = await ethers.getContractFactory('PriceFeed');
	const priceFeedAddress = getTargetAddress('PriceFeed', network);
	console.log('Found PriceFeed at:', priceFeedAddress);

    const priceFeed = await PriceFeed.attach(
		priceFeedAddress
	);

    const aggregators = require(`./aggregators/${network}.json`);
	for (let [key, aggregator] of Object.entries(aggregators)) {
		let tx = await priceFeed.addAggregator(toBytes32(key), aggregator);
		await tx.wait().then(e => {
			console.log('PriceFeed update: addAggregator for', key);
		});
	}

}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});