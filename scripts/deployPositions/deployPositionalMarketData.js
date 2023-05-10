const path = require('path');
const { ethers, upgrades } = require('hardhat');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');

const { getTargetAddress, setTargetAddress } = require('../helpers');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;

	if (network == 'homestead') {
		console.log(
			"Error L1 network used! Deploy only on L2 Optimism. \nTry using '--network optimistic'"
		);
		return 0;
	}
	if (networkObj.chainId == 420) {
		networkObj.name = 'optimisticGoerli';
		network = 'optimisticGoerli';
	}
	if (networkObj.chainId == 10) {
		networkObj.name = 'optimisticEthereum';
		network = 'optimisticEthereum';
	}
	if (networkObj.chainId == 137) {
		networkObj.name = 'polygon';
		network = 'polygon';
	}
	if (networkObj.chainId == 56) {
		networkObj.name = 'bsc';
		network = 'bsc';
	}
	if (networkObj.chainId == 42161) {
		networkObj.name = 'arbitrumOne';
		network = 'arbitrumOne';
	}

	const MarketData = await ethers.getContractFactory('PositionalMarketData');
	const MarketManagerAddress = getTargetAddress('PositionalMarketManager', network);
	const ThalesAMMAddress = getTargetAddress('ThalesAMM', network);
	const RangedAMMAddress = getTargetAddress('RangedAMM', network);

	const MarketDataDeployed = await upgrades.deployProxy(MarketData, [owner.address]);
	await MarketDataDeployed.deployed();

	console.log('PositionalMarketData deployed on', MarketDataDeployed.address);
	setTargetAddress('PositionalMarketData', network, MarketDataDeployed.address);

	await delay(5000);
	const MarketDataImplementation = await getImplementationAddress(
		ethers.provider,
		MarketDataDeployed.address
	);

	console.log('Implementation PositionalMarketData: ', MarketDataImplementation);
	setTargetAddress('PositionalMarketDataImplementation', network, MarketDataImplementation);

	await delay(5000);
	await MarketDataDeployed.setPositionalMarketManager(MarketManagerAddress, {
		from: owner.address,
	});
	await delay(5000);
	await MarketDataDeployed.setThalesAMM(ThalesAMMAddress, { from: owner.address });
	await delay(5000);
	await MarketDataDeployed.setRangedMarketsAMM(RangedAMMAddress, { from: owner.address });
	await delay(5000);

	try {
		await hre.run('verify:verify', {
			address: MarketDataImplementation,
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
