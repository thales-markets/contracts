const { ethers } = require('hardhat');
const w3utils = require('web3-utils');
const snx = require('synthetix');
const { artifacts, contract, web3 } = require('hardhat');

const { getTargetAddress, setTargetAddress } = require('../helpers');

const { toBytes32 } = require('../../index');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	console.log(networkObj)
	let network = networkObj.name;
	if (network == 'homestead') {
		network = 'mainnet';
	}
	if(networkObj.chainId == 69) {
		networkObj.name = "optimisticKovan";
		network = 'optimisticKovan'
		
	}

	console.log('Account is:' + owner.address);
	console.log('Network name:' + network);

	

	const addressResolverAddress = getTargetAddress('AddressResolver', network);
	const safeDecimalMathAddress = getTargetAddress('SafeDecimalMath', network);
	const proxysUSDAddress = getTargetAddress('ProxysUSD', network);
	
	
	console.log(addressResolverAddress);
	console.log(safeDecimalMathAddress);

	const addressResolverContract = await ethers.getContractFactory('synthetix-2.50.4-ovm/contracts/AddressResolver.sol:AddressResolver');
	const safeDecimalMathContract = await ethers.getContractFactory('synthetix-2.50.4-ovm/contracts/SafeDecimalMath.sol:SafeDecimalMath');
	const proxysUSDContract = await ethers.getContractFactory('synthetix-2.50.4-ovm/contracts/ProxyERC20.sol:ProxyERC20');

	let addressResolver = await addressResolverContract.attach(addressResolverAddress);
	let safeDecimalMath = await safeDecimalMathContract.attach(safeDecimalMathAddress);
	let proxysUSD = await proxysUSDContract.attach(proxysUSDAddress);

	// const addressResolver = snx.getTarget({ useOvm: true, contract: 'AddressResolver' });
	console.log('Found address resolver at:' + addressResolver.address);

	// const safeDecimalMath = snx.getTarget({ useOvm: true, contract: 'SafeDecimalMath' });
	console.log('Found safeDecimalMath at:' + safeDecimalMath.address);
	console.log('Found proxysUSD at:' + proxysUSD.address);

	//Price feed deployment
	const priceFeed = await ethers.getContractFactory('PriceFeed', 
					{
						libraries: {
							SafeDecimalMath: safeDecimalMath.address,
						},
					}
				);
	let priceFeedAddress = getTargetAddress('PriceFeed', network);
	let PriceFeedDeployed; 
	console.log(priceFeedAddress);
	if(typeof priceFeedAddress == 'undefined' && !priceFeedAddress) {
		PriceFeedDeployed = await priceFeed.deploy(owner.address);
		await PriceFeedDeployed.deployed();
		setTargetAddress('PriceFeed', network, PriceFeedDeployed.address);
		console.log('PriceFeed deployed to:', PriceFeedDeployed.address);
	}
	else {
		PriceFeedDeployed = await priceFeed.attach(priceFeedAddress);
		console.log('Found PriceFeed at:' + PriceFeedDeployed.address);
	}

	// We get the contract to deploy
	// 1. Deployment BinaryOption Mastercopy
	const BinaryOptionMastercopy = await ethers.getContractFactory('BinaryOptionMastercopy');
	const binaryOptionMastercopyDeployed = await BinaryOptionMastercopy.deploy();
	await binaryOptionMastercopyDeployed.deployed();

	setTargetAddress('BinaryOptionMastercopy', network, binaryOptionMastercopyDeployed.address);

	console.log('BinaryOptionMastercopy deployed to:', binaryOptionMastercopyDeployed.address);
	
	// 2. Deployment BinaryOption Market Mastercopy
	const BinaryOptionMarketMastercopy = await ethers.getContractFactory(
		'BinaryOptionMarketMastercopy',
		{
			libraries: {
				SafeDecimalMath: safeDecimalMath.address,
			},
		}
		);
	const binaryOptionMarketMastercopyDeployed = await BinaryOptionMarketMastercopy.deploy();
	await binaryOptionMarketMastercopyDeployed.deployed();
	
	setTargetAddress('BinaryOptionMarketMastercopy', network, binaryOptionMarketMastercopyDeployed.address);
	console.log(
			'binaryOptionMarketMastercopy deployed to:',
			binaryOptionMarketMastercopyDeployed.address
			);

	// 3. Deployment BinaryOption Market Factory
	const BinaryOptionMarketFactory = await ethers.getContractFactory('BinaryOptionMarketFactory');
	const binaryOptionMarketFactoryDeployed = await BinaryOptionMarketFactory.deploy(owner.address);
	await binaryOptionMarketFactoryDeployed.deployed();
	
	setTargetAddress('BinaryOptionMarketFactory', network, binaryOptionMarketFactoryDeployed.address);
	console.log('BinaryOptionMarketFactory deployed to:', binaryOptionMarketFactoryDeployed.address);

	// 4. Deployment BinaryOption Market Manager
	const day = 24 * 60 * 60;
	const maxOraclePriceAge = 120 * 60; // Price updates are accepted from up to two hours before maturity to allow for delayed chainlink heartbeats.
	const expiryDuration = 26 * 7 * day; // Six months to exercise options before the market is destructible.
	const maxTimeToMaturity = 730 * day; // Markets may not be deployed more than two years in the future.
	let creatorCapitalRequirement = w3utils.toWei('1'); // 1 sUSD is required to create a new market for testnet, 1000 for mainnet.
	if (network == 'mainnet') {
		creatorCapitalRequirement = w3utils.toWei('1000');
	}
	const poolFee = w3utils.toWei('0.005'); // 0.5% of the market's value goes to the pool in the end.
	const creatorFee = w3utils.toWei('0.005'); // 0.5% of the market's value goes to the creator.
	const feeAddress = '0xfeefeefeefeefeefeefeefeefeefeefeefeefeef';

	// const BinaryOptionMarketManager = await ethers.getContractFactory('BinaryOptionMarketManager');
	
	const BinaryOptionMarketManager = await ethers.getContractFactory('BinaryOptionMarketManager', {
		libraries: {
			SafeDecimalMath: safeDecimalMath.address,
		},
	});
	const binaryOptionMarketManagerDeployed = await BinaryOptionMarketManager.deploy(
		owner.address,
		PriceFeedDeployed.address,
		addressResolver.address,
		maxOraclePriceAge,
		expiryDuration,
		maxTimeToMaturity,
		creatorCapitalRequirement,
		poolFee,
		creatorFee,
		feeAddress
	);
	await binaryOptionMarketManagerDeployed.deployed();
	
	// await binaryOptionMarketManagerDeployed.initialize(
	// 	owner.address,
	// 	addressResolver.address,
	// 	maxOraclePriceAge,
	// 	expiryDuration,
	// 	maxTimeToMaturity,
	// 	creatorCapitalRequirement,
	// 	poolFee,
	// 	creatorFee,
	// 	feeAddress
	// );

	setTargetAddress('BinaryOptionMarketManager', network, binaryOptionMarketManagerDeployed.address);
	console.log('BinaryOptionMarketManager deployed to:', binaryOptionMarketManagerDeployed.address);

	// await binaryOptionMarketManagerDeployed.setFeeAddress(feeAddress);
	// console.log('Fee address set');
	// await binaryOptionMarketManagerDeployed.setExpiryDuration(expiryDuration);
	// console.log('Expiry duration set');
	// await binaryOptionMarketManagerDeployed.setMaxOraclePriceAge(maxOraclePriceAge);
	// console.log('Max Oracle Price age set');
	// await binaryOptionMarketManagerDeployed.setMaxTimeToMaturity(maxTimeToMaturity);
	// console.log('Max Time to Maturity set');
	// await binaryOptionMarketManagerDeployed.setCreatorCapitalRequirement(creatorCapitalRequirement);
	// console.log('Creator Capital Req. set');
	// await binaryOptionMarketManagerDeployed.setPoolFee(poolFee);
	// console.log('Pool fee set');
	// await binaryOptionMarketManagerDeployed.setCreatorFee(creatorFee);
	// console.log('Creator Fee set');
	
	
	console.log('Done setting BinaryOption Market Manager');
	const BinaryOptionMarketData = await ethers.getContractFactory('BinaryOptionMarketData');
	const binaryOptionMarketData = await BinaryOptionMarketData.deploy();
	await binaryOptionMarketData.deployed();

	setTargetAddress('BinaryOptionMarketData', network, binaryOptionMarketData.address);
	console.log('binaryOptionMarketData deployed to:', binaryOptionMarketData.address);
	
	await binaryOptionMarketFactoryDeployed.setBinaryOptionMarketManager(
		binaryOptionMarketManagerDeployed.address
	);
	await binaryOptionMarketFactoryDeployed.setBinaryOptionMarketMastercopy(
		binaryOptionMarketMastercopyDeployed.address
	);
	await binaryOptionMarketFactoryDeployed.setBinaryOptionMastercopy(
		binaryOptionMastercopyDeployed.address
	);

	await binaryOptionMarketManagerDeployed.setBinaryOptionsMarketFactory(
		binaryOptionMarketFactoryDeployed.address
	);

	console.log('Done with all deployments');
	console.log('Done with all deployments. Wait 2 min....');
	
	await new Promise(resolve => setTimeout(resolve, 60000));
	console.log('Wait 1 min....');
	await new Promise(resolve => setTimeout(resolve, 60000));
	console.log('Veryfying....');

	await hre.run('verify:verify', {
		address: binaryOptionMarketManagerDeployed.address,
		constructorArguments: [
			owner.address,
			PriceFeedDeployed.address,
			addressResolver.address,
			maxOraclePriceAge,
			expiryDuration,
			maxTimeToMaturity,
			creatorCapitalRequirement,
			poolFee,
			creatorFee,
			feeAddress,
		],
	});

	await hre.run('verify:verify', {
		address: binaryOptionMarketFactoryDeployed.address,
		constructorArguments: [owner.address],
	});

	await hre.run('verify:verify', {
		address: binaryOptionMastercopyDeployed.address,
		constructorArguments: [],
		contract: 'contracts/BinaryOptionMastercopy.sol:BinaryOptionMastercopy',
	});

	await hre.run('verify:verify', {
		address: binaryOptionMarketMastercopyDeployed.address,
		constructorArguments: [],
		contract: 'contracts/BinaryOptionMarketMastercopy.sol:BinaryOptionMarketMastercopy',
	});

	await hre.run('verify:verify', {
		address: binaryOptionMarketData.address,
		constructorArguments: [],
	});


	console.log('All params set');

	// const sAUDKey = toBytes32('sETH');
	// const initialStrikePrice = w3utils.toWei('1');
	// const now = await currentTime();

	// // let abi = ["function approve(address _spender, uint256 _value) public returns (bool success)"]
	// // let contract = new ethers.Contract(ProxyERC20sUSD.address, abi, owner);
	// await proxysUSD.approve(binaryOptionMarketManagerDeployed.address, initialStrikePrice, {
	// 	from: owner.address,
	// });
	// // await contract.approve(binaryOptionMarketManagerDeployed.address, initialStrikePrice, {
	// // 	from: owner.address,
	// // });
	// console.log('Done approving');

	// const result = await binaryOptionMarketManagerDeployed.createMarket(
	// 	sAUDKey,
	// 	initialStrikePrice,
	// 	now + 360,
	// 	initialStrikePrice,
	// 	false,
	// 	ZERO_ADDRESS,
	// 	{ gasLimit: 5500000 }
	// );
	// console.log('Market created');
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});


function delay(time) {
	return new Promise(function (resolve) {
		setTimeout(resolve, time);
	});
}
