const { ethers, upgrades } = require('hardhat');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');
const { getTargetAddress, setTargetAddress } = require('../helpers');

const user_key1 = process.env.PRIVATE_KEY;

async function main() {
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	if (networkObj.chainId == 10) {
		network = 'optimisticEthereum';
	}
	if (networkObj.chainId == 69) {
		network = 'optimisticKovan';
	}
	if (network == 'homestead') {
		network = 'mainnet';
	}

	const owner = new ethers.Wallet(user_key1, ethers.provider);

	console.log('Owner is:' + owner.address);
	console.log('Network name:' + network);

	if (networkObj.chainId == 69) {
		network = 'optimisticKovan';
	}
	const EscrowAddress = getTargetAddress('EscrowThales', network);
	const EscrowThales = await ethers.getContractFactory('EscrowThales');

	let EscrowImplementation;

	if (networkObj.chainId == 69) { 
		await upgrades.upgradeProxy(EscrowAddress, EscrowThales);
		await delay(5000);
		console.log('Escrow upgraded');
		EscrowImplementation = await getImplementationAddress(
			ethers.provider,
			EscrowAddress
			);
	}

	if (networkObj.chainId == 10) {
		EscrowImplementation = await upgrades.prepareUpgrade(EscrowAddress, EscrowThales);
		await delay(5000);
		console.log('Escrow upgraded');
	}

	
	console.log('Implementation Escrow: ', EscrowImplementation);
	setTargetAddress('EscrowThalesImplementation', network, EscrowImplementation);

	try {
		await hre.run('verify:verify', {
			address: EscrowImplementation,
		});
	} catch (e) {
		console.log(e);
	}
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});

function delay(time) {
	return new Promise(function(resolve) {
		setTimeout(resolve, time);
	});
}
