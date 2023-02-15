const { ethers, upgrades } = require('hardhat');
const { getTargetAddress, setTargetAddress } = require('../helpers');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');

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
	}
	if (networkObj.chainId == 5) {
		networkObj.name = 'goerli';
		network = 'goerli';
		PaymentToken = getTargetAddress('ExoticUSD', network);
	}
	if (networkObj.chainId == 42161) {
		networkObj.name = 'arbitrumOne';
		network = 'arbitrumOne';
		PaymentToken = getTargetAddress('ProxyUSDC', network);
	}

	console.log('Account is: ' + owner.address);
	console.log('Network:' + network);

	const SportsAMMAddress = getTargetAddress('SportsAMM', network);
	const ParlayAMMAddress = getTargetAddress('ParlayAMM', network);
	const referralsAddress = getTargetAddress('Referrals', network);
	console.log('Found Referrals at:', referralsAddress);
	console.log('Found SportsAMM at:', SportsAMMAddress);
	console.log('Found ParlayAMM at:', ParlayAMMAddress);

	const Referrals = await ethers.getContractFactory('Referrals');
	let ReferralsImplementation;
	if (networkObj.chainId == 10 || networkObj.chainId == 42161) {
		ReferralsImplementation = await upgrades.prepareUpgrade(referralsAddress, Referrals);
	} else {
		console.log('HERE');
		await upgrades.upgradeProxy(referralsAddress, Referrals);
		await delay(10000);
		ReferralsImplementation = await getImplementationAddress(ethers.provider, referralsAddress);

		const ReferralsDeployed = await Referrals.attach(referralsAddress);

		await ReferralsDeployed.setSportsAMM(SportsAMMAddress, ParlayAMMAddress, {
			from: owner.address,
		});
		console.log('Sports and Parlay updated');
	}

	console.log('Referrals upgraded');
	console.log('Implementation Referrals: ', ReferralsImplementation);
	await delay(1000);

	setTargetAddress('ReferralsImplementation', network, ReferralsImplementation);

	try {
		await hre.run('verify:verify', {
			address: ReferralsImplementation,
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
