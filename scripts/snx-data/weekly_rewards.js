'use strict';

const fs = require('fs');
const ethers = require('ethers');
const { feesClaimed } = require('./util.js');
const { getL2Snapshot } = require('./l2/script.js');

const PROXY_FEE_POOL_ADDRESS = '0xb440dd674e1243644791a4adfe3a2abb0a92d309';
const ETHERSCAN_KEY = process.env.ETHERSCAN_KEY;

let txCount = 0;
let totalScores = 0;
let accountsScores = {};

async function getBlocks(start, end) {
	const blocks = [];
	let provider = new ethers.providers.EtherscanProvider('mainnet', ETHERSCAN_KEY);

	console.log('start timestamp', toTimestamp(start));
	console.log('end timestamp', toTimestamp(end));
	// TODO start < end exception

	const filter = {
		address: PROXY_FEE_POOL_ADDRESS,
		fromBlock: 0,
		topics: [ethers.utils.id('FeePeriodClosed(uint256)')],
	};
	const logs = await provider.getLogs(filter);
	for (let key in logs) {
		const blockNumber = logs[key].blockNumber;
		const block = await provider.getBlock(blockNumber);
		if (block.timestamp >= toTimestamp(start) && block.timestamp < toTimestamp(end)) {
			blocks.push(blockNumber);
		}
	}
	return blocks;
}

async function fetchData(start, end) {
	const blocks = await getBlocks(start, end);

	console.log(blocks);
	for (let i = 0; i < blocks.length; i++) {
		if (!blocks[i + 1]) break;

		const result = await feesClaimed(blocks[i], blocks[i + 1]);

		const resultL2 = await getL2Snapshot(blocks[i], blocks[i + 1]);

		let data = [],
			dataL2 = [];
		let weeklyReward = 0,
			weeklyRewardL2 = 0;
		for (var element in result) {
			weeklyReward += result[element].rewards;
			data.push({ account: result[element].account, rewards: result[element].rewards });
		}

		for (let [key, value] of Object.entries(resultL2)) {
			weeklyRewardL2 += value / 1e18;
			dataL2.push({ account: key, rewards: value / 1e18 });
		}

		if (dataL2.length) {
			// distribute 95% of weekly rewards to L1 and 5% to L2
			getWeeklyData(data, 95, weeklyReward);
			getWeeklyData(dataL2, 5, weeklyRewardL2);
		} else {
			getWeeklyData(data, 100, weeklyReward);
		}

		console.log('tx count for week ' + (i + 1) + ' -', result.length);
		console.log(
			'min block',
			blocks[i],
			'max block',
			blocks[i + 1],
			'diff',
			blocks[i + 1] - blocks[i]
		);
		txCount += result.length;
	}

	return accountsScores;
}

function toTimestamp(strDate) {
	var datum = Date.parse(strDate);
	return datum / 1000;
}

function getWeeklyData(data, percent, weeklyReward) {
	Object.keys(data).map(function(key, index) {
		const weeklyPercent = (data[index].rewards * percent) / weeklyReward;

		if (accountsScores[data[index].account]) {
			accountsScores[data[index].account] += weeklyPercent;
		} else {
			accountsScores[data[index].account] = weeklyPercent;
		}
		totalScores += weeklyPercent;
	});
}

async function main() {
	var args = process.argv.slice(2);

	const data = await fetchData(args[0], args[1]);

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
