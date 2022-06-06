const { web3 } = require('hardhat');
const Big = require('big.js');
const w3utils = require('web3-utils');

const migrationInput = require('./migrationSnapshot.json');

for (let migratedStakerOrEscrower of migrationInput) {
	//send directly if not a staker
	console.log('Processing migratedStakerOrEscrower ' + migratedStakerOrEscrower);
	if (migratedStakerOrEscrower.totalStaked == 0) {
		console.log('Escrowed is zero');
	}
	//else put to staked and send $10 ETH if the staker has none
	else {
		let escrowed = Big(migratedStakerOrEscrower.totalEscrowed / 1e18);
		console.log('Escrowed is ' + escrowed);
		let staked = Big(migratedStakerOrEscrower.totalStaked / 1e18);
		let totalAmount = escrowed.add(staked);
		console.log('totalAmount is ' + totalAmount);
	}
}
