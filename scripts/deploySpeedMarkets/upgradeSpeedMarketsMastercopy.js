const { ethers } = require('hardhat');
const { getTargetAddress, setTargetAddress } = require('../helpers');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;

	// Network configuration
	if (network == 'homestead') {
		network = 'mainnet';
	}
	if (networkObj.chainId == 10) {
		networkObj.name = 'optimisticEthereum';
		network = 'optimisticEthereum';
	}
	if (networkObj.chainId == 42161) {
		networkObj.name = 'arbitrumOne';
		network = 'arbitrumOne';
	}
	if (networkObj.chainId == 8453) {
		networkObj.name = 'baseMainnet';
		network = 'baseMainnet';
	}
	if (networkObj.chainId == 137) {
		networkObj.name = 'polygon';
		network = 'polygon';
	}
	if (networkObj.chainId == 56) {
		networkObj.name = 'bsc';
		network = 'bsc';
	}
	if (networkObj.chainId == 168587773) {
		networkObj.name = 'blastSepolia';
		network = 'blastSepolia';
	}
	if (networkObj.chainId == 11155420) {
		networkObj.name = 'optimisticSepolia';
		network = 'optimisticSepolia';
	}

	console.log('Account is:', owner.address);
	console.log('Network name:', network);

	// Get existing addresses
	const SpeedMarketsAMMAddress = getTargetAddress('SpeedMarketsAMM', network);
	const speedMarketsAMMUtils = getTargetAddress('SpeedMarketsAMMUtils', network);
	const addressManager = getTargetAddress('AddressManager', network);

	console.log('SpeedMarketsAMM address:', SpeedMarketsAMMAddress);
	console.log('SpeedMarketsAMMUtils address:', speedMarketsAMMUtils);
	console.log('AddressManager address:', addressManager);

	// Load existing mastercopy address from deployments
	const newMastercopyAddress = getTargetAddress('SpeedMarketMastercopy', network);

	if (!newMastercopyAddress) {
		throw new Error(
			`SpeedMarketMastercopy address not found in deployments.json for network: ${network}`
		);
	}

	console.log('Using existing SpeedMarketMastercopy from deployments:', newMastercopyAddress);

	const SpeedMarketsAMM = await ethers.getContractFactory('SpeedMarketsAMM');
	const speedMarketsAMM = await SpeedMarketsAMM.attach(SpeedMarketsAMMAddress);

	console.log('Updating SpeedMarketsAMM with new mastercopy...');

	const tx = await speedMarketsAMM.setAMMAddresses(
		newMastercopyAddress,
		speedMarketsAMMUtils,
		addressManager
	);

	await tx.wait();
	console.log('SpeedMarketsAMM updated with new mastercopy');

	const currentMastercopy = await speedMarketsAMM.speedMarketMastercopy();
	console.log('Current mastercopy in SpeedMarketsAMM:', currentMastercopy);

	if (currentMastercopy.toLowerCase() === newMastercopyAddress.toLowerCase()) {
		console.log('Mastercopy successfully updated!');
	} else {
		console.log('Mastercopy update failed!');
	}
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
