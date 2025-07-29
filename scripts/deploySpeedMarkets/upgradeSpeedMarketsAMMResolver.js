const { ethers, upgrades } = require('hardhat');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');
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
	if (networkObj.chainId == 420) {
		networkObj.name = 'optimisticGoerli';
		network = 'optimisticGoerli';
	}
	if (networkObj.chainId == 5) {
		networkObj.name = 'goerli';
		network = 'goerli';
	}

	console.log('Account is:', owner.address);
	console.log('Network name:', network);

	// Get existing proxy address
	const SpeedMarketsAMMResolverAddress = getTargetAddress('SpeedMarketsAMMResolver', network);

	if (!SpeedMarketsAMMResolverAddress) {
		throw new Error(
			`SpeedMarketsAMMResolver address not found in deployments.json for network: ${network}`
		);
	}

	console.log('SpeedMarketsAMMResolver proxy address:', SpeedMarketsAMMResolverAddress);

	const SpeedMarketsAMMResolver = await ethers.getContractFactory('SpeedMarketsAMMResolver');

	// Upgrade logic differs based on network
	if (
		networkObj.chainId == 42 ||
		networkObj.chainId == 5 ||
		networkObj.chainId == 420 ||
		networkObj.chainId == 168587773 ||
		networkObj.chainId == 11155420
	) {
		// For test networks, directly upgrade the proxy
		await upgrades.upgradeProxy(SpeedMarketsAMMResolverAddress, SpeedMarketsAMMResolver);
		await delay(15000);

		const SpeedMarketsAMMResolverImplementation = await getImplementationAddress(
			ethers.provider,
			SpeedMarketsAMMResolverAddress
		);
		console.log('SpeedMarketsAMMResolver upgraded');

		console.log('Implementation SpeedMarketsAMMResolver:', SpeedMarketsAMMResolverImplementation);
		setTargetAddress(
			'SpeedMarketsAMMResolverImplementation',
			network,
			SpeedMarketsAMMResolverImplementation
		);

		try {
			await hre.run('verify:verify', {
				address: SpeedMarketsAMMResolverImplementation,
			});
			console.log('Contract verified on Etherscan');
		} catch (e) {
			console.log('Verification failed:', e);
		}
	}

	if (
		networkObj.chainId == 10 ||
		networkObj.chainId == 42161 ||
		networkObj.chainId == 137 ||
		networkObj.chainId == 56 ||
		networkObj.chainId == 8453
	) {
		// For mainnet networks, prepare upgrade for multisig execution
		const implementation = await upgrades.prepareUpgrade(
			SpeedMarketsAMMResolverAddress,
			SpeedMarketsAMMResolver
		);
		await delay(5000);

		console.log('SpeedMarketsAMMResolver upgrade prepared');

		console.log('Implementation SpeedMarketsAMMResolver:', implementation);
		setTargetAddress('SpeedMarketsAMMResolverImplementation', network, implementation);

		try {
			await hre.run('verify:verify', {
				address: implementation,
			});
			console.log('Implementation contract verified on Etherscan');
		} catch (e) {
			console.log('Verification failed:', e);
		}

		console.log('\n=== Next Steps for Mainnet ===');
		console.log(
			'Execute the upgrade through the multisig/proxy admin to point to the new implementation:',
			implementation
		);
	}

	// Get current resolver state for verification
	console.log('\n=== Current Resolver Configuration ===');
	const resolver = await ethers.getContractAt(
		'SpeedMarketsAMMResolver',
		SpeedMarketsAMMResolverAddress
	);

	try {
		const speedMarketsAMM = await resolver.speedMarketsAMM();
		console.log('SpeedMarketsAMM:', speedMarketsAMM);

		const addressManager = await resolver.addressManager();
		console.log('AddressManager:', addressManager);

		const chainedSpeedMarketsAMM = await resolver.chainedSpeedMarketsAMM();
		console.log('ChainedSpeedMarketsAMM:', chainedSpeedMarketsAMM);
	} catch (e) {
		console.log('Error reading resolver configuration:', e.message);
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
