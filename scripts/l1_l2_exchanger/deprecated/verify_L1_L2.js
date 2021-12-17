const path = require('path');
const { ethers } = require('hardhat');
const w3utils = require('web3-utils');
const snx = require('synthetix-2.50.4-ovm');
const { artifacts, contract, web3 } = require('hardhat');

const user_key = process.env.PRIVATE_KEY;

const {
	fastForward,
	toUnit,
	currentTime,
	multiplyDecimalRound,
	divideDecimalRound,
} = require('../../test/utils/index')();

const ZERO_ADDRESS = '0x' + '0'.repeat(40);

const L2_BRIDGE_ADDRESS = '0x4200000000000000000000000000000000000010';

const L1_BRIDGE_ADDRESS = '0x22F24361D548e5FaAfb36d1437839f080363982B';

const { getTargetAddress, setTargetAddress } = require('../helpers');

const L2StandardBridgeArtifacts = require('@eth-optimism/contracts/artifacts/contracts/optimistic-ethereum/OVM/bridge/tokens/OVM_L2StandardBridge.sol/OVM_L2StandardBridge');
const L1StandardBridgeArtifacts = require('@eth-optimism/contracts/artifacts/contracts/optimistic-ethereum/OVM/bridge/tokens/OVM_L1StandardBridge.sol/OVM_L1StandardBridge');
const { toBytes32 } = require('../../index');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	
	
	if(networkObj.chainId == '42') {
		console.log("network: ", networkObj.name, "\nchainID: ", networkObj.chainId);
		const net_kovan = 'kovan'
		const net_optimistic_kovan = 'optimisticKovan'

		const ThalesExchangerAddress = getTargetAddress('ThalesExchanger', net_kovan);
		const ThalesAddress = getTargetAddress('Thales', net_kovan);
		const OpThalesL1Address = getTargetAddress('OpThales_L1', net_kovan);
		const OpThalesL2Address = getTargetAddress('OpThales_L2', net_optimistic_kovan);
		

		// await hre.run('verify:verify', {
		// 	address: OpThalesL1Address,
		// 	constructorArguments: [],
		// });
		
		await hre.run('verify:verify', {
			address: ThalesExchangerAddress,
			constructorArguments: [
				owner.address, 
				ThalesAddress,
				OpThalesL1Address,
				L1_BRIDGE_ADDRESS,
				OpThalesL2Address
			],
		});
	}

	if(networkObj.chainId == '69') {
		console.log("network: ", networkObj.name, "\nchainID: ", networkObj.chainId);
		const net_kovan = 'kovan'
		const net_optimistic_kovan = 'optimisticKovan';
		const OpThalesL1Address = getTargetAddress('OpThales_L1', net_kovan);
		const OpThalesL2Address = getTargetAddress('OpThales_L2', net_optimistic_kovan);
		

		await hre.run('verify:verify', {
			address: OpThalesL2Address,
			constructorArguments: [
				L2_BRIDGE_ADDRESS,
				OpThalesL1Address,
				'Opt Thales L2',
				"OPTHALES_L2"
			],
		});
		
	}

	

	


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
