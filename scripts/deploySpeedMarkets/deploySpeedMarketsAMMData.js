const { ethers, upgrades } = require('hardhat');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');

const { getTargetAddress, setTargetAddress } = require('../helpers');

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

	let accounts = await ethers.getSigners();
	let owner = accounts[0];

	console.log('Owner is: ' + owner.address);
	console.log('Network:' + network);
	console.log('Network id:' + networkObj.chainId);

	const SpeedMarketsAMMData = await ethers.getContractFactory('SpeedMarketsAMMData');
	const SpeedAMMAddress = getTargetAddress('SpeedMarketsAMM', network);
	console.log('SpeedMarketsAMM found at: ', SpeedAMMAddress);

	await delay(2000);
	const SpeedMarketsAMMDataDeployed = await upgrades.deployProxy(SpeedMarketsAMMData, [
		owner.address,
		SpeedAMMAddress,
	]);
	await delay(2000);
	await SpeedMarketsAMMDataDeployed.deployed();

	console.log('SpeedMarketsAMMData Deployed on', SpeedMarketsAMMDataDeployed.address);
	setTargetAddress('SpeedMarketsAMMData', network, SpeedMarketsAMMDataDeployed.address);

	await delay(65000);
	const SpeedMarketsAMMDataImplementation = await getImplementationAddress(
		ethers.provider,
		SpeedMarketsAMMDataDeployed.address
	);

	console.log('Implementation SpeedMarketsAMMData: ', SpeedMarketsAMMDataImplementation);
	setTargetAddress('SpeedMarketsAMMDataImplementation', network, SpeedMarketsAMMDataImplementation);

	await delay(5000);

	try {
		await hre.run('verify:verify', {
			address: SpeedMarketsAMMDataImplementation,
		});
	} catch (e) {
		console.log(e);
	}
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});

function delay(time) {
	return new Promise(function (resolve) {
		setTimeout(resolve, time);
	});
}
