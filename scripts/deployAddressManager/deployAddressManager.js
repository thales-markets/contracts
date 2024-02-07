const { ethers, upgrades } = require('hardhat');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');

const { getTargetAddress, setTargetAddress } = require('../helpers');

const ZERO_ADDRESS = '0x' + '0'.repeat(40);

async function main() {
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;

	if (network === 'unknown') {
		network = 'localhost';
	}

	if (network == 'homestead') {
		network = 'mainnet';
	}

	if (networkObj.chainId == 10) {
		networkObj.name = 'optimisticEthereum';
		network = 'optimisticEthereum';
	}

	if (networkObj.chainId == 420) {
		networkObj.name = 'optimisticGoerli';
		network = 'optimisticGoerli';
	}

	if (networkObj.chainId == 42161) {
		networkObj.name = 'arbitrumOne';
		network = 'arbitrumOne';
	}

	if (networkObj.chainId == 8453) {
		networkObj.name = 'baseMainnet';
		network = 'baseMainnet';
	}

	if (networkObj.chainId == 56) {
		networkObj.name = 'bsc';
		network = 'bsc';
	}

	if (networkObj.chainId == 137) {
		networkObj.name = 'polygon';
		network = 'polygon';
	}

	if (networkObj.chainId == 168587773) {
		networkObj.name = 'blastSepolia';
		network = 'blastSepolia';
		proxySUSD = getTargetAddress('ExoticUSD', network);
	}

	let accounts = await ethers.getSigners();
	let owner = accounts[0];

	console.log('Owner is: ' + owner.address);
	console.log('Network:' + network);
	console.log('Network id:' + networkObj.chainId);

	const AddressManager = await ethers.getContractFactory('AddressManager');

	const safeBoxAddress = getTargetAddress('SafeBox', network);
	console.log('safeBoxAddress found at: ', safeBoxAddress);

	const referralsAddress = getTargetAddress('Referrals', network);
	console.log('referralsAddress found at: ', referralsAddress);

	const stakingThalesAddress = getTargetAddress('StakingThales', network) ?? ZERO_ADDRESS;
	console.log('stakingThalesAddress found at: ', stakingThalesAddress);

	const multiCollateralOnOffRampAddress =
		getTargetAddress('MultiCollateralOnOffRamp', network) ?? ZERO_ADDRESS;
	console.log('multiCollateralOnOffRampAddress found at: ', multiCollateralOnOffRampAddress);

	const pythAddress = getTargetAddress('Pyth', network) ?? ZERO_ADDRESS;
	console.log('pythAddress found at: ', pythAddress);

	const speedAMMAddress = getTargetAddress('SpeedMarketsAMM', network);
	console.log('speedAMMAddress found at: ', speedAMMAddress);

	await delay(2000);
	const AddressManagerDeployed = await upgrades.deployProxy(AddressManager, [
		owner.address,
		safeBoxAddress,
		referralsAddress,
		stakingThalesAddress,
		multiCollateralOnOffRampAddress,
		pythAddress,
		speedAMMAddress,
	]);
	await delay(2000);
	await AddressManagerDeployed.deployed();

	console.log('AddressManager Deployed on', AddressManagerDeployed.address);
	setTargetAddress('AddressManager', network, AddressManagerDeployed.address);

	await delay(65000);
	const AddressManagerImplementation = await getImplementationAddress(
		ethers.provider,
		AddressManagerDeployed.address
	);

	console.log('Implementation AddressManager: ', AddressManagerImplementation);
	setTargetAddress('AddressManagerImplementation', network, AddressManagerImplementation);

	await delay(5000);

	try {
		await hre.run('verify:verify', {
			address: AddressManagerImplementation,
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
