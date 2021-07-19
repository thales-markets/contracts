const { web3, ethers } = require('hardhat');
const fs = require('fs');
const { getNumberNoDecimals } = require('../helpers');

const XSNX = require('./xSNX.json');

const xsnx = new web3.eth.Contract(XSNX.abi, '0x2367012ab9c3da91290f71590d5ce217721eefe4');


/**
 * Get snapshot of all addresses holding xSNX at a block before the xToken hack occurred
 * Need to run with mainnet forking enabled pinned at block 12419912
 */
async function getHoldersSnapshot(blockNumber) {
    console.log('---Get Holders Snapshot---');
    let balancerXsnxPool = '0xE3f9cF7D44488715361581DD8B3a15379953eB4C' // balancer pool address
    let balancerXsnxPoolSecondary = '0x4939e1557613B6e84b92bf4C5D2db4061bD1A7c7' // balancer AAVE-LINK-xSNX pool address
    let transferEvents = await xsnx.getPastEvents('Transfer', {fromBlock: 0, toBlock: blockNumber});
    let transfers = [];
    
    for(let i = 0 ; i < transferEvents.length ; ++i) {
        let values = transferEvents[i].returnValues;
        transfers.push(values);
    }
    
    // add and subtract balance for addresses for each transfer
    let totalBalance = {};

    for(let i = 0 ; i < transfers.length ; ++i) {
        let address = transfers[i].to;
        let value = bn(transfers[i].value);
        if(totalBalance[address]) {
            totalBalance[address] = totalBalance[address].add(value);
        } else {
            totalBalance[address] = value;
        }
    }
    for(let i = 0 ; i < transfers.length ; ++i) {
        let address = transfers[i].from;
        let value = bn(transfers[i].value);
        if(totalBalance[address]) {
            totalBalance[address] = totalBalance[address].sub(value);
        } else {
            //totalBalance[address] = value;
        }
    }
    let poolBalance = totalBalance[balancerXsnxPool];
    delete totalBalance[balancerXsnxPool]; // remove balancer pool from snapshot
    delete totalBalance[balancerXsnxPoolSecondary]; // remove balancer pool 2 from snapshot

    let balanceSum = bn(0);
    let addressCount = 0;
    for (let address of Object.keys(totalBalance)) {
        // remove 0 balance addresses and address 0x0 which is < 0 balance
        if(totalBalance[address] <= 0) {
            delete totalBalance[address];
            continue;
        }
        balanceSum = balanceSum.add(totalBalance[address]);
        totalBalance[address] = totalBalance[address].toString();
        addressCount++;
    }
    console.log('total addresses in snapshot count:', addressCount);
    console.log('calculated pool balance:', getNumberNoDecimals(poolBalance));
    console.log('calculated holders balance:', getNumberNoDecimals(balanceSum));
    console.log('pool balance + holders balance:', getNumberNoDecimals(poolBalance) + getNumberNoDecimals(balanceSum));
    let xsnxTotalSupply = await xsnx.methods.totalSupply().call();
    let xsnxBalanceInPool = await xsnx.methods.balanceOf(balancerXsnxPool).call();

    console.log('xsnx total supply:', getNumberNoDecimals(bn(xsnxTotalSupply)))
    console.log('xsnx balance in pool:', getNumberNoDecimals(bn(xsnxBalanceInPool)))


    fs.writeFileSync('scripts/snx-data/xsnx-snapshot/pre-hack-snapshot/snapshotHolders.json', JSON.stringify(totalBalance));
    return totalBalance;
}

/**
 * Return BigNumber
 */
 function bn(amount) {
    return new ethers.BigNumber.from(amount);
}

module.exports = { getHoldersSnapshot };