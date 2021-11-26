const path = require('path');
const { ethers, upgrades } = require('hardhat');
const w3utils = require('web3-utils');
const snx = require('synthetix-2.50.4-ovm');
const { artifacts, contract, web3 } = require('hardhat');

const user_key_local_optimism = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const user_key_env = process.env.PRIVATE_KEY;
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
    else if(networkObj.chainId == 31337) {
        networkL1 = ethers.providers;
    }
    else if(networkObj.chainId == 42) {
        networkL1 = ethers.providers;
    }

    const net_kovan = 'kovan'
	const net_optimistic_kovan = 'optimisticKovan'
	
	const ThalesExchanger = await ethers.getContractFactory('ProxyThalesExchanger');;
	const OP_Thales_L2 = await ethers.getContractFactory('/contracts/Token/OpThales_L2.sol:OpThales');
	
    const ThalesAddress = getTargetAddress('Thales', net_kovan);
	const OpThalesL1Address = getTargetAddress('OpThales_L1', net_kovan);
	const OpThalesL2Address = getTargetAddress('OpThales_L2', net_optimistic_kovan);
	
	const Thales = await ethers.getContractFactory('Thales');
	// console.log("L2 Contract:\n", OP_Thales_L2);
	

	

	

	const ThalesExchanger_deployed = await upgrades.deployProxy(ThalesExchanger, [
		owner.address, 
		owner.address,
		owner.address,
		owner.address,
		owner.address
	]);
		
	tx = await ThalesExchanger_deployed.deployed();
	console.log("Thales Exchanger deployed on: ", ThalesExchanger_deployed.address);
	// setTargetAddress('ThalesExchanger', net_kovan, ThalesExchanger_deployed.address);

	


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
