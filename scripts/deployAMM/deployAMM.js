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
		networkObj.name = 'optimistic';
		network = 'optimistic';
	}

	if (networkObj.chainId == 10) {
		ProxyERC20sUSDaddress = getTargetAddress('ProxysUSD', network);
	} else if (networkObj.chainId == 69) {
		networkObj.name = 'optimisticKovan';
		ProxyERC20sUSDaddress = getTargetAddress('ProxysUSD', network);
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

	const DeciMath = await ethers.getContractFactory('DeciMath');
	const deciMath = await DeciMath.deploy();
	await deciMath.deployed();

	console.log('DeciMath deployed to:', deciMath.address);
	setTargetAddress('DeciMath', network, deciMath.address);


	const hour = 60 * 60;
	const ThalesAMM = await ethers.getContractFactory('ThalesAMM');
	let ThalesAMM_deployed = await upgrades.deployProxy(ThalesAMM, [
		owner.address,
		priceFeedAddress,
		ProxyERC20sUSDaddress,
		w3utils.toWei('1000'),
		deciMath.address,
		w3utils.toWei('0.01'),
		w3utils.toWei('0.05'),
		hour*2
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

	let managerAddress = getTargetAddress('BinaryOptionMarketManager', network);

	const BinaryOptionMarketFactory = await ethers.getContractFactory('BinaryOptionMarketFactory');
	let factoryAddress = getTargetAddress('BinaryOptionMarketFactory', network);
	const BinaryOptionMarketFactoryInstance = await BinaryOptionMarketFactory.attach(factoryAddress);

	let tx = await ThalesAMM_deployed.setBinaryOptionsMarketManager(managerAddress);
	await tx.wait().then(e => {
		console.log('ThalesAMM: setBinaryOptionsMarketManager');
	});

	tx = await ThalesAMM_deployed.setImpliedVolatilityPerAsset(
		toBytes32('ETH'),
		w3utils.toWei('120')
	);
	await tx.wait().then(e => {
		console.log('ThalesAMM: setImpliedVolatilityPerAsset(ETH, 120)');
	});

	tx = await ThalesAMM_deployed.setImpliedVolatilityPerAsset(
		toBytes32('BTC'),
		w3utils.toWei('120')
	);
	await tx.wait().then(e => {
		console.log('ThalesAMM: setImpliedVolatilityPerAsset(BTC, 120)');
	});

	tx = await ThalesAMM_deployed.setImpliedVolatilityPerAsset(
		toBytes32('LINK'),
		w3utils.toWei('120')
	);
	await tx.wait().then(e => {
		console.log('ThalesAMM: setImpliedVolatilityPerAsset(LINK, 120)');
	});

	tx = await ThalesAMM_deployed.setImpliedVolatilityPerAsset(
		toBytes32('SNX'),
		w3utils.toWei('120')
	);
	await tx.wait().then(e => {
		console.log('ThalesAMM: setImpliedVolatilityPerAsset(SNX, 120)');
	});

	tx = await BinaryOptionMarketFactoryInstance.setThalesAMM(ThalesAMM_deployed.address);
	await tx.wait().then(e => {
		console.log('BinaryOptionMarketFactoryInstance: setThalesAMM');
	});

	//setLookupTables
	tx = await deciMath.setLUT1();
	await tx.wait().then(e => {
		console.log('deciMath: setLUT1');
	});
	tx = await deciMath.setLUT2();
	await tx.wait().then(e => {
		console.log('deciMath: setLUT2');
	});
	tx = await deciMath.setLUT3_1();
	await tx.wait().then(e => {
		console.log('deciMath: setLUT3_1');
	});
	tx = await deciMath.setLUT3_2();
	await tx.wait().then(e => {
		console.log('deciMath: setLUT3_2');
	});
	tx = await deciMath.setLUT3_3();
	await tx.wait().then(e => {
		console.log('deciMath: setLUT3_3');
	});
	tx = await deciMath.setLUT3_4();
	await tx.wait().then(e => {
		console.log('deciMath: setLUT3_4');
	});

	await hre.run('verify:verify', {
		address: deciMath.address,
	});

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
	.catch(error => {
		console.error(error);
		process.exit(1);
	});

function delay(time) {
	return new Promise(function(resolve) {
		setTimeout(resolve, time);
	});
}
