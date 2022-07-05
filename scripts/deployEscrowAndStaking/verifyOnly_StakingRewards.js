const { ethers } = require('hardhat');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');

const MINUTE = 60;
const WEEK = 604800;

const { getTargetAddress, setTargetAddress } = require('../helpers');

const user_key1 = process.env.PRIVATE_KEY;

async function main() {
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	if (networkObj.chainId == 10) {
		networkObj.name = 'optimisticEthereum';
		network = 'optimisticEthereum';
	}
	if (networkObj.chainId == 69) {
		network = 'optimisticKovan';
	}
	if (networkObj.chainId == 42) {
		network = 'kovan';
	}
	let durationPeriod, unstakeDurationPeriod;
	if (network == 'homestead') {
		console.log('Setting duration to WEEK');
		network = 'mainnet';
		durationPeriod = WEEK;
		unstakeDurationPeriod = WEEK;
	} else {
		console.log('Setting duration to MINUTE');
		durationPeriod = MINUTE;
		unstakeDurationPeriod = MINUTE;
	}

	SNXIssuerAddress = getTargetAddress('SNXIssuer', network);
	const owner = new ethers.Wallet(user_key1, ethers.provider);

	console.log('Owner is:' + owner.address);
	console.log('Network name:' + network);
	console.log('SNXIssuer address: ' + SNXIssuerAddress);

	let thalesAddress, ProxyERC20sUSD_address;

	if (networkObj.chainId == 10) {
		thalesAddress = getTargetAddress('OpThales_L2', network);
		ProxyERC20sUSD_address = getTargetAddress('ProxysUSD', network);
	} else {
		if (networkObj.chainId == 69) {
			network = 'optimisticKovan';
			thalesAddress = getTargetAddress('OpThales_L2', network);
			ProxyERC20sUSD_address = getTargetAddress('ProxysUSD', network);
		} else {
			thalesAddress = getTargetAddress('Thales', network);
			ProxyERC20sUSD_address = getTargetAddress('ProxysUSD', network);
		}
	}
	console.log('Thales address: ', thalesAddress);
	console.log('ProxyERC20sUSD address: ', ProxyERC20sUSD_address);

	const ThalesStakingRewardsPoolDeployed = getTargetAddress('ThalesStakingRewardsPool', network);

	console.log('ThalesStakingRewardsPool proxy:', ThalesStakingRewardsPoolDeployed);

	const ThalesStakingRewardsPoolImplementation = await getImplementationAddress(
		ethers.provider,
		ThalesStakingRewardsPoolDeployed
	);

	console.log('Implementation ThalesStakingRewardsPool: ', ThalesStakingRewardsPoolImplementation);

	setTargetAddress(
		'ThalesStakingRewardsPoolImplementation',
		network,
		ThalesStakingRewardsPoolImplementation
	);

	try {
		await hre.run('verify:verify', {
			address: ThalesStakingRewardsPoolImplementation,
		});
	} catch (e) {
		console.log(e);
	}

	try {
		await hre.run('verify:verify', {
			address: ThalesStakingRewardsPoolDeployed,
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
