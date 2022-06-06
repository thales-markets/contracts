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
		networkObj.name = 'kovan';
		network = 'kovan';
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
	
    const ExoticTagsContract = await ethers.getContractFactory('ExoticPositionalTags');
	const ExoticTagsAddress = getTargetAddress("ExoticPositionalTags", network);
	
	const ExoticTagsDeployed = await ExoticTagsContract.attach(ExoticTagsAddress);
	console.log("Adding tags to Exotic tags");


	let labels = [
		"Sport",
		"Crypto",
		"Political-Elections",
		"Pop-culture",
		"Esports",
		"Macro-Economics",
		"Finance",
		"Web3"
	];
	// "NCAA Men's Football", "NFL", "MLB", "NBA", "NCAA Men's Basketball", "NHL", "WNBA", "MLS",
	// "EPL", "Ligue 1", "Bundesliga", "La Liga", "Serie A", "UEFA Champions League"
	
	let tagNumbers = [
						"1", "2", "3", "4", "5", "7", "6", "8"
					]
	// "9001", "9002", "9003", "9004", "9005", "9006", "9008", "9010",
	// "9011", "9012", "9013", "9014", "9015", "9016"
	let checkTag;
	// Add tags
	for(let i=0;i < labels.length; i++) {
		checkTag = await ExoticTagsDeployed.isValidTagNumber(tagNumbers[i]);
		if(!checkTag) {
			tx = await ExoticTagsDeployed.addTag(labels[i], tagNumbers[i], {from:owner.address});
			await tx.wait().then(e => {
				console.log('New tag added ', labels[i], ' with number: ', tagNumbers[i]);
			});
			await delay(1000);
		}
		else {
			console.log("Tag already added")
		}
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
