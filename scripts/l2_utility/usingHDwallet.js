const hre = require('hardhat');
const sendToAddress = process.env.PERSONAL_ADD;
const { LedgerSigner } = require('@ethersproject/hardware-wallets');

async function main() {
	// IMPORTANT -------------------------------------------------->
	// Works on windows (if all drivers are installed)
	// IN LINUX
	// Use command:  wget -q -O - https://raw.githubusercontent.com/LedgerHQ/udev-rules/master/add_udev_rules.sh | sudo bash
	// to add the device

	const path = "m/44'/60'/0'/0";
	const ledger = new LedgerSigner(hre.ethers.provider, 'hid', path);
	const ledger_network = await ledger.provider.getNetwork();

	let address = await ledger.getAddress();
	let balance = await ledger.getBalance();
	console.log('Ledger path:', ledger.path);
	console.log('\nLedger address:', address);
	console.log('\nLedger balance:', balance.toString());

	console.log('\nSign transaction');
	const tx = await ledger.sendTransaction({
		to: sendToAddress,
		value: ethers.utils.parseEther('0.002'),
	});
	await tx.wait().then(e => {
		console.log('Done transfer! $$$$ >');
	});

	const SnxRewards = await ethers.getContractFactory('TestThalesRoyale');
	const SNXRewards_connected = await SnxRewards.connect(ledger);
	console.log('\nSign deployment');
	const SNXRewards_deployed = await SNXRewards_connected.deploy();
	await SNXRewards_deployed.deployed();
	console.log('\nDummy contract deployed to:', SNXRewards_deployed.address);
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});

function delay(time) {
	return new Promise(function(resolve) {
		setTimeout(resolve, time);
	});
}
