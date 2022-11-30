const { ethers } = require('hardhat');
const thalesData = require('thales-data');
const fs = require('fs');

sendAndReceive();

async function sendAndReceive() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];

	let network_kovan = new ethers.providers.InfuraProvider('kovan');
	const net_kovan = 'kovan';
	const net_optimistic_kovan = 'optimisticKovan';

	const l1Wallet = new ethers.Wallet(user_key, network_kovan);

	// Wallet used as a user to call ProxyExchanger
	// Proxy admin user can not call functions at ProxyExchanger
	const l1Wallet2 = new ethers.Wallet(user_key2, network_kovan);
	const l2Wallet = new ethers.Wallet(user_key, ethers.provider);
	const l2Wallet2 = new ethers.Wallet(user_key2, ethers.provider);

	let blockNumber = await network_kovan.getBlockNumber();
	console.log('Kovan block number: ', blockNumber);

	blockNumber = await ethers.provider.getBlockNumber();
	console.log('Optimistic Kovan block number: ', blockNumber);
}
