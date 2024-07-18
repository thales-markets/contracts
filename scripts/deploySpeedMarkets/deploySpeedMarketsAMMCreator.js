const { ethers, upgrades } = require('hardhat');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');
const { getTargetAddress, setTargetAddress } = require('../helpers');

async function main() {
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;

	let proxySUSD;

	if (network === 'unknown') {
		network = 'localhost';
	}

	if (network == 'homestead') {
		network = 'mainnet';
	}

	if (networkObj.chainId == 10) {
		networkObj.name = 'optimisticEthereum';
		network = 'optimisticEthereum';
		proxySUSD = getTargetAddress('ProxysUSD', network);
	}

	if (networkObj.chainId == 420) {
		networkObj.name = 'optimisticGoerli';
		network = 'optimisticGoerli';
		proxySUSD = getTargetAddress('ExoticUSD', network);
	}

	if (networkObj.chainId == 42161) {
		networkObj.name = 'arbitrumOne';
		network = 'arbitrumOne';
		proxySUSD = getTargetAddress('ProxyUSDC', network);
	}

	if (networkObj.chainId == 8453) {
		networkObj.name = 'baseMainnet';
		network = 'baseMainnet';
		proxySUSD = getTargetAddress('ProxyUSDC', network);
	}

	if (networkObj.chainId == 56) {
		networkObj.name = 'bsc';
		network = 'bsc';
		proxySUSD = getTargetAddress('BUSD', network);
	}

	if (networkObj.chainId == 137) {
		networkObj.name = 'polygon';
		network = 'polygon';
		proxySUSD = getTargetAddress('ProxyUSDC', network);
	}

	if (networkObj.chainId == 168587773) {
		networkObj.name = 'blastSepolia';
		network = 'blastSepolia';
		proxySUSD = getTargetAddress('ExoticUSD', network);
	}

	if (networkObj.chainId == 11155420) {
		networkObj.name = 'optimisticSepolia';
		network = 'optimisticSepolia';
		proxySUSD = getTargetAddress('ExoticUSD', network);
	}

	let accounts = await ethers.getSigners();
	let owner = accounts[0];

	console.log('Owner is: ' + owner.address);
	console.log('Network:' + network);
	console.log('Network id:' + networkObj.chainId);

	const SpeedMarketsAMMCreator = await ethers.getContractFactory('SpeedMarketsAMMCreator');
	let SpeedMarketsAMMCreatorDeployed = await upgrades.deployProxy(SpeedMarketsAMMCreator, [
		owner.address,
		proxySUSD,
	]);
	await SpeedMarketsAMMCreatorDeployed.deployed();

	console.log('SpeedMarketsAMMCreator proxy:', SpeedMarketsAMMCreatorDeployed.address);

	const SpeedMarketsAMMCreatorImplementation = await getImplementationAddress(
		ethers.provider,
		SpeedMarketsAMMCreatorDeployed.address
	);

	console.log('Implementation SpeedMarketsAMMCreator: ', SpeedMarketsAMMCreatorImplementation);

	setTargetAddress('SpeedMarketsAMMCreator', network, SpeedMarketsAMMCreatorDeployed.address);
	setTargetAddress(
		'SpeedMarketsAMMCreatorImplementation',
		network,
		SpeedMarketsAMMCreatorImplementation
	);

	await delay(5000);

	try {
		await hre.run('verify:verify', {
			address: SpeedMarketsAMMCreatorImplementation,
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
