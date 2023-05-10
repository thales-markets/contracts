const path = require('path');
const { ethers, upgrades } = require('hardhat');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');

const { getTargetAddress, setTargetAddress } = require('../../helpers');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	let mainnetNetwork = 'mainnet';
	let PaymentToken;

	if (network == 'homestead') {
		console.log(
			"Error L1 network used! Deploy only on L2 Optimism. \nTry using '--network optimistic'"
		);
		return 0;
	}
	if (networkObj.chainId == 42) {
		networkObj.name = 'kovan';
		network = 'kovan';
		PaymentToken = getTargetAddress('ExoticUSD', network);
	}
	if (networkObj.chainId == 69) {
		networkObj.name = 'optimisticKovan';
		network = 'optimisticKovan';
		mainnetNetwork = 'kovan';
		PaymentToken = getTargetAddress('ExoticUSD', network);
	}
	if (networkObj.chainId == 420) {
		networkObj.name = 'optimisticGoerli';
		network = 'optimisticGoerli';
		PaymentToken = getTargetAddress('ExoticUSD', network);
	}
	if (networkObj.chainId == 10) {
		networkObj.name = 'optimisticEthereum';
		network = 'optimisticEthereum';
		PaymentToken = getTargetAddress('ProxysUSD', network);
	}
	if (networkObj.chainId == 5) {
		networkObj.name = 'goerli';
		network = 'goerli';
		PaymentToken = getTargetAddress('ExoticUSD', network);
	}

	if (networkObj.chainId == 42161) {
		networkObj.name = 'arbitrumOne';
		network = 'arbitrumOne';
		PaymentToken = getTargetAddress('ProxysUSD', network);
	}

	const SportMarketData = await ethers.getContractFactory('SportPositionalMarketData');
	const SportMarketManagerAddress = getTargetAddress('SportPositionalMarketManager', network);
	const SportsAMMAddress = getTargetAddress('SportsAMM', network);
	const TherundownConsumerAddress = getTargetAddress('TherundownConsumer', network);
	const GamesOddsObtainerAddress = getTargetAddress('GamesOddsObtainer', network);
	const OvertimeVoucherEscrowAddress = getTargetAddress('OvertimeVoucherEscrow', network);

	const SportMarketDataDeployed = await upgrades.deployProxy(SportMarketData, [owner.address]);
	await SportMarketDataDeployed.deployed();

	console.log('SportMarketData Deployed on', SportMarketDataDeployed.address);
	setTargetAddress('SportPositionalMarketData', network, SportMarketDataDeployed.address);

	await delay(5000);
	const SportMarketDataImplementation = await getImplementationAddress(
		ethers.provider,
		SportMarketDataDeployed.address
	);

	console.log('Implementation SportMarketData: ', SportMarketDataImplementation);
	setTargetAddress(
		'SportPositionalMarketDataImplementation',
		network,
		SportMarketDataImplementation
	);

	await delay(5000);
	await SportMarketDataDeployed.setSportPositionalMarketManager(SportMarketManagerAddress, {
		from: owner.address,
	});
	await delay(5000);
	await SportMarketDataDeployed.setSportsAMM(SportsAMMAddress, { from: owner.address });
	await delay(5000);
	await SportMarketDataDeployed.setConsumer(TherundownConsumerAddress, { from: owner.address });
	await delay(5000);
	await SportMarketDataDeployed.setOddsObtainer(GamesOddsObtainerAddress, { from: owner.address });
	await delay(5000);
	await SportMarketDataDeployed.setVoucherEscrow(OvertimeVoucherEscrowAddress, {
		from: owner.address,
	});
	await delay(5000);

	// try {
	// 	await hre.run('verify:verify', {
	// 		address: SportMarketDataDeployed.address,
	// 	});
	// } catch (e) {
	// 	console.log(e);
	// }

	try {
		await hre.run('verify:verify', {
			address: SportMarketDataImplementation,
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
