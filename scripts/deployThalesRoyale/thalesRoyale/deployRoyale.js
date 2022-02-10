const { ethers, upgrades } = require('hardhat');
const { toBytes32 } = require('../../../index');
const { getTargetAddress, setTargetAddress } = require('../../helpers');
const w3utils = require('web3-utils');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');
const snx = require('synthetix-2.50.4-ovm');

async function main() {
    
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	let rewardTokenAddress;

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

	console.log('Account is: ' + owner.address);
	console.log('Network:' + network);
	console.log('Network id:' + networkObj.chainId);

    /* ========== PROPERTIES FOR INITIALIZE ========== */

	const priceFeed = await ethers.getContractFactory('PriceFeed');
	let priceFeedAddress = getTargetAddress('PriceFeed', network);

	if (networkObj.chainId == 10 || networkObj.chainId == 69) {
		rewardTokenAddress = getTargetAddress('ProxysUSD', network);
	} else {
		const ProxyERC20sUSD = snx.getTarget({ network, contract: 'ProxyERC20sUSD' });
		rewardTokenAddress = ProxyERC20sUSD.address;
	}

	console.log('Found ProxyERC20sUSD at:' + rewardTokenAddress);

	const min = 60;
	const hour = 60 * 60;
	const day = 24 * 60 * 60;
	const week = 7 * 24 * 60 * 60;

	const asset = toBytes32('ETH');

	const signUpPeriod = day * 3;
	const roundChoosingLength = hour * 8;
	const roundLength = day;
	const pauseBetweenSeasonsTime = week * 2;

	const rounds = 6;
	const buyIn = w3utils.toWei('30');

	const ThalesRoyale = await ethers.getContractFactory('ThalesRoyale');
	const royale = await upgrades.deployProxy(ThalesRoyale, 
        [
        owner.address, 			//1
        asset, 					//2
        priceFeedAddress,		//3
        rewardTokenAddress,		//4
        rounds,					//5
        signUpPeriod,			//6
        roundChoosingLength,	//7
        roundLength,			//8
        buyIn,					//9
        pauseBetweenSeasonsTime,//10
        false					//11
        ]
    );
	await royale.deployed();

	console.log('ThalesRoyale deployed to:', royale.address);
	setTargetAddress('ThalesRoyale', network, royale.address);

    const implementation = await getImplementationAddress(ethers.provider, royale.address);
	console.log('ThalesRoyaleImplementation: ', implementation);
    setTargetAddress('ThalesRoyaleImplementation', network, implementation);

    await hre.run('verify:verify', {
        address: implementation
    });

}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});