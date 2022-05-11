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
	
    const ExoticRewardsContract = await ethers.getContractFactory('ExoticRewards');
	const ExoticRewardsAddress = getTargetAddress("ExoticRewards", network);
    const ExoticUSDContract = await ethers.getContractFactory('ExoticUSD');
	const ExoticUSDAddress = getTargetAddress("ExoticUSD", network);
	
    const ExoticUSDDeployed = await ExoticUSDContract.attach(ExoticUSDAddress);
	const ExoticRewardsDeployed = await ExoticRewardsContract.attach(ExoticRewardsAddress);

    await ExoticUSDDeployed.mintForUser(ExoticRewardsDeployed.address, {
        // from: owner.address,
        value: ethers.utils.parseEther("0"),
        gasLimit: "5000000"
    });
	console.log("Minted 100 eUSD to ExoticRewards");
   

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
