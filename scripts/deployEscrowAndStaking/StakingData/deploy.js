const { ethers, upgrades } = require('hardhat');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');

const { getTargetAddress, setTargetAddress } = require('../../helpers');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;

	if (networkObj.chainId == 420) {
		networkObj.name = 'optimisticGoerli';
		network = 'optimisticGoerli';
	}
	if (networkObj.chainId == 10) {
		networkObj.name = 'optimisticEthereum';
		network = 'optimisticEthereum';
	}
	if (networkObj.chainId == 42161) {
		networkObj.name = 'arbitrumOne';
		network = 'arbitrumOne';
	}

	const StakingData = await ethers.getContractFactory('StakingData');
	const StakingThalesAddress = getTargetAddress('StakingThales', network);
	const EscrowThalesAddress = getTargetAddress('EscrowThales', network);

	const StakingDataDeployed = await upgrades.deployProxy(StakingData, [owner.address]);
	await StakingDataDeployed.deployed();

	console.log('StakingData deployed on', StakingDataDeployed.address);
	setTargetAddress('StakingData', network, StakingDataDeployed.address);

	await delay(5000);
	const StakingDataImplementation = await getImplementationAddress(
		ethers.provider,
		StakingDataDeployed.address
	);

	console.log('Implementation StakingData: ', StakingDataImplementation);
	setTargetAddress('StakingDataImplementation', network, StakingDataImplementation);

	await delay(5000);
	await StakingDataDeployed.setStakingThales(StakingThalesAddress, {
		from: owner.address,
	});
	await delay(5000);
	await StakingDataDeployed.setEscrowThales(EscrowThalesAddress, { from: owner.address });
	await delay(5000);

	try {
		await hre.run('verify:verify', {
			address: StakingDataImplementation,
		});
	} catch (e) {
		console.log(e);
	}
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});

function delay(time) {
	return new Promise(function (resolve) {
		setTimeout(resolve, time);
	});
}
