const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');
const { web3 } = require('hardhat');
const Big = require('big.js');
const w3utils = require('web3-utils');

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

	if (network == 'homestead') {
		network = 'mainnet';
	}

	if (networkObj.chainId == 69) {
		networkObj.name = 'optimisticKovan';
		network = 'optimisticKovan';
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

	//do approval
	let tx = await thales.approve(STAKING_THALES, w3utils.toWei('5000000'));
	await tx.wait().then(e => {
		txLog(tx, 'Thales.sol: Approve tokens');
	});

	// get stakers from StakingThales from last period

	i = 0;
	for (let migratedStakerOrEscrower of migrationInput) {
		if (migratedStakerOrEscrower.isContract) {
			console.log('Skipping ' + migratedStakerOrEscrower.wallet + ' as its a contract!');
			continue;
		}

		//send directly if not a staker
		console.log('Processing migratedStakerOrEscrower ' + migratedStakerOrEscrower);
		if (migratedStakerOrEscrower.totalStaked == 0) {
			await thales.transfer(
				migratedStakerOrEscrower.wallet,
				w3utils.toWei(migratedStakerOrEscrower.totalEscrowed / 1e18 + '')
			);
		}
		//else put to staked and send $10 ETH if the staker has none
		else {
			let escrowed = Big(migratedStakerOrEscrower.totalEscrowed / 1e18);
			console.log('Escrowed is ' + escrowed);
			let staked = Big(migratedStakerOrEscrower.totalStaked / 1e18);
			let totalAmount = escrowed.add(staked);
			console.log('totalAmount is ' + totalAmount);
			let tx = await stakingThales.stakeOnBehalf(
				w3utils.toWei(totalAmount.toString()),
				migratedStakerOrEscrower.wallet
			);
			await tx.wait().then(e => {
				txLog(tx, 'stakingThales: stakeOnBehalf ' + i);
			});

			const balance = await ethers.provider.getBalance(migratedStakerOrEscrower.wallet);
			console.log('ETH balance of ' + migratedStakerOrEscrower.wallet + ' is ' + balance);
			if (balance == 0) {
				tx = await owner.sendTransaction({
					to: migratedStakerOrEscrower.wallet,
					value: ethers.utils.parseUnits('0.003125'),
				});
				await tx.wait().then(e => {
					txLog(tx, 'send ETH to ' + migratedStakerOrEscrower.wallet);
				});
			}
		}
		i++;
	}
}

executeStakingAndEscrowMigration()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});
