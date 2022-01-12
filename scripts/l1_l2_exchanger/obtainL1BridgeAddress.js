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
	let mainnet_provider;
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
		mainnet_provider = new ethers.providers.InfuraProvider("kovan");
	}
	if (networkObj.chainId == 10) {
		networkObj.name = 'optimistic';
		network = 'optimistic';
		mainnet_provider = new ethers.providers.InfuraProvider("homestead");
	}
	const l1Wallet = new ethers.Wallet(user_key, mainnet_provider);
	const l2Wallet = new ethers.Wallet(user_key, ethers.provider);

		
	// const L2StandardBridge = await ethers.getContractFactory('../../node_modules/@eth-optimism/contracts/artifacts/contracts/optimistic-ethereum/OVM/bridge/tokens/OVM_L2StandardBridge.sol:OVM_L2StandardBridge');
	const L2StandardBridge = new ethers.ContractFactory(L2StandardBridgeArtifacts.abi, L2StandardBridgeArtifacts.bytecode);
	const L1StandardBridge = new ethers.ContractFactory(L1StandardBridgeArtifacts.abi, L1StandardBridgeArtifacts.bytecode);

	const L2StandardBridge_deployed = await L2StandardBridge.connect(l2Wallet).attach(L2_BRIDGE_ADDRESS);
	console.log("L2 Bridge on Optimism: ", L2StandardBridge_deployed.address);

	const L1StandardBridgeAddress = await L2StandardBridge_deployed.l1TokenBridge();
	
	const L1StandardBridge_deployed = await L1StandardBridge.connect(l1Wallet).attach(L1StandardBridgeAddress);
	
	console.log("L1 Bridge on Mainnet at: ", L1StandardBridge_deployed.address);
	
	setTargetAddress('L1StandardBridge', 'mainnet', L1StandardBridge_deployed.address);


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
