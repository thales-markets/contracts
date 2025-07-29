const { ethers } = require('hardhat');
const { getTargetAddress, setTargetAddress } = require('../helpers');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;

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

	const ChainedSpeedMarketsAMMAddress = getTargetAddress('ChainedSpeedMarketsAMM', network);
	console.log('ChainedSpeedMarketsAMM address:', ChainedSpeedMarketsAMMAddress);

	const newMastercopyAddress = getTargetAddress('ChainedSpeedMarketMastercopy', network);

	if (!newMastercopyAddress) {
		throw new Error(
			`ChainedSpeedMarketMastercopy address not found in deployments.json for network: ${network}`
		);
	}

	console.log(
		'Using existing ChainedSpeedMarketMastercopy from deployments:',
		newMastercopyAddress
	);

	const ChainedSpeedMarketsAMM = await ethers.getContractFactory('ChainedSpeedMarketsAMM');
	const chainedSpeedMarketsAMM = await ChainedSpeedMarketsAMM.attach(ChainedSpeedMarketsAMMAddress);

	console.log('Updating ChainedSpeedMarketsAMM with new mastercopy...');

	const tx = await chainedSpeedMarketsAMM.setMastercopy(newMastercopyAddress);

	await tx.wait();
	console.log('ChainedSpeedMarketsAMM updated with new mastercopy');
	console.log('Transaction hash:', tx.hash);

	const currentMastercopy = await chainedSpeedMarketsAMM.chainedSpeedMarketMastercopy();
	console.log('Current mastercopy in ChainedSpeedMarketsAMM:', currentMastercopy);

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
