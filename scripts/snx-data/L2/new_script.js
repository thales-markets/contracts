const { request, gql } = require('graphql-request');

const regenesisSnapshot = require('./regenesisSnapshot.json');

// getCurrentSnapshotViaGraph(
// 	'https://api.thegraph.com/subgraphs/name/synthetixio-team/optimism-main'
// );
// getCurrentSnapshotViaGraph('https://api.thegraph.com/subgraphs/name/synthetixio-team/synthetix');
//getAllClaimers('https://api.thegraph.com/subgraphs/name/synthetixio-team/optimism-main');
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

	// TODO: this is only to be used after the OP regenesis which wiped the subgraph
	if (url.includes('optimism')) {
		regenesisSnapshot.forEach(r => {
			if (totalBalance[r.id] == undefined) {
				totalBalance[r.id] = r.collateral * 1.0;
			}
		});
	}
	console.log('finished');
	return totalBalance;
}

async function getAllClaimers(url) {
	let uniqueClaimers = new Set();
	var lastWednesday = new Date();
	lastWednesday.setDate(lastWednesday.getDate() - ((lastWednesday.getDay() + 4) % 7));
	let maxDate = new Date(
		lastWednesday.getFullYear(),
		lastWednesday.getMonth(),
		lastWednesday.getDate() + 1
	);
	let maxTimestamp = maxDate.getTime() / 1000;
	// let maxTimestamp = Math.floor(new Date().getTime() / 1000);
	var eightDaysAgo = new Date(
		lastWednesday.getFullYear(),
		lastWednesday.getMonth(),
		lastWednesday.getDate() - 8
	);
	let lastTimestamp = eightDaysAgo.getTime() / 1000;
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
