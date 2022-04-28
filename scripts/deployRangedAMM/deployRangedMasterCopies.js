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

	let thalesAMMAddress = getTargetAddress('ThalesAMM', network);
	console.log('Found ThalesAMM at:' + thalesAMMAddress);

	let safeBoxAddress = getTargetAddress('SafeBox', network);
	console.log('Found safeBoxAddress at:' + safeBoxAddress);

	const RangedPositionMastercopy = await ethers.getContractFactory('RangedPositionMastercopy');
	const RangedPositionMastercopyDeployed = await RangedPositionMastercopy.deploy();
	await RangedPositionMastercopyDeployed.deployed();

	console.log('RangedPositionMastercopy deployed to:', RangedPositionMastercopyDeployed.address);
	setTargetAddress('RangedPositionMastercopy', network, RangedPositionMastercopyDeployed.address);

	const RangedMarketMastercopy = await ethers.getContractFactory('RangedMarketMastercopy');
	const RangedMarketMastercopyDeployed = await RangedMarketMastercopy.deploy();
	await RangedMarketMastercopyDeployed.deployed();

	console.log('RangedMarketMastercopy deployed to:', RangedMarketMastercopyDeployed.address);
	setTargetAddress('RangedMarketMastercopy', network, RangedMarketMastercopyDeployed.address);
	try {
		await hre.run('verify:verify', {
			address: RangedPositionMastercopyDeployed.address,
			constructorArguments: [],
			contract: 'contracts/RangedMarkets/RangedPositionMastercopy.sol:RangedPositionMastercopy',
		});
	} catch (e) {
		console.log(e);
	}
	try {
		await hre.run('verify:verify', {
			address: RangedMarketMastercopyDeployed.address,
			constructorArguments: [],
			contract: 'contracts/RangedMarkets/RangedMarketMastercopy.sol:RangedMarketMastercopy',
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
