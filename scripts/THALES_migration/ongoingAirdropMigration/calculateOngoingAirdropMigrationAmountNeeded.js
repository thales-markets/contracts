const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');
const { web3 } = require('hardhat');
const Big = require('big.js');
const { BigNumber } = require('ethers');

const {
	numberExponentToLarge,
	txLog,
	setTargetAddress,
	getTargetAddress,
} = require('../../helpers.js');

const fs = require('fs');
let lastAirdropHashes = require('../../../scripts/deployOngoingRewards/ongoing-airdrop-hashes-period-19.json');

async function calculate() {
	let i = 0;
	let totalAmount = BigNumber.from(0);
	let totalAmountContract = BigNumber.from(0);
	for (let airdropee of lastAirdropHashes) {
		let address = airdropee.address;
		address = address.toLowerCase();
		console.log('Processing ' + i + ' . address');
		let contractChecker = await web3.eth.getCode(address);
		let isContract = contractChecker != '0x';
		i++;
		if (!isContract) {
			let balance = BigNumber.from(airdropee.balance);
			totalAmount = totalAmount.add(balance);
		} else {
			let balance = BigNumber.from(airdropee.balance);
			totalAmountContract = totalAmountContract.add(balance);
		}
	}

	console.log('Total balance is ' + totalAmount.toString()/1e18);
	console.log('Total balance contracts is ' + totalAmountContract.toString()/1e18);

	// create merkle tree
}

calculate()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});
