const { Web3, ethers } = require('hardhat');
const fs = require('fs');
const XSNX = require('./xSNX.json');
const { getNumberNoDecimals } = require('../helpers');
const web3 = new Web3(new Web3.providers.HttpProvider('https://mainnet.infura.io/v3/' + process.env.INFURA));

const xsnx = new web3.eth.Contract(XSNX.abi, '0x2367012ab9c3da91290f71590d5ce217721eefe4');
const bpt = new web3.eth.Contract(XSNX.abi, '0x4939e1557613b6e84b92bf4c5d2db4061bd1a7c7');

/**
 * Get snapshot of all addresses staking xSNX in AAVE-LINK-xSNX-UNI-YFI Balancer Pool 
 * at a block before the xToken hack occurred
 * Need to run with mainnet forking enabled pinned at block 12419912
 */
async function getStakersInOtherPool(blockNumber) {
    console.log('---Get Stakers in other pool Snapshot---');
    let balancerXsnxPool = '0x4939e1557613b6e84b92bf4c5d2db4061bd1a7c7' // balancer pool address
    let transferEvents = await bpt.getPastEvents('Transfer', {fromBlock: 0, toBlock: blockNumber});
    console.log('total bpt transfers:', transferEvents.length);
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
    delete totalBalance[balancerXsnxPool]; // remove balancer pool from snapshot

    let balanceSum = bn(0);
    let addressCount = 0;
    for (let address of Object.keys(totalBalance)) {
        // remove 0 balance addresses and address 0x0 which is < 0 balance
        if(totalBalance[address] <= 0) {
            delete totalBalance[address];
            continue;
        }
        totalBalance[address] = totalBalance[address].toString();
        balanceSum = balanceSum.add(totalBalance[address]);
        addressCount++;
    }
    let bptTotalSupply = await bpt.methods.totalSupply().call();
    let xsnxInPool = await xsnx.methods.balanceOf(balancerXsnxPool).call();
    let xsnxPer1BPT = bn(xsnxInPool).mul(100000000).div(bn(bptTotalSupply)).toNumber(); // mul by 100M for precision

    console.log('total address balances count:', addressCount);

    console.log('sum of all bpt token holders:', balanceSum.div(bn(10).pow(18)).toString());
    console.log('total bpt supply:', bn(bptTotalSupply).div(bn(10).pow(18)).toString());
    console.log('total xsnx in pool:', bn(xsnxInPool).div(bn(10).pow(18)).toString());
    console.log('xsnx per 1 bpt:', xsnxPer1BPT / 100000000);

    let totalxSNXBalance = bn(0);
    // Convert BPT to xSNX balance
    for (let address of Object.keys(totalBalance)) {
        let balance = totalBalance[address];
        totalBalance[address] = bn(balance).mul(xsnxPer1BPT).div(100000000).toString();
        totalxSNXBalance = totalxSNXBalance.add(totalBalance[address]);
        console.log(address, getNumberNoDecimals(bn(totalBalance[address])));
        // add to existing snapshot
        totalBalance[address] = totalBalance[address].toString();
    }

    console.log('total xSNX balance of snapshot:', totalxSNXBalance.div(bn(10).pow(18)).toString());
    console.log('total xsnx in secondary pool:', bn(xsnxInPool).div(bn(10).pow(18)).toString());
    fs.writeFileSync('scripts/snx-data/xsnx-snapshot/pre-hack-snapshot/snapshotAAVELINKPool.json', JSON.stringify(totalBalance));
    return totalBalance;
}

/**
 * Return BigNumber
 */
 function bn(amount) {
    return new ethers.BigNumber.from(amount);
}

module.exports = { getStakersInOtherPool };