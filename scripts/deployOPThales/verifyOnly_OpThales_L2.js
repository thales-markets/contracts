const path = require('path');
const { ethers } = require('hardhat');

const user_key = process.env.PRIVATE_KEY;


const L2_BRIDGE_ADDRESS = '0x4200000000000000000000000000000000000010';

const { getTargetAddress, setTargetAddress } = require('../helpers');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let mainnetNetwork = 'mainnet';

	if (network == 'homestead') {
		console.log("Error L1 network used! Deploy only on L2 Optimism. \nTry using \'--network optimisticEthereum\'")
		return 0;
	}
	if (networkObj.chainId == 42) {
		console.log("Error L1 network used! Deploy only on L2 Optimism. \nTry using \'--network optimisticKovan\'")
		return 0;
	}
	if (networkObj.chainId == 69) {
		networkObj.name = 'optimisticKovan';
		network = 'optimisticKovan';
		mainnetNetwork = 'kovan';
	}
	if (networkObj.chainId == 10) {
		networkObj.name = 'optimisticEthereum';
		network = 'optimisticEthereum';
	}
	

	const OP_Thales_L1_Address = getTargetAddress('OpThales_L1', mainnetNetwork);
	if(OP_Thales_L1_Address == undefined) {
		console.log("Please first deploy OpTHALES on L1");
		return 0;
	}
	
	const OP_Thales_L2_Address = getTargetAddress('OpThales_L2', network);
	
	console.log("Optimistic Thales on L2: ", OP_Thales_L2_Address);
	
	console.log("Optimistic Thales on L1: ", OP_Thales_L1_Address);

		
	try {
		await hre.run('verify:verify', {
			address: OP_Thales_L2_Address,
			constructorArguments: [
				L2_BRIDGE_ADDRESS,
				OP_Thales_L1_Address,
				'Optimistic Thales Token',
				"THALES"
			],
		});
	} catch (e) {
		console.log(e);
	}
		

}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});

