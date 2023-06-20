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

	const ParlayAMMLiquidityPoolData = await ethers.getContractFactory('ParlayAMMLiquidityPoolData');
	const ParlayAMMLiquidityPoolDataAddress = getTargetAddress('ParlayAMMLiquidityPoolData', network);

	let implementation;
	if (networkObj.chainId == 10 || networkObj.chainId == 42161) {
		implementation = await upgrades.prepareUpgrade(
			ParlayAMMLiquidityPoolDataAddress,
			ParlayAMMLiquidityPoolData
		);
	}

	// upgrade if test networks
	if (networkObj.chainId == 420) {
		await upgrades.upgradeProxy(ParlayAMMLiquidityPoolDataAddress, ParlayAMMLiquidityPoolData);

		implementation = await getImplementationAddress(
			ethers.provider,
			ParlayAMMLiquidityPoolDataAddress
		);
	}

	console.log('ParlayAMMLiquidityPoolData upgraded');

	console.log('ParlayAMMLiquidityPoolDataImplementation: ', implementation);
	setTargetAddress('ParlayAMMLiquidityPoolDataImplementation', network, implementation);

	await delay(5000);
	try {
		await hre.run('verify:verify', {
			address: implementation,
			contract:
				'contracts/SportMarkets/Parlay/ParlayLP/ParlayAMMLiquidityPoolData.sol:ParlayAMMLiquidityPoolData',
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
