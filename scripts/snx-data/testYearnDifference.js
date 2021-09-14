const Big = require('big.js');
const w3utils = require('web3-utils');
const orig = require('../snx-data/sorted_historical_stakers.json');
const withFix = require('../snx-data/sorted_historical_stakers_after_floor_fixed_yearn.json');

let map = new Map();

for (let [key, value] of Object.entries(orig)) {
	map.set(key, value);
}

let totalPayoutDiff = Big(0);
let investitorsTotalAmountNormal = 0;
for (let [key, value] of Object.entries(withFix)) {
	let newValue = new Big(value);
	let oldValue = new Big(map.get(key));
	let diff = newValue.sub(oldValue);
	totalPayoutDiff = totalPayoutDiff.add(diff);
	// console.log(
	// 	key +
	// 		', ' +
	// 		newValue.toString() / 1e18 +
	// 		', ' +
	// 		oldValue.toString() / 1e18 +
	// 		', ' +
	// 		diff.toString()
	// );
	console.log(key + ', ' + diff);
}
console.log('totalPayoutDiff: ' + totalPayoutDiff / 1e18);
