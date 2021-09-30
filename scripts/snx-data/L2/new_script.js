//let { web3 } = require('hardhat');
const fs = require('fs');
const { Web3 } = require('hardhat');
const { getNumberNoDecimals, bn } = require('../../snx-data/xsnx-snapshot/helpers');

const SNX_ADDRESS = '0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f';
const L2_NEW_BRIDGE = '0x5fd79d46eba7f351fe49bff9e87cdea6c821ef9f';
const L2_OLD_BRIDGE = '0x045e507925d2e05D114534D0810a1abD94aca8d6';

const SNX = require('../SNX.json');

const web3 = new Web3(
	new Web3.providers.HttpProvider('https://mainnet.infura.io/v3/' + process.env.INFURA)
);

const snx = new web3.eth.Contract(SNX.abi, SNX_ADDRESS);
const { request, gql } = require('graphql-request');

getCurrentL2SnapshotViaGraph();

async function getCurrentL2SnapshotViaGraph() {
	let totalBalance = {};
	let holders = [];
	let highestIDLast = null;
	let continueQuery = true;
	while (continueQuery) {
		highestIDLast = holders.length ? holders[holders.length - 1].id : '';
		const queryIssuers = gql`
			query getIssuers($highestID: String!) {
				snxholders(first: 1000, where: { id_gt: $highestID }, orderBy: id, orderDirection: asc) {
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
		};
		let performance = null;
		await request(
			'https://api.thegraph.com/subgraphs/name/synthetixio-team/optimism-issuance',
			queryIssuers,
			variables
		).then(data => {
			data.snxholders.forEach(d => {
				if (d.collateral > 0) {
					holders.push(d);
					totalBalance[d.id] = d.collateral * 1.0;
				}
			});
			if (data.snxholders.length < 1000) {
				continueQuery = false;
			}
			console.log('holders length is ' + holders.length);
		});
	}
	console.log('finished');
	return totalBalance;
}

module.exports = {
	getCurrentL2SnapshotViaGraph,
};

// async function main() {
// 	const data = await getL2Snapshot(0, 'latest');
// 	fs.writeFileSync('scripts/snx-data/L2/L2_snapshot.json', JSON.stringify(data));
// }

// main()
// 	.then(() => process.exit(0))
// 	.catch(error => {
// 		console.error(error);
// 		process.exit(1);
// 	});
