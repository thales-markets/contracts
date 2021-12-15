// DEPRECATED!! DON'T USE!!!

const { ethers } = require('hardhat');

const w3utils = require('web3-utils');

const { toBytes32 } = require('../../index');

const { getTargetAddress, setTargetAddress, encodeCall } = require('../helpers');

async function main() {

    /* ========== GETTING OWNER AND NETWORK ========== */

	//let accounts = await ethers.getSigners();
	//let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	const privateKey1 = process.env.PRIVATE_KEY;
	const privateKey2 = process.env.PRIVATE_KEY_2;

	if (network === 'unknown') {
		network = 'localhost';
	}

	if (network == 'homestead') {
		network = 'mainnet';
	}
	if (networkObj.chainId == 69) {
		networkObj.name = 'optimisticKovan';
		network = 'optimisticKovan';
	}
	if (networkObj.chainId == 10) {
		networkObj.name = 'optimistic';
		network = 'optimistic';
	}

	const proxyOwner = new ethers.Wallet(privateKey1, ethers.provider);
	const owner = new ethers.Wallet(privateKey2, ethers.provider);
	
	console.log('Owner is: ' + owner.address);
	console.log('ProxyOwner is: ' + proxyOwner.address);
	console.log('Network:' + network);
	console.log('Network id:' + networkObj.chainId);

    /* ========== PROPERTIES FOR INITIALIZE ========== */

	const priceFeed = await ethers.getContractFactory('PriceFeed');
	let priceFeedAddress = getTargetAddress('PriceFeed', network);
	// TODO change reward token address to sUSD
	let rewardTokenAddress = getTargetAddress('PriceFeed', network);

	const min = 60;
	const hour = 60 * 60;
	const day = 24 * 60 * 60;
	const week = 7 * 24 * 60 * 60;

	const asset = toBytes32('ETH');

	const signUpPeriod = day * 3;
	const roundChoosingLength = hour * 8;
	const roundLength = day;
	const claimTime = week;
	const pauseBetweenSeasonsTime = hour * 24;

	const season = 1;
	const zeroAmount = 0;
	const rounds = 6;
	const buyIn = w3utils.toWei('10');

    /* ========== DEPLOYMENT ========== */

	// Dev env - deploy Thales.sol; Live env - use Thales.sol contract address
	const ThalesRoyale = await ethers.getContractFactory('ThalesRoyale');

	const OwnedUpgradeabilityProxy = await ethers.getContractFactory('OwnedUpgradeabilityProxy');
	const OwnedUpgradeabilityProxyDeployed = await OwnedUpgradeabilityProxy.connect(proxyOwner).deploy();

	await OwnedUpgradeabilityProxyDeployed.deployed();
	console.log('Owned proxy deployed on:', OwnedUpgradeabilityProxyDeployed.address);

	const ThalesRoyaleConnected = await ThalesRoyale.connect(proxyOwner);
	console.log("ThalesRoyale ready to deploy: ", ThalesRoyaleConnected.signer._isSigner);

	const ThalesRoyaleDeployed = await ThalesRoyaleConnected.deploy();
	await ThalesRoyaleDeployed.deployed();

	console.log('Thales Royale logic contract deployed on:', ThalesRoyaleDeployed.address);
	setTargetAddress('Thales Royale', network, ThalesRoyaleDeployed.address);

	initializeRoyaleData = encodeCall(
		'initialize',
		['address', 'bytes32', 'address', 'uint', 'address', // 5
		'uint','uint', 'uint', 'uint', 'uint', // 5
		'uint', 'uint','bool', 'uint'], // 4
		[
			owner.address, 			//1
			asset, 					//2
			priceFeedAddress,		//3
			zeroAmount,				//4
			rewardTokenAddress,		//5
			rounds,					//6
			signUpPeriod,			//7
			roundChoosingLength,	//8
			roundLength,			//9
			claimTime,				//10
			season, 				//11
			buyIn,					//12
			false,					//13
			pauseBetweenSeasonsTime	//14
		]
	);

	let tx = await OwnedUpgradeabilityProxyDeployed.upgradeToAndCall(
		ThalesRoyaleDeployed.address, initializeRoyaleData);
	
	await tx.wait().then(e => {
		console.log('Proxy updated');
	});

    /* ========== VEFIFICATION ========== */

	await hre.run('verify:verify', {
		address: ThalesRoyaleDeployed.address,
		constructorArguments: [
		],
	});
}

    /* ========== MAIN ========== */

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});