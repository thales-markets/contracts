const path = require('path');
const { ethers } = require('hardhat');

const user_key = process.env.PRIVATE_KEY;


const L2_BRIDGE_ADDRESS = '0x4200000000000000000000000000000000000010';

const { getTargetAddress, setTargetAddress } = require('../helpers');

const L2StandardBridgeArtifacts = require('@eth-optimism/contracts/artifacts/contracts/optimistic-ethereum/OVM/bridge/tokens/OVM_L2StandardBridge.sol/OVM_L2StandardBridge');
const L1StandardBridgeArtifacts = require('@eth-optimism/contracts/artifacts/contracts/optimistic-ethereum/OVM/bridge/tokens/OVM_L1StandardBridge.sol/OVM_L1StandardBridge');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;

	if (network == 'homestead') {
		console.log("Error L1 network used! Deploy only on L2 Optimism. \nTry using \'--network optimisticEthereum\'")
		return 0;
	}
	if (networkObj.chainId == 69) {
		networkObj.name = 'optimisticKovan';
		network = 'optimisticKovan';
	}
	if (networkObj.chainId == 10) {
		networkObj.name = 'optimisticEthereum';
		network = 'optimisticEthereum';
	}
	
	let mainnet_provider = new ethers.providers.InfuraProvider("homestead");	
	const l1Wallet = new ethers.Wallet(user_key, mainnet_provider);
	const l2Wallet = new ethers.Wallet(user_key, ethers.provider);

		
	// const L2StandardBridge = await ethers.getContractFactory('../../node_modules/@eth-optimism/contracts/artifacts/contracts/optimistic-ethereum/OVM/bridge/tokens/OVM_L2StandardBridge.sol:OVM_L2StandardBridge');
	const L2StandardBridge = new ethers.ContractFactory(L2StandardBridgeArtifacts.abi, L2StandardBridgeArtifacts.bytecode);
	const L1StandardBridge = new ethers.ContractFactory(L1StandardBridgeArtifacts.abi, L1StandardBridgeArtifacts.bytecode);
	const OP_Thales_L1 = await ethers.getContractFactory('/contracts/Token/OpThales_L1.sol:OpThales');
	const OP_Thales_L2 = await ethers.getContractFactory('/contracts/Token/OpThales_L2.sol:OpThales');
	
	const OP_Thales_L1_Address = getTargetAddress('OpThales_L1', 'mainnet');
	if(OP_Thales_L1_Address == undefined) {
		console.log("Please first deploy OpTHALES on L1");
		return 0;
	}
	
	
	const OP_Thales_L2_connected = await OP_Thales_L2.connect(l2Wallet);
	console.log("L2 Contract ready to deploy: ", OP_Thales_L2_connected.signer._isSigner);
	const L2StandardBridge_deployed = await L2StandardBridge.connect(l2Wallet).attach(L2_BRIDGE_ADDRESS);
	console.log("L2 Bridge on Optimism: ", L2StandardBridge_deployed.address);
	console.log("OpTHALES on L1: ", OP_Thales_L1_Address);


	const L1StandardBridgeAddress = await L2StandardBridge_deployed.l1TokenBridge();
	
	const L1StandardBridge_deployed = await L1StandardBridge.connect(l1Wallet).attach(L1StandardBridgeAddress);
	
	console.log("L1 Bridge on Mainnet at: ", L1StandardBridge_deployed.address);
	
	const OP_Thales_L2_deployed = await OP_Thales_L2_connected.deploy(
		L2_BRIDGE_ADDRESS,
		OP_Thales_L1_Address,
		'Opt Thales L2',
		"OPTHALES_L2"
		);
		
	tx = await OP_Thales_L2_deployed.deployed();
	console.log("Optimistic Thales L2 deployed on: ",OP_Thales_L2_deployed.address);
	setTargetAddress('OpThales_L2', network, OP_Thales_L2_deployed.address);


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
