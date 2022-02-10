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

async function checkForMultisigs() {
	const StakingThales = await ethers.getContractFactory('StakingThales');
	let stakingThales = await StakingThales.attach(STAKING_THALES);

	const stakedEvents = await stakingThalesContract.getPastEvents('Staked', {
		fromBlock: 0,
		toBlock: 'latest',
	});

	let stakers = new Set();

	for (let i = 0; i < stakedEvents.length; ++i) {
		let stakerAddress = stakedEvents[i].returnValues.user.toLowerCase();
		if (!stakers.has(stakerAddress)) {
			let stakedBalanceOf = await stakingThales.stakedBalanceOf(stakerAddress);
			stakedBalanceOf = stakedBalanceOf / 1e18;
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
				stakers.add(stakerAddress);
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
