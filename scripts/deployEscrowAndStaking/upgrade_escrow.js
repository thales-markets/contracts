const { ethers, upgrades } = require('hardhat');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');
const w3utils = require('web3-utils');
const snx = require('synthetix-2.50.4-ovm');
const { artifacts, contract, web3 } = require('hardhat');

const fs = require('fs');
const { getTargetAddress, setTargetAddress, encodeCall } = require('../helpers');

const user_key1 = process.env.PRIVATE_KEY;

async function main() {
	let accounts = await ethers.getSigners();
	// let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	if (networkObj.chainId == 10) {
		network = 'optimistic';
	}
	if (networkObj.chainId == 69) {
		network = 'optimisticKovan';
	}
	if (network == 'homestead') {
		network = 'mainnet';
	}

	const owner = new ethers.Wallet(user_key1, ethers.provider);

	console.log('Owner is:' + owner.address);
	console.log('Network name:' + network);

	if (networkObj.chainId == 69) {
		network = 'optimisticKovan';
	}
	const ProxyEscrow = getTargetAddress('EscrowThales', network);

	const NewEscrow = await ethers.getContractFactory('EscrowThales');
	console.log('Escrow upgraded');

	await upgrades.upgradeProxy(ProxyEscrow, NewEscrow);
	await delay(5000);

	const EscrowImplementation = await getImplementationAddress(ethers.provider, ProxyEscrow);
	console.log('Implementation Escrow: ', EscrowImplementation);
	setTargetAddress('EscrowThalesImplementation', network, EscrowImplementation);

	try {
		await hre.run('verify:verify', {
			address: EscrowImplementation,
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

function delay(time) {
	return new Promise(function(resolve) {
		setTimeout(resolve, time);
	});
}
