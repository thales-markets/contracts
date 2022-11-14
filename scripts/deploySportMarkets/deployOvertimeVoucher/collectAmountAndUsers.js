const { ethers } = require('hardhat');
const { getTargetAddress, txLog } = require('../../helpers');
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

	const OvertimeVoucher = await ethers.getContractFactory('OvertimeVoucher');
	const OvertimeVoucherAddress = getTargetAddress('OvertimeVoucher', network);
	console.log('Found OvertimeVoucher at:', OvertimeVoucherAddress);

	const voucher = await OvertimeVoucher.attach(OvertimeVoucherAddress);

	console.log('Fetching...');

	for (let voucherNumber = 1; voucherNumber <= 157; ) {
		try {
			let amount = await voucher.amountInVoucher(voucherNumber, { from: owner.address });
			console.log(
				'Amount on vaucher ' +
					voucherNumber +
					', is: ' +
					amount +
					', amount in sUSD: ' +
					amount / 1e18
			);
			voucherNumber++;
		} catch (e) {}
	}

	console.log('Ended!');
}

function delay(time) {
	return new Promise(function (resolve) {
		setTimeout(resolve, time);
	});
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
