const path = require('path');
const { ethers } = require('hardhat');


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
		networkObj.name = 'optimistic';
		network = 'optimistic';
	}
	

	
	const ExoticMarket = await ethers.getContractFactory('ExoticPositionalMarket');
	const ExoticMarketDeployed = await ExoticMarket.deploy();
    await ExoticMarketDeployed.deployed();
	console.log("ExoticMarket Deployed on", ExoticMarketDeployed.address);
	setTargetAddress('ExoticMarketMasterCopy', network, ExoticMarketDeployed.address);

    try {
		await hre.run('verify:verify', {
			address: ExoticMarketDeployed.address,
		});
	} catch (e) {
		console.log(e);
	}

    // await delay(5000);

    // await ExoticMarketDeployed.initializeWithTwoParameters(
    //     "Who will win the el clasico which will be played on 2022-02-22?",
    //     "2000",
    //     "50000",
    //     "300",
    //     "5",
    //     "[0,1]",
    //     "Real Madrid",
    //     "FC Barcelona",
    //     "It will be a draw"
    // );

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
