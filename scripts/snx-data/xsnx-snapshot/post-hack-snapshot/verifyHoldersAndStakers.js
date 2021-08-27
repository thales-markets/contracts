const { Web3 } = require('hardhat');
const { bn, getNumberNoDecimals } = require('../../../helpers');

const XSNX = require('../xSNX.json');
const web3 = new Web3(new Web3.providers.HttpProvider('https://mainnet.infura.io/v3/' + process.env.INFURA));
const xsnx = new web3.eth.Contract(XSNX.abi, '0x1cf0f3aabe4d12106b27ab44df5473974279c524');
let balancerVault = '0xBA12222222228d8Ba445958a75a0704d566BF2C8' // balancer vault (xsnx token holder)

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
    let poolValue = await xsnx.methods.balanceOf(balancerVault).call();

    console.log('holders snapshot total value:', getNumberNoDecimals(holdersTotal));
    console.log('stakers snapshot total value:', getNumberNoDecimals(stakersTotal));
    console.log('total value of pool:', getNumberNoDecimals(bn(poolValue)));
    console.log('total supply of xsnx:', getNumberNoDecimals(bn(totalSupply)));
}

verify()