const { Web3 } = require('hardhat');
const { bn } = require('../helpers');
const XSNX = require('./xSNX.json');
const web3 = new Web3(new Web3.providers.HttpProvider('https://mainnet.infura.io/v3/' + process.env.INFURA));
const bpt = new web3.eth.Contract(XSNX.abi, '0xe3f9cf7d44488715361581dd8b3a15379953eb4c');


/**
 * Get snapshot of all addresses staking Balancer Pool Token in Staking Rewards contract pre-hack
 * Used in getStakersSnapshot to retrieve the total xSNX value of LP Stakers at pre-hack time
 */
async function getStakingRewardsStakers(blockNumber) {
    console.log('---Get Staking Rewards LP Stakers Snapshot---');
    const stakingRewardsContract = '0x1c65b1763eEE90fca83E65F14bB1d63c5280c651';
    let transferEvents = await bpt.getPastEvents('Transfer', {fromBlock: 0, toBlock: blockNumber});
    let transferToStakingRewards = [];
    let transferFromStakingRewards = [];
    
    // record all transfers to and from pool (all go through balancer pool)
    for(let i = 0 ; i < transferEvents.length ; ++i) {
        let values = transferEvents[i].returnValues;
        values.txid = transferEvents[i].transactionHash;
        if(values.from == stakingRewardsContract) {
            transferFromStakingRewards.push(values);
        } 
        if(values.to == stakingRewardsContract) {
            transferToStakingRewards.push(values);
        }
    }
    
    // add and subtract balance for account addresses for each deposit/withdraw
    // skip contract addresses and add them in a list
    let totalBalance = {};

    for(let i = 0 ; i < transferToStakingRewards.length ; ++i) {
        let address = transferToStakingRewards[i].from;
        let value = bn(transferToStakingRewards[i].value);
        if(totalBalance[address]) {
            totalBalance[address] = totalBalance[address].add(value);
        } else {
            totalBalance[address] = value;
        }
    }
    for(let i = 0 ; i < transferFromStakingRewards.length ; ++i) {
        let address = transferFromStakingRewards[i].to;
        let value = bn(transferFromStakingRewards[i].value);
        if(totalBalance[address]) {
            totalBalance[address] = totalBalance[address].sub(value);
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
    console.log('total staking rewards stakers count:', addressCount)
    console.log('total staked in rewards contract:', totalAllocated.div(bn(10).pow(18)).toString())

    return totalBalance;
}

module.exports = { getStakingRewardsStakers }