const { ethers } = require('hardhat');
const { getTargetAddress} = require('../../helpers');

async function main() {
    
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	let SafeboxAddress;

	if (network === 'unknown') {
		network = 'localhost';
	}

	if (network == 'homestead') {
		network = 'mainnet';
	}

	if (networkObj.chainId == 69) {
		networkObj.name = 'optimisticKovan';
		network = 'optimisticKovan';
	}
	if (networkObj.chainId == 10) {
		networkObj.name = 'optimisticEthereum';
		network = 'optimisticEthereum';
	}
	if (networkObj.chainId == 80001) {
		networkObj.name = 'polygonMumbai';
		network = 'polygonMumbai';
	}

	if (networkObj.chainId == 137) {
		networkObj.name = 'polygon';
		network = 'polygon';
	}

	console.log('Account is: ' + owner.address);
	console.log('Network:' + network);
	console.log('Network id:' + networkObj.chainId);

    /* ========== PROPERTIES ========== */

	const safeBoxPercentage = 0; // CHANGE for percntage

    /* ========== SAFE BOX FOR ROYALE ========== */

	const ThalesRoyale = await ethers.getContractFactory('ThalesRoyale');
	const thalesRoyaleAddress = getTargetAddress('ThalesRoyale', network);
	console.log('Found ThalesRoyale at:', thalesRoyaleAddress);

	SafeboxAddress = getTargetAddress('SafeBox', network);
	console.log('Found SafeBox at:', SafeboxAddress);

    const royale = await ThalesRoyale.attach(
		thalesRoyaleAddress
	);

	// setSafeBoxPercentage
	let tx = await royale.setSafeBoxPercentage(safeBoxPercentage);
	
	await tx.wait().then(e => {
		console.log('Safe box percentage: ', safeBoxPercentage);
	});

	// setSafeBox
	tx = await royale.setSafeBox(SafeboxAddress);
	
	await tx.wait().then(e => {
		console.log('Safe box address: ', SafeboxAddress);
	});

}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});