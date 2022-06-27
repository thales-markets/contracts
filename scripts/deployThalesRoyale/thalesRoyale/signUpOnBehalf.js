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

	const buyIn = w3utils.toWei('2700'); // CHANGE for amount 100 * 27

	players = [
		'0x00803232cc216eef9b396d6cfffd4b51e09f29da',
		'0x11219d61e95fc5930762b16868ddb2c9c6fc83fa',
		'0x1a207beefc754735871ceeb4c506686f044b1c41',
		'0x5e14c52c105c036c61ac707468f462003dc17c94',
		'0x9f8e4ee788d9b00a3409584e18034aa7b736c396',
		'0xe88857d67cf8e0031ca1674ffe17f72578e566ee',
		'0xf1b98463d6574c998f03e6edf6d7b4e5f917f915',
		'0x461783a831e6db52d68ba2f3194f6fd1e0087e04',
		'0x739f9535bcd439483a1538431f92f358a80f1801',
		'0xaa32a69dcc7f0fb97312ab9fc3a96326dda124c4',
		'0x26503d49bc36f0eac20f64d516a4fc09db549c38',
		'0x2a20f1334fbf92fbf610cfc7f6ae2d42d5456101',
		'0x9d89d94b429340feb333958216ef6c5c4c1c93c7',
		'0x3ebe9f00c3fccd09294a053dfe4ccf5a70787082',
		'0xb0c947d191a3ebca23a3d817434eb9842dd50731',
		'0x98ab20307fdaba1ce8b16d69d22461c6dbe85459',
		'0xe73304c94da7f7b32d86199bc967299da2a0fc19',
		'0xb729973d8c89c3225daf9bc2b2f2e6805f1e641b',
		'0x2e63ee889bb210392ced9c03d3c0bdaf97e1cc08',
		'0xb69e74324bc030f1b5409236efa461496d439116',
		'0x86d6b10c6121db9db75d7d9fdf10441ee17991e0',
		'0x7bd44402a58397c5251a902654b57624e64823f9',
		'0x935d2fd458fdf41b6f7b62471f593797866a3ce6',
		'0xdcb7e8f1b586c94dde9b430557e4df6727779aca',
		'0x687c1bc2ece8a5e2d81ad078d08b1187b86a3675',
		'0x9bb0819842d82e6f4436bbd2e2f7d1910929a882',
		'0xe29b7fb40150ea4b7cbc2f22e3acfa67a8da021a',
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
