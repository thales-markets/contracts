'use strict';

const fs = require('fs');
const ethers = require('ethers');
const { feesClaimed, getXSNXSnapshot } = require('./util.js');

const PROXY_FEE_POOL_ADDRESS = '0xb440dd674e1243644791a4adfe3a2abb0a92d309';
const XSNX_ADMIN_PROXY = 0x7cd5e2d0056a7a7f09cbb86e540ef4f6dccc97dd;
const ETHERSCAN_KEY = process.env.ETHERSCAN_KEY;

let totalScores = 0;

// TODO - listen to the FeePeriodClosed event and then fetch block numbers
async function getBlocks() {
	const blocks = [];
	let provider = new ethers.providers.EtherscanProvider('mainnet', ETHERSCAN_KEY);

	const filter = {
		address: PROXY_FEE_POOL_ADDRESS,
		fromBlock: 0,
		topics: [ethers.utils.id('FeePeriodClosed(uint256)')],
	};
	const logs = await provider.getLogs(filter);
	blocks.push(logs[logs.length - 2].blockNumber);
	blocks.push(logs[logs.length - 1].blockNumber);

	return blocks;
}

async function fetchData() {
	let data = [],
		weeklyReward = 0,
		accountsScores = {};

	const blocks = await getBlocks();
	const result = await feesClaimed(blocks[0], blocks[1]);

	for (var element in result) {
		weeklyReward += result[element].rewards;
		data.push({ account: result[element].account, rewards: result[element].rewards });
	}

	Object.keys(data).map(function(key, index) {
		const weeklyPercent = (data[index].rewards * 100) / weeklyReward;

		if (accountsScores[data[index].account]) {
			accountsScores[data[index].account] += weeklyPercent;
		} else {
			accountsScores[data[index].account] = weeklyPercent;
		}
		totalScores += weeklyPercent;
	});

	console.log('tx count for last week', result.length);
	console.log('min block', blocks[0], 'max block', blocks[1], 'diff', blocks[1] - blocks[0]);

	// xSNX snapshot
	for (let [key, value] of Object.entries(accountsScores)) {
		if (key == XSNX_ADMIN_PROXY) {
			console.log('XSNX_ADMIN_PROXY score', value);

			let finalValue = 0;
			const snapshot = await getXSNXSnapshot(value, blocks[1]);
			for (let [snapshotKey, snapshotValue] of Object.entries(snapshot)) {
				accountsScores[snapshotKey] = snapshotValue;
				finalValue += snapshotValue;
			}

			// should be roughly the same value as XSNX_ADMIN_PROXY score
			console.log('finalValue', finalValue);

			accountsScores[key] = 0;
		}
	}

	return accountsScores;
}

async function main() {
	const data = await fetchData();

	fs.writeFileSync('scripts/snx-data/weekly_rewards.json', JSON.stringify(data), function(err) {
		if (err) return console.log(err);
	});

	console.log('accounts scores length', Object.keys(data).length);
	console.log('total scores', totalScores);
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});
