const { ethers, upgrades } = require('hardhat');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');

const MINUTE = 60;
const WEEK = 604800;

const { getTargetAddress, setTargetAddress } = require('../helpers');
const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers/src/constants');

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
	if (networkObj.chainId == 420) {
		networkObj.name = 'optimisticGoerli';
		network = 'optimisticGoerli';
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
	} else if (networkObj.chainId == 69) {
		network = 'optimisticKovan';
		thalesAddress = getTargetAddress('OpThales_L2', network);
		ProxyERC20sUSD_address = getTargetAddress('ProxysUSD', network);
	} else {
		thalesAddress = getTargetAddress('OpThales_L2', network);
		ProxyERC20sUSD_address = getTargetAddress('ExoticUSD', network);
	}
	console.log('Thales address: ', thalesAddress);
	console.log('ProxyERC20sUSD address: ', ProxyERC20sUSD_address);

	const ProxyEscrow = await ethers.getContractFactory('EscrowThales');
	const ProxyStaking = await ethers.getContractFactory('StakingThales');

	let ProxyEscrow_deployed = await upgrades.deployProxy(ProxyEscrow, [
		owner.address,
		thalesAddress,
	]);
	await ProxyEscrow_deployed.deployed();
	await delay(5000);

	let ProxyStaking_deployed = await upgrades.deployProxy(ProxyStaking, [
		owner.address,
		ProxyEscrow_deployed.address,
		thalesAddress,
		ProxyERC20sUSD_address,
		durationPeriod,
		unstakeDurationPeriod,
		SNXIssuerAddress,
	]);
	let tx = await ProxyStaking_deployed.deployed();

	console.log('Escrow proxy:', ProxyEscrow_deployed.address);
	console.log('Staking proxy:', ProxyStaking_deployed.address);

	await delay(15000);

	const EscrowImplementation = await getImplementationAddress(
		ethers.provider,
		ProxyEscrow_deployed.address
	);
	const StakingImplementation = await getImplementationAddress(
		ethers.provider,
		ProxyStaking_deployed.address
	);

	console.log('Implementation Escrow: ', EscrowImplementation);
	console.log('Implementation Staking: ', StakingImplementation);

	setTargetAddress('StakingThales', network, ProxyStaking_deployed.address);
	setTargetAddress('EscrowThales', network, ProxyEscrow_deployed.address);
	setTargetAddress('StakingThalesImplementation', network, StakingImplementation);
	setTargetAddress('EscrowThalesImplementation', network, EscrowImplementation);

	await delay(15000);

	let ThalesAMMAddress = getTargetAddress('ThalesAMM', network);
	let PriceFeedAddress = getTargetAddress('PriceFeed', network);
	let SportsAMMAddress = getTargetAddress('SportsAMM', network);
	let ThalesBondsAddress = getTargetAddress('ThalesBonds', network);
	let AddressResolverAddress = getTargetAddress('AddressResolver', network);
	let ThalesStakingRewardsPoolAddress = getTargetAddress('ThalesStakingRewardsPool', network);
	let EscrowContractAddress = getTargetAddress('EscrowThales', network);

	// let ProxyStaking_deployed = ProxyStaking.attach(StakingContractAddress);
	// await delay(5000);

	// tx = await ProxyStaking_deployed.setThalesAMM(ThalesAMMAddress, { from: owner.address });
	// await tx.wait().then(e => {
	// 	console.log('Staking Thales: setThalesAMM ', ThalesAMMAddress);
	// });

	tx = await ProxyStaking_deployed.setAddresses(
		SNXIssuerAddress,
		owner.address,
		owner.address,
		owner.address,
		ThalesBondsAddress,
		SportsAMMAddress,
		PriceFeedAddress,
		ThalesStakingRewardsPoolAddress,
		AddressResolverAddress,
		{ from: owner.address, gasLimit: 5000000 }
	);

	await tx.wait().then((e) => {
		console.log('Staking Thales: setAddresses ');
	});

	try {
		await hre.run('verify:verify', {
			address: EscrowImplementation,
		});
	} catch (e) {
		console.log(e);
	}
	try {
		await hre.run('verify:verify', {
			address: StakingImplementation,
		});
	} catch (e) {
		console.log(e);
	}

	// try {
	// 	await hre.run('verify:verify', {
	// 		address: ProxyEscrow_deployed.address,
	// 	});
	// } catch (e) {
	// 	console.log(e);
	// }
	// try {
	// 	await hre.run('verify:verify', {
	// 		address: ProxyStaking_deployed.address,
	// 	});
	// } catch (e) {
	// 	console.log(e);
	// }
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
