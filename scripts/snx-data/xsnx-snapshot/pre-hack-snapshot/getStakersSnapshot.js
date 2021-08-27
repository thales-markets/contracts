const { Web3, ethers } = require('hardhat');
const fs = require('fs');

const { getStakingRewardsStakers } = require('./getStakingRewardsStakers');

const XSNX = require('./xSNX.json');
const web3 = new Web3(new Web3.providers.HttpProvider('https://mainnet.infura.io/v3/' + process.env.INFURA));
const xsnx = new web3.eth.Contract(XSNX.abi, '0x2367012ab9c3da91290f71590d5ce217721eefe4');
const bpt = new web3.eth.Contract(XSNX.abi, '0xe3f9cf7d44488715361581dd8b3a15379953eb4c');


/**
 * Get snapshot of all addresses staking xSNX in xSNX Pool at a block before the xToken hack occurred
 * Need to run with mainnet forking enabled pinned at block 12419912
 */
async function getStakersSnapshot(blockNumber) {
    console.log('---Get Stakers Snapshot---');
    let balancerXsnxPool = '0xE3f9cF7D44488715361581DD8B3a15379953eB4C' // balancer pool address
    const stakingRewardsContract = '0x1c65b1763eEE90fca83E65F14bB1d63c5280c651'; // staking rewards address
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
    console.log('balance of staking rewards contract:', totalBalance[stakingRewardsContract].div(bn(10).pow(18)).toString());
    
    delete totalBalance[stakingRewardsContract]; // remove staking rewards contract from snapshot

    let stakingRewardsStakers = await getStakingRewardsStakers(blockNumber);

    // merge two snapshots
    totalBalance = {...totalBalance, ...stakingRewardsStakers }

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
    }

    console.log('total xSNX balance of snapshot:', totalxSNXBalance.div(bn(10).pow(18)).toString());
    console.log('total xsnx in primary pool:', bn(xsnxInPool).div(bn(10).pow(18)).toString());
    
    fs.writeFileSync('scripts/snx-data/xsnx-snapshot/pre-hack-snapshot/snapshotPoolStakers.json', JSON.stringify(totalBalance));
    return totalBalance;
}

/**
 * Return BigNumber
 */
 function bn(amount) {
    return new ethers.BigNumber.from(amount);
}


module.exports = { getStakersSnapshot };