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

	const AmmVaultData = await ethers.getContractFactory('AmmVaultData');

	const AmmVaultDataDeployed = await upgrades.deployProxy(AmmVaultData, [owner.address]);
	await AmmVaultDataDeployed.deployed;

	console.log('AmmVaultData deployed on', AmmVaultDataDeployed.address);
	setTargetAddress('AmmVaultData', network, AmmVaultDataDeployed.address);

	await delay(5000);
	const AmmVaultDataImplementation = await getImplementationAddress(
		ethers.provider,
		AmmVaultDataDeployed.address
	);

	console.log('Implementation AmmVaultData: ', AmmVaultDataImplementation);
	setTargetAddress('AmmVaultDataImplementation', network, AmmVaultDataImplementation);
	await delay(5000);

	try {
		await hre.run('verify:verify', {
			address: AmmVaultDataImplementation,
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
