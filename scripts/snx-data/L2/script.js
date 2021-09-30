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

//getL2Snapshot(11656238, 13319318);

async function getL2Snapshot(minBlock, maxBlock) {
	const transfersInNew = await getSNXTransfers(minBlock, maxBlock, { to: L2_NEW_BRIDGE });
	//console.log('[new bridge] transfers in count', transfersInNew.length);

	const transfersOutNew = await getSNXTransfers(minBlock, maxBlock, { from: L2_NEW_BRIDGE });
	//console.log('[new bridge] transfers out count', transfersOutNew.length);

	const transfersInOld = await getSNXTransfers(minBlock, maxBlock, { to: L2_OLD_BRIDGE });
	//console.log('[old bridge] transfers in count', transfersInOld.length);

	const transfersOutOld = await getSNXTransfers(minBlock, maxBlock, { from: L2_OLD_BRIDGE });
	//console.log('[old bridge] transfers out count', transfersOutOld.length);

	// add and subtract balance for addresses for each transfer
	let totalBalance = {};

	for (let i = 0; i < transfersInNew.length; ++i) {
		let address = transfersInNew[i].from;
		let value = bn(transfersInNew[i].value);
		if (totalBalance[address]) {
			totalBalance[address] = totalBalance[address].add(value);
		} else {
			totalBalance[address] = value;
		}
	}
	for (let i = 0; i < transfersOutNew.length; ++i) {
		let address = transfersOutNew[i].from;
		let value = bn(transfersOutNew[i].value);
		if (totalBalance[address]) {
			totalBalance[address] = totalBalance[address].sub(value);
		} else {
			//totalBalance[address] = value;
		}
	}

	for (let i = 0; i < transfersInOld.length; ++i) {
		let address = transfersInOld[i].from;
		let value = bn(transfersInOld[i].value);
		if (totalBalance[address]) {
			totalBalance[address] = totalBalance[address].add(value);
		} else {
			totalBalance[address] = value;
		}
	}
	for (let i = 0; i < transfersOutOld.length; ++i) {
		let address = transfersOutOld[i].from;
		let value = bn(transfersOutOld[i].value);
		if (totalBalance[address]) {
			totalBalance[address] = totalBalance[address].sub(value);
		} else {
			//totalBalance[address] = value;
		}
	}

	let balanceSum = bn(0);
	let addressCount = 0;
	for (let address of Object.keys(totalBalance)) {
		// remove 0 balance addresses and address 0x0 which is < 0 balance
		if (totalBalance[address] <= 0) {
			delete totalBalance[address];
			continue;
		}
		balanceSum = balanceSum.add(totalBalance[address]);
		totalBalance[address] = totalBalance[address].toString();
		if (
			address.toLowerCase() == '0xb8d08d9537fc8e5624c298302137c5b5ce2f301d'.toLowerCase() ||
			address.toLowerCase() == '0x935d2fd458fdf41b6f7b62471f593797866a3ce6'.toLowerCase()||
			address.toLowerCase() == '0xdc3594961c5F49200cA76851960e57928046eCcB'.toLowerCase()||
			address.toLowerCase() == '0xe6945Ed413f233e248BCdF2A5AF249B6af7cd58c'.toLowerCase()||
			address.toLowerCase() == '0x48D1547832902eC527b17B5765381d36A9399c97'.toLowerCase()||
			address.toLowerCase() == '0x7C5B7Bf87Feab9A3F4972323BDdDA04C79D61315'.toLowerCase()||
			address.toLowerCase() == '0xb5F2949aADDd62C07AB10FFd39964fAF60887560'.toLowerCase()
		) {
			console.log('Address ' + address + ' has ' + totalBalance[address].toString()/1e18);
		}
		addressCount++;
	}
	console.log('total addresses in L2 snapshot count:', addressCount);
	console.log('calculated L2 balance:', getNumberNoDecimals(balanceSum));

	return totalBalance;
}

async function getCurrentL2SnapshotViaGraph() {

}

async function getSNXTransfers(fromBlock, toBlock, filter) {
	let transferEvents = await snx.getPastEvents('Transfer', { fromBlock, toBlock, filter });
	let transfers = [];

	for (let i = 0; i < transferEvents.length; ++i) {
		let values = transferEvents[i].returnValues;
		transfers.push(values);
	}

	return transfers;
}

module.exports = {
	getL2Snapshot,
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
