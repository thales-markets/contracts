const { ethers } = require('hardhat');
const w3utils = require('web3-utils');
const snx = require('synthetix');

const { toBytes32 } = require('../../index');

//let managerAddress = '0x46d9DB2830C005e38878b241199bb09d9d355994'; //kovan
let managerAddress = '0x5ed98Ebb66A929758C7Fe5Ac60c979aDF0F4040a'; //ropsten

//let FLIPPENING_RATIO_ORACLE = '0x5FbDB2315678afecb367f032d93F642f64180aa3'; // localhost
let FLIPPENING_RATIO_ORACLE = '0x26D5eF01dC5De340570a6e617a62bDb4383Ba1f7'; // ropsten

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

	let FlippeningRatioOracleInstanceContract = await ethers.getContractFactory('FlippeningRatioOracleInstance');

	let maturityDate = Math.round(Date.parse('13 DEC 2021 00:00:00 GMT') / 1000);

	const ProxyERC20sUSD = snx.getTarget({ network, contract: 'ProxyERC20sUSD' });
	console.log('Found ProxyERC20sUSD at:' + ProxyERC20sUSD.address);
	let abi = ['function approve(address _spender, uint256 _value) public returns (bool success)'];
	let contract = new ethers.Contract(ProxyERC20sUSD.address, abi, owner);
	await contract.approve(manager.address, w3utils.toWei('10000'), {
		from: owner.address,
	});
	console.log('Done approving');

	let oracleInstanceAddress = await createOracleInstance(
		FlippeningRatioOracleInstanceContract,
		owner.address,
		flippeningRatioOracle.address,
        'BTC/ETH Flippening Market',
		w3utils.toWei('2.5'),
	);
	await createMarket(manager, maturityDate, fundingAmount, oracleInstanceAddress);

	//-----verifications

	await hre.run('verify:verify', {
		address: oracleInstanceAddress,
		constructorArguments: [
			owner.address,
			flippeningRatioOracle.address,
			'BTC/ETH Flippening Market',
			w3utils.toWei('2.5'),
		],
		contract: 'contracts/customOracle/FlippeningRatioOracleInstance.sol:FlippeningRatioOracleInstance',
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
	ratio
) {
	const FlippeningRatioOracleInstanceContractDeployed = await FlippeningRatioOracleInstanceContract.deploy(
		ownerAddress,
		flippeningRatioOracleContractDeployedAddress,
		marketName,
	    ratio
	);
	await FlippeningRatioOracleInstanceContractDeployed.deployed();

	console.log('FlippeningRatioOracleInstanceContractDeployed deployed to:', FlippeningRatioOracleInstanceContractDeployed.address);
	console.log(
		'with params marketName ' + marketName + ' ratio ' + ratio
	);

	return FlippeningRatioOracleInstanceContractDeployed.address;
}
