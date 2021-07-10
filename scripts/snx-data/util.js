'use strict';

const snxData = require('synthetix-data'); 

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

module.exports = {
	feesClaimed
};
