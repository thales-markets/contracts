const { ethers } = require('hardhat');
const { getTargetAddress, txLog } = require('../../helpers');
const w3utils = require('web3-utils');

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

	if (networkObj.chainId == 42161) {
		networkObj.name = 'arbitrumOne';
		network = 'arbitrumOne';
	}

	if (networkObj.chainId == 42161) {
		networkObj.name = 'arbitrumOne';
		network = 'arbitrumOne';
	}

	console.log('Account is: ' + owner.address);
	console.log('Network:' + network);
	console.log('Network id:' + networkObj.chainId);

	try {
		const MarchMadness = await ethers.getContractFactory('MarchMadness');
		const marchMadnessAddress = getTargetAddress('MarchMadness', network);
		console.log('Found MarchMadness at:', marchMadnessAddress);

		const marchMadness = MarchMadness.attach(marchMadnessAddress);

		const roundPoints = [1, 2, 4, 7, 10, 20];

		for (let i = 0; i < roundPoints.length; i++) {
			console.log(`Adding points to round ${i}`);
			const tx = await marchMadness.setPointsToRound(i, roundPoints[i], { from: owner.address });
			await tx.wait().then((e) => {
				txLog(tx, 'Tx log');
			});
			await delay(1500);
		}

		const gameIdsPerRound = [
			Array.from({ length: 32 }, (_, k) => k),
			Array.from({ length: 16 }, (_, k) => k + 32),
			Array.from({ length: 8 }, (_, k) => k + 48),
			Array.from({ length: 4 }, (_, k) => k + 56),
			[60, 61],
			[62],
		];

		for (let i = 0; i < gameIdsPerRound.length; i++) {
			console.log('Adding gameIds to round');
			console.log('Round -> ', i);
			console.log('GameIds -> ', gameIdsPerRound[i]);
			const tx = await marchMadness.assignGameIdsToRound(i, gameIdsPerRound[i], {
				from: owner.address,
			});
			await tx.wait().then((e) => {
				txLog(tx, 'Tx log');
			});
			await delay(1500);
		}

		console.log('Script has finished.');
	} catch (e) {
		console.log('e ', e);
	}
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
