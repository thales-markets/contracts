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

	const lpStakingDoubleRewardsAddress = getTargetAddress('LPStakingDoubleRewards', network);
	console.log('Found LPStakingDoubleRewards at:', lpStakingDoubleRewardsAddress);

	const LPStakingDoubleRewards = await ethers.getContractFactory('LPStakingDoubleRewards');
	const implementation = await upgrades.prepareUpgrade(lpStakingDoubleRewardsAddress, LPStakingDoubleRewards);

	console.log('LPStakingDoubleRewards upgraded');

	console.log('LPStakingDoubleRewardsImplementation: ', implementation);
	setTargetAddress('LPStakingDoubleRewardsImplementation', network, implementation);

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
