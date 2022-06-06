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
const processedWallets = require('./processedWalletsUnstaking.json');

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

	i = 0;
	for (let migratedStakerOrEscrower of migrationInput) {
		let successfullyProcessed = false;
		while (!successfullyProcessed) {
			try {
				if (migratedStakerOrEscrower.isContract) {
					console.log('Skipping ' + migratedStakerOrEscrower.wallet + ' as its a contract!');
					successfullyProcessed = true;
					continue;
				}

				if (processedWallets.includes(migratedStakerOrEscrower.wallet)) {
					console.log(
						'Skipping ' + migratedStakerOrEscrower.wallet + ' as it was already processed'
					);
					successfullyProcessed = true;
					continue;
				}
				//send directly if unstaking
				console.log('Processing migratedStakerOrEscrower ' + migratedStakerOrEscrower.wallet);
				if (migratedStakerOrEscrower.unstaking) {
					console.log('Sending unstaking THALES directly to  ' + migratedStakerOrEscrower.wallet);
					let tx = await thales.transfer(
						migratedStakerOrEscrower.wallet,
						migratedStakerOrEscrower.unstakingAmount + ''
					);
					await tx.wait().then(e => {
						txLog(tx, 'thales: transfer ' + migratedStakerOrEscrower.wallet);
					});
					await delay(2000);
				}
				successfullyProcessed = true;
			} catch (e) {
				console.log(e);
				await delay(5000);
			}
		}

		if (!processedWallets.includes(migratedStakerOrEscrower.wallet)) {
			processedWallets.push(migratedStakerOrEscrower.wallet);
			fs.writeFileSync(
				'scripts/THALES_migration/stakingEscrowMigration/processedWalletsUnstaking.json',
				JSON.stringify(processedWallets),
				function(err) {
					if (err) return console.log(err);
				}
			);
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

function delay(time) {
	return new Promise(function(resolve) {
		setTimeout(resolve, time);
	});
}
