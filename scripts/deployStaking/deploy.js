const { ethers } = require('hardhat');
const w3utils = require('web3-utils');
const snx = require('synthetix');
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

	let thalesAddress, EscrowThalesAddress;

	if(network == "ropsten") {
		thalesAddress = '0x3Cf560A59aa5Ca6A5294C2606544b08aDa9461a7'; //ropsten
	}
	console.log("Thales address: ", thalesAddress)

	if(network == "ropsten") {
		EscrowThalesAddress = '0x853e95761B8306E4Ca6ea3e2521cF69F3D380759'; //ropsten
	}
	console.log("EscrowThales address: ", EscrowThalesAddress)
	
	const ProxyERC20sUSD = snx.getTarget({ network, contract: 'ProxyERC20sUSD' });
    // console.log('Found ProxyERC20sUSD at:' + ProxyERC20sUSD.address);	
	// const ProxyERC20sUSD = '0x578C6B406D3C40fa2417CB810513B1E4822B4614'; 
	console.log("ProxyERC20sUSD address: ", ProxyERC20sUSD.address)

	const StakingThales = await ethers.getContractFactory('StakingThales');
	const StakingThalesDeployed = await StakingThales.deploy(owner.address, EscrowThalesAddress, thalesAddress, ProxyERC20sUSD.address);
	await StakingThalesDeployed.deployed();

	console.log("StakingThales deployed to: ", StakingThalesDeployed.address);

	await hre.run('verify:verify', {
		address: StakingThalesDeployed.address,
		constructorArguments: [owner.address, EscrowThalesAddress, thalesAddress, ProxyERC20sUSD.address],
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
