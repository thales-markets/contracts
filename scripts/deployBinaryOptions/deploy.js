const { ethers } = require('hardhat');
const w3utils = require('web3-utils');
const snx = require('synthetix-2.50.4-ovm');
const { getTargetAddress, setTargetAddress } = require('../helpers');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	let priceFeedAddress, ProxyERC20sUSDaddress;

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

	if (networkObj.chainId == 10) {
		ProxyERC20sUSDaddress = getTargetAddress('ProxysUSD', network);
	} else if (networkObj.chainId == 69) {
		networkObj.name = 'optimisticKovan';
		ProxyERC20sUSDaddress = getTargetAddress('ProxysUSD', network);
	} else {
		const ProxyERC20sUSD = snx.getTarget({ network, contract: 'ProxyERC20sUSD' });
		ProxyERC20sUSDaddress = ProxyERC20sUSD.address;
	}

	console.log('Account is:' + owner.address);
	console.log('Network name:' + network);

	console.log('Found ProxyERC20sUSD at:' + ProxyERC20sUSDaddress);

	if (network == 'ropsten') {
		const ropstenPriceFeed = await ethers.getContractFactory('MockPriceFeed');
		PriceFeedDeployed = await ropstenPriceFeed.deploy(owner.address);
		await PriceFeedDeployed.deployed();
		setTargetAddress('PriceFeed', network, PriceFeedDeployed.address);
		setTargetAddress('MockPriceFeed', network, PriceFeedDeployed.address);
		console.log('MockPriceFeed deployed to:', PriceFeedDeployed.address);
		await PriceFeedDeployed.setPricetoReturn(w3utils.toWei('1000'));
		priceFeedAddress = PriceFeedDeployed.address;
		console.log('Adding aggregator', snx.toBytes32('ETH'), owner.address);
		await PriceFeedDeployed.addAggregator(snx.toBytes32('ETH'), owner.address);
	} else {
		priceFeedAddress = getTargetAddress('PriceFeed', network);
		console.log('Found PriceFeed at:' + priceFeedAddress);
	}

	// // We get the contract to deploy
	const BinaryOptionMastercopy = await ethers.getContractFactory('BinaryOptionMastercopy');
	const binaryOptionMastercopyDeployed = await BinaryOptionMastercopy.deploy();
	await binaryOptionMastercopyDeployed.deployed();

	console.log('BinaryOptionMastercopy deployed to:', binaryOptionMastercopyDeployed.address);
	setTargetAddress('BinaryOptionMastercopy', network, binaryOptionMastercopyDeployed.address);

	const BinaryOptionMarketMastercopy = await ethers.getContractFactory(
		'BinaryOptionMarketMastercopy'
	);
	const binaryOptionMarketMastercopyDeployed = await BinaryOptionMarketMastercopy.deploy();
	await binaryOptionMarketMastercopyDeployed.deployed();

	console.log(
		'binaryOptionMarketMastercopy deployed to:',
		binaryOptionMarketMastercopyDeployed.address
	);
	setTargetAddress(
		'BinaryOptionMarketMastercopy',
		network,
		binaryOptionMarketMastercopyDeployed.address
	);

	const day = 24 * 60 * 60;
	const expiryDuration = 26 * 7 * day; // Six months to exercise options before the market is destructible.
	const maxTimeToMaturity = 730 * day; // Markets may not be deployed more than two years in the future.
	let creatorCapitalRequirement = w3utils.toWei('1'); // 1 sUSD is required to create a new market for testnet, 1000 for mainnet.
	if (network == 'mainnet') {
		creatorCapitalRequirement = w3utils.toWei('1000');
	}

	const BinaryOptionMarketManager = await ethers.getContractFactory('BinaryOptionMarketManager');
	const binaryOptionMarketManagerDeployed = await BinaryOptionMarketManager.deploy(
		owner.address,
		ProxyERC20sUSDaddress,
		priceFeedAddress,
		expiryDuration,
		maxTimeToMaturity,
		creatorCapitalRequirement
	);
	await binaryOptionMarketManagerDeployed.deployed();

	console.log('binaryOptionMarketManager deployed to:', binaryOptionMarketManagerDeployed.address);

	setTargetAddress('BinaryOptionMarketManager', network, binaryOptionMarketManagerDeployed.address);

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

		let transaction = await binaryOptionMarketManagerDeployed.setWhitelistedAddresses(
			whitelistedAddresses
		);
		await transaction.wait().then(e => {
			console.log('BinaryOptionMarketManager: whitelistedAddresses set');
		});

		const BinaryOptionMarketFactory = await ethers.getContractFactory('BinaryOptionMarketFactory');
		const binaryOptionMarketFactoryDeployed = await BinaryOptionMarketFactory.deploy(owner.address);
		await binaryOptionMarketFactoryDeployed.deployed();

		console.log(
			'BinaryOptionMarketFactory deployed to:',
			binaryOptionMarketFactoryDeployed.address
		);
		setTargetAddress(
			'BinaryOptionMarketFactory',
			network,
			binaryOptionMarketFactoryDeployed.address
		);

		const BinaryOptionMarketData = await ethers.getContractFactory('BinaryOptionMarketData');
		const binaryOptionMarketData = await BinaryOptionMarketData.deploy();

		console.log('binaryOptionMarketData deployed to:', binaryOptionMarketData.address);

		setTargetAddress('BinaryOptionMarketData', network, binaryOptionMarketData.address);

		let LimitOrderProviderAddress = getTargetAddress('LimitOrderProvider', network);

		let tx = await binaryOptionMarketFactoryDeployed.setBinaryOptionMarketManager(
			binaryOptionMarketManagerDeployed.address
		);
		await tx.wait().then(e => {
			console.log('BinaryOptionMarketFactory: setBinaryOptionMarketManager');
		});
		tx = await binaryOptionMarketManagerDeployed.setBinaryOptionsMarketFactory(
			binaryOptionMarketFactoryDeployed.address
		);
		await tx.wait().then(e => {
			console.log('BinaryOptionMarketManager: setBinaryOptionsMarketFactory');
		});

		tx = await binaryOptionMarketFactoryDeployed.setBinaryOptionMarketMastercopy(
			binaryOptionMarketMastercopyDeployed.address
		);
		await tx.wait().then(e => {
			console.log('BinaryOptionMarketFactory: setBinaryOptionMarketMastercopy');
		});
		tx = await binaryOptionMarketFactoryDeployed.setBinaryOptionMastercopy(
			binaryOptionMastercopyDeployed.address
		);
		await tx.wait().then(e => {
			console.log('BinaryOptionMarketFactory: setBinaryOptionMastercopy');
		});

		if (LimitOrderProviderAddress) {
			tx = await binaryOptionMarketFactoryDeployed.setLimitOrderProvider(LimitOrderProviderAddress);
			await tx.wait().then(e => {
				console.log('BinaryOptionMarketFactory: setLimitOrderProvider');
			});
		}

		if (network == 'ropsten') {
			await hre.run('verify:verify', {
				address: binaryOptionMarketFactoryDeployed.address,
				constructorArguments: [owner.address],
			});

			await hre.run('verify:verify', {
				address: binaryOptionMastercopyDeployed.address,
				constructorArguments: [],
				contract: 'contracts/BinaryOptions/BinaryOptionMastercopy.sol:BinaryOptionMastercopy',
			});

			await hre.run('verify:verify', {
				address: binaryOptionMarketMastercopyDeployed.address,
				constructorArguments: [],
				contract:
					'contracts/BinaryOptions/BinaryOptionMarketMastercopy.sol:BinaryOptionMarketMastercopy',
			});

			await hre.run('verify:verify', {
				address: binaryOptionMarketData.address,
				constructorArguments: [],
			});

			await hre.run('verify:verify', {
				address: binaryOptionMarketManagerDeployed.address,
				constructorArguments: [
					owner.address,
					ProxyERC20sUSDaddress,
					priceFeedAddress,
					expiryDuration,
					maxTimeToMaturity,
					creatorCapitalRequirement,
				],
			});
		}

		await hre.run('verify:verify', {
			address: binaryOptionMarketFactoryDeployed.address,
			constructorArguments: [owner.address],
		});

		await hre.run('verify:verify', {
			address: binaryOptionMarketData.address,
			constructorArguments: [],
		});

		await hre.run('verify:verify', {
			address: binaryOptionMarketManagerDeployed.address,
			constructorArguments: [
				owner.address,
				ProxyERC20sUSDaddress,
				priceFeedAddress,
				expiryDuration,
				maxTimeToMaturity,
				creatorCapitalRequirement,
			],
		});

		await hre.run('verify:verify', {
			address: binaryOptionMastercopyDeployed.address,
			constructorArguments: [],
			contract: 'contracts/BinaryOptions/BinaryOptionMastercopy.sol:BinaryOptionMastercopy',
		});

		await hre.run('verify:verify', {
			address: binaryOptionMarketMastercopyDeployed.address,
			constructorArguments: [],
			contract:
				'contracts/BinaryOptions/BinaryOptionMarketMastercopy.sol:BinaryOptionMarketMastercopy',
		});
	}

	function delay(time) {
		return new Promise(function(resolve) {
			setTimeout(resolve, time);
		});
	}
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});
