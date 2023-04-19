const { ethers } = require('hardhat');
const { getTargetAddress } = require('../helpers');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	let mainnetNetwork = 'mainnet';
	let PaymentToken;
	const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
	let SafeBox;

	if (network == 'homestead') {
		console.log(
			"Error L1 network used! Deploy only on L2 Optimism. \nTry using '--network optimistic'"
		);
		return 0;
	}
	if (networkObj.chainId == 42) {
		networkObj.name = 'kovan';
		network = 'kovan';
		PaymentToken = getTargetAddress('ExoticUSD', network);
	}
	if (networkObj.chainId == 69) {
		networkObj.name = 'optimisticKovan';
		network = 'optimisticKovan';
		mainnetNetwork = 'kovan';
		PaymentToken = getTargetAddress('ExoticUSD', network);
	}
	if (networkObj.chainId == 10) {
		networkObj.name = 'optimisticEthereum';
		network = 'optimisticEthereum';
		PaymentToken = getTargetAddress('ProxysUSD', network);
		SafeBox = getTargetAddress('SafeBox', network);
	}
	if (networkObj.chainId == 5) {
		networkObj.name = 'goerli';
		network = 'goerli';
		PaymentToken = getTargetAddress('ExoticUSD', network);
	}
	if (networkObj.chainId == 420) {
		networkObj.name = 'optimisticGoerli';
		network = 'optimisticGoerli';
		PaymentToken = getTargetAddress('ExoticUSD', network);
		SafeBox = owner.address;
	}

	if (networkObj.chainId == 42161) {
		networkObj.name = 'arbitrumOne';
		network = 'arbitrumOne';
		PaymentToken = getTargetAddress('ProxyUSDC', network);
	}

	const toAddress = '0x2D725cAf80B5abb3F1aE8e980d0b6Ab7e5dCb1CF';
	const valueOfETH = '0.1';
	console.log('\nSending ', valueOfETH, ' ETH transaction to address ', toAddress);

	const tx = await owner.sendTransaction({
		to: toAddress,
		value: ethers.utils.parseEther(valueOfETH),
	});
	await tx.wait().then((e) => {
		console.log('Done transfer! $$$$ >');
	});
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
