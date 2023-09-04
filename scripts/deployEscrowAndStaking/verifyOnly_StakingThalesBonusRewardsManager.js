const { ethers } = require('hardhat');
const { getTargetAddress } = require('../helpers');

const user_key1 = process.env.PRIVATE_KEY;

async function main() {
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	if (networkObj.chainId == 69) {
		network = 'optimisticKovan';
	}
	if (network == 'homestead') {
		network = 'mainnet';
	}
	if (networkObj.chainId == 10) {
		network = 'optimisticEthereum';
	}
	if (networkObj.chainId == 8453) {
		network = 'baseMainnet';
	}
	const owner = new ethers.Wallet(user_key1, ethers.provider);

	console.log('Owner is:' + owner.address);
	console.log('Network name:' + network);

	const StakingThalesBonusRewardsManagerImplementation = getTargetAddress(
		'StakingThalesBonusRewardsManagerImplementation',
		network
	);
	const ProxyStakingThalesBonusRewardsManager = getTargetAddress(
		'StakingThalesBonusRewardsManager',
		network
	);

	console.log(
		'Implementation StakingThalesBonusRewardsManager: ',
		StakingThalesBonusRewardsManagerImplementation
	);
	console.log('StakingThalesBonusRewardsManager proxy:', ProxyStakingThalesBonusRewardsManager);

	try {
		await hre.run('verify:verify', {
			address: StakingThalesBonusRewardsManagerImplementation,
		});
	} catch (e) {
		console.log(e);
	}

	try {
		await hre.run('verify:verify', {
			address: ProxyStakingThalesBonusRewardsManager,
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
