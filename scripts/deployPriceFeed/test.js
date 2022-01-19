const { ethers } = require('hardhat');
const w3utils = require('web3-utils');
const snx = require('synthetix-2.50.4-ovm');

const {
	fastForward,
	toUnit,
	currentTime,
	multiplyDecimalRound,
	divideDecimalRound,
} = require('../../test/utils')();

const { toBN } = web3.utils;

const ZERO_ADDRESS = '0x' + '0'.repeat(40);

const { toBytes32 } = require('../../index');
const { getTargetAddress, setTargetAddress } = require('../helpers');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;

	console.log('Account is:' + owner.address);
	console.log('Network name:' + networkObj.name);


	const PriceFeed = await ethers.getContractFactory('PriceFeed');

	const priceFeedAddress = getTargetAddress('PriceFeed', network);
	const priceFeedDeployed = await PriceFeed.attach(
		priceFeedAddress
	);

	console.log(
		'PriceFeed deployed to:',
		priceFeedDeployed.address
	);

    // RAI 0x76b06a2f6df6f0514e7bec52a9afb3f603b477cd
    let tx = await priceFeedDeployed.addPool(toBytes32('RAI'), '0x76b06a2f6df6f0514e7bec52a9afb3f603b477cd');
    await tx.wait().then(e => {
		console.log('PriceFeed: addPool for RAI');
	});

	let price = await priceFeedDeployed.rateForCurrency(toBytes32('RAI'));
	console.log(price);
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});
