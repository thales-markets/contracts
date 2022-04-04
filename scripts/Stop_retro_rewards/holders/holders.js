const keccak256 = require('keccak256');
const Big = require('big.js');
var Contract = require('web3-eth-contract');
// set provider for all later instances to use
const Web3 = require('web3');
Contract.setProvider(
	new Web3.providers.HttpProvider('https://mainnet.infura.io/v3/27301cd3b3134269bfb2271a79a5beae')
);

var web3 = new Web3(
	new Web3.providers.HttpProvider('https://mainnet.infura.io/v3/27301cd3b3134269bfb2271a79a5beae')
);

const {
	numberExponentToLarge,
	txLog,
	setTargetAddress,
	getTargetAddress,
} = require('../../helpers.js');

const fs = require('fs');

let erc20ABI = require('./erc20ABI.json');
const thalesContract = new Contract(erc20ABI, '0x03E173Ad8d1581A4802d3B532AcE27a62c5B81dc');

async function checkDoDoDepositors() {
	let totalSupply = 0;
	let allTransferEvents = [];
	let startingBlock = 13204171;
	let blocksIncrement = 100000;
	let nextBlock = startingBlock + blocksIncrement;
	let currentBlock = await web3.eth.getBlockNumber();
	while (startingBlock <= currentBlock) {
		const transferEvents = await thalesContract.getPastEvents('Transfer', {
			fromBlock: startingBlock,
			toBlock: nextBlock,
		});
		allTransferEvents = allTransferEvents.concat(transferEvents);
		if (nextBlock >= currentBlock) {
			break;
		}
		startingBlock = nextBlock;
		nextBlock = startingBlock + blocksIncrement;
		if (nextBlock >= currentBlock) {
			nextBlock = currentBlock;
		}
	}

	//latest 14509255

	let stillHolding = [];
	let checkedAlready = new Set();
	for (let te in allTransferEvents) {
		let dev = allTransferEvents[te];
		console.log('checking depositor ' + dev.returnValues[1]);
		if (checkedAlready.has(dev.returnValues[1].toLowerCase())) {
			continue;
		}
		checkedAlready.add(dev.returnValues[1].toLowerCase());
		if (
			'0x03E173Ad8d1581A4802d3B532AcE27a62c5B81dc'.toLowerCase() ==
			dev.returnValues[1].toLowerCase()
		) {
			continue;
		}

		await thalesContract.methods
			.balanceOf(dev.returnValues[1])
			.call({ from: '0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe' })
			.then(async function(result) {
				if (result != '0') {
					let holder = {};
					holder.balance = result / 1e18;
					holder.address = dev.returnValues[1].toLowerCase();
					let contractChecker = await web3.eth.getCode(holder.address);
					let isContract = contractChecker != '0x';
					holder.isContract = isContract;
					console.log('Result is ' + result);
					stillHolding.push(holder);
					totalSupply = totalSupply + holder.balance;
				}
			});
	}

	console.log('Total supply is ' + totalSupply);

	stillHolding.sort(function(a, b) {
		// Compare the 2 dates
		if (a.balance > b.balance) return -1;
		if (a.balance < b.balance) return 1;
		return 0;
	});

	fs.writeFileSync(
		'scripts/Stop_retro_rewards/holders/holders.json',
		JSON.stringify(stillHolding),
		function(err) {
			if (err) return console.log(err);
		}
	);

	const ObjectsToCsv = require('objects-to-csv')
	const csv = new ObjectsToCsv(stillHolding);
	await csv.toDisk('scripts/Stop_retro_rewards/holders/holders.csv');
}

checkDoDoDepositors()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});
