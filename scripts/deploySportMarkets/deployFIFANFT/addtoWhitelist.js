const { ethers } = require('hardhat');
const { getTargetAddress, txLog } = require('../../helpers');
const w3utils = require('web3-utils');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	let users = [];
	let OvertimeWorldCupZebro;
	let zebroAddress;

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
		networkObj.name = 'optimisticEthereum';
		network = 'optimisticEthereum';
	}
	if (networkObj.chainId == 80001) {
		networkObj.name = 'polygonMumbai';
		network = 'polygonMumbai';
	}

	if (networkObj.chainId == 137) {
		networkObj.name = 'polygon';
		network = 'polygon';
	}

	if (networkObj.chainId == 420) {
		networkObj.name = 'optimisticGoerli';
		network = 'optimisticGoerli';
	}

	if (networkObj.chainId == 5) {
		networkObj.name = 'goerli';
		network = 'goerli';
	}

	console.log('Account is: ' + owner.address);
	console.log('Network:' + network);
	console.log('Network id:' + networkObj.chainId);

	/* ========== PROPERTIES ========== */

	// CHANGE addresses
	users = [
		'0xE21B80181304e3641424cdFb8376E73574ab4794',
		'0xe966C59c15566A994391F6226fee5bc0eF70F87A',
	];

	/* ========== MINT ROYALE PASSES ========== */

	OvertimeWorldCupZebro = await ethers.getContractFactory('OvertimeWorldCupZebro');
	zebroAddress = getTargetAddress('OvertimeWorldCupZebro', network);
	console.log('Found OvertimeWorldCupZebro at:', zebroAddress);

	const fifa = await OvertimeWorldCupZebro.attach(zebroAddress);

	console.log('No. users: ' + users.length);

	console.log('Start whitelist!');

	let usersBatch = [];
	for (let i = 0; i < users.length; i++) {
		console.log('Adding whitelist: ' + users[i], ', which is ' + i);
		usersBatch.push(users[i]);
		if ((usersBatch.length > 0 && usersBatch.length % 10 == 0) || users.length - 1 == i) {
			try {
				console.log('Populate...');

				let tx = await fifa.setWhitelistedAddresses(usersBatch, true, {
					from: owner.address,
				});
				await tx.wait().then((e) => {
					txLog(tx, 'Added: ' + usersBatch);
				});
				console.log('Added!');
				console.log(usersBatch);
				usersBatch = [];
				await delay(5000);
			} catch (e) {
				console.log('Retry!');
				await delay(5000);
			}
		}
	}

	console.log('Ended!');
}

function delay(time) {
	return new Promise(function (resolve) {
		setTimeout(resolve, time);
	});
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
