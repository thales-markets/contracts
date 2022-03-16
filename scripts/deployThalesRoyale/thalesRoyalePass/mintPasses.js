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

	// CHANGE for amount 30 * 20
	const approvedsUSD = w3utils.toWei('600');

	// CHANGE for eth amount to be send
	let ethToSend = ethers.utils.parseUnits('0.004');

	// CHANGE addresses
	players = [
		'0x752cdfdffaeebe73bb1388f69f94553ade64c988',
		'0x706D961Ab69d54a0FCbaa13E77842279A5724139',
		'0xdc5D225547FAdE385F34C2C139Bf043Adb2779c6',
		'0x3fb4185036dBf5E0322C23584948fa97597B482c',
		'0xa113824E1F3c08580C1638eF4B480BadF884f7bf',
		'0x98Ec0DAbCa4D663638F31BAE866f3F3Ab8eBD220',
		'0x9755e3d858a3310e9915e490104435ed4f0d7547',
		'0x9a29bbAfEB9D443cCdd3c4f8Ebd426Aacb20ef33',
		'0xb8c1b2704da2984b396bd199ef9a8ac19b2c98c1',
		'0x00Ae7Fe77AB7C4e77F894C76c167DC310766c57a',
		'0xb7aCFf9f8AdF276e89F1a85fe573A7C2e6A63bF6',
		'0x34feC027EE0a1ff0AEF548e6602cfdB4389479BB',
		'0x57D3017DB560Ea906E67cEeF0250348793C05053',
		'0x9cE2Cb750ECf2053Ac2526792f1DaC88E9508B41',
		'0x0bebe2165de412e7925ab8352e36f3b0493dd3b9',
		'0xEae03EB54eB26B38057544895E834aF42fc46A69',
		'0xf7f6f7ec25c52c3e4794c9e2d32020ec00c07dc2',
		'0x8989759b3e23511214ac89be112f4eb52cb6db3c',
		'0x2b5b64df5e31a31d2e48de94b15c2093bc4cc09c',
		'0x43c21cC46637Ae611d2b3BEEaD90A73aE56362b3'
	];

	/* ========== MINT ROYALE PASSES ========== */

	const ThalesRoyalePass = await ethers.getContractFactory('ThalesRoyalePass');
	const thalesRoyalePassAddress = getTargetAddress('ThalesRoyalePass', network);
	console.log('Found ThalesRoyalePass at:', thalesRoyalePassAddress);

	const royalePass = await ThalesRoyalePass.attach(thalesRoyalePassAddress);

	if (networkObj.chainId == 80001 || networkObj.chainId == 137) {
		ProxyERC20sUSDaddress = getTargetAddress('ProxyUSDC', network);
	} else {
		ProxyERC20sUSDaddress = getTargetAddress('ProxysUSD', network);
	}
	
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
