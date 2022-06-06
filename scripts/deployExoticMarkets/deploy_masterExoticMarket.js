const path = require('path');
const { ethers } = require('hardhat');

const user_key = process.env.PRIVATE_KEY;


const L2_BRIDGE_ADDRESS = '0x4200000000000000000000000000000000000010';

const { getTargetAddress, setTargetAddress } = require('../helpers');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	let mainnetNetwork = 'mainnet';
	let PaymentTokenAddress;
    let SafeBoxAddress;
    let OracleCouncilAddress;
    let ThalesBondsAddress;
    let ExoticTagsAddress;
    let MarketDataAddress;
    let ExoticRewardsAddress;
    let OpenBidMastercopy;
    let FixedBidMastercopy;
    let TheRundownConsumer;
	let addressZero = '0x0000000000000000000000000000000000000000';


	if (network == 'homestead') {
		console.log("Error L1 network used! Deploy only on L2 Optimism. \nTry using \'--network optimistic\'")
		return 0;
	}
	if (networkObj.chainId == 42) {
		networkObj.name = 'kovan';
		network = 'kovan';
	}
	if (networkObj.chainId == 69) {
		networkObj.name = 'optimisticKovan';
		network = 'optimisticKovan';
		mainnetNetwork = 'kovan';
		PaymentTokenAddress =  getTargetAddress("ExoticUSD", network);
        SafeBoxAddress = owner.address;
        OracleCouncilAddress =  getTargetAddress("ThalesOracleCouncil", network);
        ThalesBondsAddress =  getTargetAddress("ThalesBonds", network);
        ExoticTagsAddress =  getTargetAddress("ExoticPositionalTags", network);
        MarketDataAddress =  getTargetAddress("ExoticPositionalMarketData", network);
        ExoticRewardsAddress =  getTargetAddress("ExoticRewards", network);
        OpenBidMastercopy =  getTargetAddress("ExoticMarketOpenBidMastercopy", network);
        FixedBidMastercopy =  getTargetAddress("ExoticMarketMasterCopy", network);
        TheRundownConsumer =  addressZero;
	}
	if (networkObj.chainId == 10) {
		networkObj.name = 'optimisticEthereum';
		network = 'optimisticEthereum';
		PaymentTokenAddress =  getTargetAddress("ProxysUSD", network); 
        SafeBoxAddress = getTargetAddress("SafeBox", network);
        OracleCouncilAddress =  getTargetAddress("ThalesOracleCouncil", network);
        ThalesBondsAddress =  getTargetAddress("ThalesBonds", network);
        ExoticTagsAddress =  getTargetAddress("ExoticPositionalTags", network);
        MarketDataAddress =  getTargetAddress("ExoticPositionalMarketData", network);
        ExoticRewardsAddress =  getTargetAddress("ExoticRewards", network);
        OpenBidMastercopy =  addressZero;
        FixedBidMastercopy =  getTargetAddress("ExoticMarketMasterCopy", network);
        TheRundownConsumer =  addressZero;
	}
	

	const ExoticMarket = await ethers.getContractFactory('ExoticPositionalFixedMarket');
	const ExoticMarketDeployed = await ExoticMarket.deploy();
    await ExoticMarketDeployed.deployed();
	console.log("ExoticMarketMarket Deployed on", ExoticMarketDeployed.address);
	setTargetAddress('ExoticMarketMasterCopy', network, ExoticMarketDeployed.address);
	
	if (networkObj.chainId == 69) {
		const ExoticMarketManagerAddress = getTargetAddress("ExoticMarketManager", network);
		const ExoticMarketManager = await ethers.getContractFactory('ExoticPositionalMarketManager');
		const ExoticMarketManagerDeployed = await ExoticMarketManager.attach(ExoticMarketManagerAddress);

		tx = await ExoticMarketManagerDeployed.setAddresses(
					ExoticMarketDeployed.address,
					OpenBidMastercopy,
					OracleCouncilAddress,
					PaymentTokenAddress,
					ExoticTagsAddress,
					OracleCouncilAddress,
					MarketDataAddress,
					ExoticRewardsAddress,
					SafeBoxAddress,
					{from: owner.address});
				await tx.wait().then(e => {
					console.log('\n setAddresses: \n',
					'FixedBidMastercopy: ', FixedBidMastercopy, '\n',
					'OpenBidMastercopy: ', ExoticMarketDeployed.address, '\n',
					'OracleCouncilAddress: ', OracleCouncilAddress, '\n',
					'PaymentTokenAddress: ', PaymentTokenAddress, '\n',
					'ExoticTagsAddress: ', ExoticTagsAddress, '\n',
					'TheRundownConsumer: ', TheRundownConsumer, '\n',
					'MarketDataAddress: ', MarketDataAddress, '\n',
					'ExoticRewardsAddress: ', ExoticRewardsAddress, '\n',
					'SafeBoxAddress: ', SafeBoxAddress, '\n',
					);
				});
		await delay(1000);
		console.log("ExoticMarket Mastercopy updated");
	}

	console.log("ExoticMarket Mastercopy updated");
	
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});

    
function delay(time) {
	return new Promise(function(resolve) {
		setTimeout(resolve, time);
	});
}
