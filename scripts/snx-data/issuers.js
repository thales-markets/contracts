'use strict';

const fs = require('fs');
const ethers = require('ethers');

const { issued } = require('./util');

const FIRST_BLOCK = 5855000; // Jun-26-2018
const BLOCKS_PER_WEEK = 45000; // approx
let txCount = 0;

async function getBlocks() {
	const blocks = [];
	let provider = new ethers.providers.EtherscanProvider('mainnet', process.env.ETHERSCAN_KEY);
	const currentBlockNumber = (await provider.getBlock()).number;
	console.log('currentBlockNumber', currentBlockNumber);

	for(let i = FIRST_BLOCK; i < currentBlockNumber + BLOCKS_PER_WEEK; i = i+BLOCKS_PER_WEEK) {
		blocks.push(i);
	}
	
	return blocks;
}

async function main() {
	const accounts = {};
	const blocks = await getBlocks();
	for (let i = 0; i < blocks.length; i++) {
		if (!blocks[i + 1]) break;
		const result = await issued(blocks[i], blocks[i + 1]);
		for (var element in result) {
			accounts[result[element].account.toLowerCase()] = 1;
		}
		txCount += result.length;
		console.log('results length', result.length, 'min block', blocks[i], 'max block', blocks[i+1]);
	}
	
	console.log('total accounts', Object.keys(accounts).length);
	console.log('total transactions', txCount);
	fs.writeFileSync('scripts/snx-data/issuers.json', JSON.stringify(accounts));
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});
