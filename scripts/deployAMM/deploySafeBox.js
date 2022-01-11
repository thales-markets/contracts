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

	let accounts = await ethers.getSigners();
	let owner = accounts[0];

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
	const SafeBox = await ethers.getContractFactory('SafeBox');
	let SafeBoxDeployed = await upgrades.deployProxy(SafeBox, [owner.address, ProxyERC20sUSDaddress]);
	await SafeBoxDeployed.deployed();

	console.log('SafeBox proxy:', SafeBoxDeployed.address);

	const SafeBoxImplementation = await getImplementationAddress(
		ethers.provider,
		SafeBoxDeployed.address
	);

	console.log('Implementation SafeBox: ', SafeBoxImplementation);

	setTargetAddress('SafeBox', network, SafeBoxDeployed.address);
	setTargetAddress('SafeBoxImplementation', network, SafeBoxImplementation);

	try {
		await hre.run('verify:verify', {
			address: SafeBoxImplementation,
		});
	} catch (e) {
		console.log(e);
	}

	try {
		await hre.run('verify:verify', {
			address: SafeBoxDeployed.address,
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
