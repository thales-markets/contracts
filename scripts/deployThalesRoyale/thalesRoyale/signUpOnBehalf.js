const { ethers } = require('hardhat');
const { getTargetAddress, txLog } = require('../../helpers');
const w3utils = require('web3-utils');
var crypto = require('crypto');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	let players = [];
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

	const buyIn = w3utils.toWei('2600'); // CHANGE for amount 100 * 26

	players = [
		'0x9EaADa91D759d3E67f1394583b8fC9299a910c88',
		'0xe966C59c15566A994391F6226fee5bc0eF70F87A',
	];

	/* ========== SIGN IN ROYALE ========== */

	const ThalesRoyale = await ethers.getContractFactory('ThalesRoyale');
	const thalesRoyaleAddress = getTargetAddress('ThalesRoyale', network);
	console.log('Found ThalesRoyale at:', thalesRoyaleAddress);

	const royale = await ThalesRoyale.attach(thalesRoyaleAddress);

	if (networkObj.chainId == 80001 || networkObj.chainId == 137) {
		ProxyERC20sUSDaddress = getTargetAddress('ProxyUSDC', network);
	} else {
		ProxyERC20sUSDaddress = getTargetAddress('ProxysUSD', network);
	}

	console.log('Found ProxyERC20sUSD at:' + ProxyERC20sUSDaddress);

	let abi = ['function approve(address _spender, uint256 _value) public returns (bool success)'];
	let contract = new ethers.Contract(ProxyERC20sUSDaddress, abi, owner);

	console.log('No. players: ' + players.length);

	console.log('amount for approve: ' + buyIn);

	await contract.approve(royale.address, buyIn, {
		from: owner.address,
	});
	delay(5000); // need some time to  finish approval

	console.log('Done approving');

	// sign in
	console.log('Starting sign up!');

	//sign in on behalf
	for (let i = 0; i < players.length; ) {
		console.log('Sign up ' + players[i], ', which is ' + i);
		try {
			let tx = await royale.signUpOnBehalf(players[i], { from: owner.address });

			await tx.wait().then(e => {
				txLog(tx, 'Signed up: ' + players[i]);
			});
			i++;
		} catch (e) {
			console.log('Retry');
		}
	}

	console.log('Ended sign up!');
}

function delay(time) {
	return new Promise(function(resolve) {
		setTimeout(resolve, time);
	});
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});
