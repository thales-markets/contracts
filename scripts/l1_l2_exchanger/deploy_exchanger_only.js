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

const { getTargetAddress, setTargetAddress } = require('../helpers');

const L2StandardBridgeArtifacts = require('@eth-optimism/contracts/artifacts/contracts/optimistic-ethereum/OVM/bridge/tokens/OVM_L2StandardBridge.sol/OVM_L2StandardBridge');
const L1StandardBridgeArtifacts = require('@eth-optimism/contracts/artifacts/contracts/optimistic-ethereum/OVM/bridge/tokens/OVM_L1StandardBridge.sol/OVM_L1StandardBridge');
const { toBytes32 } = require('../../index');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	// let networkObj = await ethers.provider.getNetwork();
	
	let network_kovan = new ethers.providers.InfuraProvider("kovan");
	// console.log(network_kovan);
	const net_kovan = 'kovan'
	let network_optimistic_kovan = await ethers.provider.getNetwork();
	const net_optimistic_kovan = 'optimisticKovan'
	// console.log(network_optimistic_kovan);
	
	// const l2StandardBridgeArtifact = require(`../node_modules/@eth-optimism/contracts/artifacts/contracts/L2/messaging/L2StandardBridge.sol/L2StandardBridge.json`)
	
	
	const l1Wallet = new ethers.Wallet(user_key, network_kovan);
	const l2Wallet = new ethers.Wallet(user_key, ethers.provider);
	
	let blockNumber = await network_kovan.getBlockNumber();
	console.log("Kovan block number: ", blockNumber);
	
	blockNumber = await ethers.provider.getBlockNumber();
	console.log("Optimistic Kovan block number: ", blockNumber);
	
	// const L2StandardBridge = await ethers.getContractFactory('../../node_modules/@eth-optimism/contracts/artifacts/contracts/optimistic-ethereum/OVM/bridge/tokens/OVM_L2StandardBridge.sol:OVM_L2StandardBridge');
	const L2StandardBridge = new ethers.ContractFactory(L2StandardBridgeArtifacts.abi, L2StandardBridgeArtifacts.bytecode);
	const L1StandardBridge = new ethers.ContractFactory(L1StandardBridgeArtifacts.abi, L1StandardBridgeArtifacts.bytecode);
	const OP_Thales_L1 = await ethers.getContractFactory('/contracts/Token/OpThales_L1.sol:OpThales');
	const ThalesExchanger = await ethers.getContractFactory('ThalesExchanger');
	const OP_Thales_L2 = await ethers.getContractFactory('/contracts/Token/OpThales_L2.sol:OpThales');
	const ThalesAddress = getTargetAddress('Thales', net_kovan);
	const OpThalesL1Address = getTargetAddress('OpThales_L1', net_kovan);
	const OpThalesL2Address = getTargetAddress('OpThales_L2', net_optimistic_kovan);
	
	const Thales = await ethers.getContractFactory('Thales');
	// console.log("L2 Contract:\n", OP_Thales_L2);
	

	const Thales_deployed= await Thales.connect(l1Wallet).attach(ThalesAddress);
	console.log("Thales on Kovan at: ", Thales_deployed.address);
	const OP_Thales_L1_deployed = await OP_Thales_L1.connect(l1Wallet).attach(OpThalesL1Address);
	console.log("OpThales on L1: ", OP_Thales_L1_deployed.address);
	const OP_Thales_L2_deployed = await OP_Thales_L2.connect(l2Wallet).attach(OpThalesL2Address);
	console.log("OpThales on L2: ", OP_Thales_L2_deployed.address);
	const L2StandardBridge_deployed = await L2StandardBridge.connect(l2Wallet).attach(L2_BRIDGE_ADDRESS);
	console.log("L2 Bridge on Optimistic Kovan at: ", L2StandardBridge_deployed.address);
	
	const ThalesExchanger_connected = await ThalesExchanger.connect(l1Wallet);
	console.log("Thales Exchanger ready to deploy: ", ThalesExchanger_connected.signer._isSigner);

	const L1StandardBridgeAddress = await L2StandardBridge_deployed.l1TokenBridge();
	
	const L1StandardBridge_deployed = await L1StandardBridge.connect(l1Wallet).attach(L1StandardBridgeAddress);
	
	console.log("L1 Bridge on Kovan at: ", L1StandardBridge_deployed.address);

	const ThalesExchanger_deployed = await ThalesExchanger_connected.deploy(
		owner.address, 
		Thales_deployed.address,
		OP_Thales_L1_deployed.address,
		L1StandardBridge_deployed.address,
		OP_Thales_L2_deployed.address
		);
		
	tx = await ThalesExchanger_deployed.deployed();
	console.log("Thales Exchanger deployed on: ", ThalesExchanger_deployed.address);
	setTargetAddress('ThalesExchanger', net_kovan, ThalesExchanger_deployed.address);

	


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
