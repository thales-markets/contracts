const { web3 } = require('hardhat');
const { bn } = require('../helpers');
const XSNX = require('../xSNX.json');
const bpt = new web3.eth.Contract(XSNX.abi, '0xEA39581977325C0833694D51656316Ef8A926a62');


/**
 * Get snapshot of all addresses staking xSNX Balancer Pool Token in Staking Rewards contract
 * Used in getStakersSnapshot to retrieve the total xSNX value of LP Stakers
 */
async function getStakingRewardsStakers(blockNumber) {
    console.log('---Get Staking Rewards LP Stakers Snapshot---');
    const stakingRewardsContract = '0x9AA731A7302117A16e008754A8254fEDE2C35f8D';
    let transferEvents = await bpt.getPastEvents('Transfer', {fromBlock: 0, toBlock: blockNumber});
    let transferToStakingRewards = [];
    let transferFromStakingRewards = [];
    
    // record all transfers to and from staking rewards (all go through contract)
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