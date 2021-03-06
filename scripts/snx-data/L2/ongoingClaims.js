const { request, gql } = require('graphql-request');

let url = 'https://api.thegraph.com/subgraphs/name/thales-markets/thales-options';

getAllClaimers();
async function getLastRootTimestamp() {
	let lastTimestamp = 0;
	const getOngoingAirdropNewRoots = gql`
		query getOngoingAirdropNewRoots {
			ongoingAirdropNewRoots(orderBy: timestamp, orderDirection: asc) {
				timestamp
			}
		}
	`;
	await request(url, getOngoingAirdropNewRoots).then(data => {
		if (data.ongoingAirdropNewRoots) {
			data.ongoingAirdropNewRoots.forEach(d => {
				lastTimestamp = d.timestamp;
			});
		}
	});
	return lastTimestamp;
}

async function getAllClaimers() {
	let lastRootTimestamp = await getLastRootTimestamp();
	let claimers = [];
	const getClaims = gql`
		query getClaims($lastRootTimestamp: BigInt!) {
			tokenTransactions(where: { type: claimStakingRewards, timestamp_gt: $lastRootTimestamp }) {
				account
				id
				timestamp
				type
			}
		}
	`;
	const variables = {
		lastRootTimestamp: lastRootTimestamp,
	};
	await request(url, getClaims, variables).then(data => {
		data.tokenTransactions.forEach(d => {
			claimers.push(d.account);
		});
	});
	return claimers;
}

module.exports = {
	getAllClaimers: getAllClaimers,
};
