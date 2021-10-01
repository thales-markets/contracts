const { ethers } = require('hardhat');
const w3utils = require('web3-utils');
const snx = require('synthetix');
const { artifacts, contract, web3 } = require('hardhat');

const { toBN } = web3.utils;

const { toBytes32 } = require('../../index');

//let managerAddress = '0x30C1d1BE9E33696F8dd9FDf3430c36FCd73436cB'; //kovan
let managerAddress = '0x5ed98Ebb66A929758C7Fe5Ac60c979aDF0F4040a'; //ropsten

//kovan
let oracleContract = '0xff07c97631ff3bab5e5e5660cdf47aded8d4d4fd';
let sportsJobId = '07c2ac56981546409a65be557d0b76cc';

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	if (network == 'homestead') {
		network = 'mainnet';
	}
	let fundingAmount = w3utils.toWei('1');
	if (network == 'homestead') {
		network = 'mainnet';
		fundingAmount = w3utils.toWei('1000');
	}

	console.log('Account is:' + owner.address);
	console.log('Network name:' + networkObj.name);

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

	let EthBurnedFeedContract = await ethers.getContractFactory('EthBurnedFeed');
	const EthBurnedFeedContractDeployed = await EthBurnedFeedContract.deploy(
		owner.address,
		oracleContract,
		toBytes32(sportsJobId),
		w3utils.toWei('0.1'),
		'burned-eth',
		false
	);
	await EthBurnedFeedContractDeployed.deployed();

	await hre.run('verify:verify', {
		address: '0x5A81f48D2aF98EdB31241055a2b2f13351DE1E04',
		constructorArguments: [
			owner.address,
			'0xff07c97631ff3bab5e5e5660cdf47aded8d4d4fd',
			toBytes32(sportsJobId),
			w3utils.toWei('0.1'),
			'burned-eth',
			false,
		],
		contract: 'contracts/customOracle/EthBurnedFeed.sol:EthBurnedFeed',
	});
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});
