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
	if (networkObj.chainId == 42161) {
		networkObj.name = 'arbitrumOne';
		network = 'arbitrumOne';
	}
	if (networkObj.chainId == 8453) {
		networkObj.name = 'baseMainnet';
		network = 'baseMainnet';
	}
	if (networkObj.chainId == 11155420) {
		networkObj.name = 'optimisticSepolia';
		network = 'optimisticSepolia';
	}

	const owner = new ethers.Wallet(user_key1, ethers.provider);

	let StakingImplementation;

	console.log('Owner is:' + owner.address);
	console.log('Network name:' + network);

	if (networkObj.chainId == 69) {
		network = 'optimisticKovan';
	}
	if (networkObj.chainId == 420) {
		networkObj.name = 'optimisticGoerli';
		network = 'optimisticGoerli';
		proxySUSD = getTargetAddress('ExoticUSD', network);
	}

	const StakingRewardsPoolAddress = getTargetAddress('ThalesStakingRewardsPool', network);
	const StakingRewardsPoolContract = await ethers.getContractFactory('ThalesStakingRewardsPool');
	console.log('Address of staking rewards pool: ', StakingRewardsPoolAddress);
	let StakingRewardsPoolImplementation;
	if (networkObj.chainId == 69 || networkObj.chainId == 420 || networkObj.chainId == 11155420) {
		await upgrades.upgradeProxy(StakingRewardsPoolAddress, StakingRewardsPoolContract);
		await delay(5000);

		console.log('Staking Rewards Pool upgraded');
		StakingRewardsPoolImplementation = await getImplementationAddress(
			ethers.provider,
			StakingRewardsPoolAddress
		);
	}

	if (networkObj.chainId == 10 || networkObj.chainId == 42161 || networkObj.chainId == 8453) {
		StakingRewardsPoolImplementation = await upgrades.prepareUpgrade(
			StakingRewardsPoolAddress,
			StakingRewardsPoolContract
		);
		await delay(5000);
		console.log('Staking Rewards Pool upgraded');
	}

	console.log('Implementation StakingRewardsPool: ', StakingRewardsPoolImplementation);
	setTargetAddress(
		'ThalesStakingRewardsPoolImplementation',
		network,
		StakingRewardsPoolImplementation
	);

	try {
		await hre.run('verify:verify', {
			address: StakingRewardsPoolImplementation,
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

function delay(time) {
	return new Promise(function (resolve) {
		setTimeout(resolve, time);
	});
}
