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
		networkObj.name = 'optimistic';
		network = 'optimistic';
	}
	
    const ExoticTagsContract = await ethers.getContractFactory('ExoticPositionalTags');
	const ExoticTagsAddress = getTargetAddress("ExoticPositionalTags", network);
	
	const ExoticTagsDeployed = await ExoticTagsContract.attach(ExoticTagsAddress);
	console.log("Adding tags to Exotic tags");


	let labels = ["Sport", "Crypto", "Politics", "Pop-culture", "Esports", "Football", "Basketball", "Bitcoin", "Ethereum"];
	let tagNumbers = ["1", "2", "3", "4", "5", "101", "102", "201", "202"]

	// Add tags
	for(let i=0;i < labels.length; i++) {
		tx = await ExoticTagsDeployed.addTag(labels[i], tagNumbers[i], {from:owner.address});
		await tx.wait().then(e => {
			console.log('New tag added ', labels[i], ' with number: ', tagNumbers[i]);
		});
		await delay(1000);
	}
	console.log("Tags added");
    
    

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
