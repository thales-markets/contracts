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
    console.log(networkObj)
	
	const net_optimistic_kovan = 'optimisticKovan';
	const net_kovan = networkObj.name;
			
		
	const ProxyThalesExchanger = await ethers.getContractFactory('ThalesExchanger');
	const ThalesAddress = getTargetAddress('Thales', net_kovan);
	const OpThalesL1Address = getTargetAddress('OpThales_L1', net_kovan);
	const OpThalesL2Address = getTargetAddress('OpThales_L2', net_optimistic_kovan);
	const L1StandardBridgeAddress = getTargetAddress('L1StandardBridge', net_kovan);

	console.log("Thales on Kovan at: ", ThalesAddress);
	console.log("OpThales on L1: ", OpThalesL1Address);
	console.log("OpThales on L2: ", OpThalesL2Address);
			
	console.log("L1 Bridge on Kovan at: ", L1StandardBridgeAddress);

	const ProxyThalesExchanger_deployed = await upgrades.deployProxy(ProxyThalesExchanger, 
		[
			owner.address, 
			ThalesAddress,
			OpThalesL1Address,
			L1StandardBridgeAddress,
			OpThalesL2Address
		]
	);
	await ProxyThalesExchanger_deployed.deployed;

	console.log("Proxy Thales Exchanger deployed:", ProxyThalesExchanger_deployed.address);
	const ProxyThalesExchangerImplementation = await getImplementationAddress(ethers.provider, ProxyThalesExchanger_deployed.address);
	
	console.log("Implementation ProxyThalesExchanger: ", ProxyThalesExchangerImplementation);
	setTargetAddress('ProxyThalesExchanger', net_kovan, ProxyThalesExchanger_deployed.address);
	setTargetAddress('ProxyThalesExchangerImplementation', net_kovan, ProxyThalesExchangerImplementation);


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
