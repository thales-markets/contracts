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

	const ExchangeRatesV2 = await ethers.getContractFactory('ExchangeRatesV2', {
		libraries: {
			SafeDecimalMath: safeDecimalMath.address,
		},
	});
	const exchangeRatesV2 = await ExchangeRatesV2.deploy(owner.address);
	await exchangeRatesV2.deployed();

	console.log('ExchangeRates deployed to:', exchangeRatesV2.address);

    await exchangeRatesV2.addAggregator(toBytes32('JPY'), JPY_AGGREGATOR);
    //await exchangeRatesV2.addAggregator(toBytes32('EUR'), EUR_AGGREGATOR);
    //await exchangeRatesV2.addAggregator(toBytes32('LINK'), LINK_AGGREGATOR);

	await hre.run('verify:verify', {
		address: exchangeRatesV2.address,
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
