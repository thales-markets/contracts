const { ethers } = require('hardhat');
const thalesData = require('thales-data');
const fs = require('fs');

getUniqueTraders();

async function getUniqueTraders() {
	let networkObj = await ethers.provider.getNetwork();
	let uniqueTraders = new Set();
	let marketTransactions;
	let markets = await thalesData.sportMarkets.markets({
		network: networkObj.chainId,
	});
	console.log('Num markets: ', markets.length);
	for (let i = 0; i < markets.length; i++) {
		marketTransactions = await thalesData.sportMarkets.marketTransactions({
			market: markets[i].address,
			network: networkObj.chainId,
		});
		if (marketTransactions.length > 0) {
			marketTransactions.forEach((element) => {
				if (!uniqueTraders.has(element.account)) {
					uniqueTraders.add(element.account);
				}
			});
		}
	}
	console.log('_UNIQUE TRADERS: ', uniqueTraders.length);
	console.log(uniqueTraders);

	fs.writeFileSync(
		'scripts/deploySportMarkets/deploySportsAMM/uniqueTraders.json',
		JSON.stringify(Array.from(uniqueTraders)),
		function (err) {
			if (err) return console.log(err);
		}
	);
}
