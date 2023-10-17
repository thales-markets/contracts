const { ethers } = require('hardhat');
const { setTargetAddress, getTargetAddress } = require('../helpers');

async function main() {
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;

	if (network === 'unknown') {
		network = 'localhost';
	}

	if (network == 'homestead') {
		network = 'mainnet';
	}

	if (networkObj.chainId == 10) {
		networkObj.name = 'optimisticEthereum';
		network = 'optimisticEthereum';
	}

	if (networkObj.chainId == 420) {
		networkObj.name = 'optimisticGoerli';
		network = 'optimisticGoerli';
	}

	if (networkObj.chainId == 42161) {
		networkObj.name = 'arbitrumOne';
		network = 'arbitrumOne';
	}

	if (networkObj.chainId == 8453) {
		networkObj.name = 'baseMainnet';
		network = 'baseMainnet';
	}

	if (networkObj.chainId == 56) {
		networkObj.name = 'bsc';
		network = 'bsc';
	}

	if (networkObj.chainId == 137) {
		networkObj.name = 'polygon';
		network = 'polygon';
	}

	console.log('Network:' + network);
	console.log('Network id:' + networkObj.chainId);

	const SpeedMarketsAMMUtils = await ethers.getContractFactory('SpeedMarketsAMMUtils');
	const SpeedMarketsAMMUtilsDeployed = await SpeedMarketsAMMUtils.deploy();
	await SpeedMarketsAMMUtilsDeployed.deployed();

	setTargetAddress('SpeedMarketsAMMUtils', network, SpeedMarketsAMMUtilsDeployed.address);

	await delay(5000);

	try {
		await hre.run('verify:verify', {
			address: SpeedMarketsAMMUtilsDeployed.address,
		});
	} catch (e) {
		console.log(e);
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
