const { ethers, upgrades } = require('hardhat');
const { getTargetAddress, setTargetAddress } = require('../../helpers');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;

	let proxySUSD;

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
		proxySUSD = getTargetAddress('ProxysUSD', network);
	}

	if (networkObj.chainId == 80001) {
		networkObj.name = 'polygonMumbai';
		network = 'polygonMumbai';
	}

	if (networkObj.chainId == 137) {
		networkObj.name = 'polygon';
		network = 'polygon';
	}

	if (networkObj.chainId == 420) {
		networkObj.name = 'optimisticGoerli';
		network = 'optimisticGoerli';
		proxySUSD = getTargetAddress('ExoticUSD', network);
	}

	if (networkObj.chainId == 42161) {
		networkObj.name = 'arbitrumOne';
		network = 'arbitrumOne';
		proxySUSD = getTargetAddress('ProxyUSDC', network);
	}

	console.log('Account is: ' + owner.address);
	console.log('Network:' + network);

	const parlayAMMLiquidityPoolAddress = getTargetAddress('ParlayAMMLiquidityPool', network);
	console.log('Found ParlayAMMLiquidityPool at:', parlayAMMLiquidityPoolAddress);

	const ParlayAMMLiquidityPool = await ethers.getContractFactory('ParlayAMMLiquidityPool');

	let parlayLP = ParlayAMMLiquidityPool.attach(parlayAMMLiquidityPoolAddress);
	let round = await parlayLP.round();
	let roundPool = await parlayLP.roundPools(round.toString());
	let numOfTradingMarketsPerRound = await parlayLP.getTradingMarketsPerRound(round);
	console.log('Pool round: ', round.toString());
	console.log('Pool round: ', roundPool);
	console.log('Num of Markets in Round: ', numOfTradingMarketsPerRound.toString());
	let market;
	let alreadyExercised = false;
	let notExercisedMarkets = [];
	numOfTradingMarketsPerRound = parseInt(numOfTradingMarketsPerRound);
	for (let i = 0; i < numOfTradingMarketsPerRound; i++) {
		market = await parlayLP.tradingMarketsPerRound(round, i);
		console.log(i, market);
		alreadyExercised = await parlayLP.marketAlreadyExercisedInRound(round, market);
		if (!alreadyExercised) {
			notExercisedMarkets.push(market);
		}
	}
	console.log(
		'Closed markets in round: ',
		numOfTradingMarketsPerRound - notExercisedMarkets.length
	);
	console.log('Pending closure in round: ', notExercisedMarkets.length);
	console.log('Pending markets: \n', notExercisedMarkets);
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
