const { ethers } = require('hardhat');
const { getTargetAddress, txLog } = require('../../helpers');
const w3utils = require('web3-utils');

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

	/* ========== MINT ROYALE PASSES ========== */

	const OvertimeVoucher = await ethers.getContractFactory('OvertimeVoucher');
	const OvertimeVoucherAddress = getTargetAddress('OvertimeVoucher', network);
	console.log('Found OvertimeVoucher at:', OvertimeVoucherAddress);

	const voucher = await OvertimeVoucher.attach(OvertimeVoucherAddress);

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

	let tx = await contract.approve(voucher.address, approvedsUSD, {
		from: owner.address,
	});
	await tx.wait().then((e) => {
		console.log('Approve tokens');
	});

	console.log('Done approving');

	// minting and send eth
	console.log('Start minting!');

	let addressToMintTo = '0x461783A831E6dB52D68Ba2f3194F6fd1E0087E04';
	let amountToMint = w3utils.toWei('20');

	console.log('Minting...');
	tx = await voucher.mint(addressToMintTo, amountToMint, { from: owner.address });
	await tx.wait().then((e) => {
		txLog(tx, 'Pass minted to ' + addressToMintTo);
	});

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
