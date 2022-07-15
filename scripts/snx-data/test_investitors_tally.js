const Big = require('big.js');
const w3utils = require('web3-utils');
const investitors = require('../snx-data/investitors.json');

let investitorsTotalAmountWithoutStaking = Big(0);
let investitorsTotalAmountNormal = 0;
for (let [key, value] of Object.entries(investitors)) {
	investitorsTotalAmountWithoutStaking = investitorsTotalAmountWithoutStaking.add(
		w3utils.toWei(value + '')
	);
	investitorsTotalAmountNormal = investitorsTotalAmountNormal + value * 1.0;
}

console.log('investitors total amount normal', investitorsTotalAmountNormal);
console.log(
	'investitors total amount without staking',
	investitorsTotalAmountWithoutStaking.toString()
);
