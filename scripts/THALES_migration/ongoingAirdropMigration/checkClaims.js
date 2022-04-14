const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');
const { web3 } = require('hardhat');
const Big = require('big.js');
const { BigNumber } = require('ethers');

const {
	numberExponentToLarge,
	txLog,
	setTargetAddress,
	getTargetAddress,
} = require('../../helpers.js');

const fs = require('fs');
let lastAirdropHashes = require('./OngoingAirdropMigration.json');

const ONGOING_AIRDROP = getTargetAddress('OngoingAirdrop', 'optimistic');
const OngoingAirdropABI = require('../../abi/OngoingAirdrop.json');
const ONGOING_AIRDROP_CONTRACT = new web3.eth.Contract(OngoingAirdropABI, ONGOING_AIRDROP);
async function prepareOngoingAirdropMigration() {
	const airdropC = await ethers.getContractFactory('OngoingAirdrop');
	let airdropContract = await airdropC.attach(ONGOING_AIRDROP);
	let curBlock = await ethers.provider.getBlock();
	console.log('curBlock is ' + curBlock.number);
	let ef = {
		address: '0x8D47b12ce25E2dc6866e8aAC0DbD823Da09fADd6',
		topics: ['0x34fcbac0073d7c3d388e51312faf357774904998eeb8fca628b9e6f65ee1cbf7'],
	};

	let allClaims = [];
	let blockCounter = 3134215;
	while (blockCounter < curBlock.number) {
		let nextBlock = blockCounter + 10000;
		console.log('Querying claims ' + blockCounter + ' to ' + nextBlock);
		let claims = await airdropContract.queryFilter(ef, blockCounter, nextBlock);
		claims.forEach(c => {
			allClaims.push(c.args[0].toLowerCase());
		});
		console.log('Number of claims is:' + allClaims.length);
		blockCounter = nextBlock;
	}

	let totalUnclaimedBalance = BigNumber.from(0);
	let i = 0;
	for (let airdropee of lastAirdropHashes) {
		let address = airdropee.address;
		address = address.toLowerCase();
		if (!allClaims.includes(address)) {
			totalUnclaimedBalance = totalUnclaimedBalance.add(BigNumber.from(airdropee.balance));
		}
		console.log('Processing ' + i++ + ' . address');
		console.log('Total unclaimed balance so far = ' + totalUnclaimedBalance.toString());
	}
}

prepareOngoingAirdropMigration()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});
