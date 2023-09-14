const { ethers } = require('hardhat');
const { setTargetAddress } = require('../helpers.js');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	if (network === 'unknown') {
		network = 'localhost';
	}

	if (network == 'homestead') {
		network = 'mainnet';
	}
	if (networkObj.chainId == 420) {
		networkObj.name = 'optimisticGoerli';
		network = 'optimisticGoerli';
	}
	if (networkObj.chainId == 8453) {
		networkObj.name = 'baseMainnet';
		network = 'baseMainnet';
	}

	console.log('Account is: ' + owner.address);
	console.log('Network:' + network);

	// Dev env - deploy Thales.sol; Live env - use Thales.sol contract address
	const Overtime = await ethers.getContractFactory('Overtime');
	const OvertimeDeployed = await Overtime.deploy();
	await OvertimeDeployed.deployed();
	// update deployments.json file
	setTargetAddress('OvertimeToken', network, OvertimeDeployed.address);

	console.log('OvertimeToken deployed to:', OvertimeDeployed.address);

	await hre.run('verify:verify', {
		address: OvertimeDeployed.address,
		// contract: 'contracts/Token/Thales.sol:Thales',
	});
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
