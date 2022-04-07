const path = require('path');
const { ethers, upgrades } = require('hardhat');
const w3utils = require('web3-utils');
const { artifacts, contract, web3 } = require('hardhat');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');

const { getTargetAddress, setTargetAddress, encodeCall } = require('../helpers');


const {
	fastForward,
	toUnit,
	currentTime,
	multiplyDecimalRound,
	divideDecimalRound,
} = require('../../test/utils/index')();


async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
    let network = networkObj.name;
	let net_optimistic = '';
	
	if (network == 'homestead') {
		network = 'mainnet';
		net_optimistic = 'optimisticEthereum';
	}
	if (networkObj.chainId == 42) {
		network = 'kovan';
		net_optimistic = 'optimisticKovan';
	}
	if (networkObj.chainId == 69) {
		console.log("Error L2 network used! Deploy only on L1 Mainnet. \nTry using \'--network mainnet\'");
		return 0;
	}
	if (networkObj.chainId == 10) {
		console.log("Error L2 network used! Deploy only on L1 Mainnet. \nTry using \'--network mainnet\'");
		return 0;
	}
	
			
	const ProxyThalesExchangerImplementation = getTargetAddress('ProxyThalesExchangerImplementation', network);
	console.log("Implementation ProxyThalesExchanger: ", ProxyThalesExchangerImplementation);
	
	const ProxyThalesExchanger = getTargetAddress('ProxyThalesExchanger', network);
	console.log(" ProxyThalesExchanger: ", ProxyThalesExchanger);
	
	const ProxyThalesExchangerImplementation_2 = await getImplementationAddress(ethers.provider, ProxyThalesExchanger);
	console.log("Implementation ProxyThalesExchanger: ", ProxyThalesExchangerImplementation_2);
	

	// try {
	// 	await hre.run('verify:verify', {
	// 		address: ProxyThalesExchangerImplementation,
	// 	});
	// } catch (e) {
	// 	console.log(e);
	// }
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});

