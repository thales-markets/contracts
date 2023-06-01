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

	const ParlayAMMLiquidityPoolData = await ethers.getContractFactory('ParlayAMMLiquidityPoolData');

	const ParlayAMMLiquidityPoolDataDeployed = await upgrades.deployProxy(ParlayAMMLiquidityPoolData, [
		owner.address,
	]);
	await ParlayAMMLiquidityPoolDataDeployed.deployed();

	console.log('ParlayAMMLiquidityPoolData deployed on', ParlayAMMLiquidityPoolDataDeployed.address);
	setTargetAddress('ParlayAMMLiquidityPoolData', network, ParlayAMMLiquidityPoolDataDeployed.address);

	await delay(5000);
	const ParlayAMMLiquidityPoolDataImplementation = await getImplementationAddress(
		ethers.provider,
		ParlayAMMLiquidityPoolDataDeployed.address
	);

	console.log(
		'Implementation ParlayAMMLiquidityPoolData: ',
		ParlayAMMLiquidityPoolDataImplementation
	);
	setTargetAddress(
		'ParlayAMMLiquidityPoolDataImplementation',
		network,
		ParlayAMMLiquidityPoolDataImplementation
	);
	await delay(5000);

	try {
		await hre.run('verify:verify', {
			address: ParlayAMMLiquidityPoolDataImplementation,
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
