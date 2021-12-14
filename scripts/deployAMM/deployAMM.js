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
	const thalesAMM = await ThalesAMM.deploy();
	await thalesAMM.deployed();

	console.log('ThalesAMM logic contract deployed on:', ThalesAMM.address);
	setTargetAddress('ThalesAMMImplementation', network, thalesAMM.address);

	tx = await OwnedUpgradeabilityProxyDeployed.upgradeTo(thalesAMM.address);

	await tx.wait().then(e => {
		console.log('Proxy updated');
	});

	const ThalesAMMDeployed = ThalesAMM.connect(owner).attach(
		OwnedUpgradeabilityProxyDeployed.address
	);

	tx = await ThalesAMMDeployed.initialize(
		owner.address,
		priceFeedAddress,
		ProxyERC20sUSDaddress,
		w3utils.toWei('1000'),
		deciMath.address
	);

	await tx.wait().then(e => {
		console.log('ProxyThalesAMM initialized');
	});

	setTargetAddress('ThalesAMM', network, ThalesAMMDeployed.address);

	let managerAddress = getTargetAddress('BinaryOptionMarketManager', network);

	const BinaryOptionMarketFactory = await ethers.getContractFactory('BinaryOptionMarketFactory');
	let factoryAddress = getTargetAddress('BinaryOptionMarketFactory', network);
	const BinaryOptionMarketFactoryInstance = await BinaryOptionMarketFactory.attach(factoryAddress);

	let tx = await thalesAMM.setBinaryOptionsMarketManager(managerAddress);
	await tx.wait().then(e => {
		console.log('ThalesAMM: setBinaryOptionsMarketManager');
	});

	tx = await thalesAMM.setImpliedVolatilityPerAsset(toBytes32('ETH'), w3utils.toWei('120'));
	await tx.wait().then(e => {
		console.log('ThalesAMM: setImpliedVolatilityPerAsset(ETH, 120)');
	});

	tx = await thalesAMM.setImpliedVolatilityPerAsset(toBytes32('LINK'), w3utils.toWei('120'));
	await tx.wait().then(e => {
		console.log('ThalesAMM: setImpliedVolatilityPerAsset(LINK, 120)');
	});

	tx = await thalesAMM.setImpliedVolatilityPerAsset(toBytes32('LINK'), w3utils.toWei('120'));
	await tx.wait().then(e => {
		console.log('ThalesAMM: setImpliedVolatilityPerAsset(LINK, 120)');
	});

	tx = await BinaryOptionMarketFactoryInstance.setThalesAMM(ThalesAMMDeployed.address);
	await tx.wait().then(e => {
		console.log('BinaryOptionMarketFactoryInstance: setThalesAMM');
	});

	await hre.run('verify:verify', {
		address: deciMath.address,
	});

	await hre.run('verify:verify', {
		address: thalesAMM.address,
		constructorArguments: [
			owner.address,
			priceFeedAddress,
			ProxyERC20sUSDaddress,
			w3utils.toWei('1000'),
			deciMath.address,
		],
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
