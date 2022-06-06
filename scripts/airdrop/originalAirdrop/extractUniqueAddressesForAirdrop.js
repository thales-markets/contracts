const fs = require('fs');

const historicalSnapshot = require('./airdropSnapshot.json');
const airdropAdditional = require('./airdrop-additional.json');

// merge all addresses into final snapshot
const airdropSnapshotFinal = Object.assign(historicalSnapshot, airdropAdditional);
// get list of leaves for the merkle trees using index, address and token balance
// encode user address and balance using web3 encodePacked
let duplicateCheckerSet = new Set();
for (let address of Object.keys(airdropSnapshotFinal)) {
	if (duplicateCheckerSet.has(address)) {
		// dont airdrop same address more than once
		continue;
	} else {
		duplicateCheckerSet.add(address);
	}
}

let arr = Array.from(duplicateCheckerSet);
fs.writeFileSync(
	'scripts/airdrop/finalSnapshot.json',
	JSON.stringify(arr),
	function(err) {
		if (err) return console.log(err);
	}
);
