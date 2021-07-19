const { web3 } = require('hardhat');
const { bn, getNumberNoDecimals } = require('../helpers');

const XSNX = require('./xSNX.json');

const xsnx = new web3.eth.Contract(XSNX.abi, '0x2367012ab9c3da91290f71590d5ce217721eefe4');
let balancerXsnxPool = '0xE3f9cF7D44488715361581DD8B3a15379953eB4C' // balancer pool address

let holders = require('./snapshotHolders.json');
let stakers = require('./snapshotPoolStakers.json');

/**
 * Verify the numbers in both holders and stakers snapshot match
 */
async function verify() {
    let holdersTotal = bn(0);
    for(let amount of Object.values(holders)) {
        holdersTotal = holdersTotal.add(amount);
    }

    let stakersTotal = bn(0);
    for(let amount of Object.values(stakers)) {
        stakersTotal = stakersTotal.add(amount);
    }

    let totalSupply = await xsnx.methods.totalSupply().call();
    let poolValue = await xsnx.methods.balanceOf(balancerXsnxPool).call();

    console.log('holders snapshot total value:', getNumberNoDecimals(holdersTotal));
    console.log('stakers snapshot total value:', getNumberNoDecimals(stakersTotal));
    console.log('total value of pool:', getNumberNoDecimals(bn(poolValue)));
    console.log('total supply of xsnx:', getNumberNoDecimals(bn(totalSupply)));
}

verify()