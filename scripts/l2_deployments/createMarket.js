const { ethers } = require('hardhat');
const w3utils = require('web3-utils');

const { currentTime } = require('../../test/utils/index')();

const ZERO_ADDRESS = '0x' + '0'.repeat(40);

const { getTargetAddress } = require('../helpers');

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
		networkObj.name = 'optimisticEthereum';
		network = 'optimisticEthereum';
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

	console.log('Found address resolver at:' + addressResolver.address);

	console.log('Found safeDecimalMath at:' + safeDecimalMath.address);
	console.log('Found proxysUSD at:' + proxysUSD.address);

	const PositionalMarketManager = await ethers.getContractFactory('PositionalMarketManager');
	let PositionalMarketAddress = getTargetAddress('PositionalMarketManager', network);
	let PositionalMarketManagerDeployed = await PositionalMarketManager.attach(
		PositionalMarketAddress
	);
	console.log('PositionalMarketManager attached to:', PositionalMarketManagerDeployed.address);

	const ETHKey = toBytes32('ETH');
	const initialMint = w3utils.toWei('1');
	const now = await currentTime();

	let abi = ['function approve(address _spender, uint256 _value) public returns (bool success)'];
	let contract = new ethers.Contract(proxysUSD.address, abi, owner);
	let approval = await contract.approve(
		PositionalMarketManagerDeployed.address,
		w3utils.toWei('1000'),
		{
			from: owner.address,
		}
	);
	approval.wait().then(console.log('Done approving'));

	const hour = 60 * 60;

	const result = await PositionalMarketManagerDeployed.createMarket(
		ETHKey,
		w3utils.toWei('3400'),
		now + hour * 72,
		initialMint,
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
			ETHKey,
			w3utils.toWei('4000'),
			now + hour * 72,
			initialMint,
			false,
			ZERO_ADDRESS,
		],
		contract: 'contracts/Positions/PositionalMarket.sol:PositionalMarket',
	});
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});
