const { getHoldersSnapshot } = require('./getHoldersSnapshot');
const { getStakersSnapshot } = require('./getStakersSnapshot');
const { getFinalSnapshot } = require('./getFinalSnapshot');


async function getPostHackSnapshot(blockNumber) {
    let holdersSnapshot = await getHoldersSnapshot(blockNumber);
    let stakersSnapshot = await getStakersSnapshot(blockNumber);
    return await getFinalSnapshot(holdersSnapshot, stakersSnapshot);
}

module.exports = { getPostHackSnapshot }