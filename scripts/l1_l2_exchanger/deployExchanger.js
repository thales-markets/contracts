const { ethers, upgrades } = require('hardhat');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');

const { getTargetAddress, setTargetAddress } = require('../helpers');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	let net_optimistic = '';

	if (network == 'homestead') {
		network = 'mainnet';
		net_optimistic = 'optimisticEthereum';
	}
	if (networkObj.chainId == 42) {
		network = 'kovan';
		net_optimistic = 'optimisticKovan';
	}
	if (networkObj.chainId == 69) {
		console.log(
			"Error L2 network used! Deploy only on L1 Mainnet. \nTry using '--network mainnet'"
		);
		return 0;
	}
	if (networkObj.chainId == 10) {
		console.log(
			"Error L2 network used! Deploy only on L1 Mainnet. \nTry using '--network mainnet'"
		);
		return 0;
	}

	const ProxyThalesExchanger = await ethers.getContractFactory('ThalesExchanger');
	const ThalesAddress = getTargetAddress('Thales', network);
	const OpThalesL1Address = getTargetAddress('OpThales_L1', network);
	const OpThalesL2Address = getTargetAddress('OpThales_L2', net_optimistic);
	const L1StandardBridgeAddress = getTargetAddress('L1StandardBridge', network);

	if (
		ThalesAddress == undefined ||
		OpThalesL1Address == undefined ||
		OpThalesL2Address == undefined ||
		L1StandardBridgeAddress == undefined
	) {
		console.log('Some deployments are missing');
		console.log(
			'Thales:',
			ThalesAddress,
			'\nOpThales on L1: ',
			OpThalesL1Address,
			'\nOpThales on L2: ',
			OpThalesL2Address,
			'\nL1 Standard Bridge: ',
			L1StandardBridgeAddress
		);
		return 0;
	}

	console.log('Thales on L1: ', ThalesAddress);
	console.log('OpThales on L1: ', OpThalesL1Address);
	console.log('OpThales on L2: ', OpThalesL2Address);

	console.log('L1 Standard Bridge on L1: ', L1StandardBridgeAddress);

	const ProxyThalesExchanger_deployed = await upgrades.deployProxy(ProxyThalesExchanger, [
		owner.address,
		ThalesAddress,
		OpThalesL1Address,
		L1StandardBridgeAddress,
		OpThalesL2Address,
	]);
	await ProxyThalesExchanger_deployed.deployed;

	console.log('Proxy Thales Exchanger deployed:', ProxyThalesExchanger_deployed.address);
	const ProxyThalesExchangerImplementation = await getImplementationAddress(
		ethers.provider,
		ProxyThalesExchanger_deployed.address
	);

	console.log('Implementation ProxyThalesExchanger: ', ProxyThalesExchangerImplementation);
	setTargetAddress('ProxyThalesExchanger', network, ProxyThalesExchanger_deployed.address);
	setTargetAddress(
		'ProxyThalesExchangerImplementation',
		network,
		ProxyThalesExchangerImplementation
	);

	try {
		await hre.run('verify:verify', {
			address: ProxyThalesExchangerImplementation,
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
