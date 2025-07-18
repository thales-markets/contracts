const { ethers, upgrades } = require('hardhat');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');
const { getTargetAddress, setTargetAddress } = require('../helpers');

async function main() {
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;

	let proxySUSD;
	let speedMarketsAMM;
	let chainedSpeedMarketsAMM;
	let addressManager;

	if (network === 'unknown') {
		network = 'localhost';
	}

	if (network == 'homestead') {
		network = 'mainnet';
	}

	if (networkObj.chainId == 10) {
		networkObj.name = 'optimisticEthereum';
		network = 'optimisticEthereum';
		proxySUSD = getTargetAddress('ProxysUSD', network);
	}

	if (networkObj.chainId == 420) {
		networkObj.name = 'optimisticGoerli';
		network = 'optimisticGoerli';
		proxySUSD = getTargetAddress('ExoticUSD', network);
	}

	if (networkObj.chainId == 42161) {
		networkObj.name = 'arbitrumOne';
		network = 'arbitrumOne';
		proxySUSD = getTargetAddress('ProxyUSDC', network);
	}

	if (networkObj.chainId == 8453) {
		networkObj.name = 'baseMainnet';
		network = 'baseMainnet';
		proxySUSD = getTargetAddress('ProxyUSDC', network);
	}

	if (networkObj.chainId == 56) {
		networkObj.name = 'bsc';
		network = 'bsc';
		proxySUSD = getTargetAddress('BUSD', network);
	}

	if (networkObj.chainId == 137) {
		networkObj.name = 'polygon';
		network = 'polygon';
		proxySUSD = getTargetAddress('ProxyUSDC', network);
	}

	if (networkObj.chainId == 168587773) {
		networkObj.name = 'blastSepolia';
		network = 'blastSepolia';
		proxySUSD = getTargetAddress('ExoticUSD', network);
	}

	if (networkObj.chainId == 11155420) {
		networkObj.name = 'optimisticSepolia';
		network = 'optimisticSepolia';
		proxySUSD = getTargetAddress('ExoticUSD', network);
	}

	let accounts = await ethers.getSigners();
	let owner = accounts[0];

	console.log('Owner is: ' + owner.address);
	console.log('Network:' + network);
	console.log('Network id:' + networkObj.chainId);

	// Get required contract addresses
	speedMarketsAMM = getTargetAddress('SpeedMarketsAMM', network);
	chainedSpeedMarketsAMM = getTargetAddress('ChainedSpeedMarketsAMM', network);
	addressManager = getTargetAddress('AddressManager', network);

	console.log('SpeedMarketsAMM address:', speedMarketsAMM);
	console.log('ChainedSpeedMarketsAMM address:', chainedSpeedMarketsAMM);
	console.log('AddressManager address:', addressManager);

	// Verify required addresses exist
	if (!speedMarketsAMM || speedMarketsAMM === '') {
		throw new Error('SpeedMarketsAMM address not found for network: ' + network);
	}
	if (!addressManager || addressManager === '') {
		throw new Error('AddressManager address not found for network: ' + network);
	}

	// Deploy SpeedMarketsAMMResolver
	const SpeedMarketsAMMResolver = await ethers.getContractFactory('SpeedMarketsAMMResolver');
	let SpeedMarketsAMMResolverDeployed = await upgrades.deployProxy(SpeedMarketsAMMResolver, [
		owner.address,
		speedMarketsAMM,
		addressManager,
	]);
	await SpeedMarketsAMMResolverDeployed.deployed();

	console.log('SpeedMarketsAMMResolver proxy:', SpeedMarketsAMMResolverDeployed.address);

	const SpeedMarketsAMMResolverImplementation = await getImplementationAddress(
		ethers.provider,
		SpeedMarketsAMMResolverDeployed.address
	);

	console.log('Implementation SpeedMarketsAMMResolver: ', SpeedMarketsAMMResolverImplementation);

	setTargetAddress('SpeedMarketsAMMResolver', network, SpeedMarketsAMMResolverDeployed.address);
	setTargetAddress(
		'SpeedMarketsAMMResolverImplementation',
		network,
		SpeedMarketsAMMResolverImplementation
	);

	// Wait before verification
	await delay(5000);

	// Additional setup if ChainedSpeedMarketsAMM exists
	if (chainedSpeedMarketsAMM && chainedSpeedMarketsAMM !== '') {
		console.log('Setting ChainedSpeedMarketsAMM in resolver...');
		try {
			const resolver = await ethers.getContractAt(
				'SpeedMarketsAMMResolver',
				SpeedMarketsAMMResolverDeployed.address
			);
			const tx = await resolver.setChainedSpeedMarketsAMM(chainedSpeedMarketsAMM);
			await tx.wait();
			console.log('ChainedSpeedMarketsAMM set successfully');
		} catch (e) {
			console.log('Error setting ChainedSpeedMarketsAMM:', e.message);
		}
	}

	// Setup multicollateral approval
	console.log('Setting up multicollateral approval...');
	try {
		const resolver = await ethers.getContractAt(
			'SpeedMarketsAMMResolver',
			SpeedMarketsAMMResolverDeployed.address
		);
		const MAX_APPROVAL = ethers.constants.MaxUint256;
		const tx = await resolver.setupMultiCollateralApproval(MAX_APPROVAL);
		await tx.wait();
		console.log('Multicollateral approval set successfully');
	} catch (e) {
		console.log('Error setting multicollateral approval:', e.message);
	}

	// Verify contract
	try {
		await hre.run('verify:verify', {
			address: SpeedMarketsAMMResolverImplementation,
		});
	} catch (e) {
		console.log(e);
	}

	// Print deployment summary
	console.log('\n=== Deployment Summary ===');
	console.log('SpeedMarketsAMMResolver Proxy:', SpeedMarketsAMMResolverDeployed.address);
	console.log('SpeedMarketsAMMResolver Implementation:', SpeedMarketsAMMResolverImplementation);
	console.log('\n=== Next Steps ===');
	console.log('1. Update AddressManager with resolver address:');
	console.log(
		`   AddressManager.setAddressInAddressBook("SpeedMarketsAMMResolver", "${SpeedMarketsAMMResolverDeployed.address}")`
	);
	console.log('2. Configure MultiCollateralOnOffRamp to whitelist resolver:');
	console.log(
		`   MultiCollateralOnOffRamp.setAMM("${SpeedMarketsAMMResolverDeployed.address}", true)`
	);
	console.log('3. Upgrade SpeedMarketsAMM and ChainedSpeedMarketsAMM implementations');
	console.log('4. Re-enable multicollateral on both AMMs if needed');
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
