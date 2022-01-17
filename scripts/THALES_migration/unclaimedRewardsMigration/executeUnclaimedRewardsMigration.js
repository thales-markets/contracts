const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');
const { web3 } = require('hardhat');
const Big = require('big.js');

const {
  numberExponentToLarge,
  txLog,
  getTargetAddress,
  setTargetAddress,
} = require('../../helpers.js');

const migrationInput = require('scripts/THALES_migration/migrationSnapshot.json');

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

  const stakingThalesABI = require('../../abi/StakingThales.json');

  const stakingThalesContract = new web3.eth.Contract(stakingThalesABI, STAKING_THALES);

  const StakingThales = await ethers.getContractFactory('StakingThales');
  let stakingThales = await StakingThales.attach(STAKING_THALES);

  const Thales = await ethers.getContractFactory('Thales');
  let thales = await Thales.attach(THALES);

  // get stakers from StakingThales from last period
}

executeStakingAndEscrowMigration()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
