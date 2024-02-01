const { ethers, upgrades } = require('hardhat');
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');
const { getTargetAddress, setTargetAddress } = require('../helpers');

const user_key1 = process.env.PRIVATE_KEY;

async function main() {
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	if (networkObj.chainId == 10) {
		network = 'optimisticEthereum';
	}
	if (networkObj.chainId == 69) {
		network = 'optimisticKovan';
	}
	if (network == 'homestead') {
		network = 'mainnet';
	}
	if (networkObj.chainId == 42161) {
		networkObj.name = 'arbitrumOne';
		network = 'arbitrumOne';
	}
	if (networkObj.chainId == 8453) {
		networkObj.name = 'baseMainnet';
		network = 'baseMainnet';
	}

	const owner = new ethers.Wallet(user_key1, ethers.provider);

	let SafeBoxBufferImplementation;

	console.log('Owner is:' + owner.address);
	console.log('Network name:' + network);

	if (networkObj.chainId == 69) {
		network = 'optimisticKovan';
	}
	if (networkObj.chainId == 420) {
		networkObj.name = 'optimisticGoerli';
		network = 'optimisticGoerli';
		proxySUSD = getTargetAddress('ExoticUSD', network);
	}

	const SafeBoxBuffer = getTargetAddress('SafeBoxBuffer', network);
	const SafeBoxBufferContract = await ethers.getContractFactory('SafeBoxBuffer');
	console.log('Address of staking: ', SafeBoxBuffer);

	if (networkObj.chainId == 69 || networkObj.chainId == 420) {
		await upgrades.upgradeProxy(SafeBoxBuffer, SafeBoxBufferContract);
		await delay(5000);

		console.log('SafeBoxBuffer upgraded');
		SafeBoxBufferImplementation = await getImplementationAddress(ethers.provider, SafeBoxBuffer);
	}

	if (networkObj.chainId == 10 || networkObj.chainId == 42161 || networkObj.chainId == 8453) {
		SafeBoxBufferImplementation = await upgrades.prepareUpgrade(
			SafeBoxBuffer,
			SafeBoxBufferContract
		);
		await delay(5000);
		console.log('SafeBoxBuffer upgraded');
	}

	console.log('Implementation SafeBoxBuffer: ', SafeBoxBufferImplementation);
	setTargetAddress('SafeBoxBufferImplementation', network, SafeBoxBufferImplementation);

	try {
		await hre.run('verify:verify', {
			address: SafeBoxBufferImplementation,
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
