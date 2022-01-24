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

	let escrowers = new Set();

	for (let i = 0; i < addToEscrowEvents.length; ++i) {
		let escrowerAddress = addToEscrowEvents[i].returnValues.acount.toLowerCase();
		if (!escrowers.has(escrowerAddress)) {
			let stakedBalanceOf = await stakingThales.stakedBalanceOf(escrowerAddress);
			stakedBalanceOf = stakedBalanceOf / 1e18;
			let contractChecker = await web3.eth.getCode(escrowerAddress);

			let escrowedBalanceOf = await escrowThales.totalAccountEscrowedAmount(escrowerAddress);
			escrowedBalanceOf = escrowedBalanceOf / 1e18;

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
				escrowers.add(escrowerAddress);
			}
		}
	}
}

checkForMultisigs()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});
