const keccak256 = require('keccak256');
const { web3 } = require('hardhat');
const Big = require('big.js');
var Contract = require('web3-eth-contract');
// set provider for all later instances to use
const Web3 = require('web3');
Contract.setProvider(
	new Web3.providers.HttpProvider('https://mainnet.infura.io/v3/27301cd3b3134269bfb2271a79a5beae')
);

const {
	numberExponentToLarge,
	txLog,
	setTargetAddress,
	getTargetAddress,
} = require('../../helpers.js');

const fs = require('fs');
let dodoStakingAbi = require('./dodoAbi.json');
const dodoPool = new Contract(dodoStakingAbi, '0x136829c258E31B3AB1975Fe7D03d3870C3311651');

let dodoLPTokensAbi = require('./dodoLPTokensAbi.json');
const dodoLPTokens = new Contract(dodoLPTokensAbi, '0x031816fd297228e4fd537c1789d51509247d0b43');

const thalesContract = new Contract(dodoLPTokensAbi, '0x03E173Ad8d1581A4802d3B532AcE27a62c5B81dc');
const wethContract = new Contract(dodoLPTokensAbi, '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2');

async function checkDoDoDepositors() {
	const transferEvents = await dodoLPTokens.getPastEvents('Transfer', {
		fromBlock: 13233948,
		toBlock: 'latest',
	});

	let stillInLPToken = [];
	let checkedAlready = new Set();
	for (let te in transferEvents) {
		let dev = transferEvents[te];
		console.log('checking depositor ' + dev.returnValues[1]);
		if (checkedAlready.has(dev.returnValues[1].toLowerCase())) {
			continue;
		}
		checkedAlready.add(dev.returnValues[1].toLowerCase());
		if (
			'0x136829c258E31B3AB1975Fe7D03d3870C3311651'.toLowerCase() ==
			dev.returnValues[1].toLowerCase()
		) {
			continue;
		}

		if (
			'0x0000000000000000000000000000000000000000'.toLowerCase() ==
			dev.returnValues[1].toLowerCase()
		) {
			continue;
		}

		await dodoLPTokens.methods
			.balanceOf(dev.returnValues[1])
			.call({ from: '0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe' })
			.then(async function(result) {
				if (result != '0') {
					let lper = {};
					lper.balance = result / 1e18;
					lper.address = dev.returnValues[1].toLowerCase();
					console.log('Result is ' + result);
					stillInLPToken.push(lper);
				}
			});
	}

	stillInLPToken.sort(function(a, b) {
		// Compare the 2 dates
		if (a.balance > b.balance) return -1;
		if (a.balance < b.balance) return 1;
		return 0;
	});

	const depositEvents = await dodoPool.getPastEvents('Deposit', {
		fromBlock: 13234158,
		toBlock: 14436186,
	});

	let checkedAlreadyStaked = new Set();
	let stillInLPers = [];
	for (let de in depositEvents) {
		let dev = depositEvents[de];
		console.log('checking depositor ' + dev.returnValues[0]);
		if (checkedAlreadyStaked.has(dev.returnValues[0].toLowerCase())) {
			continue;
		}
		checkedAlreadyStaked.add(dev.returnValues[0].toLowerCase());
		if (
			'0x0000000000000000000000000000000000000000'.toLowerCase() ==
			dev.returnValues[0].toLowerCase()
		) {
			continue;
		}

		await dodoPool.methods
			.balanceOf(dev.returnValues[0])
			.call({ from: '0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe' })
			.then(async function(result) {
				if (result != '0') {
					let lper = {};
					lper.balance = result / 1e18;
					lper.address = dev.returnValues[0].toLowerCase();
					console.log('Result is ' + result);

					await dodoPool.methods
						.getPendingReward(dev.returnValues[0], 0)
						.call({ from: '0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe' })
						.then(function(result) {
							lper.pendingReward = result / 1e18;
							stillInLPers.push(lper);
						});
				}
			});
	}

	stillInLPers.sort(function(a, b) {
		// Compare the 2 dates
		if (a.balance > b.balance) return -1;
		if (a.balance < b.balance) return 1;
		return 0;
	});

	let mergedResult = [];
	let addressProcessed = new Set();

	let total = 0;

	stillInLPers.forEach(s => {
		if (addressProcessed.has(s.address.toLowerCase())) {
			console.log('PROBLEM, address ' + s.address.toLowerCase() + ' is repeated');
		} else {
			addressProcessed.add(s.address.toLowerCase());
			total = total + s.balance;
			mergedResult.push(s);
		}
	});

	stillInLPToken.forEach(s => {
		if (addressProcessed.has(s.address.toLowerCase())) {
			console.log(
				'PROBLEM, address ' +
					s.address.toLowerCase() +
					' is repeated. It has ' +
					s.balance +
					' LP tokens '
			);
			let obj = mergedResult.find(o => o.address.toLowerCase() == s.address.toLowerCase());
			obj.balance = obj.balance + s.balance;
			total = total + s.balance;
		} else {
			addressProcessed.add(s.address.toLowerCase());
			total = total + s.balance;
			mergedResult.push(s);
		}
	});

	console.log('Total is ' + total);

	mergedResult.sort(function(a, b) {
		// Compare the 2 dates
		if (a.balance > b.balance) return -1;
		if (a.balance < b.balance) return 1;
		return 0;
	});

	let totalLPSupply;
	await dodoLPTokens.methods
		.totalSupply()
		.call({ from: '0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe' })
		.then(async function(result) {
			if (result != '0') {
				totalLPSupply = result / 1e18;
				console.log('totalLPSupply is ' + totalLPSupply);
			}
		});

	let thalesInContract;
	await thalesContract.methods
		.balanceOf('0x031816fd297228e4fd537c1789d51509247d0b43')
		.call({ from: '0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe' })
		.then(async function(result) {
			if (result != '0') {
				thalesInContract = result / 1e18;
				console.log('thalesInContract is ' + thalesInContract);
			}
		});

	let wethInContract;
	await wethContract.methods
		.balanceOf('0x031816fd297228e4fd537c1789d51509247d0b43')
		.call({ from: '0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe' })
		.then(async function(result) {
			if (result != '0') {
				wethInContract = result / 1e18;
				console.log('wethInContract is ' + wethInContract);
			}
		});

	let thalesPerLPToken = thalesInContract / totalLPSupply;
	let wethPerLPToken = wethInContract / totalLPSupply;

	mergedResult.forEach(m => {
		m.totalThalesLP = m.balance * thalesPerLPToken;
		m.totalWETHLP = m.balance * wethPerLPToken;
		if (m.pendingReward) {
			m.totalThales = m.pendingReward * 1.0 + m.totalThalesLP;
		} else m.totalThales = m.totalThalesLP;
	});

	fs.writeFileSync(
		'scripts/Stop_retro_rewards/dodo/mergedResult.json',
		JSON.stringify(mergedResult),
		function(err) {
			if (err) return console.log(err);
		}
	);

	fs.writeFileSync(
		'scripts/Stop_retro_rewards/dodo/stillInLPToken.json',
		JSON.stringify(stillInLPToken),
		function(err) {
			if (err) return console.log(err);
		}
	);

	fs.writeFileSync(
		'scripts/Stop_retro_rewards/dodo/stillInLPers.json',
		JSON.stringify(stillInLPers),
		function(err) {
			if (err) return console.log(err);
		}
	);
}

checkDoDoDepositors()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});
