const { Web3 } = require('hardhat');
const fs = require('fs');
const { bn } = require('../helpers');
const XSNX = require('./xSNX.json');

const web3 = new Web3(new Web3.providers.HttpProvider('https://mainnet.infura.io/v3/' + process.env.INFURA));
const bpt = new web3.eth.Contract(XSNX.abi, '0xEA39581977325C0833694D51656316Ef8A926a62');

const merkleClaimSnapshot = require('./pre-hack-snapshot.json');
const xsnx = new web3.eth.Contract(XSNX.abi, '0x1cf0f3aabe4d12106b27ab44df5473974279c524');


/**
 * Get snapshot of all addresses which haven't claimed xSNXa from Merkle Claim contract
 */
async function getUnclaimedXSNXaMerkleClaim() {
    const merkleClaimsContract = '0x1de6Cd47Dfe2dF0d72bff4354d04a79195cABB1C';
    let transferEvents = await xsnx.getPastEvents('Transfer', {fromBlock: 0, toBlock: '13118314'});
    let totalBalance = merkleClaimSnapshot;
    
    // Remove all addresses which have redeemed their xSNXa from xSNXaMerkleClaim Contract
    for(let i = 0 ; i < transferEvents.length ; ++i) {
        let values = transferEvents[i].returnValues;
        values.txid = transferEvents[i].transactionHash;
        if(values.from == merkleClaimsContract) {
            if(totalBalance[values.to]) {
                delete totalBalance[values.to];
            }
        }
    }

    let totalAllocated = bn(0);
    let addressCount = 0;
    for (let address of Object.keys(totalBalance)) {
        // remove 0 balance addresses and address 0x0 which is < 0 balance
        if(totalBalance[address] <= 0) {
            delete totalBalance[address];
            continue;
        }
        totalBalance[address] = totalBalance[address].toString();
        totalAllocated = totalAllocated.add(totalBalance[address]);
        addressCount++;
    }
    console.log('total addresses which haven\'t claimed from xSNXMerkleClaim:', addressCount)
    console.log('total address xSNX value:', totalAllocated.toString())

    fs.writeFileSync('scripts/snx-data/xsnx-snapshot/august-hack-snapshot/snapshotXSNXaMerkleUnclaimed.json',
         JSON.stringify(totalBalance));
    return totalBalance;
}

module.exports = { getUnclaimedXSNXaMerkleClaim }