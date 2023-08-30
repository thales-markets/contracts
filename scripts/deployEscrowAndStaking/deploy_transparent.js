const { ethers, upgrades } = require('hardhat');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');
const w3utils = require('web3-utils');

const MINUTE = 60;
const WEEK = 604800;

const { getTargetAddress, setTargetAddress } = require('../helpers');
const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers/src/constants');

const user_key1 = process.env.PRIVATE_KEY;

async function main() {
	let thalesAddress, ProxyERC20sUSD_address;
	let durationPeriod, unstakeDurationPeriod;
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	if (networkObj.chainId == 10) {
		networkObj.name = 'optimisticEthereum';
		network = 'optimisticEthereum';
	}
	if (networkObj.chainId == 42161) {
		networkObj.name = 'arbitrumOne';
		network = 'arbitrumOne';
		durationPeriod = WEEK;
		unstakeDurationPeriod = WEEK;
		thalesAddress = getTargetAddress('ThalesToken', network);
		ProxyERC20sUSD_address = getTargetAddress('ProxyUSDC', network);
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
	if (network == 'homestead') {
		console.log('Setting duration to WEEK');
		network = 'mainnet';
		durationPeriod = WEEK;
		unstakeDurationPeriod = WEEK;
	} else {
		// console.log('Setting duration to MINUTE');
		// durationPeriod = MINUTE;
		// unstakeDurationPeriod = MINUTE;
	}
	if (networkObj.chainId == 8453) {
		networkObj.name = 'baseMainnet';
		network = 'baseMainnet';
		durationPeriod = WEEK;
		unstakeDurationPeriod = WEEK;
		thalesAddress = getTargetAddress('ThalesToken', network);
		ProxyERC20sUSD_address = getTargetAddress('ProxyUSDC', network);
	}

	SNXIssuerAddress = getTargetAddress('SNXIssuer', network);
	const owner = new ethers.Wallet(user_key1, ethers.provider);

	console.log('Owner is:' + owner.address);
	console.log('Network name:' + network);
	console.log('SNXIssuer address: ' + SNXIssuerAddress);

	if (networkObj.chainId == 10) {
		thalesAddress = getTargetAddress('OpThales_L2', network);
		ProxyERC20sUSD_address = getTargetAddress('ProxysUSD', network);
	} else if (networkObj.chainId == 69) {
		network = 'optimisticKovan';
		thalesAddress = getTargetAddress('OpThales_L2', network);
		ProxyERC20sUSD_address = getTargetAddress('ProxysUSD', network);
	} else if (networkObj.chainId == 420) {
		thalesAddress = getTargetAddress('OpThales_L2', network);
		ProxyERC20sUSD_address = getTargetAddress('ExoticUSD', network);
	} else {
		//do nothing
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
		ZERO_ADDRESS,
	]);
	let tx = await ProxyStaking_deployed.deployed();

	console.log('Escrow proxy:', ProxyEscrow_deployed.address);
	console.log('Staking proxy:', ProxyStaking_deployed.address);

	await delay(10000);

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

	console.log('Deploying ThalesStakingPool');

	const ThalesStakingRewardsPool = await ethers.getContractFactory('ThalesStakingRewardsPool');
	let ThalesStakingRewardsPoolDeployed = await upgrades.deployProxy(ThalesStakingRewardsPool, [
		owner.address,
		ProxyStaking_deployed.address,
		thalesAddress,
		ProxyEscrow_deployed.address,
	]);
	await ThalesStakingRewardsPoolDeployed.deployed();

	console.log('ThalesStakingRewardsPool proxy:', ThalesStakingRewardsPoolDeployed.address);

	const ThalesStakingRewardsPoolImplementation = await getImplementationAddress(
		ethers.provider,
		ThalesStakingRewardsPoolDeployed.address
	);

	console.log('Implementation ThalesStakingRewardsPool: ', ThalesStakingRewardsPoolImplementation);

	setTargetAddress('ThalesStakingRewardsPool', network, ThalesStakingRewardsPoolDeployed.address);
	setTargetAddress(
		'ThalesStakingRewardsPoolImplementation',
		network,
		ThalesStakingRewardsPoolImplementation
	);

	let ThalesAMMAddress = getTargetAddress('ThalesAMM', network);
	let RangedAMMAddress = getTargetAddress('RangedAMM', network);
	// let SportsAMMAddress = getTargetAddress('SportsAMM', network);
	let ThalesAMMLiquidityPoolAddress = getTargetAddress('ThalesAMMLiquidityPool', network);
	let ThalesStakingRewardsPoolAddress = getTargetAddress('ThalesStakingRewardsPool', network);

	console.log('Setting addresses... ');

	tx = await ProxyStaking_deployed.setAddresses(
		ZERO_ADDRESS,
		ThalesAMMAddress,
		RangedAMMAddress,
		ZERO_ADDRESS,
		ZERO_ADDRESS,
		ThalesStakingRewardsPoolAddress,
		ZERO_ADDRESS,
		ZERO_ADDRESS,
		ThalesAMMLiquidityPoolAddress,
		ZERO_ADDRESS,
		ZERO_ADDRESS,
		{ from: owner.address, gasLimit: 5000000 }
	);

	await tx.wait().then((e) => {
		console.log('Staking Thales: setAddresses ');
	});

	delay(1000);

	console.log('Setting parameters... ');
	const fixedReward = w3utils.toWei('20000', 'ether');
	const extraReward = w3utils.toWei('10000', 'ether');
	const maxAMMPercentage = '50';
	const AMMMultiplier = '2';

	tx = await ProxyStaking_deployed.setStakingRewardsParameters(
		fixedReward,
		extraReward,
		true,
		0,
		maxAMMPercentage,
		0,
		0,
		AMMMultiplier,
		{ from: owner.address, gasLimit: 5000000 }
	);
	await tx.wait().then((e) => {
		console.log('Staking Thales: setStakingRewardsParameters ');
	});
	delay(1000);

	tx = await ProxyStaking_deployed.setStakingParameters(true, false, WEEK, WEEK, false, {
		from: owner.address,
	});
	await tx.wait().then((e) => {
		console.log('Staking Thales: setThalesAMM ', ThalesAMMAddress);
	});
	delay(1000);

	// const EscrowImplementation = await getImplementationAddress(
	// 	ethers.provider,
	// 	EscrowAddress
	// );
	// const StakingImplementation = await getImplementationAddress(
	// 	ethers.provider,
	// 	StakingAddress
	// );
	// const ThalesStakingRewardsPoolImplementation = await getImplementationAddress(
	// 	ethers.provider,
	// 	ThalesStakingRewardsPoolAddress
	// );

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

	try {
		await hre.run('verify:verify', {
			address: ThalesStakingRewardsPoolImplementation,
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
