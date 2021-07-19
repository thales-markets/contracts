const { getHoldersSnapshot } = require('./getHoldersSnapshot');
const { getStakersSnapshot } = require('./getStakersSnapshot');
const { getStakersInOtherPool } = require('./getStakersInOtherPool');
const { mergeTwoPoolSnapshots } = require('./mergeTwoPoolSnaps');
const { getFinalSnapshot } = require('./getFinalSnapshot');


async function getPreHackSnapshot(blockNumber) {
    let holdersSnapshot = await getHoldersSnapshot(blockNumber);
    let stakers1Snapshot = await getStakersSnapshot(blockNumber);
    let stakers2Snapshot = await getStakersInOtherPool(blockNumber);
    let stakersSnapshot = await mergeTwoPoolSnapshots(stakers1Snapshot, stakers2Snapshot);
    return await getFinalSnapshot(holdersSnapshot, stakersSnapshot);
}

module.exports = { getPreHackSnapshot }