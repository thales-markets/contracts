const { ethers } = require('hardhat');
const w3utils = require('web3-utils');

const MINUTE = 60;
const WEEK = 604800;

const fs = require('fs');
const { getTargetAddress } = require('../helpers');

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

	const maxSNXPercentage = '15';
	const maxAMMPercentage = '12';
	const maxRoyalePercentage = '3';
	const AMMMultiplier = '10';
	const SNXMultiplier = '1';
	const fixedReward = w3utils.toWei('70000', 'ether');
	const extraReward = w3utils.toWei('21000', 'ether');

	const ThalesStakingRewardsPoolAddress = getTargetAddress('ThalesStakingRewardsPool', network);

	const ProxyStaking = await ethers.getContractFactory('StakingThales');
	let StakingThalesAddress = getTargetAddress('StakingThales', network);

	const ProxyEscrow = await ethers.getContractFactory('EscrowThales');
	let EscrowThalesAddress = getTargetAddress('EscrowThales', network);

	const StakingThales = await ProxyStaking.attach(StakingThalesAddress);
	console.log('StakingThales attached on: ', StakingThales.address);

	const EscrowThales = await ProxyEscrow.attach(EscrowThalesAddress);
	console.log('EscrowThales attached on: ', EscrowThales.address);

	let ThalesAMMAddress = getTargetAddress('ThalesAMM', network);
	let ThalesRoyaleAddress = getTargetAddress('ThalesRoyale', network);
	let PriceFeedAddress = getTargetAddress('PriceFeed', network);
	let ExoticBondsAddress = getTargetAddress('ThalesBonds', network);

	delay(1000);

	tx = await StakingThales.setStakingRewardsParameters(
		fixedReward,
		extraReward,
		true,
		maxSNXPercentage,
		maxAMMPercentage,
		maxRoyalePercentage,
		SNXMultiplier,
		AMMMultiplier,
		{ from: owner.address }
	);
	await tx.wait().then((e) => {
		console.log('Staking Thales: setThalesAMM ', ThalesAMMAddress);
	});
	delay(1000);

	tx = await StakingThales.setStakingParameters(true, false, MINUTE, MINUTE, false, {
		from: owner.address,
	});
	await tx.wait().then((e) => {
		console.log('Staking Thales: setThalesAMM ', ThalesAMMAddress);
	});
	delay(1000);

	// delay(1000);

	// tx = await EscrowThales.setStakingThalesContract(StakingThales.address, { from: owner.address });
	// await tx.wait().then(e => {
	// 	console.log('Escrow Thales: setStakingThalesContract ', StakingThales.address);
	// });
	// delay(1000);
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
