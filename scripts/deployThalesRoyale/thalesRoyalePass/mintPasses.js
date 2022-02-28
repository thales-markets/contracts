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

	// CHANGE for amount 30 * 10
	const approvedsUSD = w3utils.toWei('300');

	// CHANGE for eth amount to be send
	let ethToSend = ethers.utils.parseUnits('0.004');

	// CHANGE addresses
	players = [
		'0x2dB3c0F42022FDC8dfE70036Fee85e48a24B88af',
		'0x86AABcD459587bC1A347aE1E2d15223856354EC9',
		'0xA03218F18B26E124d1D0BeB0B0f8Dd12b25bE47e',
		'0x2A20F1334fbf92fbf610CfC7F6ae2D42D5456101',
		'0x526D4023E9fAa34c8D2EDBa29C34e54390919f95',
		'0x625Aeae32804efC8ed809734449276c3970a560c',
		'0x1f2B0633BB0623dCCebE57932d6731Ae93f5213E',
		'0x17990Cb7FbE68b7c2A31a9976970466CD1e7FEd9',
		'0x9A44394ffd96a78d0B5c5b2f5DCFF6052C70176d',
		'0xE3a44DD2a8C108bE56A78635121Ec914074dA16D'
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
