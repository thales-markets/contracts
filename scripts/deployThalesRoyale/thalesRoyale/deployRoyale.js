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
    let royaleVoucherAddress;

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

	royaleVoucherAddress = getTargetAddress('ThalesRoyaleVoucher', network);
	console.log('Found ThalesRoyaleVoucher at:' + royaleVoucherAddress);

	const min = 60;
	const hour = 60 * 60;
	const day = 24 * 60 * 60;
	const week = 7 * 24 * 60 * 60;

	const asset = toBytes32('ETH');

	const signUpPeriod = min * 10;
	const roundChoosingLength = min * 5;
	const roundLength = min * 10;
	const pauseBetweenSeasonsTime = hour * 1;

	const rounds = 6;
	const buyIn = w3utils.toWei('1');

	const ThalesRoyale = await ethers.getContractFactory('ThalesRoyale');
	const royale = await upgrades.deployProxy(ThalesRoyale, 
        [
        owner.address, 			//1
        asset, 					//2
        priceFeedAddress,		//3
        rewardTokenAddress,		//4
		royaleVoucherAddress,	//5
        rounds,					//6
        signUpPeriod,			//7
        roundChoosingLength,	//8
        roundLength,			//9
        buyIn,					//10
        pauseBetweenSeasonsTime//11
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