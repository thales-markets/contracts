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
		console.log(
			"Error L1 network used! Deploy only on L2 Optimism. \nTry using '--network optimistic'"
		);
		return 0;
	}
	if (networkObj.chainId == 42) {
		networkObj.name = 'kovan';
		network = 'kovan';
		PaymentToken = getTargetAddress('ExoticUSD', network);
	}
	if (networkObj.chainId == 69) {
		networkObj.name = 'optimisticKovan';
		network = 'optimisticKovan';
		PaymentToken = getTargetAddress('ExoticUSD', network);
	}
	if (networkObj.chainId == 10) {
		networkObj.name = 'optimisticEthereum';
		network = 'optimisticEthereum';
		PaymentToken = getTargetAddress('ProxysUSD', network);
	}
	if (networkObj.chainId == 5) {
		networkObj.name = 'goerli';
		network = 'goerli';
		PaymentToken = getTargetAddress('ExoticUSD', network);
	}
	if (networkObj.chainId == 420) {
		networkObj.name = 'optimisticGoerli';
		network = 'optimisticGoerli';
		PaymentToken = getTargetAddress('ExoticUSD', network);
	}

	const ParlayAMM = await ethers.getContractFactory('ParlayMarketsAMM');
	const ParlayAMMAddress = getTargetAddress('ParlayAMM', network);
	const ParlayAMMDeployed = await ParlayAMM.attach(ParlayAMMAddress);

	const ParlayMarket = await ethers.getContractFactory('ParlayMarketMastercopy');

	const ParlayMarketDeployed = await ParlayMarket.deploy();
	await ParlayMarketDeployed.deployed();

	console.log('ParlayMarketDeployed Deployed on', ParlayMarketDeployed.address);
	setTargetAddress('ParlayMarketMastercopy', network, ParlayMarketDeployed.address);

	if (networkObj.chainId == 5 || networkObj.chainId == 42 || networkObj.chainId == 420) {
		await delay(5000);
		await ParlayAMMDeployed.setParlayMarketMastercopies(ParlayMarketDeployed.address, {
			from: owner.address,
		});
		console.log('ParlayMarketMastercopy set in Parlay AMM');
	}

	await delay(65000);
	try {
		await hre.run('verify:verify', {
			address: ParlayMarketDeployed.address,
			contract: 'contracts/SportMarkets/Parlay/ParlayMarketMastercopy.sol:ParlayMarketMastercopy',
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
	return new Promise(function (resolve) {
		setTimeout(resolve, time);
	});
}
