const lastMerkleDistribution = require(`./ongoing-airdrop-hashes-period-1.json`);
const ongoingRewards = require('../snx-data/ongoing_distribution.json');
lastMerkleDistribution.forEach(l => {
	if (!ongoingRewards.hasOwnProperty(l.address)) {
		ongoingRewards[l.address] = 0;
	}
});

console.log(lastMerkleDistribution);
