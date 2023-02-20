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

	const StakingAddress = getTargetAddress('StakingThales', network);
	const StakingContract = await ethers.getContractFactory('StakingThales');
	console.log('Address of staking: ', StakingAddress);

	if (networkObj.chainId == 69 || networkObj.chainId == 420) {
		await upgrades.upgradeProxy(StakingAddress, StakingContract);
		await delay(5000);

		console.log('Escrow upgraded');
		StakingImplementation = await getImplementationAddress(ethers.provider, StakingAddress);
	}

	if (networkObj.chainId == 10) {
		StakingImplementation = await upgrades.prepareUpgrade(StakingAddress, StakingContract);
		await delay(5000);
		console.log('Staking upgraded');
	}

	console.log('Implementation Staking: ', StakingImplementation);
	setTargetAddress('StakingThalesImplementation', network, StakingImplementation);

	try {
		await hre.run('verify:verify', {
			address: StakingImplementation,
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
