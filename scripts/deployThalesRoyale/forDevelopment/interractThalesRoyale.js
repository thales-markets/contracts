const { ethers } = require('hardhat');
const { getTargetAddress } = require('../../helpers');

var ethers2 = require('ethers');
var crypto = require('crypto');

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
		networkObj.name = 'optimisticEthereum';
		network = 'optimisticEthereum';
	}

	console.log('Account is: ' + owner.address);
	console.log('Network:' + network);

	// Dev env - deploy Thales.sol; Live env - use Thales.sol contract address
	const ThalesRoyale = await ethers.getContractFactory('ThalesRoyale');
	const ThalesRoyaleDeployed = await ThalesRoyale.attach(
		'0xb15d3070B829C542c72356EEb7157364A77fEE63'
	);

	for (let i = 0; i < 1000; i++) {
		var id = crypto.randomBytes(32).toString('hex');
		var privateKey = '0x' + id;

		var wallet = new ethers2.Wallet(privateKey);
		let tx = await ThalesRoyaleDeployed.signUpOnBehalf(wallet.address, { from: owner.address });
		await tx.wait().then(e => {
			console.log('signed up : ' + wallet.address);
		});
	}
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});
