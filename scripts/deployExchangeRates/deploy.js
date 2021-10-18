const { ethers } = require('hardhat');
const { toBytes32 } = require('../../index');
const snx = require('synthetix');

const JPY_AGGREGATOR = '0xD627B1eF3AC23F1d3e576FA6206126F3c1Bd0942'; // kovan
const EUR_AGGREGATOR = '0x0c15Ab9A0DB086e062194c273CC79f41597Bbf13'; // kovan
const LINK_AGGREGATOR = '0x396c5E36DD0a0F5a5D33dae44368D4193f69a1F0'; // kovan

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

	console.log('Account is: ' + owner.address);
	console.log('Network:' + network);

	const addressResolver = snx.getTarget({ network, contract: 'ReadProxyAddressResolver' });
	console.log('Found address resolver at:' + addressResolver.address);

	const safeDecimalMath = snx.getTarget({ network, contract: 'SafeDecimalMath' });
	console.log('Found safeDecimalMath at:' + safeDecimalMath.address);

	const PriceFeed = await ethers.getContractFactory('PriceFeed');
	const priceFeed = await PriceFeed.deploy(owner.address);
	await priceFeed.deployed();

	console.log('PriceFeed deployed to:', priceFeed.address);

    await priceFeed.addAggregator(toBytes32('JPY'), JPY_AGGREGATOR);
    //await priceFeed.addAggregator(toBytes32('EUR'), EUR_AGGREGATOR);
    //await priceFeed.addAggregator(toBytes32('LINK'), LINK_AGGREGATOR);

	await hre.run('verify:verify', {
		address: priceFeed.address,
        constructorArguments: [
			owner.address,
        ],
	});
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});
