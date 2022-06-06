const { ethers, upgrades } = require('hardhat');
const { getTargetAddress, setTargetAddress } = require('../helpers');

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

	console.log('Account is: ' + owner.address);
	console.log('Network:' + network);

	const lpStakingRewardsAddress = getTargetAddress('LPStakingRewards', network);
	console.log('Found LPStakingRewards at:', lpStakingRewardsAddress);

	const LPStakingRewards = await ethers.getContractFactory('LPStakingRewards');
	const implementation = await upgrades.prepareUpgrade(lpStakingRewardsAddress, LPStakingRewards);

	console.log('LPStakingRewards upgraded');

	console.log('LPStakingRewardsImplementation: ', implementation);
	setTargetAddress('LPStakingRewardsImplementation', network, implementation);

	await hre.run('verify:verify', {
		address: implementation
	});
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});
