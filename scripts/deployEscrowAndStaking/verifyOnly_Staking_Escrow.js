const { ethers } = require('hardhat');
const { getTargetAddress } = require('../helpers');

const user_key1 = process.env.PRIVATE_KEY;

async function main() {
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	if (networkObj.chainId == 69) {
		network = 'optimisticKovan';
	}
	if (network == 'homestead') {
		network = 'mainnet';
	}
	if (networkObj.chainId == 10) {
		network = 'optimisticEthereum';
	}
	const owner = new ethers.Wallet(user_key1, ethers.provider);

	console.log('Owner is:' + owner.address);
	console.log('Network name:' + network);

	const StakingImplementation = getTargetAddress('StakingThalesImplementation', network);
	const EscrowImplementation = getTargetAddress('EscrowThalesImplementation', network);
	const ProxyStaking = getTargetAddress('StakingThales', network);
	const ProxyEscrow = getTargetAddress('EscrowThales', network);

	console.log('Implementation Escrow: ', EscrowImplementation);
	console.log('Implementation Staking: ', StakingImplementation);
	console.log('Escrow proxy:', ProxyEscrow);
	console.log('Staking proxy:', ProxyStaking);

	try {
		await hre.run('verify:verify', {
			address: StakingImplementation,
		});
	} catch (e) {
		console.log(e);
	}
	try {
		await hre.run('verify:verify', {
			address: EscrowImplementation,
		});
	} catch (e) {
		console.log(e);
	}

	try {
		await hre.run('verify:verify', {
			address: ProxyEscrow,
		});
	} catch (e) {
		console.log(e);
	}
	try {
		await hre.run('verify:verify', {
			address: ProxyStaking,
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
