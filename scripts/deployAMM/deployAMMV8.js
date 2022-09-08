const { ethers, upgrades } = require('hardhat');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');
const snx = require('synthetix-2.50.4-ovm');
const { artifacts, contract, web3 } = require('hardhat');
const { getTargetAddress, setTargetAddress } = require('../helpers');
const { toBytes32 } = require('../../index');
const w3utils = require('web3-utils');
const ZERO_ADDRESS = '0x' + '0'.repeat(40);

async function main() {
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	let priceFeedAddress, ProxyERC20sUSDaddress;

	if (network == 'homestead') {
		network = 'mainnet';
	}

	if (networkObj.chainId == 69) {
		networkObj.name = 'optimisticKovan';
		network = 'optimisticKovan';
	}

	if (networkObj.chainId == 10) {
		networkObj.name = 'optimisticEthereum';
		network = 'optimisticEthereum';
	}

	if (networkObj.chainId == 80001) {
		networkObj.name = 'polygonMumbai';
		network = 'polygonMumbai';
	}

	if (networkObj.chainId == 137) {
		networkObj.name = 'polygon';
		network = 'polygon';
	}

	if (networkObj.chainId == 56) {
		networkObj.name = 'bsc';
		network = 'bsc';
	}

	if (networkObj.chainId == 42161) {
		networkObj.name = 'arbitrumOne';
		network = 'arbitrumOne';
	}

	if (networkObj.chainId == 10) {
		ProxyERC20sUSDaddress = getTargetAddress('ProxysUSD', network);
	} else if (networkObj.chainId == 69) {
		networkObj.name = 'optimisticKovan';
		ProxyERC20sUSDaddress = getTargetAddress('ProxysUSD', network);
	} else if (
		networkObj.chainId == 80001 ||
		networkObj.chainId == 137 ||
		networkObj.chainId == 42161
	) {
		ProxyERC20sUSDaddress = getTargetAddress('ProxyUSDC', network);
	} else if (networkObj.chainId == 56) {
		ProxyERC20sUSDaddress = getTargetAddress('BUSD', network);
	} else {
		const ProxyERC20sUSD = snx.getTarget({ network, contract: 'ProxyERC20sUSD' });
		ProxyERC20sUSDaddress = ProxyERC20sUSD.address;
	}

	const user_key1 = process.env.PRIVATE_KEY;
	const owner = new ethers.Wallet(user_key1, ethers.provider);

	console.log('Owner is: ' + owner.address);
	console.log('Network:' + network);
	console.log('Network id:' + networkObj.chainId);

	priceFeedAddress = getTargetAddress('PriceFeed', network);
	console.log('Found PriceFeed at:' + priceFeedAddress);

	await delay(5000);

	const hour = 60 * 60;
	const ThalesAMM = await ethers.getContractFactory('ThalesAMM');
	let ThalesAMM_deployed = await upgrades.deployProxy(ThalesAMM, [
		owner.address,
		priceFeedAddress,
		ProxyERC20sUSDaddress,
		w3utils.toWei('100'),
		ZERO_ADDRESS,
		w3utils.toWei('0.02'),
		w3utils.toWei('0.20'),
		hour * 24,
	]);
	await ThalesAMM_deployed.deployed();

	console.log('ThalesAMM proxy:', ThalesAMM_deployed.address);

	const ThalesAMMImplementation = await getImplementationAddress(
		ethers.provider,
		ThalesAMM_deployed.address
	);

	console.log('Implementation ThalesAMM: ', ThalesAMMImplementation);

	setTargetAddress('ThalesAMM', network, ThalesAMM_deployed.address);
	setTargetAddress('ThalesAMMImplementation', network, ThalesAMMImplementation);

	let managerAddress = getTargetAddress('PositionalMarketManager', network);

	const PositionalMarketFactory = await ethers.getContractFactory('PositionalMarketFactory');
	let factoryAddress = getTargetAddress('PositionalMarketFactory', network);
	const PositionalMarketFactoryInstance = await PositionalMarketFactory.attach(factoryAddress);

	await delay(5000);

	let tx = await ThalesAMM_deployed.setPositionalMarketManager(managerAddress);
	await tx.wait().then((e) => {
		console.log('ThalesAMM: setPositionalMarketManager');
	});

	tx = await ThalesAMM_deployed.setImpliedVolatilityPerAsset(
		toBytes32('ETH'),
		w3utils.toWei('130')
	);
	await tx.wait().then((e) => {
		console.log('ThalesAMM: setImpliedVolatilityPerAsset(ETH, 130)');
	});

	await delay(5000);

	tx = await ThalesAMM_deployed.setImpliedVolatilityPerAsset(toBytes32('BTC'), w3utils.toWei('96'));
	await tx.wait().then((e) => {
		console.log('ThalesAMM: setImpliedVolatilityPerAsset(BTC, 96)');
	});

	await delay(5000);

	tx = await PositionalMarketFactoryInstance.setThalesAMM(ThalesAMM_deployed.address);
	await tx.wait().then((e) => {
		console.log('PositionalMarketFactoryInstance: setThalesAMM');
	});

	await delay(5000);
	const safeBoxImpact = w3utils.toWei('0.01');
	const safeBox = getTargetAddress('SafeBox', network);
	tx = await ThalesAMM_deployed.setSafeBoxData(safeBox, safeBoxImpact);
	await tx.wait().then((e) => {
		console.log('ThalesAMM: setSafeBox()');
	});

	await delay(5000);

	tx = await ThalesAMM_deployed.setMinMaxSupportedPriceAndCap(
		w3utils.toWei('0.1'),
		w3utils.toWei('0.9'),
		w3utils.toWei('5000')
	);
	await tx.wait().then((e) => {
		console.log('ThalesAMM: setMinMaxSupportedPriceAndCap()');
	});

	const referralImpact = w3utils.toWei('0.01');
	const referrals = getTargetAddress('Referrals', network);
	tx = await ThalesAMM_deployed.setStakingThalesAndReferrals(
		ZERO_ADDRESS,
		referrals,
		referralImpact
	);
	await tx.wait().then((e) => {
		console.log('ThalesAMM: setStakingThalesAndReferrals()');
	});
	await delay(5000);
	try {
		await hre.run('verify:verify', {
			address: ThalesAMMImplementation,
		});
	} catch (e) {
		console.log(e);
	}

	try {
		await hre.run('verify:verify', {
			address: ThalesAMM_deployed.address,
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
