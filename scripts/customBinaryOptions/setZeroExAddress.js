const { ethers } = require('hardhat');
const w3utils = require('web3-utils');
const snx = require('synthetix');
const { artifacts, contract, web3 } = require('hardhat');
const { getTargetAddress, setTargetAddress } = require('../helpers');

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

	const addressResolver = snx.getTarget({ network, contract: 'ReadProxyAddressResolver' });
	console.log('Found address resolver at:' + addressResolver.address);

	const safeDecimalMath = snx.getTarget({ network, contract: 'SafeDecimalMath' });
	console.log('Found safeDecimalMath at:' + safeDecimalMath.address);

	const priceFeedAddress = getTargetAddress('PriceFeed', network);
	console.log('Found PriceFeed at:' + priceFeedAddress);
	
	const ZeroExAddress = getTargetAddress('ZeroEx', network);
	console.log('Found 0x at:' + ZeroExAddress);
	
	const BinaryOptionMarketManagerAddress = getTargetAddress('BinaryOptionMarketManager', network);
	console.log('Found BinaryOptionMarketManager at:' + BinaryOptionMarketManagerAddress);


	const BinaryOptionMarketManager = await ethers.getContractFactory('BinaryOptionMarketManager', {
		libraries: {
			SafeDecimalMath: safeDecimalMath.address,
		},
	});
	
	const binaryOptionMarketManagerDeployed = await BinaryOptionMarketManager.attach(BinaryOptionMarketManagerAddress);
	


	let tx = await binaryOptionMarketManagerDeployed.setZeroExAddress(ZeroExAddress);

	await tx.wait().then(e => {
		console.log('BinaryOptionMarketFactory: setZeroExAddress');
	});
	
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});


function delay(time) {
	return new Promise(function (resolve) {
		setTimeout(resolve, time);
	});
}
