const path = require('path');
const { ethers } = require('hardhat');
const w3utils = require('web3-utils');
const snx = require('synthetix');
const { artifacts, contract, web3 } = require('hardhat');
require('dotenv').config();

// const user_key = process.env.PRIVATE_KEY;
const user_key = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

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
	
	const local_L1 = 'localhost'
	
	const local_L2 = 'optimistic'
	
    const l1RpcProvider = new ethers.providers.JsonRpcProvider(process.env.LOCAL_OPT_IP_2)
    const l2RpcProvider = new ethers.providers.JsonRpcProvider(process.env.LOCAL_OPT_IP)
	
	const l1Wallet = new ethers.Wallet(user_key, l1RpcProvider);
	const l2Wallet = new ethers.Wallet(user_key, l2RpcProvider);

	let blockNumber = await l1RpcProvider.getBlockNumber();
	console.log("Kovan block number: ", blockNumber);
	
	blockNumber = await l2RpcProvider.getBlockNumber();
	console.log("Optimistic Kovan block number: ", blockNumber);
	
	const L2StandardBridge = new ethers.ContractFactory(L2StandardBridgeArtifacts.abi, L2StandardBridgeArtifacts.bytecode);
	const L1StandardBridge = new ethers.ContractFactory(L1StandardBridgeArtifacts.abi, L1StandardBridgeArtifacts.bytecode);
	const OP_Thales_L1 = await ethers.getContractFactory('/contracts/Token/OpThales_L1.sol:OpThales');
	const ThalesExchanger = await ethers.getContractFactory('ThalesExchanger');
	const OP_Thales_L2 = await ethers.getContractFactory('/contracts/Token/OpThales_L2.sol:OpThales');
	// const ThalesAddress = getTargetAddress('Thales', local_L1);

	const Thales = await ethers.getContractFactory('Thales');
	// console.log("L2 Contract:\n", OP_Thales_L2);
	

	const Thales_deployed= await Thales.connect(l1Wallet).deploy();
    await Thales_deployed.deployed();
    console.log("Thales deployed on: ",Thales_deployed.address);
	setTargetAddress('Thales', local_L1, Thales_deployed.address);

	const ThalesExchanger_connected = await ThalesExchanger.connect(l1Wallet);
	console.log("Thales Exchanger ready to deploy: ", ThalesExchanger_connected.signer._isSigner);
	const OP_Thales_L1_connected = await OP_Thales_L1.connect(l1Wallet);
	console.log("L1 Contract ready to deploy: ", OP_Thales_L1_connected.signer._isSigner);
	const OP_Thales_L2_connected = await OP_Thales_L2.connect(l2Wallet);
	console.log("L2 Contract ready to deploy: ", OP_Thales_L2_connected.signer._isSigner);
	const L2StandardBridge_deployed = await L2StandardBridge.connect(l2Wallet).attach(L2_BRIDGE_ADDRESS);
	console.log("L2 Bridge on Optimistic Kovan at: ", L2StandardBridge_deployed.address);


	const L1StandardBridgeAddress = await L2StandardBridge_deployed.l1TokenBridge();
	
	const L1StandardBridge_deployed = await L1StandardBridge.connect(l1Wallet).attach(L1StandardBridgeAddress);
	
	console.log("L1 Bridge on Kovan at: ", L1StandardBridge_deployed.address);

	const OP_Thales_L1_deployed = await OP_Thales_L1_connected.deploy();
	
	let tx = await OP_Thales_L1_deployed.deployed();
	// console.log(tx);
	console.log("Optimistic Thales L1 deployed on: ",OP_Thales_L1_deployed.address);
	setTargetAddress('OpThales_L1', local_L1, OP_Thales_L1_deployed.address);
	
	const OP_Thales_L2_deployed = await OP_Thales_L2_connected.deploy(
		L2_BRIDGE_ADDRESS,
		OP_Thales_L1_deployed.address,
		'Opt Thales L2',
		"OPTHALES_L2"
		);
		
	tx = await OP_Thales_L2_deployed.deployed();
	console.log("Optimistic Thales L2 deployed on: ",OP_Thales_L2_deployed.address);
	setTargetAddress('OpThales_L2', local_L2, OP_Thales_L2_deployed.address);
	
	const ThalesExchanger_deployed = await ThalesExchanger_connected.deploy(
		owner.address, 
		Thales_deployed.address,
		OP_Thales_L1_deployed.address,
		L1StandardBridge_deployed.address,
		OP_Thales_L2_deployed.address
		);
		
	tx = await ThalesExchanger_deployed.deployed();
	console.log("Thales Exchanger deployed on: ", ThalesExchanger_deployed.address);
	setTargetAddress('ThalesExchanger', local_L1, ThalesExchanger_deployed.address);

	


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
