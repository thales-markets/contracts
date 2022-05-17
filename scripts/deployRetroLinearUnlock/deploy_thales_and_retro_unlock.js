const { ethers } = require('hardhat');
const w3utils = require('web3-utils');
const { txLog } = require('../helpers.js');

const TOTAL_AMOUNT = w3utils.toWei('60000');
const VESTING_PERIOD = 86400 * 365; //one year

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;

	console.log('Account is: ' + owner.address);
	console.log('Network:' + network);
	console.log('Total amount', TOTAL_AMOUNT);

	// Dev env - deploy Thales.sol; Live env - use Thales.sol contract address
	const Thales = await ethers.getContractFactory('Thales');
	const ThalesDeployed = await Thales.deploy();
	await ThalesDeployed.deployed();

	console.log('Thales deployed to:', ThalesDeployed.address);

	const startTime = (await ethers.provider.getBlock()).timestamp + 1000; // hardcoded

	const VestingEscrow = await ethers.getContractFactory('VestingEscrow');
	const VestingEscrowDeployed = await VestingEscrow.deploy(
		owner.address,
		ThalesDeployed.address,
		startTime,
		startTime + VESTING_PERIOD
	);
	await VestingEscrowDeployed.deployed();
	console.log('VestingEscrowDeploy deployed to:', VestingEscrowDeployed.address);

	tx = await ThalesDeployed.approve(VestingEscrowDeployed.address, TOTAL_AMOUNT);
	txLog(tx, 'Thales.sol: Approve tokens');

	tx = await VestingEscrowDeployed.addTokens(TOTAL_AMOUNT);
	txLog(tx, 'VestingEscrow.sol: Add tokens');

	const recipients = [
		'0x461783A831E6dB52D68Ba2f3194F6fd1E0087E04',
		'0x169379d950ceffa34f5d92e33e40B7F3787F0f71',
		'0x9dB26e239F550C972573f64c3131399cC3E11eB7',
		'0x1BdAF065050869d3F2047eE85840f439c8B334C2',
		'0x8c42138C925d1049EC6B29F1EcF817b1628e54Ba',
		'0xb8D08D9537FC8E5624c298302137c5b5ce2F301D',
		'0x9f8e4ee788D9b00A3409584E18034aA7B736C396',
		'0x201A00ca946D9a312902Ceee012432a094503084',
		'0xD88cD37f2EE22a07870B6385d3041F95C1575D3C',
		'0xB27E08908D6Ecbe7F9555b9e048871532bE89302', 
		'0xfC970891F3B23FcD904CD8e73F3426876F4FE73b',
		'0xeBaCC96EA6449DB03732e11f807188e4E57CCa97',
		'0xfE5F7Be0dB53D43829B5D22F7C4d1953400eA5CF',
		'0xc6f4177dfc0509152896bf35cb547cae9834e964',
	];
	let amounts = new Array(14).fill(w3utils.toWei('365'));

	await VestingEscrowDeployed.fund(recipients, amounts);

	await hre.run('verify:verify', {
		address: ThalesDeployed.address,
	});

	await hre.run('verify:verify', {
		address: VestingEscrowDeployed.address,
		constructorArguments: [
			owner.address,
			ThalesDeployed.address,
			startTime,
			startTime + VESTING_PERIOD,
		],
	});
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});
