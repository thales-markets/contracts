const { ethers, upgrades } = require('hardhat');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');

const { getTargetAddress, setTargetAddress } = require('../../helpers');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	console.log("networkObj:", networkObj );
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

	const StakingData = await ethers.getContractFactory('StakingData');
	const StakingDataAddress = getTargetAddress('StakingData', network);

	let implementation;
	if (networkObj.chainId == 10 || networkObj.chainId == 42161) {
		implementation = await upgrades.prepareUpgrade(StakingDataAddress, StakingData);
	}

	// upgrade if test networks
	if (networkObj.chainId == 420) {
		await upgrades.upgradeProxy(StakingDataAddress, StakingData);

		implementation = await getImplementationAddress(ethers.provider, StakingDataAddress);
	}

	console.log('StakingData upgraded');

	console.log('StakingDataImplementation: ', implementation);
	setTargetAddress('StakingDataImplementation', network, implementation);

	await delay(5000);
	try {
		await hre.run('verify:verify', {
			address: implementation,
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
