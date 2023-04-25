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

	const SportAMMLiquidityPoolData = await ethers.getContractFactory('SportAMMLiquidityPoolData');

	const SportAMMLiquidityPoolDataDeployed = await upgrades.deployProxy(SportAMMLiquidityPoolData, [
		owner.address,
	]);
	await SportAMMLiquidityPoolDataDeployed.deployed;

	console.log('SportAMMLiquidityPoolData deployed on', SportAMMLiquidityPoolDataDeployed.address);
	setTargetAddress('SportAMMLiquidityPoolData', network, SportAMMLiquidityPoolDataDeployed.address);

	await delay(5000);
	const SportAMMLiquidityPoolDataImplementation = await getImplementationAddress(
		ethers.provider,
		SportAMMLiquidityPoolDataDeployed.address
	);

	console.log(
		'Implementation SportAMMLiquidityPoolData: ',
		SportAMMLiquidityPoolDataImplementation
	);
	setTargetAddress(
		'SportAMMLiquidityPoolDataImplementation',
		network,
		SportAMMLiquidityPoolDataImplementation
	);
	await delay(5000);

	try {
		await hre.run('verify:verify', {
			address: SportAMMLiquidityPoolDataImplementation,
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
