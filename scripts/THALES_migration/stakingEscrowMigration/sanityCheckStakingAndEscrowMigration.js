const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');
const { web3 } = require('hardhat');
const Big = require('big.js');
const w3utils = require('web3-utils');
const { BigNumber } = require('ethers');

const {
	numberExponentToLarge,
	txLog,
	getTargetAddress,
	setTargetAddress,
} = require('../../helpers.js');

const migrationInput = require('./migrationSnapshot.json');

const fs = require('fs');

async function executeStakingAndEscrowMigration() {
	let accounts = await ethers.getSigners();
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	let owner = accounts[0];

	let userBalanceAndHashes = [];
	let userBalanceHashes = [];
	let i = 0;
	let totalBalance = Big(0);

	let ethToSend = ethers.utils.parseUnits('0.0039');
	if (network == 'homestead') {
		network = 'mainnet';
	}

	if (networkObj.chainId == 69) {
		networkObj.name = 'optimisticKovan';
		network = 'optimisticKovan';
		ethToSend = ethers.utils.parseUnits('0.000039');
	}
	if (networkObj.chainId == 10) {
		networkObj.name = 'optimistic';
		network = 'optimistic';
	}

	console.log('Network is ' + network);

	// attach contracts
	const STAKING_THALES = getTargetAddress('StakingThales', network);
	const StakingThales = await ethers.getContractFactory('StakingThales');

	let stakingThales = await StakingThales.attach(STAKING_THALES);
	const Thales = await ethers.getContractFactory('/contracts/Token/OpThales_L2.sol:OpThales');
	const THALES = getTargetAddress('OpThales_L2', network);
	console.log('THALES is ' + THALES);
	let thales = await Thales.attach(THALES);

	// get stakers from StakingThales from last period
	for (let migratedStakerOrEscrower of migrationInput) {
		i++;
		if (migratedStakerOrEscrower.isContract) {
			console.log('Skipping ' + migratedStakerOrEscrower.wallet + ' as its a contract!');
			successfullyProcessed = true;
			continue;
		}

		// console.log(
		// 	'Processing migratedStakerOrEscrower ' +
		// 		migratedStakerOrEscrower.wallet +
		// 		' which is ' +
		// 		i +
		// 		'.'
		// );

		if (migratedStakerOrEscrower.totalStaked != '0') {
			let stakedBalanceOfBN = await stakingThales.stakedBalanceOf(migratedStakerOrEscrower.wallet);
			// console.log('staked is ' + stakedBalanceOfBN.toString());

			let escrowed;
			if (migratedStakerOrEscrower.totalEscrowed === undefined) {
				escrowed = BigNumber.from(0);
			} else {
				escrowed = BigNumber.from(migratedStakerOrEscrower.totalEscrowed);
			}
			let staked = BigNumber.from(migratedStakerOrEscrower.totalStaked);
			let totalAmount = escrowed.add(staked);
			// console.log('totalAmount is ' + totalAmount.toString());

			if (stakedBalanceOfBN != totalAmount.toString()) {
				console.log(
					'!!!!!!!!!!!!!!!!!!!!!!!!!SanityCheckFailed for ' + migratedStakerOrEscrower.wallet
				);
			}
		}
	}
}

executeStakingAndEscrowMigration()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});

function delay(time) {
	return new Promise(function(resolve) {
		setTimeout(resolve, time);
	});
}
