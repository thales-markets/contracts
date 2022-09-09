const { ethers, upgrades } = require('hardhat');
const { getTargetAddress, setTargetAddress } = require('../helpers');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');
const w3utils = require('web3-utils');

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

	if (networkObj.chainId == 69) {
		networkObj.name = 'optimisticKovan';
		network = 'optimisticKovan';
	}
	if (networkObj.chainId == 10) {
		networkObj.name = 'optimisticEthereum';
		network = 'optimisticEthereum';
	}
	if (networkObj.chainId == 137) {
		networkObj.name = 'polygon';
		network = 'polygon';
	}
	if (networkObj.chainId == 56) {
		networkObj.name = 'bsc';
		network = 'bsc';
	}

	if (networkObj.chainId == 42161) {
		networkObj.name = 'arbitrumOne';
		network = 'arbitrumOne';
	}

	console.log('Account is: ' + owner.address);
	console.log('Network:' + network);

	const rangedAmmAddress = getTargetAddress('RangedAMM', network);
	console.log('Found RangedMarketsAMM at:', rangedAmmAddress);

	const RangedMarketsAMM = await ethers.getContractFactory('RangedMarketsAMM');
	// await upgrades.upgradeProxy(rangedAmmAddress, RangedMarketsAMM);

	let RangedMarketsAMMImplementation = await upgrades.prepareUpgrade(
		rangedAmmAddress,
		RangedMarketsAMM
	);
	console.log('RangedMarketsAMM upgraded');

	// const RangedMarketsAMMImplementation = await getImplementationAddress(
	// 	ethers.provider,
	// 	rangedAmmAddress
	// );

	console.log('Implementation RangedMarketsAMM: ', RangedMarketsAMMImplementation);

	setTargetAddress('RangedAMMImplementation', network, RangedMarketsAMMImplementation);

	try {
		await hre.run('verify:verify', {
			address: RangedMarketsAMMImplementation,
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
