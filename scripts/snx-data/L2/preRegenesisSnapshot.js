const { request, gql } = require('graphql-request');

getCurrentSnapshotViaGraph(
	'https://api.thegraph.com/subgraphs/name/synthetixio-team/optimism-issuance'
);
// getCurrentSnapshotViaGraph('https://api.thegraph.com/subgraphs/name/synthetixio-team/synthetix');
//getAllClaimers('https://api.thegraph.com/subgraphs/name/synthetixio-team/optimism-issuance');
//getAllClaimers('https://api.thegraph.com/subgraphs/name/synthetixio-team/synthetix');

async function getCurrentSnapshotViaGraph(url) {
	let uniqueClaimers = await getAllClaimers(url);
	let totalBalance = {};
	let holders = [];
	let highestIDLast = '';
	let continueQuery = true;
	while (continueQuery) {
		const queryIssuers = gql`
			query getIssuers($highestID: String!, $threshold: String!) {
				snxholders(
					first: 100
					where: { id_gt: $highestID, collateral_gt: $threshold }
					orderBy: id
					orderDirection: asc
				) {
					id
					balanceOf
					collateral
					initialDebtOwnership
					debtEntryAtIndex
				}
			}
		`;
		const variables = {
			highestID: highestIDLast,
			threshold: '0.001',
		};
		let performance = null;
		await request(url, queryIssuers, variables).then(data => {
			console.log('got batch');
			data.snxholders.forEach(d => {
				let threshold = d.collateral * 1.0;
				if (uniqueClaimers.has(d.id)) {
					holders.push(d);
					totalBalance[d.id] = d.collateral * 1.0;
				}
			});
			if (data.snxholders.length < 100) {
				continueQuery = false;
			}
			highestIDLast = data.snxholders.length ? data.snxholders[data.snxholders.length - 1].id : '';
			console.log('holders length is ' + holders.length);
		});
	}
	console.log('holders are: ' + JSON.stringify(holders));
	console.log('finished');
	return totalBalance;
}

async function getAllClaimers(url) {
	let uniqueClaimers = new Set();
	let maxTimestamp = 1636785200;
	let lastTimestamp = 1636465200;
	let continueQuery = true;
	let claimers = [];
	while (continueQuery) {
		const queryIssuers = gql`
			query getClaimers($lastTimestamp: BigInt!, $maxTimestamp: BigInt!) {
				feesClaimeds(
					first: 1000
					where: { timestamp_gt: $lastTimestamp, timestamp_lt: $maxTimestamp }
					orderBy: timestamp
					orderDirection: asc
				) {
					timestamp
					account
				}
			}
		`;
		const variables = {
			lastTimestamp: lastTimestamp,
			maxTimestamp: maxTimestamp,
		};
		let performance = null;
		await request(url, queryIssuers, variables).then(data => {
			// console.log(data);
			data.feesClaimeds.forEach(d => {
				if (uniqueClaimers.has(d.account)) {
					// console.log(d.account + ' claimed twice');
				}
				uniqueClaimers.add(d.account);
				claimers.push(d);
			});
			if (data.feesClaimeds.length < 1000) {
				continueQuery = false;
			}
			// console.log('claimers length is ' + claimers.length);
			// console.log('uniqueClaimers length is ' + uniqueClaimers.size);
		});

		lastTimestamp = claimers.length ? claimers[claimers.length - 1].timestamp : '';
	}
	return uniqueClaimers;
}

module.exports = {
	getCurrentSnapshotViaGraph: getCurrentSnapshotViaGraph,
};
