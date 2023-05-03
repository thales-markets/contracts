const { ethers, upgrades } = require('hardhat');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');

const { setTargetAddress } = require('../../helpers');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;

	if (networkObj.chainId == 420) {
		networkObj.name = 'optimisticGoerli';
		network = 'optimisticGoerli';
	}
	if (networkObj.chainId == 10) {
		networkObj.name = 'optimisticEthereum';
		network = 'optimisticEthereum';
	}
	if (networkObj.chainId == 42161) {
		networkObj.name = 'arbitrumOne';
		network = 'arbitrumOne';
	}

	const ThalesAMMLiquidityPoolData = await ethers.getContractFactory('ThalesAMMLiquidityPoolData');

	const ThalesAMMLiquidityPoolDataDeployed = await upgrades.deployProxy(
		ThalesAMMLiquidityPoolData,
		[owner.address]
	);
	await ThalesAMMLiquidityPoolDataDeployed.deployed;

	console.log('ThalesAMMLiquidityPoolData deployed on', ThalesAMMLiquidityPoolDataDeployed.address);
	setTargetAddress(
		'ThalesAMMLiquidityPoolData',
		network,
		ThalesAMMLiquidityPoolDataDeployed.address
	);

	await delay(5000);
	const ThalesAMMLiquidityPoolDataImplementation = await getImplementationAddress(
		ethers.provider,
		ThalesAMMLiquidityPoolDataDeployed.address
	);

	console.log(
		'Implementation ThalesAMMLiquidityPoolData: ',
		ThalesAMMLiquidityPoolDataImplementation
	);
	setTargetAddress(
		'ThalesAMMLiquidityPoolDataImplementation',
		network,
		ThalesAMMLiquidityPoolDataImplementation
	);
	await delay(5000);

	try {
		await hre.run('verify:verify', {
			address: ThalesAMMLiquidityPoolDataImplementation,
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
