const { ethers } = require('hardhat');

const w3utils = require('web3-utils');

const { toBytes32 } = require('../../index');

const { getTargetAddress, setTargetAddress } = require('../helpers');

var ethers2 = require('ethers');
var crypto = require('crypto');

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

	const priceFeed = await ethers.getContractFactory('PriceFeed');
	let priceFeedAddress = getTargetAddress('PriceFeed', network);

	// Dev env - deploy Thales.sol; Live env - use Thales.sol contract address
	const ThalesRoyale = await ethers.getContractFactory('ThalesRoyale');
	const ThalesRoyaleDeployed = await ThalesRoyale.attach(
		'0xb15d3070B829C542c72356EEb7157364A77fEE63'
	);

	for (let i = 0; i < 1000; i++) {
		var id = crypto.randomBytes(32).toString('hex');
		var privateKey = '0x' + id;

		var wallet = new ethers2.Wallet(privateKey);
		let tx = await ThalesRoyaleDeployed.signUpOnBehalf(wallet.address, { from: owner.address });
		await tx.wait().then(e => {
			console.log('signed up : ' + wallet.address);
		});
	}

	// let tx = await ThalesRoyaleDeployed.signUp();
	// let alivePlayers = await ThalesRoyaleDeployed.getAlivePlayers();
	// console.log('Alive Players are: ' + alivePlayers);

	// const day = 1;
	// let tx = await ThalesRoyaleDeployed.setSignUpPeriod(day);
	// await tx.wait().then(e => {
	// 	console.log('ThalesRoyaleDeployed: setSignUpPeriod');
	// });
	//
	// let creationTime = await ThalesRoyaleDeployed.creationTime();
	// console.log('CreationTime' + creationTime);
	// let signUpPeriod = await ThalesRoyaleDeployed.signUpPeriod();
	// console.log('signUpPeriod' + signUpPeriod);
	//
	// tx = await ThalesRoyaleDeployed.startRoyale();
	// await tx.wait().then(e => {
	// 	console.log('ThalesRoyaleDeployed: startRoyale');
	// });
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});
