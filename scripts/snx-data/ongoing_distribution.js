'use strict';

const fs = require('fs');
const ethers = require('ethers');
const { feesClaimed, getXSNXSnapshot, getYearnSnapshot } = require('./util.js');
const { getCurrentSnapshotViaGraph } = require('./l2/new_script.js');

const PROXY_FEE_POOL_ADDRESS = '0xb440dd674e1243644791a4adfe3a2abb0a92d309';
const YEARN_STAKING_ADDRESS = 0xc9a62e09834cedcff8c136f33d0ae3406aea66bd;
const ETHERSCAN_KEY = process.env.ETHERSCAN_KEY;

let txCount = 0;
let totalScores = 0;
let accountsScores = {};

async function getBlocks(start, end) {
	const blocks = [];
	let provider = new ethers.providers.EtherscanProvider('mainnet', ETHERSCAN_KEY);

	const startTimestamp = toTimestamp(start); // yyyy-mm-dd 00:00:00
	const endTimestamp = toTimestamp(end) + 24 * 3600 - 1; // yyyy-mm-dd 23:59:59

	console.log('start timestamp', startTimestamp);
	console.log('end timestamp', endTimestamp);
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
		if (block.timestamp >= startTimestamp && block.timestamp < endTimestamp) {
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

		const result = await getCurrentSnapshotViaGraph(
			'https://api.thegraph.com/subgraphs/name/synthetixio-team/synthetix'
		);
		const resultL2 = await getCurrentSnapshotViaGraph(
			'https://api.thegraph.com/subgraphs/name/synthetixio-team/optimism-issuance'
		);

		let data = [],
			dataL2 = [];
		let weeklyReward = 0,
			weeklyRewardL2 = 0;

		for (let [key, value] of Object.entries(result)) {
			weeklyReward += value / 1e18;
			data.push({ account: key.toLowerCase(), rewards: value / 1e18 });
		}

		for (let [key, value] of Object.entries(resultL2)) {
			weeklyRewardL2 += value / 1e18;
			dataL2.push({ account: key.toLowerCase(), rewards: value / 1e18 });
		}

		if (dataL2.length) {
			// distribute 95% of weekly rewards to L1 and 5% to L2
			getWeeklyData(data, 88, weeklyReward);
			getWeeklyData(dataL2, 12, weeklyRewardL2);
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

		// Yearn snapshot
		for (let [key, value] of Object.entries(accountsScores)) {
			if (key == YEARN_STAKING_ADDRESS) {
				console.log('YEARN_STAKING_ADDRESS score', value);

				let finalValueYearn = 0;
				const yearnSnapshot = await getYearnSnapshot(value, 0, blocks[blocks.length - 1]);
				for (let [snapshotKey, snapshotValue] of Object.entries(yearnSnapshot)) {
					if (accountsScores[snapshotKey.toLowerCase()]) {
						accountsScores[snapshotKey.toLowerCase()] += snapshotValue;
					} else {
						accountsScores[snapshotKey.toLowerCase()] = snapshotValue;
					}
					finalValueYearn += snapshotValue;
				}

				// should be roughly the same value as YEARN_STAKING_ADDRESS score
				console.log('finalValue yearn', finalValueYearn);

				accountsScores[key] = 0;
			}
		}
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

		if (accountsScores[data[index].account.toLowerCase()]) {
			accountsScores[data[index].account.toLowerCase()] += weeklyPercent;
		} else {
			accountsScores[data[index].account.toLowerCase()] = weeklyPercent;
		}
		totalScores += weeklyPercent;
	});
}

async function main() {
	var args = process.argv.slice(2);

	const data = await fetchData(args[0], args[1]);

	fs.writeFileSync('scripts/snx-data/ongoing_distribution.json', JSON.stringify(data), function(
		err
	) {
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
