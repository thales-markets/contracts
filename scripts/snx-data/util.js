'use strict';

const snxData = require('synthetix-data'); 
const { getSnapshot } = require('./xsnx-snapshot/getSnapshot');

const MAX_RESULTS = 5000;

const getHashFromId = id => id.split('-')[0];

const feesClaimed = async (minBlock, maxBlock) => {
    return snxData.pageResults({
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
            properties: [
                'id',
                'account',
                'timestamp',
                'rewards',
            ],
        },
    })
        .then(results =>
            results.map(({ id, account, timestamp, rewards }) => ({
                hash: getHashFromId(id),
                account,
                timestamp: Number(timestamp * 1000),
                rewards: rewards / 1e18,
                type: 'feesClaimed',
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
}

module.exports = {
	feesClaimed,
    getXSNXSnapshot
};
