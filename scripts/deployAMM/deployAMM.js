const { ethers } = require('hardhat');
const w3utils = require('web3-utils');
const snx = require('synthetix-2.50.4-ovm');
const { artifacts, contract, web3 } = require('hardhat');
const { getTargetAddress, setTargetAddress } = require('../helpers');
const { toBytes32 } = require('../../index');

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

	const privateKey1 = process.env.PRIVATE_KEY;
	const privateKey2 = process.env.PRIVATE_KEY_2;

	const proxyOwner = new ethers.Wallet(privateKey1, ethers.provider);
	const owner = new ethers.Wallet(privateKey2, ethers.provider);

	console.log('Owner is: ' + owner.address);
	console.log('ProxyOwner is: ' + proxyOwner.address);
	console.log('Network:' + network);
	console.log('Network id:' + networkObj.chainId);

	const PriceFeed = await ethers.getContractFactory('PriceFeed');

	const OwnedUpgradeabilityProxy = await ethers.getContractFactory('OwnedUpgradeabilityProxy');
	const OwnedUpgradeabilityProxyDeployed = await OwnedUpgradeabilityProxy.connect(
		proxyOwner
	).deploy();

	await OwnedUpgradeabilityProxyDeployed.deployed();
	console.log('Owned proxy deployed on:', OwnedUpgradeabilityProxyDeployed.address);

	console.log('Found ProxyERC20sUSD at:' + ProxyERC20sUSDaddress);
	priceFeedAddress = getTargetAddress('PriceFeed', network);
	console.log('Found PriceFeed at:' + priceFeedAddress);

	const DeciMath = await ethers.getContractFactory('DeciMath');
	const deciMath = await DeciMath.deploy();
	await deciMath.deployed();

	console.log('DeciMath deployed to:', deciMath.address);
	setTargetAddress('DeciMath', network, deciMath.address);

	const ThalesAMM = await ethers.getContractFactory('ThalesAMM');
	const thalesAMMConnected = await ThalesAMM.connect(proxyOwner);
	console.log('thalesAMMConnected ready to deploy: ', thalesAMMConnected.signer._isSigner);
	const thalesAMMImplementation = await thalesAMMConnected.deploy();
	await thalesAMMImplementation.deployed();

	console.log('ThalesAMM logic contract deployed on:', thalesAMMImplementation.address);
	setTargetAddress('ThalesAMMImplementation', network, thalesAMMImplementation.address);

	let tx = await OwnedUpgradeabilityProxyDeployed.upgradeTo(thalesAMMImplementation.address);

	await tx.wait().then(e => {
		console.log('Proxy updated');
	});

	const ThalesAMMDProxyeployed = ThalesAMM.connect(owner).attach(
		OwnedUpgradeabilityProxyDeployed.address
	);

	tx = await ThalesAMMDProxyeployed.initialize(
		owner.address,
		priceFeedAddress,
		ProxyERC20sUSDaddress,
		w3utils.toWei('1000'),
		deciMath.address,
		w3utils.toWei('0.01'),
		w3utils.toWei('0.05')
	);

	await tx.wait().then(e => {
		console.log('ProxyThalesAMM initialized');
	});

	setTargetAddress('ThalesAMM', network, ThalesAMMDProxyeployed.address);

	let managerAddress = getTargetAddress('BinaryOptionMarketManager', network);

	const BinaryOptionMarketFactory = await ethers.getContractFactory('BinaryOptionMarketFactory');
	let factoryAddress = getTargetAddress('BinaryOptionMarketFactory', network);
	const BinaryOptionMarketFactoryInstance = await BinaryOptionMarketFactory.attach(factoryAddress);

	tx = await ThalesAMMDProxyeployed.setBinaryOptionsMarketManager(managerAddress);
	await tx.wait().then(e => {
		console.log('ThalesAMM: setBinaryOptionsMarketManager');
	});

	tx = await ThalesAMMDProxyeployed.setImpliedVolatilityPerAsset(
		toBytes32('ETH'),
		w3utils.toWei('120')
	);
	await tx.wait().then(e => {
		console.log('ThalesAMM: setImpliedVolatilityPerAsset(ETH, 120)');
	});

	tx = await ThalesAMMDProxyeployed.setImpliedVolatilityPerAsset(
		toBytes32('BTC'),
		w3utils.toWei('120')
	);
	await tx.wait().then(e => {
		console.log('ThalesAMM: setImpliedVolatilityPerAsset(BTC, 120)');
	});

	tx = await ThalesAMMDProxyeployed.setImpliedVolatilityPerAsset(
		toBytes32('LINK'),
		w3utils.toWei('120')
	);
	await tx.wait().then(e => {
		console.log('ThalesAMM: setImpliedVolatilityPerAsset(LINK, 120)');
	});

	tx = await BinaryOptionMarketFactoryInstance.setThalesAMM(ThalesAMMDProxyeployed.address);
	await tx.wait().then(e => {
		console.log('BinaryOptionMarketFactoryInstance: setThalesAMM');
	});

	//setLookupTables 		await deciMath.setLUT1();
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

	// verify logic contract
	await hre.run('verify:verify', {
		address: thalesAMMImplementation.address,
		constructorArguments: [],
	});

	// verify proxy contract
	await hre.run('verify:verify', {
		address: ThalesAMMDProxyeployed.address,
		constructorArguments: [],
	});
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
