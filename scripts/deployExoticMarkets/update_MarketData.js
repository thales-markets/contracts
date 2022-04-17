const path = require('path');
const { ethers, upgrades } = require('hardhat');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');


const { getTargetAddress, setTargetAddress } = require('../helpers');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	let mainnetNetwork = 'mainnet';

	if (network == 'homestead') {
		console.log("Error L1 network used! Deploy only on L2 Optimism. \nTry using \'--network optimistic\'")
		return 0;
	}
	if (networkObj.chainId == 42) {
		console.log("Error L1 network used! Deploy only on L2 Optimism. \nTry using \'--network optimisticKovan\'")
		return 0;
	}
	if (networkObj.chainId == 69) {
		networkObj.name = 'optimisticKovan';
		network = 'optimisticKovan';
		mainnetNetwork = 'kovan';
	}
	if (networkObj.chainId == 10) {
		networkObj.name = 'optimisticEthereum';
		network = 'optimisticEthereum';
	}
	
    const MarketDataContract = await ethers.getContractFactory('ExoticPositionalMarketData');
	const MarketDataAddress = getTargetAddress("ExoticPositionalMarketData", network);
    
    await upgrades.upgradeProxy(MarketDataAddress, MarketDataContract);
    await delay(5000);

    console.log('MarketDataAddress upgraded');
    
    const ExoticPositionalMarketDataImplementation = await getImplementationAddress(
		ethers.provider,
		MarketDataAddress
	);

	console.log('Implementation of MarketData: ', ExoticPositionalMarketDataImplementation);
	setTargetAddress('ExoticPositionalMarketDataImplementation', network, ExoticPositionalMarketDataImplementation);
	   

    try {
		await hre.run('verify:verify', {
			address: ExoticPositionalMarketDataImplementation,
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
	return new Promise(function(resolve) {
		setTimeout(resolve, time);
	});
}
