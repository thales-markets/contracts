const path = require('path');
const { ethers, upgrades } = require('hardhat');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');


const { getTargetAddress, setTargetAddress } = require('../../helpers');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	let mainnetNetwork = 'mainnet';
	let PaymentToken;

	if (network == 'homestead') {
		console.log("Error L1 network used! Deploy only on L2 Optimism. \nTry using \'--network optimistic\'")
		return 0;
	}
	if (networkObj.chainId == 42) {
		networkObj.name = 'kovan';
		network = 'kovan';
		PaymentToken = getTargetAddress("ExoticUSD", network);;
	}
	if (networkObj.chainId == 69) {
		networkObj.name = 'optimisticKovan';
		network = 'optimisticKovan';
		mainnetNetwork = 'kovan';
		PaymentToken = getTargetAddress("ExoticUSD", network);;
	}
	if (networkObj.chainId == 10) {
		networkObj.name = 'optimisticEthereum';
		network = 'optimisticEthereum';
		PaymentToken = getTargetAddress("ProxysUSD", network);;
	}
	//Constants
	const capPerMarket = "5000000000000000000000";
	const min_spread = "20000000000000000";
	const max_spread = "200000000000000000";
	const minimalTimeLeftToMaturity = "86400";

	const SportMarketFactory = await ethers.getContractFactory('SportPositionalMarketFactory');
    const SportMarketFactoryAddress = getTargetAddress("SportPositionalMarketFactory", network);;
    const SportMarketFactoryDeployed = await SportMarketFactory.attach(SportMarketFactoryAddress);

    const SportsAMM = await ethers.getContractFactory('SportsAMM');
   
    const SportsAMMDeployed = await upgrades.deployProxy(SportsAMM, [
        owner.address,
		PaymentToken,
		capPerMarket,
		min_spread,
		max_spread,
		minimalTimeLeftToMaturity
	]);
	await SportsAMMDeployed.deployed;
    
    console.log("SportsAMM Deployed on", SportsAMMDeployed.address);
    setTargetAddress('SportsAMM', network, SportsAMMDeployed.address);

	const SportsAMMImplementation = await getImplementationAddress(
		ethers.provider,
		SportsAMMDeployed.address
	);

	console.log('Implementation SportsAMM: ', SportsAMMImplementation);
	setTargetAddress('SportsAMMImplementation', network, SportsAMMImplementation);
	
	await delay(5000);
	
    await SportMarketFactoryDeployed.setThalesAMM(SportsAMMDeployed.address, {from: owner.address});
	console.log("SportsAMM updated in Factory");
	await delay(2000);

    try {
		await hre.run('verify:verify', {
			address: SportsAMMDeployed.address,
		});
	} catch (e) {
		console.log(e);
	}

    try {
		await hre.run('verify:verify', {
			address: SportsAMMImplementation,
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
	return new Promise(function(resolve) {
		setTimeout(resolve, time);
	});
}
