const { Web3, ethers } = require('hardhat');
const fs = require('fs');

const { getStakingRewardsStakers } = require('./getStakingRewardsStakers');

const XSNX = require('./xSNX.json');

const web3 = new Web3(new Web3.providers.HttpProvider('https://mainnet.infura.io/v3/' + process.env.INFURA));
const xsnx = new web3.eth.Contract(XSNX.abi, '0x1cf0f3aabe4d12106b27ab44df5473974279c524');
const bpt = new web3.eth.Contract(XSNX.abi, '0xEA39581977325C0833694D51656316Ef8A926a62');


/**
 * Get snapshot of all addresses staking xSNX in xSNX Pool at a block before the xToken hack occurred
 * Need to run with mainnet forking enabled pinned at block 13118314 (6 blocks before the hack)
 */
async function getStakersSnapshot() {
    console.log('---Get Stakers Snapshot---');
    const balancerVault = '0xBA12222222228d8Ba445958a75a0704d566BF2C8' // balancer vault address
    const stakingRewardsContract = '0x9AA731A7302117A16e008754A8254fEDE2C35f8D'; // staking rewards address
    let transferEvents = await bpt.getPastEvents('Transfer', {fromBlock: 0, toBlock: '13118314'});
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
    delete totalBalance[balancerVault]; // remove balancer pool from snapshot
    delete totalBalance[stakingRewardsContract]; // remove staking rewards contract from snapshot

    let stakingRewardsStakers = await getStakingRewardsStakers();

    // merge the two snapshots
    for (let [address, amount] of Object.entries(stakingRewardsStakers)) {
        if(totalBalance[address]) {
            totalBalance[address] = totalBalance[address].add(amount);
        } else {
            totalBalance[address] = amount;
        }
    }

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
    let xsnxInPool = await xsnx.methods.balanceOf(balancerVault).call();
    let xsnxPer1BPT = bn(xsnxInPool).mul(1e14).div(bn(bptTotalSupply)).toNumber(); // mul by 1e14 for precision

    console.log('total address balances count:', addressCount);

    console.log('sum of all bpt token holders:', balanceSum.div(bn(10).pow(18)).toString());
    console.log('total bpt supply:', bn(bptTotalSupply).div(bn(10).pow(18)).toString());
    console.log('total xsnx in pool:', bn(xsnxInPool).div(bn(10).pow(18)).toString());
    console.log('xsnx per 1 bpt:', xsnxPer1BPT / 1e14);

    let totalxSNXBalance = bn(0);
    // Convert BPT to xSNX balance
    for (let address of Object.keys(totalBalance)) {
        let balance = totalBalance[address];
        totalBalance[address] = bn(balance).mul(xsnxPer1BPT).div(1e14).toString();
        totalxSNXBalance = totalxSNXBalance.add(totalBalance[address]);
    }

    console.log('total xSNX balance of snapshot:', totalxSNXBalance.div(bn(10).pow(18)).toString());
    console.log('total xsnx in pool:', bn(xsnxInPool).div(bn(10).pow(18)).toString());

    fs.writeFileSync('scripts/snx-data/xsnx-snapshot/august-hack-snapshot/snapshotPoolStakers.json', JSON.stringify(totalBalance));
    return totalBalance;
}

/**
 * Return BigNumber
 */
 function bn(amount) {
    return new ethers.BigNumber.from(amount);
}

module.exports = { getStakersSnapshot }