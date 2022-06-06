const { ethers } = require('hardhat');
const user_key = process.env.PRIVATE_KEY;

const L2_BRIDGE_ADDRESS = '0x4200000000000000000000000000000000000010';

const { getTargetAddress, setTargetAddress } = require('../../helpers');

const L2StandardBridgeArtifacts = require('@eth-optimism/contracts/artifacts/contracts/optimistic-ethereum/OVM/bridge/tokens/OVM_L2StandardBridge.sol/OVM_L2StandardBridge');
const L1StandardBridgeArtifacts = require('@eth-optimism/contracts/artifacts/contracts/optimistic-ethereum/OVM/bridge/tokens/OVM_L1StandardBridge.sol/OVM_L1StandardBridge');

async function main() {
	
	let network_kovan = new ethers.providers.InfuraProvider("kovan");
	const net_kovan = 'kovan';
	const net_optimistic_kovan = 'optimisticKovan'
		
	const l1Wallet = new ethers.Wallet(user_key, network_kovan);
	const l2Wallet = new ethers.Wallet(user_key, ethers.provider);
	
	let blockNumber = await network_kovan.getBlockNumber();
	console.log("Kovan block number: ", blockNumber);
	
	blockNumber = await ethers.provider.getBlockNumber();
	console.log("Optimistic Kovan block number: ", blockNumber);
	
	const L2StandardBridge = new ethers.ContractFactory(L2StandardBridgeArtifacts.abi, L2StandardBridgeArtifacts.bytecode);
	const L1StandardBridge = new ethers.ContractFactory(L1StandardBridgeArtifacts.abi, L1StandardBridgeArtifacts.bytecode);
	const OP_Thales_L1 = await ethers.getContractFactory('/contracts/Token/OpThales_L1.sol:OpThales');
	const ThalesExchanger = await ethers.getContractFactory('ThalesExchanger');
	const OP_Thales_L2 = await ethers.getContractFactory('/contracts/Token/OpThales_L2.sol:OpThales');
	const ThalesAddress = getTargetAddress('Thales', 'kovan');

	const Thales = await ethers.getContractFactory('Thales');
		

	const Thales_deployed= await Thales.connect(l1Wallet).attach(ThalesAddress);
	console.log("Thales on Kovan at: ", Thales_deployed.address);
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

	console.log("Optimistic Thales L1 deployed on: ",OP_Thales_L1_deployed.address);
	setTargetAddress('OpThales_L1', net_kovan, OP_Thales_L1_deployed.address);
	
	const OP_Thales_L2_deployed = await OP_Thales_L2_connected.deploy(
		L2_BRIDGE_ADDRESS,
		OP_Thales_L1_deployed.address,
		'Opt Thales L2',
		"OPTHALES_L2"
		);
		
	tx = await OP_Thales_L2_deployed.deployed();
	console.log("Optimistic Thales L2 deployed on: ",OP_Thales_L2_deployed.address);
	setTargetAddress('OpThales_L2', net_optimistic_kovan, OP_Thales_L2_deployed.address);


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
