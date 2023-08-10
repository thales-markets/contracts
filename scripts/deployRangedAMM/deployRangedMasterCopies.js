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

	if (networkObj.chainId == 56) {
		networkObj.name = 'bsc';
		network = 'bsc';
	}

	if (networkObj.chainId == 42161) {
		networkObj.name = 'arbitrumOne';
		network = 'arbitrumOne';
	}

	if (networkObj.chainId == 8453) {
		networkObj.name = 'baseMainnet';
		network = 'baseMainnet';
	}
	if (networkObj.chainId == 10) {
		ProxyERC20sUSDaddress = getTargetAddress('ProxysUSD', network);
	} else if (networkObj.chainId == 69) {
		networkObj.name = 'optimisticKovan';
		ProxyERC20sUSDaddress = getTargetAddress('ProxysUSD', network);
	} else if (
		networkObj.chainId == 80001 ||
		networkObj.chainId == 137 ||
		networkObj.chainId == 42161 ||
		networkObj.chainId == 8453
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

	const RangedMarketAMM = await ethers.getContractFactory('RangedMarketsAMM');
	let RangedMarketAMMAddress = getTargetAddress('RangedAMM', network);
	const RangedMarketAMMDeployer = await RangedMarketAMM.attach(RangedMarketAMMAddress);

	await delay(10000);
	let tx = await RangedMarketAMMDeployer.setRangedMarketMastercopies(
		RangedMarketMastercopyDeployed.address,
		RangedPositionMastercopyDeployed.address
	);
	await tx.wait().then((e) => {
		console.log('RangedMarketAMMDeployer: setRangedMarketMastercopies');
	});

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
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});

function delay(time) {
	return new Promise(function (resolve) {
		setTimeout(resolve, time);
	});
}
