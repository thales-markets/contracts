const { ethers } = require('hardhat');
const { getTargetAddress} = require('../../helpers');
const w3utils = require('web3-utils');

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
		networkObj.name = 'optimistic';
		network = 'optimistic';
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

	const ProxyERC20sUSD = snx.getTarget({ network, contract: 'ProxyERC20sUSD' });
	console.log('Found ProxyERC20sUSD at:' + ProxyERC20sUSD.address);
	let abi = ['function approve(address _spender, uint256 _value) public returns (bool success)'];
	let contract = new ethers.Contract(ProxyERC20sUSD.address, abi, owner);	
	
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