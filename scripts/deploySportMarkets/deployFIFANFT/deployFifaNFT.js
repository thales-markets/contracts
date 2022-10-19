const { ethers } = require('hardhat');
const { getTargetAddress, setTargetAddress } = require('../../helpers');
const w3utils = require('web3-utils');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	let stakingAddress;

	if (network === 'unknown') {
		network = 'localhost';
	}

	if (network == 'homestead') {
		network = 'mainnet';
	}
	if (networkObj.chainId == 69) {
		networkObj.name = 'optimisticKovan';
		network = 'optimisticKovan';
	}
	if (networkObj.chainId == 10) {
		networkObj.name = 'optimisticEthereum';
		network = 'optimisticEthereum';
	}

	if (networkObj.chainId == 80001) {
		networkObj.name = 'polygonMumbai';
		network = 'polygonMumbai';
	}

	if (networkObj.chainId == 137) {
		networkObj.name = 'polygon';
		network = 'polygon';
	}
	if (networkObj.chainId == 420) {
		networkObj.name = 'optimisticGoerli';
		network = 'optimisticGoerli';
	}

	if (networkObj.chainId == 5) {
		networkObj.name = 'goerli';
		network = 'goerli';
	}

	console.log('Account is: ' + owner.address);
	console.log('Network:' + network);

	stakingAddress = getTargetAddress('StakingThales', network);
	console.log('Found stakingAddress at:' + stakingAddress);

	const minimumAmountForStaking = w3utils.toWei('10');

	let favoriteTeams = [
		'Qatar',
		'Ecuador',
		'Senegal',
		'Netherlands',
		'England',
		'IR Iran',
		'United States',
		'Wales',
		'Argentina',
		'Saudi Arabia',
		'Mexico',
		'Poland',
		'France',
		'Australia',
		'Denmark',
		'Tunisia',
		'Spain',
		'Costa Rica',
		'Germany',
		'Japan',
		'Belgium',
		'Canada',
		'Morocco',
		'Croatia',
		'Brazil',
		'Serbia',
		'Switzerland',
		'Cameroon',
		'Portugal',
		'Ghana',
		'Uruguay',
		'South Korea',
	];

	let uri = 'https://thales-protocol.s3.eu-north-1.amazonaws.com';

	const FIFAFavoriteTeam = await ethers.getContractFactory('FIFAFavoriteTeam');
	const FIFAFavoriteTeamDeployed = await FIFAFavoriteTeam.deploy(
		uri,
		favoriteTeams,
		stakingAddress,
		minimumAmountForStaking
	);
	await FIFAFavoriteTeamDeployed.deployed();
	setTargetAddress('FIFAFavoriteTeam', network, FIFAFavoriteTeamDeployed.address);

	console.log('FIFAFavoriteTeam deployed to:', FIFAFavoriteTeamDeployed.address);

	await hre.run('verify:verify', {
		address: FIFAFavoriteTeamDeployed.address,
		constructorArguments: [uri, favoriteTeams, stakingAddress, minimumAmountForStaking],
	});
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
