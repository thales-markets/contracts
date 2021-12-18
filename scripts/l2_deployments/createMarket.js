const { ethers } = require('hardhat');
const w3utils = require('web3-utils');
const snx = require('synthetix-2.50.4-ovm');
const { artifacts, contract, web3 } = require('hardhat');

const {
	fastForward,
	toUnit,
	currentTime,
	multiplyDecimalRound,
	divideDecimalRound,
} = require('../../test/utils/index')();

const ZERO_ADDRESS = '0x' + '0'.repeat(40);

const { getTargetAddress, setTargetAddress } = require('../helpers');

const { toBytes32 } = require('../../index');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	console.log(networkObj);
	let network = networkObj.name;
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

	console.log('Account is:' + owner.address);
	console.log('Network name:' + network);

	const addressResolverAddress = getTargetAddress('AddressResolver', network);
	const safeDecimalMathAddress = getTargetAddress('SafeDecimalMath', network);
	const proxysUSDAddress = getTargetAddress('ProxysUSD', network);

	console.log(addressResolverAddress);
	console.log(safeDecimalMathAddress);

	const addressResolverContract = await ethers.getContractFactory(
		'synthetix-2.50.4-ovm/contracts/AddressResolver.sol:AddressResolver'
	);
	const safeDecimalMathContract = await ethers.getContractFactory(
		'synthetix-2.50.4-ovm/contracts/SafeDecimalMath.sol:SafeDecimalMath'
	);
	const proxysUSDContract = await ethers.getContractFactory(
		'synthetix-2.50.4-ovm/contracts/ProxyERC20.sol:ProxyERC20'
	);

	let addressResolver = await addressResolverContract.attach(addressResolverAddress);
	let safeDecimalMath = await safeDecimalMathContract.attach(safeDecimalMathAddress);
	let proxysUSD = await proxysUSDContract.attach(proxysUSDAddress);

	// const addressResolver = snx.getTarget({ useOvm: true, contract: 'AddressResolver' });
	console.log('Found address resolver at:' + addressResolver.address);

	// const safeDecimalMath = snx.getTarget({ useOvm: true, contract: 'SafeDecimalMath' });
	console.log('Found safeDecimalMath at:' + safeDecimalMath.address);
	console.log('Found proxysUSD at:' + proxysUSD.address);

	const BinaryOptionMarketManager = await ethers.getContractFactory('BinaryOptionMarketManager');
	let binaryOptionMarketAddress = getTargetAddress('BinaryOptionMarketManager', network);
	let binaryOptionMarketManagerDeployed = await BinaryOptionMarketManager.attach(
		binaryOptionMarketAddress
	);
	console.log('BinaryOptionMarketManager attached to:', binaryOptionMarketManagerDeployed.address);

	const sAUDKey = toBytes32('ETH');
	const initialStrikePrice = w3utils.toWei('1');
	const now = await currentTime();

	let abi = ['function approve(address _spender, uint256 _value) public returns (bool success)'];
	let contract = new ethers.Contract(proxysUSD.address, abi, owner);
	let approval = await contract.approve(
		binaryOptionMarketManagerDeployed.address,
		w3utils.toWei('1000'),
		{
			from: owner.address,
		}
	);
	approval.wait().then(console.log('Done approving'));

	const result = await binaryOptionMarketManagerDeployed.createMarket(
		sAUDKey,
		w3utils.toWei('5000'),
		now + 360000,
		initialStrikePrice,
		false,
		ZERO_ADDRESS
	);
	let marketCreated;
	await result.wait().then(function(receipt) {
		console.log('receipt', receipt);
		let marketCreationArgs = receipt.events[receipt.events.length - 1].args;
		for (var key in marketCreationArgs) {
			if (marketCreationArgs.hasOwnProperty(key)) {
				if (key == 'market') {
					console.log('Market created at ' + marketCreationArgs[key]);
					marketCreated = marketCreationArgs[key];
				}
			}
		}
	});
	console.log('Verifying created at ' + marketCreated);

	await hre.run('verify:verify', {
		address: marketCreated,
		constructorArguments: [
			sAUDKey,
			w3utils.toWei('70000'),
			now + 3600000,
			initialStrikePrice,
			false,
			ZERO_ADDRESS,
		],
		contract: 'contracts/BinaryOptions/BinaryOptionMarket.sol:BinaryOptionMarket',
	});
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
