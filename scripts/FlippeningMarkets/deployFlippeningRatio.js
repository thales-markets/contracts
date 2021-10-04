const { ethers } = require('hardhat');

const BTC_TOTAL_MARKETCAP = '0x47E1e89570689c13E723819bf633548d611D630C';
const ETH_TOTAL_MARKETCAP = '0xAA2FE1324b84981832AafCf7Dc6E6Fe6cF124283';

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	if (network == 'homestead') {
		network = 'mainnet';
	}

	console.log('Account is:' + owner.address);
	console.log('Network name:' + networkObj.name);

	// We get the contract to deploy
	let FlippeningRatioOracle = await ethers.getContractFactory('FlippeningRatioOracle');
	const flippeningRatioOracle = await FlippeningRatioOracle.deploy(
		BTC_TOTAL_MARKETCAP,
		ETH_TOTAL_MARKETCAP
	);
	await flippeningRatioOracle.deployed();

	console.log('FlippeningRatioOracle deployed to:', flippeningRatioOracle.address);

	await hre.run('verify:verify', {
		address: flippeningRatioOracle.address,
		constructorArguments: [BTC_TOTAL_MARKETCAP, ETH_TOTAL_MARKETCAP],
		contract: 'contracts/customOracle/FlippeningRatioOracle.sol:FlippeningRatioOracle',
	});
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});
