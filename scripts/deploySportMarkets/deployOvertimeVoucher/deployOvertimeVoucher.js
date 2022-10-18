const { ethers } = require('hardhat');
const { getTargetAddress, setTargetAddress } = require('../../helpers');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	let sUSDAddress;
	let sportsAMMAddress;
	let PaymentToken;

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
		PaymentToken = getTargetAddress('ExoticUSD', network);
	}
	if (networkObj.chainId == 5) {
		networkObj.name = 'goerli';
		network = 'goerli';
		PaymentToken = getTargetAddress('ExoticUSD', network);
	}
	sUSDAddress = PaymentToken;

	console.log('Account is: ' + owner.address);
	console.log('Network:' + network);

	// if (networkObj.chainId == 80001 || networkObj.chainId == 137) {
	// 	sUSDAddress = getTargetAddress('ProxyUSDC', network);
	// } else {
	// 	sUSDAddress = getTargetAddress('ProxysUSD', network);
	// }

	console.log('Proxy USD :', sUSDAddress);

	sportsAMMAddress = getTargetAddress('SportsAMM', network);
	let ParlayAMMAddress = getTargetAddress('ParlayAMM', network);
	console.log('Found sportsAMMAddress at:' + sportsAMMAddress);
	console.log('Found ParlayAMMAddress at:' + ParlayAMMAddress);

	const OvertimeVoucher = await ethers.getContractFactory('OvertimeVoucher');
	const OvertimeVoucherDeployed = await OvertimeVoucher.deploy(
		sUSDAddress,
		'https://thales-protocol.s3.eu-north-1.amazonaws.com/voucher1-20.png',
		'https://thales-protocol.s3.eu-north-1.amazonaws.com/voucher1-50.png',
		'https://thales-protocol.s3.eu-north-1.amazonaws.com/voucher1-100.png',
		'https://thales-protocol.s3.eu-north-1.amazonaws.com/voucher1-200.png',
		'https://thales-protocol.s3.eu-north-1.amazonaws.com/voucher1-500.png',
		'https://thales-protocol.s3.eu-north-1.amazonaws.com/voucher1-1000.png',
		sportsAMMAddress,
		ParlayAMMAddress
	);
	console.log('OvertimeVoucher deploying:');
	await delay(2000);
	await OvertimeVoucherDeployed.deployed();
	setTargetAddress('OvertimeVoucher', network, OvertimeVoucherDeployed.address);

	console.log('OvertimeVoucher deployed to:', OvertimeVoucherDeployed.address);

	await hre.run('verify:verify', {
		address: OvertimeVoucherDeployed.address,
		constructorArguments: [
			sUSDAddress,
			'https://thales-protocol.s3.eu-north-1.amazonaws.com/voucher1-20.png',
			'https://thales-protocol.s3.eu-north-1.amazonaws.com/voucher1-50.png',
			'https://thales-protocol.s3.eu-north-1.amazonaws.com/voucher1-100.png',
			'https://thales-protocol.s3.eu-north-1.amazonaws.com/voucher1-200.png',
			'https://thales-protocol.s3.eu-north-1.amazonaws.com/voucher1-500.png',
			'https://thales-protocol.s3.eu-north-1.amazonaws.com/voucher1-1000.png',
			sportsAMMAddress,
			ParlayAMMAddress,
		],
	});
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
