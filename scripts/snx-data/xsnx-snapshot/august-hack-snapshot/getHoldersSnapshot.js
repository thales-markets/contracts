const { Web3, ethers } = require('hardhat');
const fs = require('fs');
const { getNumberNoDecimals } = require('../helpers');

const XSNX = require('./xSNX.json');
const { getUnclaimedXSNXaMerkleClaim } = require('./getxSNXMerkleClaim');

const web3 = new Web3(new Web3.providers.HttpProvider('https://mainnet.infura.io/v3/' + process.env.INFURA));
const xsnx = new web3.eth.Contract(XSNX.abi, '0x1cf0f3aabe4d12106b27ab44df5473974279c524');

/**
 * Get snapshot of all addresses holding xSNX at a block before the xSNX hack occurred
 * Need to run with mainnet forking enabled pinned at block 13118314 (6 blocks before the hack)
 */
async function getHoldersSnapshot() {
    console.log('---Get Holders Snapshot---');
    let balancerXsnxVault = '0xBA12222222228d8Ba445958a75a0704d566BF2C8'; // balancer vault address
    let merkleClaimXSNXa = '0x1de6Cd47Dfe2dF0d72bff4354d04a79195cABB1C'; // xSNXa Merkle Claim contract
    let transferEvents = await xsnx.getPastEvents('Transfer', {fromBlock: 0, toBlock: '13118314'});
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
    let vaultBalance = totalBalance[balancerXsnxVault];
    delete totalBalance[balancerXsnxVault]; // remove balancer vault from snapshot
    delete totalBalance[merkleClaimXSNXa]; // remove merkle claim xSNXa from snapshot

    let merkleClaimSnapshot = await getUnclaimedXSNXaMerkleClaim();

     // merge the two snapshots
     for (let [address, amount] of Object.entries(merkleClaimSnapshot)) {
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
        balanceSum = balanceSum.add(totalBalance[address]);
        totalBalance[address] = totalBalance[address].toString();
        addressCount++;
    }
    console.log('total addresses in snapshot count:', addressCount);
    console.log('calculated pool balance:', getNumberNoDecimals(vaultBalance));
    console.log('calculated holders balance:', getNumberNoDecimals(balanceSum));
    console.log('pool balance + holders balance:', getNumberNoDecimals(vaultBalance) + getNumberNoDecimals(balanceSum));
    let xsnxTotalSupply = await xsnx.methods.totalSupply().call();
    let xsnxBalanceInBalancer = await xsnx.methods.balanceOf(balancerXsnxVault).call();

    console.log('xsnx total supply:', getNumberNoDecimals(bn(xsnxTotalSupply)))
    console.log('xsnx balance in balancer vault:', getNumberNoDecimals(bn(xsnxBalanceInBalancer)))
    
    fs.writeFileSync('scripts/snx-data/xsnx-snapshot/august-hack-snapshot/snapshotHolders.json', JSON.stringify(totalBalance));
    return totalBalance;
}

/**
 * Return BigNumber
 */
 function bn(amount) {
    return new ethers.BigNumber.from(amount);
}

module.exports = { getHoldersSnapshot }