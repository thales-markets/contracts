const { request, gql } = require('graphql-request');

let url = 'https://api.thegraph.com/subgraphs/name/thales-markets/thales-polygon';
const fs = require('fs');

getUniqueTraders();
async function getUniqueTraders() {
	let traders = [];
	let lastRootTimestamp = 0;
	let continueQuery = true;
	let uniqueTraders = new Set();
	while (continueQuery) {
		const getClaims = gql`
			query getClaims($lastRootTimestamp: BigInt!) {
				trades(
					where: { timestamp_gt: $lastRootTimestamp }
					orderBy: timestamp
					orderDirection: asc
				) {
					maker
					taker
					timestamp
				}
			}
		`;
		const variables = {
			lastRootTimestamp: lastRootTimestamp,
		};
		await request(url, getClaims, variables).then((data) => {
			if (data.trades.length < 100) {
				continueQuery = false;
			}
			data.trades.forEach((d) => {
				uniqueTraders.add(d.maker);
				uniqueTraders.add(d.taker);
			});
			lastRootTimestamp = data.trades.length ? data.trades[data.trades.length - 1].timestamp : '';
		});
	}
	console.log(uniqueTraders);

	fs.writeFileSync(
		'scripts/deployAMM/uniqueTradersPolygon.json',
		JSON.stringify(Array.from(uniqueTraders)),
		function (err) {
			if (err) return console.log(err);
		}
	);
}
