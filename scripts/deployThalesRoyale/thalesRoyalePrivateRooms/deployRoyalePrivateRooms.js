const { ethers, upgrades } = require('hardhat');
const { toBytes32 } = require('../../../index');
const { getTargetAddress, setTargetAddress } = require('../../helpers');
const w3utils = require('web3-utils');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');

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

	const SNX = toBytes32('SNX');
	const ETH = toBytes32('ETH');
	const BTC = toBytes32('BTC');
	const LINK = toBytes32('LINK');

	const ThalesRoyalePrivateRoom = await ethers.getContractFactory('ThalesRoyalePrivateRoom');
	const royale = await upgrades.deployProxy(ThalesRoyalePrivateRoom, 
        [
			owner.address,
			priceFeedAddress,
			rewardTokenAddress,
			15 * min, 				// minTimeSignUp
			30 * min,				// minRoundTime
			15 * min,				// minChooseTime
			15 * min,				// offsetBeteweenChooseAndEndRound
			10,						// maxPlayersInClosedRoom
			w3utils.toWei('1'),		// minBuyIn
			[BTC, ETH, SNX, LINK],	// allowedAssets
			2						// _minNumberOfRounds
        ]
    );
	await royale.deployed();

	console.log('ThalesRoyalePrivateRoom deployed to:', royale.address);
	setTargetAddress('ThalesRoyalePrivateRoom', network, royale.address);

    const implementation = await getImplementationAddress(ethers.provider, royale.address);
	console.log('ThalesRoyalePrivateRoomImplementation: ', implementation);
    setTargetAddress('ThalesRoyalePrivateRoomImplementation', network, implementation);

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