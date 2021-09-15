const { ethers } = require('hardhat');

const BTC_TOTAL_MARKETCAP = '0x47E1e89570689c13E723819bf633548d611D630C'; // mainnet
const ETH_TOTAL_MARKETCAP = '0xAA2FE1324b84981832AafCf7Dc6E6Fe6cF124283'; // mainnet

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

	const BTCPriceFeed = await ethers.getContractFactory('PriceFeedInstance');
	const BTCPriceFeedDeployed = await BTCPriceFeed.deploy(
		owner.address,
		BTC_TOTAL_MARKETCAP,
		'BTC Marketcap'
	);

	await BTCPriceFeedDeployed.deployed();

	console.log('BTC PriceFeed deployed to: ', BTCPriceFeedDeployed.address);

	const ETHPriceFeed = await ethers.getContractFactory('PriceFeedInstance');
	const ETHPriceFeedDeployed = await ETHPriceFeed.deploy(
		owner.address,
		ETH_TOTAL_MARKETCAP,
		'ETH Marketcap'
	);

	await ETHPriceFeedDeployed.deployed();

	console.log('ETH PriceFeed deployed to: ', ETHPriceFeedDeployed.address);

	await hre.run('verify:verify', {
		address: BTCPriceFeedDeployed.address,
		constructorArguments: [owner.address, BTC_TOTAL_MARKETCAP, 'BTC Marketcap'],
	});

	await hre.run('verify:verify', {
		address: ETHPriceFeedDeployed.address,
		constructorArguments: [owner.address, ETH_TOTAL_MARKETCAP, 'ETH Marketcap'],
	});
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});
