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

	console.log('Account is: ' + owner.address);
	console.log('Network:' + network);

	const positionalMarketManagerAddress = getTargetAddress('PositionalMarketManager', network);
	console.log('Found PositionalMarketManager at:', positionalMarketManagerAddress);

	const PositionalMarketManager = await ethers.getContractFactory('PositionalMarketManager');
	await upgrades.upgradeProxy(positionalMarketManagerAddress, PositionalMarketManager);

	console.log('PositionalMarketManager upgraded');

	const positionalMarketManagerImplementation = await getImplementationAddress(ethers.provider, positionalMarketManagerAddress);
	setTargetAddress('PositionalMarketManagerImplementation', network, positionalMarketManagerImplementation);

	const PositionalMarketManagerDeployed = await PositionalMarketManager.attach(positionalMarketManagerAddress);

	const positionalMarketFactoryAddress = getTargetAddress('PositionalMarketFactory', network);
	tx = await PositionalMarketManagerDeployed.setPositionalMarketFactory(
		positionalMarketFactoryAddress
	);

	await tx.wait().then(e => {
		console.log('PositionalMarketManager: setPositionalMarketFactory');
	});

	// set whitelisted addresses for L2
	if (networkObj.chainId === 10 || networkObj.chainId === 69) {
		const whitelistedAddresses = [
			'0x9841484A4a6C0B61C4EEa71376D76453fd05eC9C',
			'0x461783A831E6dB52D68Ba2f3194F6fd1E0087E04',
			'0xb8D08D9537FC8E5624c298302137c5b5ce2F301D',
			'0x9f8e4ee788D9b00A3409584E18034aA7B736C396',
			'0xB27E08908D6Ecbe7F9555b9e048871532bE89302',
			'0x169379d950ceffa34f5d92e33e40B7F3787F0f71',
			'0xeBaCC96EA6449DB03732e11f807188e4E57CCa97',
			'0xFe0eBCACFcca78E2dab89210b70B6755Fe209419',
			'0xfE5F7Be0dB53D43829B5D22F7C4d1953400eA5CF',
			'0xa95c7e7d7b0c796f314cbb6f95593cbd67beb994',
			'0xe966C59c15566A994391F6226fee5bc0eF70F87A',
			'0x36688C92700618f1D676698220F1AF44492811FE',
			'0xAa32a69dCC7f0FB97312Ab9fC3a96326dDA124C4',
		];

		let transaction = await PositionalMarketManagerDeployed.setWhitelistedAddresses(
			whitelistedAddresses
		);
		await transaction.wait().then(e => {
			console.log('PositionalMarketManager: whitelistedAddresses set');
		});
	}


	try {
		await hre.run('verify:verify', {
			address: positionalMarketManagerImplementation,
		});
	} catch (e) {
		console.log(e);
	}
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});
