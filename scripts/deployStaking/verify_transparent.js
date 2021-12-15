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

    // let ProxyEscrow_deployed = await upgrades.deployProxy(ProxyEscrow, 
    //             [
    //         		owner.address,
    //         		thalesAddress
    //         	]
    //     );
    // await ProxyEscrow_deployed.deployed();

    // let ProxyStaking_deployed = await upgrades.deployProxy(ProxyStaking,
    //     [
    //         owner.address, 
    //         ProxyEscrow_deployed.address,
    //         thalesAddress,
    //         ProxyERC20sUSD_address,
    //         durationPeriod,
    //         unstakeDurationPeriod
    //     ]
    // );
    // await ProxyStaking_deployed.deployed();
	
	// const OwnedProxyEscrow = await ethers.getContractFactory('OwnedUpgradeabilityProxy');
	// const OwnedProxyEscrow_deployed = await OwnedProxyEscrow.connect(proxyOwner).deploy();
	// await OwnedProxyEscrow_deployed.deployed();

	// const OwnedProxyStaking_deployed = await OwnedProxyEscrow.connect(proxyOwner).deploy();
	// await OwnedProxyStaking_deployed.deployed();

	// const ProxyStaking_implementation = await ProxyStaking.connect(owner).deploy();
	// await ProxyStaking_implementation.deployed();
	// console.log("Staking implementation:", ProxyStaking_implementation.address);
	
	// const ProxyEscrow_implementation = await ProxyEscrow.connect(owner).deploy();
	// await ProxyEscrow_implementation.deployed();
	// console.log("Escrow implementation:", ProxyEscrow_implementation.address);
	
	// // let tx = await OwnedProxyStaking_deployed.upgradeTo(ProxyStaking_implementation.address);
	// // await tx.wait();
	
	// // tx = await OwnedProxyEscrow_deployed.upgradeTo(ProxyEscrow_implementation.address);
	// // await tx.wait();
	
	// let initializeEscrowData = encodeCall(
	// 	'initialize',
	// 	['address', 'address'],
	// 	[
	// 		owner.address,
	// 		thalesAddress
	// 	]
	// );
	
	// console.log("1");
	
	// const TransparentProxy = await ethers.getContractFactory('TransparentUpgradeableProxy');
	// const TransparentEscrow_deployed = await TransparentProxy.connect(proxyOwner).deploy(
	// 	ProxyEscrow_implementation.address, 
	// 	owner.address, 
	// 	initializeEscrowData
	// 	);
	// await delay(10000);
	// await TransparentEscrow_deployed.deployed();
	// 	// let tx = await TransparentEscrow_deployed.upgradeToAndCall(ProxyEscrow_implementation.address, initializeEscrowData);
	// 	// await tx.wait();
		
	// console.log("2");
	// let initializeStakingData = encodeCall(
	// 	'initialize',
	// 	['address', 'address', 'address', 'address', 'uint256', 'uint256'],
	// 	[
	// 		owner.address, 
	// 		TransparentEscrow_deployed.address,
	// 		thalesAddress,
	// 		ProxyERC20sUSD_address,
	// 		durationPeriod,
	// 		unstakeDurationPeriod
	// 	]
	// );
		
		
	// console.log("3");
	
	// const TransparentStaking_deployed = await TransparentProxy.connect(proxyOwner).deploy(
	// 	ProxyStaking_implementation,
	// 	owner.address,
	// 	initializeStakingData
	// );
	// await TransparentStaking_deployed.deployed();

	// // tx = await TransparentStaking_deployed.upgradeToAndCall(ProxyStaking_implementation.address, initializeStakingData);
	// // await tx.wait();

	// const ProxyEscrow_deployed = ProxyEscrow.connect(owner).attach(TransparentEscrow_deployed.address);
	
	// const ProxyStaking_deployed = ProxyStaking.connect(owner).attach(TransparentStaking_deployed.address);	
	
	// // tx = await ProxyEscrow_deployed.initialize(
        // // 	owner.address,
        // // 	thalesAddress
        // // 	);
		
        // // await tx.wait();
		
        
        // // let initializeStakingData = encodeCall(
            // // 	'initialize',
            // // 	['address', 'address', 'address', 'address', 'uint256', 'uint256'],
            // // 	[
                // // 		owner,
                // // 		EscrowThalesDeployed.address,
                // // 		ThalesDeployed.address,
                // // 		sUSDSynth.address,
                // // 		WEEK,
                // // 		WEEK
                // // 	]
                // // );
                
                // // const ProxyStaking_deployed = ProxyStaking.connect(owner).attach(OwnedProxyStaking_deployed.address);	
                // // tx = await ProxyStaking_deployed.initialize(
                    // // 	owner.address, 
                    // // 	ProxyEscrow_deployed.address,
                    // // 	thalesAddress,
                    // // 	ProxyERC20sUSD_address,
	// // 	durationPeriod,
	// // 	unstakeDurationPeriod
	// // 	);
	// // await tx.wait();
		
    // console.log("Escrow proxy:", ProxyEscrow_deployed.address);
	// console.log("Staking proxy:", ProxyStaking_deployed.address);
	
	// setTargetAddress('ProxyStakingThales', network, ProxyStaking_deployed.address);
	// setTargetAddress('ProxyEscrowThales', network, ProxyEscrow_deployed.address);
		
    let StakingAddress = '0x4f8A0ca4af3e58EB992ac2D3573065117CDB5CA0'
    let EscrowAddress = '0xEBB06f3ca3980d71EcccC99Fd7CA1080bF82Becd'

	await hre.run('verify:verify', {
			address: StakingAddress,
			// constructorArguments: [
			//     owner.address, 
            //     ProxyEscrow_deployed.address,
            //     thalesAddress,
            //     ProxyERC20sUSD_address,
            //     durationPeriod,
            //     unstakeDurationPeriod
			// ],
		});
	await hre.run('verify:verify', {
		address: EscrowAddress,
		// constructorArguments: [
        //     owner.address,
        //     thalesAddress
		// ],
	});
	// console.log('Found ProxyERC20sUSD at:' + ProxyERC20sUSD.address);
	// const ProxyERC20sUSD = '0x578C6B406D3C40fa2417CB810513B1E4822B4614';
	// console.log('EscrowThales address: ', EscrowThalesAddress);
	
	// let EscrowThalesAttached = await EscrowThales.attach(EscrowThalesAddress);
	// console.log('Thales address: ', thalesAddress);
	
	
	// const StakingThales = await ethers.getContractFactory('StakingThales');
	// const StakingThalesDeployed = await StakingThales.deploy(
	// 	owner.address,
	// 	EscrowThalesAddress,
	// 	thalesAddress,
	// 	ProxyERC20sUSD.address,
	// 	durationPeriod,
	// 	unstakeDurationPeriod
	// );
	// await StakingThalesDeployed.deployed();

	// await EscrowThalesAttached.setStakingThalesContract(StakingThalesDeployed.address);

	// console.log('StakingThales deployed to: ', StakingThalesDeployed.address);
	// // update deployments.json file


	await ProxyStaking_deployed.startStakingPeriod({ from: owner.address });
	console.log('Staking has been started');
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
