const { ethers } = require('hardhat');
const { getTargetAddress, txLog } = require('../../helpers');
const w3utils = require('web3-utils');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	let players = [];
	let ProxyERC20sUSDaddress;

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
	if (networkObj.chainId == 420) {
		networkObj.name = 'optimisticGoerli';
		network = 'optimisticGoerli';
	}

	if (networkObj.chainId == 80001) {
		networkObj.name = 'polygonMumbai';
		network = 'polygonMumbai';
	}

	if (networkObj.chainId == 137) {
		networkObj.name = 'polygon';
		network = 'polygon';
	}

	console.log('Account is: ' + owner.address);
	console.log('Network:' + network);
	console.log('Network id:' + networkObj.chainId);

	/* ========== PROPERTIES ========== */

	// CHANGE addresses
	invalidNames = [
		'2B',
		'2B 2B',
		'1A',
		'1A 1A',
		'2D',
		'2D 2D',
		'1C',
		'1C 1C',
		'2C',
		'2C 2C',
		'1D',
		'1D 1D',
		'2A',
		'2A 2A',
		'1B',
		'1B 1B',
		'2F',
		'2F 2F',
		'1E',
		'1E 1E',
		'2H',
		'2H 2H',
		'1G',
		'1G 1G',
		'2E',
		'2E 2E',
		'1F',
		'1F 1F',
		'2G',
		'2G 2G',
		'1H',
		'1H 1H',
		'Round of 16 6 winner',
		'Round of 16 6 winner Round of 16 6 winner',
		'Round of 16 5 winner',
		'Round of 16 5 winner Round of 16 5 winner',
		'Round of 16 2 winner',
		'Round of 16 2 winner Round of 16 2 winner',
		'Round of 16 1 winner',
		'Round of 16 1 winner Round of 16 1 winner',
		'Round of 16 8 winner',
		'Round of 16 8 winner Round of 16 8 winner',
		'Round of 16 7 winner',
		'Round of 16 7 winner Round of 16 7 winner',
		'Round of 16 4 winner',
		'Round of 16 4 winner Round of 16 4 winner',
		'Round of 16 3 winner',
		'Round of 16 3 winner Round of 16 3 winner',
		'Quarterfinal 2 Winner',
		'Quarterfinal 2 Winner Quarterfinal 2 Winner',
		'Quarterfinal 1 Winner',
		'Quarterfinal 1 Winner Quarterfinal 1 Winner',
		'Quarterfinal 4 Winner',
		'Quarterfinal 4 Winner Quarterfinal 4 Winner',
		'Quarterfinal 3 Winner',
		'Quarterfinal 3 Winner Quarterfinal 3 Winner',
		'semifinal 2 loser',
		'semifinal 2 loser semifinal 2 loser',
		'semifinal 1 loser',
		'semifinal 1 loser semifinal 1 loser',
		'semifinal 2 winner',
		'semifinal 2 winner semifinal 2 winner',
		'semifinal 1 winner',
		'semifinal 1 winner semifinal 1 winner',
	];

	/* ========== MINT ROYALE PASSES ========== */

	const TherundownConsumerVerifier = await ethers.getContractFactory('TherundownConsumerVerifier');
	const therundownConsumerVerifierAddress = getTargetAddress('TherundownConsumerVerifier', network);
	console.log('Found TherundownConsumerVerifier at:', therundownConsumerVerifierAddress);

	const verifier = await TherundownConsumerVerifier.attach(therundownConsumerVerifierAddress);

	console.log('No. invalid names: ' + invalidNames.length);

	// populate
	console.log('Start populate!');

	let invalidNamesBatch = [];
	for (let i = 0; i < invalidNames.length; i++) {
		console.log('Adding invalid name: ' + invalidNames[i], ', which is ' + i);
		invalidNamesBatch.push(invalidNames[i]);

		//console.log('Value on contract...');
		//console.log(await verifier.isInvalidNames(invalidNames[i], { from: owner.address }));

		if (
			(invalidNamesBatch.length > 0 && invalidNamesBatch.length % 10 == 0) ||
			invalidNames.length - 1 == i
		) {
			try {
				console.log('Populate...');

				let tx = await verifier.setInvalidNames(invalidNamesBatch, true, { from: owner.address });
				await tx.wait().then((e) => {
					txLog(tx, 'Added: ' + invalidNamesBatch);
				});
				console.log('Added!');
				console.log(invalidNamesBatch);
				invalidNamesBatch = [];
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
