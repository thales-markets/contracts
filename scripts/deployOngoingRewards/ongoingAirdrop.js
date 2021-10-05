const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');
const { web3 } = require('hardhat');
const Big = require('big.js');

const {
	numberExponentToLarge,
	txLog,
	getTargetAddress,
	setTargetAddress,
} = require('../helpers.js');

const ongoingRewards = require('../snx-data/ongoing_distribution.json');

const TOTAL_AMOUNT = web3.utils.toWei('125000');
const TOTAL_AMOUNT_STAKING = web3.utils.toWei('100000');
const TOTAL_AMOUNT_TO_TRANSFER = web3.utils.toWei('225000');

const fs = require('fs');

let includeStakingRewards = false;

async function ongoingAirdrop() {
	let accounts = await ethers.getSigners();
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	let owner = accounts[0];

	let userBalanceAndHashes = [];
	let userBalanceHashes = [];
	let i = 0;
	let totalBalance = Big(0);

	if (network === 'homestead') {
		network = 'mainnet';
	} else if (network === 'unknown') {
		network = 'localhost';
	}
	console.log('Network name:' + network);

	// attach contracts
	const THALES = getTargetAddress('Thales', network);
	const ONGOING_AIRDROP = getTargetAddress('OngoingAirdrop', network);
	const STAKING_THALES = getTargetAddress('StakingThales', network);

	const stakingThalesABI = require('../abi/StakingThales.json');

	const stakingThalesContract = new web3.eth.Contract(stakingThalesABI, STAKING_THALES);

	const OngoingAirdrop = await ethers.getContractFactory('OngoingAirdrop');
	let ongoingAirdrop = await OngoingAirdrop.attach(ONGOING_AIRDROP);

	const StakingThales = await ethers.getContractFactory('StakingThales');
	let stakingThales = await StakingThales.attach(STAKING_THALES);

	const Thales = await ethers.getContractFactory('Thales');
	let thales = await Thales.attach(THALES);

	// get stakers from StakingThales from last period
	let stakers = [];
	const stakingRewards = [];
	if (STAKING_THALES) {
		const stakingTimestamp = await stakingThales.startTimeStamp();
		if (stakingTimestamp.toString() > 0) {
			// check if staking has begun
			const closedPeriodEvents = await stakingThalesContract.getPastEvents('ClosedPeriod', {
				fromBlock: 0,
				toBlock: 'latest',
			});
			let lastClosedPeriodBlockNumber = 0;

			if (closedPeriodEvents.length) {
				lastClosedPeriodBlockNumber = closedPeriodEvents[closedPeriodEvents.length - 1].blockNumber; // get last ClosedPeriod event block number
			}

			// closePeriod() logic
			try {
				const lastPeriodTimeStamp = (await stakingThales.lastPeriodTimeStamp()).toString();
				const durationPeriod = (await stakingThales.durationPeriod()).toString();
				const closingDate = new Date(lastPeriodTimeStamp * 1000.0 + durationPeriod * 1000.0);
				const now = new Date();

				console.log('lastPeriodTS', lastPeriodTimeStamp);
				console.log('durationPeriod', durationPeriod);
				console.log('closingDate', closingDate.getTime());

				if (now.getTime() > closingDate.getTime()) {
					// TODO: close through gnosis
					// let tx = await stakingThales.closePeriod();
					// await tx
					// 	.wait()
					// 	.then(e => {
					// 		console.log('StakingThales: period closed');
					// 	})
					// 	.catch(e => {
					// 		console.err(e);
					// 		return;
					// 	});

					if (includeStakingRewards) {
						const stakedEvents = await stakingThalesContract.getPastEvents('Staked', {
							fromBlock: 0,
							toBlock: 'latest',
						});

						for (let i = 0; i < stakedEvents.length; ++i) {
							stakers.push(stakedEvents[i].returnValues.user.toLowerCase());
						}

						stakers = [...new Set(stakers)]; // ensure uniqueness

						console.log('stakers', stakers);

						for (let staker of stakers) {
							try {
								const reward = await stakingThales.getRewardsAvailable(staker);
								console.log('available rewards for ', staker, ' - ', reward.toString());
								stakingRewards[staker.toLowerCase()] = parseInt(reward.toString());
							} catch (e) {
								continue; // rewards already claimed, continue
							}
						}
					}
				} else {
					console.log("StakingThales: it's not time yet to close period");
					return;
				}
			} catch (e) {
				console.log('StakingThales: failed to close the period', e);
				return;
			}

			console.log('stakin rewards', stakingRewards);
		}
	}

	// get file with previous hashes
	let ongoingPeriod = await ongoingAirdrop.period();
	const lastMerkleDistribution = require(`./ongoing-airdrop-hashes-period-${ongoingPeriod.toString()}.json`);

	lastMerkleDistribution.forEach(l => {
		if (!ongoingRewards.hasOwnProperty(l.address.toLowerCase())) {
			ongoingRewards[l.address.toLowerCase()] = 0;
		}
	});

	// pause ongoingAirdrop
	// TODO: pause through gnosis
	// let pauseTX = await ongoingAirdrop.setPaused(true);
	// await pauseTX.wait().then(e => {
	// 	txLog(pauseTX, 'Airdrop paused');
	// });

	let totalScore = Big(0);
	for (let value of Object.values(ongoingRewards)) {
		totalScore = totalScore.add(value);
	}

	console.log('totalScore', totalScore.toString());

	let addressesToSkip = new Set();

	// get list of leaves for the merkle trees using index, address and token balance
	// encode user address and balance using web3 encodePacked
	for (let address of Object.keys(ongoingRewards)) {
		address = address.toLowerCase();
		console.log('processing address: ' + address);
		addressesToSkip.add(address);
		// check last period merkle distribution
		var index = lastMerkleDistribution
			.map(function(e) {
				return e.address;
			})
			.indexOf(address);

		let claimed = 0;
		try {
			await ongoingAirdrop.claimed(index);
		} catch (e) {
			claimed = 1; // tx returned error - address already claimed
		}

		console.log('checking address: ' + address);
		let amount = Big(ongoingRewards[address])
			.times(TOTAL_AMOUNT)
			.div(totalScore)
			.round();

		// check if the address is in stakingRewards
		const stakingReward = Big(stakingRewards[address] ? stakingRewards[address] : 0);
		if (stakingReward > 0) {
			amount = amount.add(stakingReward);
		}

		// adding only new amounts to totalBalance value
		totalBalance = totalBalance.add(amount);
		let previousBalance = 0;
		// if address hasn't claimed add to amount prev value
		if (claimed == 0 && lastMerkleDistribution[index]) {
			amount = amount.add(lastMerkleDistribution[index].balance);
			previousBalance = lastMerkleDistribution[index].balance;
		}

		let hash = keccak256(
			web3.utils.encodePacked(i, address, numberExponentToLarge(amount.toString()))
		);
		let balance = {
			address,
			balance: numberExponentToLarge(amount.toString()),
			stakingBalance: numberExponentToLarge(stakingReward),
			previousBalance,
			proof: '',
			hash,
			index: i,
		};

		console.log('ongoing', address, numberExponentToLarge(amount.toString()));

		stakingReward[address] = 0;
		userBalanceHashes.push(hash);
		userBalanceAndHashes.push(balance);
		++i;
	}

	// Add staking rewards to merkle tree
	for (let address of Object.keys(stakingRewards)) {
		address = address.toLowerCase();
		if (addressesToSkip.has(address)) {
			console.log('skipping address: ' + address);
			continue;
		}
		// check last period merkle distribution
		var index = lastMerkleDistribution
			.map(function(e) {
				return e.address;
			})
			.indexOf(address);

		let claimed = 0;
		try {
			await ongoingAirdrop.claimed(index);
		} catch (e) {
			claimed = 1; // tx returned error - address already claimed
		}

		let amount = Big(stakingRewards[address]);
		let previousBalance = 0;
		// adding only new amounts to totalBalance value
		totalBalance = totalBalance.add(amount);

		// if address hasn't claimed add to amount prev value
		if (claimed == 0 && lastMerkleDistribution[index]) {
			amount = amount.add(lastMerkleDistribution[index].balance);
			previousBalance = lastMerkleDistribution[index].balance;
		}

		console.log('staking', address, numberExponentToLarge(amount.toString()));

		let hash = keccak256(
			web3.utils.encodePacked(i, address, numberExponentToLarge(amount.toString()))
		);
		let balance = {
			address,
			balance: numberExponentToLarge(amount.toString()),
			stakingBalance: numberExponentToLarge(Big(stakingRewards[address])),
			previousBalance,
			hash,
			proof: '',
			index: i,
		};
		userBalanceHashes.push(hash);
		userBalanceAndHashes.push(balance);
		++i;
	}

	// create merkle tree
	const merkleTree = new MerkleTree(userBalanceHashes, keccak256, {
		sortLeaves: true,
		sortPairs: true,
	});

	// Get tree root
	const root = merkleTree.getHexRoot();
	console.log('tree root:', root);

	for (let ubh in userBalanceAndHashes) {
		userBalanceAndHashes[ubh].proof = merkleTree.getHexProof(userBalanceAndHashes[ubh].hash);
	}

	// TODO: all through gnosis
	// ongoingAirdrop: set new tree root, unpause contract
	// let tx = await ongoingAirdrop.setRoot(root);
	// await tx.wait().then(e => {
	// 	txLog(tx, 'New root set');
	// });
	// pauseTX = await ongoingAirdrop.setPaused(false);
	// await pauseTX.wait().then(e => {
	// 	txLog(pauseTX, 'Airdrop unpaused');
	// });

	ongoingPeriod = (await ongoingAirdrop.period()) + 1;

	fs.writeFileSync(
		`scripts/deployOngoingRewards/ongoing-airdrop-hashes-period-${ongoingPeriod.toString()}.json`,
		JSON.stringify(userBalanceAndHashes),
		function(err) {
			if (err) return console.log(err);
		}
	);

	if (includeStakingRewards) {
		await thales.transfer(ongoingAirdrop.address, TOTAL_AMOUNT_TO_TRANSFER);
	} else {
		await thales.transfer(ongoingAirdrop.address, TOTAL_AMOUNT);
	}
}

ongoingAirdrop()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});
