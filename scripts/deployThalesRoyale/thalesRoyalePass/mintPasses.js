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
		networkObj.name = 'optimistic';
		network = 'optimistic';
	}

	console.log('Account is: ' + owner.address);
	console.log('Network:' + network);
	console.log('Network id:' + networkObj.chainId);

	/* ========== PROPERTIES ========== */

	// CHANGE for amount 30 * 100
	const approvedsUSD = w3utils.toWei('3000');

	// CHANGE for eth amount to be send
	let ethToSend = ethers.utils.parseUnits('0.004');

	// CHANGE addresses
	players = [
		'0x835d18b633532a15F188f896dea31685761eB672',
		'0x36688C92700618f1D676698220F1AF44492811FE',
		'0xe966C59c15566A994391F6226fee5bc0eF70F87A',
	];

	/* ========== MINT ROYALE PASSES ========== */

	const ThalesRoyalePass = await ethers.getContractFactory('ThalesRoyalePass');
	const thalesRoyalePassAddress = getTargetAddress('ThalesRoyalePass', network);
	console.log('Found ThalesRoyalePass at:', thalesRoyalePassAddress);

	const royalePass = await ThalesRoyalePass.attach(thalesRoyalePassAddress);

	ProxyERC20sUSDaddress = getTargetAddress('ProxysUSD', network);
	console.log('Found ProxyERC20sUSD at:' + ProxyERC20sUSDaddress);

	let abi = ['function approve(address _spender, uint256 _value) public returns (bool success)'];
	let contract = new ethers.Contract(ProxyERC20sUSDaddress, abi, owner);

	console.log('No. players: ' + players.length);

	console.log('amount for approve: ' + approvedsUSD);

	let tx = await contract.approve(royalePass.address, approvedsUSD, {
		from: owner.address,
	});
	await tx.wait().then(e => {
		console.log('Approve tokens');
	});

	console.log('Done approving');

	// minting and send eth
	console.log('Start minting!');

	let successfullyMinted = false;
	let successfullyEthSend = false;
	for (let i = 0; i < players.length; ) {
		console.log('Minting/sending for: ' + players[i], ', which is ' + i);
		try {
			// mint
			if (!successfullyMinted) {
				console.log('Minting...');
				let tx = await royalePass.mint(players[i], { from: owner.address });
				await tx.wait().then(e => {
					txLog(tx, 'Pass minted to ' + players[i]);
				});

				successfullyMinted = true;
				console.log('Minted!');
			}

			// send eth
			if (!successfullyEthSend) {
				console.log('ETH sending...');
				tx = await owner.sendTransaction({
					to: players[i],
					value: ethToSend,
				});
				await tx.wait().then(e => {
					txLog(tx, 'send ETH to ' + players[i]);
				});
				successfullyEthSend = true;
				console.log('ETH send!');
			}

			successfullyMinted = false;
			successfullyEthSend = false;
			i++;
		} catch (e) {
			console.log('Retry');
			await delay(5000);
		}
	}

	console.log('Ended!');
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
