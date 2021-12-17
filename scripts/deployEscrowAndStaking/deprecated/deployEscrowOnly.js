const { ethers } = require('hardhat');
const w3utils = require('web3-utils');
const snx = require('synthetix-2.50.4-ovm');
const { artifacts, contract, web3 } = require('hardhat');

const THALES_AMOUNT = web3.utils.toWei('200');

const fs = require('fs');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	if (network == 'homestead') {
		network = 'mainnet';
	}

	console.log('Account is:' + owner.address);
	console.log('Network name:' + networkObj.name);

	const thalesAddress = '0x3Cf560A59aa5Ca6A5294C2606544b08aDa9461a7'; //ropsten
	const EscrowThales = await ethers.getContractFactory('EscrowThales');
	const EscrowThalesDeployed = await EscrowThales.deploy(owner.address, thalesAddress);
	await EscrowThalesDeployed.deployed();

	console.log("EscrowThales deployed to: ", EscrowThalesDeployed.address);

	await hre.run('verify:verify', {
		address: EscrowThalesDeployed.address,
		constructorArguments: [owner.address, thalesAddress],
	});

}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});


function delay(time) {
	return new Promise(function (resolve) {
		setTimeout(resolve, time);
	});
}
