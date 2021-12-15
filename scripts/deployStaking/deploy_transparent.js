const { ethers, upgrades } = require('hardhat');
const w3utils = require('web3-utils');
const snx = require('synthetix-2.50.4-ovm');
const { artifacts, contract, web3 } = require('hardhat');



const THALES_AMOUNT = web3.utils.toWei('200');
const SECOND = 1000;
const MINUTE = 60;
const HOUR = 3600;
const DAY = 86400;
const WEEK = 604800;
const YEAR = 31556926;

const fs = require('fs');
const { getTargetAddress, setTargetAddress, encodeCall } = require('../helpers');

const user_key1 = process.env.PRIVATE_KEY;
const user_key2 = process.env.PRIVATE_KEY_2;

async function main() {
	let accounts = await ethers.getSigners();
	// let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	if(networkObj.chainId == 69) {
        network = "optimisticKovan";
		
    }
	let durationPeriod, unstakeDurationPeriod;
	if (network == 'homestead') {
		console.log('Setting duration to WEEK');
		network = 'mainnet';
		durationPeriod = WEEK;
		unstakeDurationPeriod = WEEK;
	} else {
		console.log('Setting duration to MINUTE');
		durationPeriod = MINUTE;
		unstakeDurationPeriod = MINUTE;
	}
	
	const owner = new ethers.Wallet(user_key1, ethers.provider);
	const proxyOwner = new ethers.Wallet(user_key2, ethers.provider);
	
	console.log('Owner is:' + owner.address);
	console.log('ProxyOwner is:' + proxyOwner.address);
	console.log('Network name:' + network);
	
	let thalesAddress, ProxyERC20sUSD_address;
	
	if(networkObj.chainId == 69) {
        network = "optimisticKovan";
		thalesAddress = getTargetAddress('OpThales_L2', network);
		ProxyERC20sUSD_address = getTargetAddress('ProxysUSD', network);
    }
	else{
		thalesAddress = getTargetAddress('Thales', network);
		ProxyERC20sUSD_address = getTargetAddress('PriceFeed', network);
	}
	// const thalesAddress = getTargetAddress('OpThales_L2', network);
	console.log('Thales address: ', thalesAddress);
	
	// const ProxyERC20sUSD_address = getTargetAddress('ProxysUSD', network);
	console.log('ProxyERC20sUSD address: ', ProxyERC20sUSD_address);
	// const ProxyEscrowThalesAddress = getTargetAddress('ProxyEscrowThales', network);

	const ProxyEscrow = await ethers.getContractFactory('ProxyEscrowThales');
	const ProxyStaking = await ethers.getContractFactory('ProxyStakingThales');

    let ProxyEscrow_deployed = await upgrades.deployProxy(ProxyEscrow, 
                [
            		owner.address,
            		thalesAddress
            	]
        );
    await ProxyEscrow_deployed.deployed();

    let ProxyStaking_deployed = await upgrades.deployProxy(ProxyStaking,
        [
            owner.address, 
            ProxyEscrow_deployed.address,
            thalesAddress,
            ProxyERC20sUSD_address,
            durationPeriod,
            unstakeDurationPeriod
        ]
    );
    await ProxyStaking_deployed.deployed();
	
	
		
    console.log("Escrow proxy:", ProxyEscrow_deployed.address);
	console.log("Staking proxy:", ProxyStaking_deployed.address);
	
	setTargetAddress('ProxyStakingThales', network, ProxyStaking_deployed.address);
	setTargetAddress('ProxyEscrowThales', network, ProxyEscrow_deployed.address);
		
	
	// await ProxyStaking_deployed.startStakingPeriod({ from: owner.address });
	// console.log('Staking has been started');
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
