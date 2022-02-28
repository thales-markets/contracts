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

	// CHANGE for amount 30 * 20
	const approvedsUSD = w3utils.toWei('600');

	// CHANGE for eth amount to be send
	let ethToSend = ethers.utils.parseUnits('0.004');

	// CHANGE addresses
	players = [
		'0x0EE081687aeDbfcC29Af677a283b1d2f404a2516',
		'0x51ef44D4b09b998b214897cCc9973c46172C6D85',
		'0xDf5fa32B726a5118281e74aD3B7C707423e28F8B',
		'0x3fb4185036dBf5E0322C23584948fa97597B482c',
		'0xA82820D837490F27b0D548D9E1aaF29E798a2d12',
		'0x75200f08EB8Bae1Ca7b22e539aCA7Cefd64f82Ad',
		'0x7bcB720895900289395D5787Ee32e0016334962D',
		'0x9223F2e38510AA77ded779c5F22C67F4E8315EeA',
		'0xCAEC5eA92dDE2062B45E2Da100870eAC3e1866d3',
		'0x3852C563ccef8436468e5F5f07d1d9f282817391',
		'0x8be60fe9F7C8d940D8DA9d5dDD0D8E0c15A4288B',
		'0x95B9F2F528338b0cDB3F14442837b0e7F05DCEeC',
		'0x952580D41f10dB41d97fcd6B1984bC2538eEFC2c',
		'0x6C85553e86609Ba71f646bFdC506D65981a4a2D9',
		'0x2e9D73745E04A90A83Ba13303705d5534E38F296',
		'0x2cb9c829D2F7Dab6769B1207328D0441C6A8727D',
		'0xe626E8ca82603e3B44751f8562B5ED126d345140',
		'0x97ecF820857527480e06e8F775D9C9281BBA2267',
		'0x7C46d2356CF09F037599C00eE8f330D42A090Ee4',
		'0x70F8D86aC14548cE33Da8a3Fcd19076c56e0Ea9D'
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
