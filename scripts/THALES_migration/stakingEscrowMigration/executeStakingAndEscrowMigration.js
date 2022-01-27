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

	let ethToSend = ethers.utils.parseUnits('0.003125');
	if (network == 'homestead') {
		network = 'mainnet';
	}

	if (networkObj.chainId == 69) {
		networkObj.name = 'optimisticKovan';
		network = 'optimisticKovan';
		ethToSend = ethers.utils.parseUnits('0.00003125');
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
	// let tx = await thales.approve(STAKING_THALES, w3utils.toWei('5000000'));
	// await tx.wait().then(e => {
	// 	txLog(tx, 'Thales.sol: Approve tokens');
	// });

	// get stakers from StakingThales from last period

	i = 0;
	for (let migratedStakerOrEscrower of migrationInput) {
		if (migratedStakerOrEscrower.isContract) {
			console.log('Skipping ' + migratedStakerOrEscrower.wallet + ' as its a contract!');
			continue;
		}

		if (processedWallets.includes(migratedStakerOrEscrower.wallet)) {
			console.log('Skipping ' + migratedStakerOrEscrower.wallet + ' as it was already processed');
			continue;
		}
		//send directly if not a staker
		console.log('Processing migratedStakerOrEscrower ' + migratedStakerOrEscrower.wallet);
		if (migratedStakerOrEscrower.unstaking == 0) {
			console.log('Sending unstaking THALES directly to  ' + migratedStakerOrEscrower.wallet);
			let tx = await thales.transfer(
				migratedStakerOrEscrower.wallet,
				migratedStakerOrEscrower.unstakingAmount + ''
			);
			tx.wait().then(e => {
				txLog(tx, 'thales: transfer ' + migratedStakerOrEscrower.wallet);
			});
		}

		if (migratedStakerOrEscrower.totalStaked == 0) {
			console.log('Sending THALES directly to  ' + migratedStakerOrEscrower.wallet);
			let tx = await thales.transfer(
				migratedStakerOrEscrower.wallet,
				migratedStakerOrEscrower.totalEscrowed + ''
			);
			tx.wait().then(e => {
				txLog(tx, 'thales: transfer ' + migratedStakerOrEscrower.wallet);
			});
		}
		//else put to staked and send $10 ETH if the staker has none
		else {
			let escrowed;
			if (migratedStakerOrEscrower.totalEscrowed === undefined) {
				escrowed = BigNumber.from(0);
			} else {
				escrowed = BigNumber.from(migratedStakerOrEscrower.totalEscrowed);
			}
			console.log('Escrowed is ' + escrowed);
			let staked = BigNumber.from(migratedStakerOrEscrower.totalStaked);
			let totalAmount = escrowed.add(staked);
			console.log('totalAmount is ' + totalAmount.toString());
			let tx = await stakingThales.stakeOnBehalf(
				totalAmount.toString(),
				migratedStakerOrEscrower.wallet
			);
			await tx.wait().then(e => {
				txLog(tx, 'stakingThales: stakeOnBehalf ' + i);
			});

			const balance = await ethers.provider.getBalance(migratedStakerOrEscrower.wallet);
			console.log('ETH balance of ' + migratedStakerOrEscrower.wallet + ' is ' + balance);

			if (balance == 0) {
				await delay(5000);
				tx = await owner.sendTransaction({
					to: migratedStakerOrEscrower.wallet,
					value: ethToSend,
				});
				await tx.wait().then(e => {
					txLog(tx, 'send ETH to ' + migratedStakerOrEscrower.wallet);
				});
			}
		}
		processedWallets.push(migratedStakerOrEscrower.wallet);
		fs.writeFileSync(
			'scripts/THALES_migration/stakingEscrowMigration/processedWallets.json',
			JSON.stringify(processedWallets),
			function(err) {
				if (err) return console.log(err);
			}
		);
		i++;
		await delay(10000);
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
