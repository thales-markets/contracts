const { ethers } = require('hardhat');

const { getTargetAddress, setTargetAddress } = require('../../helpers');

const user_key_local_optimism = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const user_key_env = process.env.PRIVATE_KEY;
const user_key2 = process.env.PRIVATE_KEY_2;

const L2_BRIDGE_ADDRESS = '0x4200000000000000000000000000000000000010';


const L2StandardBridgeArtifacts = require('@eth-optimism/contracts/artifacts/contracts/optimistic-ethereum/OVM/bridge/tokens/OVM_L2StandardBridge.sol/OVM_L2StandardBridge');
const L1StandardBridgeArtifacts = require('@eth-optimism/contracts/artifacts/contracts/optimistic-ethereum/OVM/bridge/tokens/OVM_L1StandardBridge.sol/OVM_L1StandardBridge');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
    console.log(networkObj)
	let networkL1, networkL2;
    let user_key;
    if(networkObj.chainId == 69) {
        networkL1 = new ethers.providers.InfuraProvider("kovan");
        networkL2 = ethers.provider;
        user_key = user_key_env;
    }
    else if(networkObj.chainId == 420) {
        networkL1 = new ethers.providers.JsonRpcProvider(process.env.LOCAL_OPT_IP_2)
        networkL2 = new ethers.providers.JsonRpcProvider(process.env.LOCAL_OPT_IP)
        user_key = user_key_local_optimism;
    }
	let network_kovan = new ethers.providers.InfuraProvider("kovan");
	
	const net_kovan = 'kovan'
	const net_optimistic_kovan = 'optimisticKovan'
	
	
	const l1Wallet = new ethers.Wallet(user_key, networkL1);
	const l1Wallet2 = new ethers.Wallet(user_key2, network_kovan);
	const l2Wallet = new ethers.Wallet(user_key, networkL2);
	
	let blockNumber = await networkL1.getBlockNumber();
	console.log("Kovan block number: ", blockNumber);
	
	blockNumber = await networkL2.getBlockNumber();
	console.log("Optimistic Kovan block number: ", blockNumber);
	
	const L2StandardBridge = new ethers.ContractFactory(L2StandardBridgeArtifacts.abi, L2StandardBridgeArtifacts.bytecode);
	const L1StandardBridge = new ethers.ContractFactory(L1StandardBridgeArtifacts.abi, L1StandardBridgeArtifacts.bytecode);
	const OP_Thales_L1 = await ethers.getContractFactory('/contracts/Token/OpThales_L1.sol:OpThales');
	const ProxyThalesExchanger = await ethers.getContractFactory('ProxyThalesExchanger');
	const OP_Thales_L2 = await ethers.getContractFactory('/contracts/Token/OpThales_L2.sol:OpThales');
	const ThalesAddress = getTargetAddress('Thales', net_kovan);
	const OpThalesL1Address = getTargetAddress('OpThales_L1', net_kovan);
	const OpThalesL2Address = getTargetAddress('OpThales_L2', net_optimistic_kovan);
	
	const OwnedUpgradeabilityProxy = await ethers.getContractFactory('OwnedUpgradeabilityProxy');
	const OwnedUpgradeabilityProxy_deployed = await OwnedUpgradeabilityProxy.connect(l1Wallet).deploy();
	
	await OwnedUpgradeabilityProxy_deployed.deployed();
	console.log("Owned proxy deployed on: ",OwnedUpgradeabilityProxy_deployed.address);
	setTargetAddress('OwnedUpgradeabilityProxy', net_kovan, OwnedUpgradeabilityProxy_deployed.address);

	const Thales = await ethers.getContractFactory('Thales');

	const Thales_deployed= await Thales.connect(l1Wallet).attach(ThalesAddress);
	console.log("Thales on Kovan at: ", Thales_deployed.address);
	const OP_Thales_L1_deployed = await OP_Thales_L1.connect(l1Wallet).attach(OpThalesL1Address);
	console.log("OpThales on L1: ", OP_Thales_L1_deployed.address);
	const OP_Thales_L2_deployed = await OP_Thales_L2.connect(l2Wallet).attach(OpThalesL2Address);
	console.log("OpThales on L2: ", OP_Thales_L2_deployed.address);
	const L2StandardBridge_deployed = await L2StandardBridge.connect(l2Wallet).attach(L2_BRIDGE_ADDRESS);
	console.log("L2 Bridge on Optimistic Kovan at: ", L2StandardBridge_deployed.address);
	
	const ProxyThalesExchanger_connected = await ProxyThalesExchanger.connect(l1Wallet);
	console.log("Thales Exchanger ready to deploy: ", ProxyThalesExchanger_connected.signer._isSigner);

	const L1StandardBridgeAddress = await L2StandardBridge_deployed.l1TokenBridge();
	
	const L1StandardBridge_deployed = await L1StandardBridge.connect(l1Wallet).attach(L1StandardBridgeAddress);
	
	console.log("L1 Bridge on Kovan at: ", L1StandardBridge_deployed.address);
	const ProxyThalesExchanger_implementation = await ProxyThalesExchanger_connected.deploy();
	await ProxyThalesExchanger_implementation.deployed();

	console.log("Proxy Thales Exchanger Logic deployed on: ", ProxyThalesExchanger_implementation.address);
	setTargetAddress('ProxyThalesExchangerLogic', net_kovan, ProxyThalesExchanger_implementation.address);


	await delay(20000);
	
	tx = await ProxyThalesExchanger_implementation.owner.call();
	console.log("Owner is:", tx);
	await delay(20000);
	
	tx = await OwnedUpgradeabilityProxy_deployed.upgradeTo(ProxyThalesExchanger_implementation.address);
	await tx.wait()
	console.log("Proxy updated");
	
	await delay(20000);
	
	const ProxyThalesExchanger_deployed = ProxyThalesExchanger.connect(l1Wallet2).attach(OwnedUpgradeabilityProxy_deployed.address);
	
	tx = await ProxyThalesExchanger_deployed.initialize(
			owner.address, 
			Thales_deployed.address,
			OP_Thales_L1_deployed.address,
			L1StandardBridge_deployed.address,
			OP_Thales_L2_deployed.address
		);
	
	await tx.wait();
	console.log(tx.hash)
	console.log("Proxy Thales Exchanger deployed on: ", ProxyThalesExchanger_deployed.address);
	setTargetAddress('ProxyThalesExchanger', net_kovan, ProxyThalesExchanger_deployed.address);
	
	
	console.log("Wait 20 seconds");
	await delay(20000);

	tx = await ThalesExchanger_deployed.owner.call();
	console.log("Owner is:", tx);

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
