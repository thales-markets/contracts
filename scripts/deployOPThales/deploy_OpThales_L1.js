const path = require('path');
const { ethers } = require('hardhat');

const user_key = process.env.PRIVATE_KEY;

const { getTargetAddress, setTargetAddress } = require('../helpers');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;

	if (network == 'homestead') {
		network = 'mainnet';
	}
	if (networkObj.chainId == 42) {
		network = 'kovan';
	}
	if (networkObj.chainId == 69) {
		console.log("Error L2 network used! Deploy only on L1 Mainnet. \nTry using \'--network mainnet\'");
		return 0;
	}
	if (networkObj.chainId == 10) {
		console.log("Error L2 network used! Deploy only on L1 Mainnet. \nTry using \'--network mainnet\'");
		return 0;
	}
	
	const l1Wallet = new ethers.Wallet(user_key, ethers.provider);	
	const OP_Thales_L1 = await ethers.getContractFactory('/contracts/Token/OpThales_L1.sol:OpThales');
	const OP_Thales_L1_connected = await OP_Thales_L1.connect(l1Wallet);
	console.log("L1 Contract ready to deploy: ", OP_Thales_L1_connected.signer._isSigner);

	const OP_Thales_L1_deployed = await OP_Thales_L1_connected.deploy();
	
	let tx = await OP_Thales_L1_deployed.deployed();
	console.log("Optimistic Thales L1 deployed on: ",OP_Thales_L1_deployed.address);
	setTargetAddress('OpThales_L1', network, OP_Thales_L1_deployed.address);
	
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});

