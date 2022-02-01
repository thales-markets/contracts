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
const processedWallets = require('./processedWallets.json');

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

	let totalAmount = BigNumber.from(0);
	let totalAmountContract = BigNumber.from(0);
	let totalAmountEscrow = BigNumber.from(0);
	let totalAmountStaked = BigNumber.from(0);
	let totalAmountUnstaking = BigNumber.from(0);
	let countAddressesNoETH = 0;

	i = 0;
	for (let migratedStakerOrEscrower of migrationInput) {
		i++;
		if (migratedStakerOrEscrower.isContract) {
			console.log('Skipping ' + migratedStakerOrEscrower.wallet + ' as its a contract!');
			continue;
		}

		//send directly if not a staker
		console.log(
			'Processing migratedStakerOrEscrower ' +
				migratedStakerOrEscrower.wallet +
				' which is ' +
				i +
				'.'
		);
		if (migratedStakerOrEscrower.unstaking) {
			let balanceUnstaking = BigNumber.from(migratedStakerOrEscrower.unstakingAmount);
			totalAmountUnstaking = totalAmountUnstaking.add(balanceUnstaking);
			totalAmount = totalAmount.add(balanceUnstaking);
		}

		if (
			migratedStakerOrEscrower.totalStaked == '0' &&
			migratedStakerOrEscrower.totalEscrowed !== undefined &&
			migratedStakerOrEscrower.totalEscrowed != '0'
		) {
			let balanceEscrow = BigNumber.from(migratedStakerOrEscrower.totalEscrowed);
			totalAmountEscrow = totalAmountEscrow.add(balanceEscrow);
			totalAmount = totalAmount.add(balanceEscrow);
		}
		//else put to staked and send $10 ETH if the staker has none
		else {
			if (migratedStakerOrEscrower.totalStaked != '0') {
				let escrowed;
				if (migratedStakerOrEscrower.totalEscrowed === undefined) {
					escrowed = BigNumber.from(0);
				} else {
					escrowed = BigNumber.from(migratedStakerOrEscrower.totalEscrowed);
				}
				let staked = BigNumber.from(migratedStakerOrEscrower.totalStaked);
				let totalAmountToStake = escrowed.add(staked);

				let balanceEscrow = escrowed;
				totalAmountEscrow = totalAmountEscrow.add(balanceEscrow);
				let balanceStaking = BigNumber.from(migratedStakerOrEscrower.totalStaked);
				totalAmountStaked = totalAmountStaked.add(balanceStaking);

				totalAmount = totalAmount.add(balanceEscrow).add(balanceStaking);

				const balance = await ethers.provider.getBalance(migratedStakerOrEscrower.wallet);
				console.log('ETH balance of ' + migratedStakerOrEscrower.wallet + ' is ' + balance);

				if (balance == 0) {
					countAddressesNoETH++;
				}
			}
		}
	}
	console.log('Total balance is ' + totalAmount.toString() / 1e18);
	console.log('Total balance staked is ' + totalAmountStaked.toString() / 1e18);
	console.log('Total balance unstaking is ' + totalAmountUnstaking.toString() / 1e18);
	console.log('Total balance escrowed is ' + totalAmountEscrow.toString() / 1e18);
	console.log('Total balance address no ETH is ' + countAddressesNoETH);
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
