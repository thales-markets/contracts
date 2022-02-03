// const { ethers } = require('hardhat');
const hre = require('hardhat');
const w3utils = require('web3-utils');
const snx = require('synthetix-2.50.4-ovm');
const { artifacts, contract, web3 } = require('hardhat');

const INFURA = process.env.INFURA;

const {LedgerSigner} = require('@anders-t/ethers-ledger');

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
    let connection = {
        url: 'https://optimism-kovan.infura.io/v3/'+INFURA
    };
    const ledger = new LedgerSigner(hre.ethers.provider, path);

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
    console.log("Ledger path:", ledger.path);

    // console.log("Ledger accounts:\n", ledger);
    const SnxRewards = await ethers.getContractFactory('SNXRewards'); 
    const SNXRewards_connected = await SnxRewards.connect(ledger);
    // console.log(SNXRewards_connected);
    const SNXRewards_deployed = await SNXRewards_connected.deploy();
    await SNXRewards_deployed.deployed();

    console.log("Dummy contract deployed on:", SNXRewards_deployed.address);
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
