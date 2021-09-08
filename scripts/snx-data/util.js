'use strict';

const snxData = require('synthetix-data');
const { getSnapshot } = require('./xsnx-snapshot/getSnapshot');
const { getYearnData } = require('./yearn/script');

const MAX_RESULTS = 5000;

const getHashFromId = id => id.split('-')[0];

const feesClaimed = async (minBlock, maxBlock) => {
	return snxData
		.pageResults({
			api: snxData.graphAPIEndpoints.snx,
			max: MAX_RESULTS,
			query: {
				entity: 'feesClaimeds',
				selection: {
					orderBy: 'timestamp',
					orderDirection: 'desc',
					where: {
						block_gte: minBlock || undefined,
						block_lte: maxBlock || undefined,
					},
				},
				properties: ['id', 'account', 'timestamp', 'rewards'],
			},
		})
		.then(results =>
			results.map(({ id, account, timestamp, rewards }) => ({
				hash: getHashFromId(id),
				account,
				timestamp: Number(timestamp * 1000),
				rewards: rewards / 1e18,
				type: 'feesClaimed',
			}))
		)
		.catch(err => console.error(err));
};

const issued = async (minBlock, maxBlock) => {
	return snxData.pageResults({
		api: snxData.graphAPIEndpoints.snx,
		max: MAX_RESULTS,
		query: {
			entity: 'issueds',
			selection: {
				orderBy: 'timestamp',
				orderDirection: 'desc',
				where: {
					block_gte: minBlock || undefined,
					block_lte: maxBlock || undefined,
				},
			},
			properties: [
				'id', // the transaction hash
				'account', // the address of the burner
				'timestamp', // the timestamp when this transaction happened
				'block', // the block in which this transaction happened
				'value', // the issued amount in sUSD
			],
		},
	})
		.then(results =>
			results.map(({ id, account, timestamp, block, value }) => ({
				hash: getHashFromId(id),
				account,
				timestamp: Number(timestamp * 1000),
				block: Number(block),
				value: value / 1e18,
				type: 'issued',
			})),
		)
		.catch(err => console.error(err));
}

const getXSNXSnapshot = async (xsnxScore, blockNumber) => {
	const snapshot = await getSnapshot(blockNumber);

	let totalValue = 0;
	for (let [key, value] of Object.entries(snapshot)) {
		snapshot[key] = value / 1e18;
		totalValue += value / 1e18;
	}

	const data = {};
	for (let [key, value] of Object.entries(snapshot)) {
		data[key] = (value / totalValue) * xsnxScore;
	}

	return data;
};

const getYearnSnapshot = async (yearnScore, minBlockNumber, maxBlockNumber) => {
	const snapshot = await getYearnData(minBlockNumber, maxBlockNumber);

	let totalValue = 0;
	for (let [key, value] of Object.entries(snapshot)) {
		snapshot[key] = value / 1e18;
		totalValue += value / 1e18;
	}

	const data = {};
	for (let [key, value] of Object.entries(snapshot)) {
		data[key] = (value / totalValue) * yearnScore;
	}

	return data;
};

module.exports = {
	feesClaimed,
	issued,
	getXSNXSnapshot,
	getYearnSnapshot,
};
