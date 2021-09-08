const fs = require('fs');
const { getAugustHackSnapshot } = require('./august-hack-snapshot/getSnapshot');
const { getPostHackSnapshot } = require('./post-hack-snapshot/getSnapshot');
const { getPreHackSnapshot } = require('./pre-hack-snapshot/getSnapshot');

/**
 * Get snapshot of xsnx holders + LP stakers either pre-hack or post-hack
 * @param {Number} blockNumber which block number to get snapshot from
 */
async function getSnapshot(blockNumber) {
    let snapshot;
    if(blockNumber < 12419918) {
        snapshot = await getPreHackSnapshot();
    } else if(blockNumber == 13118314) {
        snapshot = await getAugustHackSnapshot();
    }  else if(blockNumber >= 12649601) {
        snapshot = await getPostHackSnapshot();
    } else {
        console.log(`blocks from 12419918 to 12649601 are between hack and 
                    xsnx second token pool deployment ;
                    cannot retrieve snapshot between these blocks`);
    }
    fs.writeFileSync('scripts/snx-data/xsnx-snapshot/snapshot.json', JSON.stringify(snapshot));
    return snapshot;
}

module.exports = {
    getSnapshot,
}

//getSnapshot(13118314);