const keccak256 = require('keccak256');
const { web3 } = require('hardhat');
const Big = require('big.js');

const {
	numberExponentToLarge,
	txLog,
	setTargetAddress,
	getTargetAddress,
} = require('../../helpers.js');

const fs = require('fs');

const STAKING_THALES = getTargetAddress('StakingThales', 'mainnet');
const stakingThalesABI = require('../../abi/StakingThales.json');
const stakingThalesContract = new web3.eth.Contract(stakingThalesABI, STAKING_THALES);

const Escrow_THALES = getTargetAddress('EscrowThales', 'mainnet');
const EscrowThalesABI = require('../../abi/EscrowThales.json');
const escrowThalesContract = new web3.eth.Contract(EscrowThalesABI, Escrow_THALES);

async function checkForMultisigs() {
	const StakingThales = await ethers.getContractFactory('StakingThales');
	let stakingThales = await StakingThales.attach(STAKING_THALES);

	const EscrowThales = await ethers.getContractFactory('EscrowThales');
	let escrowThales = await EscrowThales.attach(Escrow_THALES);

	const addToEscrowEvents = await escrowThalesContract.getPastEvents('AddedToEscrow', {
		fromBlock: 0,
		toBlock: 'latest',
	});

	let walletsforMigrationMap = new Map();

	for (let i = 0; i < addToEscrowEvents.length; ++i) {
		let escrowerAddress = addToEscrowEvents[i].returnValues.acount.toLowerCase();
		if (!walletsforMigrationMap.has(escrowerAddress)) {
			let stakedBalanceOfBN = await stakingThales.stakedBalanceOf(escrowerAddress);
			let stakedBalanceOf = stakedBalanceOfBN / 1e18;
			let contractChecker = await web3.eth.getCode(escrowerAddress);

			let escrowedBalanceOfBN = await escrowThales.totalAccountEscrowedAmount(escrowerAddress);
			let escrowedBalanceOf = escrowedBalanceOfBN / 1e18;

			let isContract = contractChecker != '0x';
			if (escrowedBalanceOf > 0) {
				console.log(
					'Pushing ' +
						i +
						'. escrower ' +
						escrowerAddress +
						' with balance ' +
						escrowedBalanceOf +
						' with staked balance ' +
						stakedBalanceOf
				);
				if (isContract) {
					console.log('Escrower ' + escrowerAddress + ' is a contract');
				}
			}
			let walletObject = {};
			walletObject.totalEscrowed = escrowedBalanceOfBN;
			walletObject.isContract = isContract;
			walletObject.totalStaked = stakedBalanceOfBN;
			walletsforMigrationMap.set(escrowerAddress, walletObject);
		}
	}

	const stakedEvents = await stakingThalesContract.getPastEvents('Staked', {
		fromBlock: 0,
		toBlock: 'latest',
	});

	for (let i = 0; i < stakedEvents.length; ++i) {
		let stakerAddress = stakedEvents[i].returnValues.user.toLowerCase();
		let stakedBalanceOfBN = await stakingThales.stakedBalanceOf(stakerAddress);
		let stakedBalanceOf = stakedBalanceOfBN / 1e18;
		let contractChecker = await web3.eth.getCode(stakerAddress);
		let isContract = contractChecker != '0x';
		if (stakedBalanceOf > 0) {
			console.log(
				'Pushing ' +
					i +
					'. staker ' +
					stakerAddress +
					' with balance ' +
					stakedBalanceOf +
					' with contract checker being ' +
					contractChecker
			);
			if (isContract) {
				console.log('Staker ' + stakerAddress + ' is a contract');
			}
		}
		let walletObject = {};
		if (walletsforMigrationMap.has(stakerAddress)) {
			walletObject = walletsforMigrationMap.get(stakerAddress);
		}
		walletObject.totalStaked = stakedBalanceOfBN;
		walletObject.isContract = isContract;
		walletsforMigrationMap.set(stakerAddress, walletObject);
	}

	let migrationWallets = [];
	walletsforMigrationMap.forEach((value, key) => {
		let walletObjectForArray = value;
		walletObjectForArray.wallet = key;
		migrationWallets.push(walletObjectForArray);
	});
	fs.writeFileSync(
		'scripts/THALES_migration/migrationSnapshot.json',
		JSON.stringify(migrationWallets),
		function(err) {
			if (err) return console.log(err);
		}
	);
}

checkForMultisigs()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});
