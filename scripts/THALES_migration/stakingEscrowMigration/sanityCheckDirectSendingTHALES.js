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
		networkObj.name = 'optimisticEthereum';
		network = 'optimisticEthereum';
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
		if (migratedStakerOrEscrower.isContract) {
			console.log('Skipping ' + migratedStakerOrEscrower.wallet + ' as its a contract!');
			continue;
		}

		let unstakingAmount = BigNumber.from(0);
		let escrowedAmount = BigNumber.from(0);
		if (migratedStakerOrEscrower.unstaking) {
			unstakingAmount = BigNumber.from(migratedStakerOrEscrower.unstakingAmount);
		}
		if (
			migratedStakerOrEscrower.totalStaked == '0' &&
			migratedStakerOrEscrower.totalEscrowed !== undefined &&
			migratedStakerOrEscrower.totalEscrowed != '0'
		) {
			escrowedAmount = BigNumber.from(migratedStakerOrEscrower.totalEscrowed);
		}

		if (unstakingAmount.toString() != 0 || escrowedAmount.toString() != 0) {
			i++;
			//send directly if not a staker
			console.log('Processing migratedStakerOrEscrower ' + migratedStakerOrEscrower.wallet + " which is " + i + ". ");
			let balance = await thales.balanceOf(migratedStakerOrEscrower.wallet);
			let shouldBeSent = unstakingAmount.add(escrowedAmount);
			console.log('balance is ' + balance.toString());
			console.log('shouldBeSent is ' + shouldBeSent.toString());
			if (balance != shouldBeSent.toString()) {
				console.log('!!!!!!!!!!SanityCheckFailed for ' + migratedStakerOrEscrower.wallet);
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
