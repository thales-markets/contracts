const { ethers } = require('hardhat');
const { getTargetAddress } = require('../helpers');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	console.log(networkObj);
	let network = networkObj.name;
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

	console.log('Account is:' + owner.address);
	console.log('Network name:' + network);

	const PositionalMarketManagerAddress = getTargetAddress('PositionalMarketManager', network);
	console.log('Found PositionalMarketManager at:' + PositionalMarketManagerAddress);

	const ZeroExAddress = getTargetAddress('ZeroEx', network);
	console.log('Found 0x at:' + ZeroExAddress);

	// const PositionalMarketFactoryAddress = getTargetAddress('PositionalMarketFactory', network);
	// console.log('Found PositionalMarketFactory at:' + PositionalMarketFactoryAddress);

	// let abi = ['function setPositionalMarketFactory(address _positionalMarketFactory) external'];
	// let contract = new ethers.Contract(PositionalMarketManagerAddress, abi, owner);

	// let setPositions = await contract.setPositionalMarketFactory(
	// 	PositionalMarketFactoryAddress,
	// 	{
	// 		from: owner.address,
	// 		gasLimit: 5000000
	// 	}
	// );
	// console.log(setPositions)
	// setPositions.wait().then(console.log('Done transfer! $$$$ >'));

	// 3. Deployment Position Market Factory
	let abi = ['function setZeroExAddress(address _zeroExAddress) public'];
	let contract = new ethers.Contract(PositionalMarketManagerAddress, abi, owner);
	let setZeroEx = await contract.setZeroExAddress(ZeroExAddress, {
		from: owner.address,
		gasLimit: 5000000,
	});
	console.log(setZeroEx);
	setZeroEx.wait().then(console.log('Done transfer! $$$$ >'));
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});
