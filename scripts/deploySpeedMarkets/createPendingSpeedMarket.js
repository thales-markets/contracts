const { ethers } = require('hardhat');
const { getTargetAddress } = require('../helpers');
const { toBytes32 } = require('../../index');

async function main() {
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;

	if (network === 'unknown') {
		network = 'localhost';
	}

	if (network == 'homestead') {
		network = 'mainnet';
	}

	if (networkObj.chainId == 10) {
		networkObj.name = 'optimisticEthereum';
		network = 'optimisticEthereum';
	}

	if (networkObj.chainId == 11155420) {
		networkObj.name = 'optimisticSepolia';
		network = 'optimisticSepolia';
	}

	if (networkObj.chainId == 42161) {
		networkObj.name = 'arbitrumOne';
		network = 'arbitrumOne';
	}

	if (networkObj.chainId == 8453) {
		networkObj.name = 'baseMainnet';
		network = 'baseMainnet';
	}

	if (networkObj.chainId == 137) {
		networkObj.name = 'polygon';
		network = 'polygon';
	}

	let accounts = await ethers.getSigners();
	let owner = accounts[0];

	console.log('Owner is: ' + owner.address);
	console.log('Network:' + network);
	console.log('Network id:' + networkObj.chainId);

	// Get the deployed SpeedMarketsAMMCreator contract
	const speedMarketsAMMCreatorAddress = getTargetAddress('SpeedMarketsAMMCreator', network);
	console.log('SpeedMarketsAMMCreator address:', speedMarketsAMMCreatorAddress);

	const SpeedMarketsAMMCreator = await ethers.getContractFactory('SpeedMarketsAMMCreator');
	const speedMarketsAMMCreator = await SpeedMarketsAMMCreator.attach(speedMarketsAMMCreatorAddress);

	// Parameters for the pending speed market based on the example
	const params = {
		asset: toBytes32('BTC'), // BTC asset
		strikeTime: 0, // 0 for current time
		delta: 60, // 60 seconds
		strikePrice: '11529290606949', // Strike price 115292
		strikePriceSlippage: '5000000000000000', // 0.5% slippage (0.005 * 1e18)
		direction: 0, // 0 for UP
		collateral: '0x0000000000000000000000000000000000000000', // Zero address for default collateral
		buyinAmount: '2640147', // Buy-in amount
		referrer: '0x0000000000000000000000000000000000000000', // Referrer address
		skewImpact: 0, // No skew impact
	};

	console.log('\nAdding pending speed market with parameters:');
	console.log('Asset:', 'BTC');
	console.log('Strike Time:', params.strikeTime);
	console.log('Delta:', params.delta, 'seconds');
	console.log('Strike Price:', params.strikePrice);
	console.log('Strike Price Slippage:', params.strikePriceSlippage);
	console.log('Direction:', params.direction === 0 ? 'UP' : 'DOWN');
	console.log('Collateral:', params.collateral);
	console.log('Buy-in Amount:', params.buyinAmount);
	console.log('Referrer:', params.referrer);
	console.log('Skew Impact:', params.skewImpact);

	// Create transaction to add pending speed market
	const tx = await speedMarketsAMMCreator.addPendingSpeedMarket([
		params.asset,
		params.strikeTime,
		params.delta,
		params.strikePrice,
		params.strikePriceSlippage,
		params.direction,
		params.collateral,
		params.buyinAmount,
		params.referrer,
		params.skewImpact,
	]);

	console.log('\nTransaction hash:', tx.hash);
	const receipt = await tx.wait();
	console.log('Transaction confirmed in block:', receipt.blockNumber);

	// Get the pending markets size
	const pendingSize = await speedMarketsAMMCreator.getPendingSpeedMarketsSize();
	console.log('\nTotal pending speed markets:', pendingSize.toString());

	// Check if AddSpeedMarket event was emitted
	const addSpeedMarketEvent = receipt.events?.find((e) => e.event === 'AddSpeedMarket');
	if (addSpeedMarketEvent) {
		console.log('\nPending speed market added successfully!');
		console.log('Event data:', addSpeedMarketEvent.args);
	}

	console.log('\nScript completed successfully!');
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
