const { ethers } = require('hardhat');
const { getTargetAddress} = require('../../helpers');
const w3utils = require('web3-utils');
const snx = require('synthetix-2.50.4-ovm');

async function main() {
    
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	let ProxyERC20sUSDaddress;

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

	console.log('Account is: ' + owner.address);
	console.log('Network:' + network);
	console.log('Network id:' + networkObj.chainId);

    /* ========== PROPERTIES ========== */

	const season = 1; // CHANGE for season
	const initialFund = w3utils.toWei('1000'); // CHANGE for amount

    /* ========== PUT FUNDS IN ROYALE ========== */

	const ThalesRoyale = await ethers.getContractFactory('ThalesRoyale');
	const thalesRoyaleAddress = getTargetAddress('ThalesRoyale', network);
	console.log('Found ThalesRoyale at:', thalesRoyaleAddress);

    const royale = await ThalesRoyale.attach(
		thalesRoyaleAddress
	);

	if (networkObj.chainId == 80001 || networkObj.chainId == 137) {
		ProxyERC20sUSDaddress = getTargetAddress('ProxyUSDC', network);
	} else {
		ProxyERC20sUSDaddress = getTargetAddress('ProxysUSD', network);
	}

	console.log('Found ProxyERC20sUSD at:' + ProxyERC20sUSDaddress);

	let abi = ['function approve(address _spender, uint256 _value) public returns (bool success)'];
	let contract = new ethers.Contract(ProxyERC20sUSDaddress, abi, owner);	
	
	await contract.approve(royale.address, initialFund, {
		from: owner.address,
	});
	delay(5000); // need some time to  finish approval
	console.log('Done approving');

	// put funds
	let tx = await royale.putFunds(initialFund, season);
	
	await tx.wait().then(e => {
		console.log('Funds updated for a season: ', season);
	});

}

function delay(time) {
	return new Promise(function (resolve) {
		setTimeout(resolve, time);
	});
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});