const { ethers, upgrades } = require('hardhat');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');

const { getTargetAddress, setTargetAddress } = require('../../helpers');

async function main() {
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
	const ThalesAMMLiquidityPoolDataAddress = getTargetAddress('ThalesAMMLiquidityPoolData', network);

	let implementation;
	if (networkObj.chainId == 10 || networkObj.chainId == 42161) {
		implementation = await upgrades.prepareUpgrade(
			ThalesAMMLiquidityPoolDataAddress,
			ThalesAMMLiquidityPoolData
		);
	}

	// upgrade if test networks
	if (networkObj.chainId == 420) {
		await upgrades.upgradeProxy(ThalesAMMLiquidityPoolDataAddress, ThalesAMMLiquidityPoolData);

		implementation = await getImplementationAddress(
			ethers.provider,
			ThalesAMMLiquidityPoolDataAddress
		);
	}

	console.log('ThalesAMMLiquidityPoolData upgraded');

	console.log('ThalesAMMLiquidityPoolDataImplementation: ', implementation);
	setTargetAddress('ThalesAMMLiquidityPoolDataImplementation', network, implementation);

	await delay(5000);
	try {
		await hre.run('verify:verify', {
			address: implementation,
			contract:
				'contracts/AMM/LiquidityPool/ThalesAMMLiquidityPoolData.sol:ThalesAMMLiquidityPoolData',
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
