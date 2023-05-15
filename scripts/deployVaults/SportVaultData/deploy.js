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

	const SportVaultData = await ethers.getContractFactory('SportVaultData');

	const SportVaultDataDeployed = await upgrades.deployProxy(SportVaultData, [owner.address]);
	await SportVaultDataDeployed.deployed();

	console.log('SportVaultData deployed on', SportVaultDataDeployed.address);
	setTargetAddress('SportVaultData', network, SportVaultDataDeployed.address);

	await delay(5000);
	const SportVaultDataImplementation = await getImplementationAddress(
		ethers.provider,
		SportVaultDataDeployed.address
	);

	console.log('Implementation SportVaultData: ', SportVaultDataImplementation);
	setTargetAddress('SportVaultDataImplementation', network, SportVaultDataImplementation);
	await delay(5000);

	try {
		await hre.run('verify:verify', {
			address: SportVaultDataImplementation,
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
