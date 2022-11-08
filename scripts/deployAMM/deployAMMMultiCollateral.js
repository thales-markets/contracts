const { ethers, upgrades } = require('hardhat');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');
const snx = require('synthetix-2.50.4-ovm');
const { artifacts, contract, web3 } = require('hardhat');
const { getTargetAddress, setTargetAddress } = require('../helpers');
const { toBytes32 } = require('../../index');
const w3utils = require('web3-utils');

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

	if (networkObj.chainId == 10) {
		ProxyERC20sUSDaddress = getTargetAddress('ProxysUSD', network);
	} else if (networkObj.chainId == 69) {
		networkObj.name = 'optimisticKovan';
		ProxyERC20sUSDaddress = getTargetAddress('ProxysUSD', network);
	} else if (networkObj.chainId == 80001 || networkObj.chainId == 137) {
		ProxyERC20sUSDaddress = getTargetAddress('ProxyUSDC', network);
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

	let deciMathAddress = getTargetAddress('DeciMath', network);

	const hour = 60 * 60;
	const ThalesAMM = await ethers.getContractFactory('ThalesAMM');
	let ThalesAMM_deployed = await upgrades.deployProxy(ThalesAMM, [
		owner.address,
		priceFeedAddress,
		ProxyERC20sUSDaddress,
		w3utils.toWei('30'),
		deciMathAddress,
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

	setTargetAddress('ThalesAMMMultiCollateral', network, ThalesAMM_deployed.address);
	setTargetAddress('ThalesAMMImplementationMultiCollateral', network, ThalesAMMImplementation);

	let managerAddress = getTargetAddress('PositionalMarketManager', network);

	await delay(5000);

	let tx = await ThalesAMM_deployed.setPositionalMarketManager(managerAddress);
	await tx.wait().then((e) => {
		console.log('ThalesAMM: setPositionalMarketManager');
	});

	await delay(5000);

	let curveSusdAddresss = getTargetAddress('CurveSUSD', network);
	let DAI = getTargetAddress('DAI', network);
	let USDC = getTargetAddress('USDC', network);
	let USDT = getTargetAddress('USDT', network);

	tx = await ThalesAMM_deployed.setCurveSUSD(curveSusdAddresss, DAI, USDC, USDT);
	await tx.wait().then((e) => {
		console.log('ThalesAMM: setCurveSUSD');
	});

	await delay(5000);

	tx = await ThalesAMM_deployed.setImpliedVolatilityPerAsset(toBytes32('ETH'), w3utils.toWei('95'));
	await tx.wait().then((e) => {
		console.log('ThalesAMM: setImpliedVolatilityPerAsset(ETH, 95)');
	});

	await delay(5000);

	tx = await ThalesAMM_deployed.setImpliedVolatilityPerAsset(toBytes32('BTC'), w3utils.toWei('85'));
	await tx.wait().then((e) => {
		console.log('ThalesAMM: setImpliedVolatilityPerAsset(BTC, 85)');
	});

	await delay(5000);
	const safeBox = getTargetAddress('SafeBox', network);
	const safeBoxImpact = w3utils.toWei('0.01');
	tx = await ThalesAMM_deployed.setSafeBoxData(safeBox, safeBoxImpact);
	await tx.wait().then((e) => {
		console.log('ThalesAMM: safeBoxImpact()');
	});

	await delay(5000);

	const minPrice = w3utils.toWei('0.10');
	const maxPrice = w3utils.toWei('0.90');
	tx = await ThalesAMM_deployed.setMinMaxSupportedPrice(minPrice, maxPrice);
	await tx.wait().then((e) => {
		console.log('ThalesAMM: setMinMaxSupportedPrice()');
	});

	await delay(10000);

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
