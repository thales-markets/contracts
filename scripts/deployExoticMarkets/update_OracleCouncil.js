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
	
    const OracleCouncilContract = await ethers.getContractFactory('ThalesOracleCouncil');
	const OracleCouncilAddress = getTargetAddress("ThalesOracleCouncil", network);
    
    await upgrades.upgradeProxy(OracleCouncilAddress, OracleCouncilContract);
    await delay(5000);

    console.log('OracleCouncil upgraded');
    
    const OracleCouncilImplementation = await getImplementationAddress(
		ethers.provider,
		OracleCouncilAddress
	);

	console.log('Implementation OracleCouncil: ', OracleCouncilImplementation);
	setTargetAddress('ThalesOracleCouncilImplementation', network, OracleCouncilImplementation);
	   

    try {
		await hre.run('verify:verify', {
			address: OracleCouncilImplementation,
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
