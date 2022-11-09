const { ethers, upgrades } = require('hardhat');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');
const { toBytes32 } = require('../../../index');
const { setTargetAddress } = require('../../helpers');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	if (network === 'unknown') {
		network = 'localhost';
	}

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

	console.log('Account is: ' + owner.address);
	console.log('Network:' + network);
	console.log('Network id:' + networkObj.chainId);

	// thales
	const IUniswapV3PoolThales = await ethers.getContractAt(
		'IUniswapV3Pool',
		'0xff7fbdf7832ae524deda39ca402e03d92adff7a5'
	);
	// susd
	const IUniswapV3PoolsUSD = await ethers.getContractAt(
		'IUniswapV3Pool',
		'0x2e80d5a7b3c613d854ee43243ff09808108561eb'
	);

	const IUniswapFactory = await ethers.getContractAt(
		'IUniswapV3Factory',
		'0x1f98431c8ad98523631ae4a59f267346ea31f984'
	);

	// op kovan test
	// let pool = await IUniswapFactory.getPool('0x4200000000000000000000000000000000000006', '0xaA5068dC2B3AADE533d3e52C6eeaadC6a8154c57', 10000);
	// const IUniswapV3PoolsDAI = await ethers.getContractAt('IUniswapV3Pool', pool);
	// let daiResult = await IUniswapV3PoolsDAI.slot0();
	// console.log('dai Result is ' + daiResult[0].toString());
	let thalesResult = await IUniswapV3PoolThales.slot0();
	let sUSDResult = await IUniswapV3PoolsUSD.slot0();
	console.log('thales Result is ' + thalesResult[0].toString());
	console.log('susd Result is ' + sUSDResult[0].toString());

	console.log('token 0 susd', await IUniswapV3PoolsUSD.token0());
	console.log('token 1 susd', await IUniswapV3PoolsUSD.token1());

	console.log('token 0 THALES', await IUniswapV3PoolThales.token0());
	console.log('token 1 THALES', await IUniswapV3PoolThales.token1());
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
