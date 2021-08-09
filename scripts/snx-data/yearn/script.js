const { web3 } = require('hardhat');
const fs = require('fs');
const { getNumberNoDecimals, bn } = require('../xsnx-snapshot/helpers');

const SNX_ADDRESS = '0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f';
const SNX_YEARN_VAULT = '0xF29AE508698bDeF169B89834F76704C3B205aedf';

const SNX = require('../SNX.json');

const snx = new web3.eth.Contract(SNX.abi, SNX_ADDRESS);

async function getYearnData(minBlock, maxBlock) {
	const transfersIn = await getSNXTransfers(minBlock, maxBlock, { to: SNX_YEARN_VAULT });
	console.log('[new bridge] transfers in count', transfersIn.length);

	const transfersOut = await getSNXTransfers(minBlock, maxBlock, { from: SNX_YEARN_VAULT });
	console.log('[new bridge] transfers out count', transfersOut.length);

	// add and subtract balance for addresses for each transfer
	let totalBalance = [];

	for (let i = 0; i < transfersIn.length; ++i) {
		let address = transfersIn[i].from;
		let value = bn(transfersIn[i].value);
		if (totalBalance[address]) {
			totalBalance[address] = totalBalance[address].add(value);
		} else {
			totalBalance[address] = value;
		}
	}
	for (let i = 0; i < transfersOut.length; ++i) {
		let address = transfersOut[i].from;
		let value = bn(transfersOut[i].value);
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
		addressCount++;
	}
	console.log('total addresses in snapshot count:', addressCount);
	console.log('calculated Yearn balance:', getNumberNoDecimals(balanceSum));

	return totalBalance;
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
	getYearnData,
};

// async function main() {
// 	const data = await getYearnData(0, 'latest');
// 	fs.writeFileSync('scripts/snx-data/yearn/yearn_snapshot.json', JSON.stringify(data));
// }

// main()
// 	.then(() => process.exit(0))
// 	.catch(error => {
// 		console.error(error);
// 		process.exit(1);
// 	});
