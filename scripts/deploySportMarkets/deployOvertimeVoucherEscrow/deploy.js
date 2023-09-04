const { ethers, upgrades } = require('hardhat');
const { getTargetAddress, setTargetAddress } = require('../../helpers');
const w3utils = require('web3-utils');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');

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
	if (networkObj.chainId == 8453) {
		networkObj.name = 'baseMainnet';
		network = 'baseMainnet';
		proxySUSD = getTargetAddress('ProxyUSDC', network);
	}

	console.log('Account is: ' + owner.address);
	console.log('Network:' + network);
	console.log('Network id:' + networkObj.chainId);

	let overtimeVoucher = getTargetAddress('OvertimeVoucher', network);

	// required parm - set Vladan's HW as test
	let whitelistedAddresses = ['0x0d858351a5fb419c9a3760647900d2f7ad526c83'];

	console.log('Found ProxyERC20sUSD at:' + proxySUSD);

	const periodEnd = 1679657818;

	const VoucherEscrow = await ethers.getContractFactory('OvertimeVoucherEscrow');
	const voucherEscrow = await upgrades.deployProxy(VoucherEscrow, [
		owner.address,
		proxySUSD,
		overtimeVoucher,
		whitelistedAddresses,
		w3utils.toWei('5'),
		periodEnd,
	]);

	await voucherEscrow.deployed();

	console.log('OvertimeVoucherEscrow deployed to:', voucherEscrow.address);
	setTargetAddress('OvertimeVoucherEscrow', network, voucherEscrow.address);

	const implementation = await getImplementationAddress(ethers.provider, voucherEscrow.address);
	console.log('OvertimeVoucherEscrowImplementation: ', implementation);
	setTargetAddress('OvertimeVoucherEscrowImplementation', network, implementation);

	try {
		await hre.run('verify:verify', {
			address: implementation,
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
