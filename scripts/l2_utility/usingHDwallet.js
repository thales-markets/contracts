// const { ethers } = require('hardhat');
const hre = require('hardhat');
const w3utils = require('web3-utils');
const snx = require('synthetix-2.50.4-ovm');
const { artifacts, contract, web3 } = require('hardhat');

const sendToAddress = process.env.PERSONAL_ADD;

const {LedgerSigner} = require('@anders-t/ethers-ledger');
// const {LedgerSigner} = require("@ethersproject/hardware-wallets");

const {
	fastForward,
	toUnit,
	currentTime,
	multiplyDecimalRound,
	divideDecimalRound,
} = require('../../test/utils/index')();

const ZERO_ADDRESS = '0x' + '0'.repeat(40);

const { getTargetAddress, setTargetAddress } = require('../helpers');

const { toBytes32 } = require('../../index');

async function main() {
	// let accounts = await ethers.getSigners();
	// let owner = accounts[0];
	let networkObj = await hre.ethers.provider.getNetwork();
    
    const path = "m/44'/60'/0'/0";
    // console.log(hre.ethers.provider);

    const ledger = new LedgerSigner(hre.ethers.provider,path);
    const ledger_network = await ledger.provider.getNetwork();
	console.log("ledger net:",ledger_network);
    // ledger.provider.connection = connection;
	// console.log(networkObj);
	let network = networkObj.name;
	if (network == 'homestead') {
		network = 'mainnet';
	}
	if (networkObj.chainId == 69) {
		networkObj.name = 'optimisticKovan';
		network = 'optimisticKovan';
	}
	if(networkObj.chainId == 10) {
		networkObj.name = "optimistic";
		network = 'optimistic'		
	}

	// console.log('Account is:' + owner.address);
	// console.log('Network name:' + network);
    let address = await ledger.getAddress();
    console.log("Ledger path:", ledger.path);
    console.log("\nLedger path:", address);

    const tx = await ledger.sendTransaction({
        to: sendToAddress,
        value: ethers.utils.parseEther("0.0001")
    });

    // console.log("tx:\n", tx);
    // const SnxRewards = await ethers.getContractFactory('TestThalesRoyale'); 
    // const SNXRewards_connected = SnxRewards;
    // // const SNXRewards_connected = await SnxRewards.connect(ledger);
    // console.log(SNXRewards_connected);
    // const SNXRewards_deployed = await SNXRewards_connected.deploy();
    // await SNXRewards_deployed.deployed();

    // console.log("Dummy contract deployed on:", SNXRewards_deployed.address);
    await tx.wait().then(e => {
        console.log('Done transfer! $$$$ >');
        });

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
