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

	let teamUrls = [
		'https://thales-protocol.s3.eu-north-1.amazonaws.com/zebro_qatar.png',
		'https://thales-protocol.s3.eu-north-1.amazonaws.com/zebro_ecuador.png',
		'https://thales-protocol.s3.eu-north-1.amazonaws.com/zebro_senegal.png',
		'https://thales-protocol.s3.eu-north-1.amazonaws.com/zebro_netherlands.png',
		'https://thales-protocol.s3.eu-north-1.amazonaws.com/zebro_england.png',
		'https://thales-protocol.s3.eu-north-1.amazonaws.com/zebro_iran.png',
		'https://thales-protocol.s3.eu-north-1.amazonaws.com/zebro_usa.png',
		'https://thales-protocol.s3.eu-north-1.amazonaws.com/zebro_wales.png',
		'https://thales-protocol.s3.eu-north-1.amazonaws.com/zebro_argentina.png',
		'https://thales-protocol.s3.eu-north-1.amazonaws.com/zebro_saudi_arabia.png',
		'https://thales-protocol.s3.eu-north-1.amazonaws.com/zebro_mexico.png',
		'https://thales-protocol.s3.eu-north-1.amazonaws.com/zebro_poland.png',
		'https://thales-protocol.s3.eu-north-1.amazonaws.com/zebro_france.png',
		'https://thales-protocol.s3.eu-north-1.amazonaws.com/zebro_australia.png',
		'https://thales-protocol.s3.eu-north-1.amazonaws.com/zebro_denmark.png',
		'https://thales-protocol.s3.eu-north-1.amazonaws.com/zebro_tunisia.png',
		'https://thales-protocol.s3.eu-north-1.amazonaws.com/zebro_spain.png',
		'https://thales-protocol.s3.eu-north-1.amazonaws.com/zebro_costa_rica.png',
		'https://thales-protocol.s3.eu-north-1.amazonaws.com/zebro_germany.png',
		'https://thales-protocol.s3.eu-north-1.amazonaws.com/zebro_japan.png',
		'https://thales-protocol.s3.eu-north-1.amazonaws.com/zebro_belgium.png',
		'https://thales-protocol.s3.eu-north-1.amazonaws.com/zebro_canada.png',
		'https://thales-protocol.s3.eu-north-1.amazonaws.com/zebro_morocco.png',
		'https://thales-protocol.s3.eu-north-1.amazonaws.com/zebro_croatia.png',
		'https://thales-protocol.s3.eu-north-1.amazonaws.com/zebro_brazil.png',
		'https://thales-protocol.s3.eu-north-1.amazonaws.com/zebro_serbia.png',
		'https://thales-protocol.s3.eu-north-1.amazonaws.com/zebro_switzerland.png',
		'https://thales-protocol.s3.eu-north-1.amazonaws.com/zebro_cameroon.png',
		'https://thales-protocol.s3.eu-north-1.amazonaws.com/zebro_portugal.png',
		'https://thales-protocol.s3.eu-north-1.amazonaws.com/zebro_ghana.png',
		'https://thales-protocol.s3.eu-north-1.amazonaws.com/zebro_uruguay.png',
		'https://thales-protocol.s3.eu-north-1.amazonaws.com/zebro_south_korea.png',
	];

	const OvertimeWorldCupZebro = await ethers.getContractFactory('OvertimeWorldCupZebro');
	const OvertimeWorldCupZebroDeployed = await OvertimeWorldCupZebro.deploy(
		favoriteTeams,
		teamUrls,
		stakingAddress,
		minimumAmountForStaking
	);
	await OvertimeWorldCupZebroDeployed.deployed();
	setTargetAddress('OvertimeWorldCupZebro', network, OvertimeWorldCupZebroDeployed.address);

	console.log('OvertimeWorldCupZebro deployed to:', OvertimeWorldCupZebroDeployed.address);

	await hre.run('verify:verify', {
		address: OvertimeWorldCupZebroDeployed.address,
		constructorArguments: [favoriteTeams, teamUrls, stakingAddress, minimumAmountForStaking],
	});
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
