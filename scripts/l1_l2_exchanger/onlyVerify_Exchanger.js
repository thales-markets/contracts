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
	// if (networkObj.chainId == 69) {
	// 	console.log("Error L2 network used! Deploy only on L1 Mainnet. \nTry using \'--network mainnet\'");
	// 	return 0;
	// }
	// if (networkObj.chainId == 10) {
	// 	console.log("Error L2 network used! Deploy only on L1 Mainnet. \nTry using \'--network mainnet\'");
	// 	return 0;
	// }


	// const ProxyThalesExchanger_deployed = getTargetAddress('ProxyThalesExchanger', network);
	// const ProxyThalesExchangerImplementation = await getImplementationAddress(ethers.provider, ProxyThalesExchanger_deployed);

	// console.log("Implementation ProxyThalesExchanger: ", ProxyThalesExchangerImplementation);
	// setTargetAddress('ProxyThalesExchangerImplementation', network, ProxyThalesExchangerImplementation);

	try {
		await hre.run('verify:verify', {
			address: '0xab411282DBA1cC152688AeC9a2325605F6D6d581',
			constructorArguments: ['0xE1757E47417e4bFF5f3F01713A205E1709344D5D']
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

