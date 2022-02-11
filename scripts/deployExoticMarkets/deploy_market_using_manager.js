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
	

	ExoticMarketAddress = getTargetAddress('ExoticMarketMasterCopy', network);
	
	const ExoticMarketManager = await ethers.getContractFactory('ExoticPositionalMarketManager');
	const ExoticMarketManagerAddress = getTargetAddress('ExoticMarketManager', network);
    let ExoticMarketManagerDeployed = await ExoticMarketManager.attach(ExoticMarketManagerAddress);
	console.log("ExoticMarketManager on", ExoticMarketManagerDeployed.address);
    
    // console.log(ExoticMarketManager);

    // let tx = await ExoticMarketManagerDeployed.createExoticMarket();
    // console.log(tx)
    let tx = await ExoticMarketManagerDeployed.createExoticMarketThree(
        "Who will win the el clasico which will be played on 2022-02-22?",
        "0",
        "0",
        "300",
        "5",
        [0,1],
        ExoticMarketAddress,
        "Real Madrid",
        "FC Barcelona",
        "It will be a draw",
        {gasLimit: 5000000});
    
    await tx.wait().then(e => {
        console.log("Market created")
    });

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
