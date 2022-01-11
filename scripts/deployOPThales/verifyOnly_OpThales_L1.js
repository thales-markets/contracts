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
	if (networkObj.chainId == 69) {
		console.log("Error L2 network used! Deploy only on L1 Mainnet. \nTry using \'--network mainnet\'");
		return 0;
	}
	if (networkObj.chainId == 10) {
		console.log("Error L2 network used! Deploy only on L1 Mainnet. \nTry using \'--network mainnet\'");
		return 0;
	}
	
	const OP_Thales_L1_Address = getTargetAddress('OpThales_L1', network);
	console.log("Optimistic Thales on L1: ", OP_Thales_L1_Address);

	try {
		await hre.run('verify:verify', {
			address: OP_Thales_L1_Address,
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

