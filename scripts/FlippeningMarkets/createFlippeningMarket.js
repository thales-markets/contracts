const { ethers } = require('hardhat');
const w3utils = require('web3-utils');
const snx = require('synthetix-2.50.4-ovm');

const { toBytes32 } = require('../../index');

//let managerAddress = '0x46d9DB2830C005e38878b241199bb09d9d355994'; //kovan
let managerAddress = '0x5ed98Ebb66A929758C7Fe5Ac60c979aDF0F4040a'; //real

//let FLIPPENING_RATIO_ORACLE = '0x5FbDB2315678afecb367f032d93F642f64180aa3'; // localhost
let FLIPPENING_RATIO_ORACLE = '0x2b68111e7f4954C82898dD3bB9cFBcd34534c65e'; // real

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	let fundingAmount = w3utils.toWei('1');
	if (network == 'homestead') {
		network = 'mainnet';
		fundingAmount = w3utils.toWei('1000');
	}

	console.log('Account is:' + owner.address);
	console.log('Network name:' + networkObj.name);

	const addressResolver = snx.getTarget({ network, contract: 'ReadProxyAddressResolver' });
	console.log('Found address resolver at:' + addressResolver.address);

	const safeDecimalMath = snx.getTarget({ network, contract: 'SafeDecimalMath' });
	console.log('Found safeDecimalMath at:' + safeDecimalMath.address);

	const BinaryOptionMarketManager = await ethers.getContractFactory('BinaryOptionMarketManager', {
		libraries: {
			SafeDecimalMath: safeDecimalMath.address,
		},
	});
	let manager = await BinaryOptionMarketManager.attach(managerAddress);

	console.log('found manager at:' + manager.address);

	let FlippeningRatioOracle = await ethers.getContractFactory('FlippeningRatioOracle');
	const flippeningRatioOracle = await FlippeningRatioOracle.attach(FLIPPENING_RATIO_ORACLE);

	console.log('flippeningRatioOracle deployed to:', flippeningRatioOracle.address);

	let FlippeningRatioOracleInstanceContract = await ethers.getContractFactory(
		'FlippeningRatioOracleInstance'
	);

	let maturityDate = Math.round(Date.parse('1 NOV 2021 00:00:00 GMT') / 1000);

	let oracleInstanceAddress = await createOracleInstance(
		FlippeningRatioOracleInstanceContract,
		owner.address,
		flippeningRatioOracle.address,
		'ETH/BTC market cap ratio',
		w3utils.toWei('0.41'),
		'ETH/BTC market cap ratio'
	);
	await createMarket(manager, maturityDate, fundingAmount, oracleInstanceAddress);

	oracleInstanceAddress = await createOracleInstance(
		FlippeningRatioOracleInstanceContract,
		owner.address,
		flippeningRatioOracle.address,
		'ETH/BTC market cap ratio',
		w3utils.toWei('0.46'),
		'ETH/BTC market cap ratio'
	);
	await createMarket(manager, maturityDate, fundingAmount, oracleInstanceAddress);

	oracleInstanceAddress = await createOracleInstance(
		FlippeningRatioOracleInstanceContract,
		owner.address,
		flippeningRatioOracle.address,
		'ETH/BTC market cap ratio',
		w3utils.toWei('0.36'),
		'ETH/BTC market cap ratio'
	);
	await createMarket(manager, maturityDate, fundingAmount, oracleInstanceAddress);

	//-----verifications

	await hre.run('verify:verify', {
		address: oracleInstanceAddress,
		constructorArguments: [
			owner.address,
			flippeningRatioOracle.address,
			'ETH/BTC Flippening Market',
			w3utils.toWei('1'),
			'Flippening Markets',
		],
		contract:
			'contracts/customOracle/FlippeningRatioOracleInstance.sol:FlippeningRatioOracleInstance',
	});
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});

async function createMarket(
	manager,
	maturityDate,
	fundingAmount,
	flippeningMarketOracleInstanceContractDeployedAddress
) {
	const result = await manager.createMarket(
		toBytes32(''),
		0,
		maturityDate,
		fundingAmount,
		true,
		flippeningMarketOracleInstanceContractDeployedAddress,
		{ gasLimit: 5500000 }
	);

	await result.wait().then(function(receipt) {
		console.log('receipt', receipt);
		let marketCreationArgs = receipt.events[receipt.events.length - 1].args;
		for (var key in marketCreationArgs) {
			if (marketCreationArgs.hasOwnProperty(key)) {
				if (key == 'market') {
					console.log('Market created at ' + marketCreationArgs[key]);
				}
			}
		}
	});
}

async function createOracleInstance(
	FlippeningRatioOracleInstanceContract,
	ownerAddress,
	flippeningRatioOracleContractDeployedAddress,
	marketName,
	ratio,
	eventName
) {
	const FlippeningRatioOracleInstanceContractDeployed = await FlippeningRatioOracleInstanceContract.deploy(
		ownerAddress,
		flippeningRatioOracleContractDeployedAddress,
		marketName,
		ratio,
		eventName
	);
	await FlippeningRatioOracleInstanceContractDeployed.deployed();

	console.log(
		'FlippeningRatioOracleInstanceContractDeployed deployed to:',
		FlippeningRatioOracleInstanceContractDeployed.address
	);
	console.log(
		'with params marketName ' + marketName + ' ratio ' + ratio + ' event name ' + eventName
	);

	return FlippeningRatioOracleInstanceContractDeployed.address;
}
