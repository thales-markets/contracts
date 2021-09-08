const fs = require('fs');
const { bn, bnDecimal } = require('../helpers');

/**
 * Merge the holders and stakers of xsnx in one final snapshot
 */
async function getFinalSnapshot(xsnxHoldersSnapshot, xsnxStakersSnapshot) {
    console.log('---Get Final Snapshot---');
    // merge the two snapshots
    let finalSnapshot = {};
    for(let [address, amount] of Object.entries(xsnxHoldersSnapshot)) {
        finalSnapshot[address] = bn(amount);
    }
    for(let [address, amount] of Object.entries(xsnxStakersSnapshot)) {
        if(finalSnapshot[address]) {
            finalSnapshot[address] = finalSnapshot[address].add(amount);
        } else {
            finalSnapshot[address] = amount;
        }
    }

    let totalXSNXTValue = bn(0);
    let airdropCount = 0;
    for(let [address, amount] of Object.entries(finalSnapshot)) {
        if(bn(amount).lt(bnDecimal(1))) {
            delete finalSnapshot[address];
        } else {
            totalXSNXTValue = totalXSNXTValue.add(amount);
            airdropCount++;
            finalSnapshot[address] = finalSnapshot[address].toString();
        }
    }
    console.log('total xsnx to be distributed:', totalXSNXTValue.toString());
    console.log('airdrop count:', airdropCount);
    fs.writeFileSync('scripts/snx-data/xsnx-snapshot/august-hack-snapshot/snapshotFinal.json', 
        JSON.stringify(finalSnapshot));
    return finalSnapshot;
}

module.exports = { getFinalSnapshot }