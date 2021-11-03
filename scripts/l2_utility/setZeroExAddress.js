const { ethers } = require('hardhat');
const w3utils = require('web3-utils');
const snx = require('synthetix');
const { artifacts, contract, web3 } = require('hardhat');

const {
	fastForward,
	toUnit,
	currentTime,
	multiplyDecimalRound,
	divideDecimalRound,
} = require('../../test/utils/index')();

const ZERO_ADDRESS = '0x' + '0'.repeat(40);

const { getTargetAddress, setTargetAddress } = require('../helpers');

const { toBytes32 } = require('../../index');

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
	if(networkObj.chainId == 10) {
		networkObj.name = "optimistic";
		network = 'optimistic'		
	}

	console.log('Account is:' + owner.address);
	console.log('Network name:' + network);

	const BinaryOptionMarketManagerAddress = getTargetAddress('BinaryOptionMarketManager', network);
	console.log('Found BinaryOptionMarketManager at:' + BinaryOptionMarketManagerAddress);
	

	const ZeroExAddress = getTargetAddress('ZeroEx', network);
	console.log('Found 0x at:' + ZeroExAddress);

	// const BinaryOptionMarketFactoryAddress = getTargetAddress('BinaryOptionMarketFactory', network);
	// console.log('Found BinaryOptionMarketFactory at:' + BinaryOptionMarketFactoryAddress);

	// let abi = ['function setBinaryOptionsMarketFactory(address _binaryOptionMarketFactory) external'];
	// let contract = new ethers.Contract(BinaryOptionMarketManagerAddress, abi, owner);

	// let setBinaryOptions = await contract.setBinaryOptionsMarketFactory(
	// 	BinaryOptionMarketFactoryAddress,
	// 	{
	// 		from: owner.address,
	// 		gasLimit: 5000000
	// 	}
	// );
	// console.log(setBinaryOptions)
	// setBinaryOptions.wait().then(console.log('Done transfer! $$$$ >'));


	
	// 3. Deployment BinaryOption Market Factory
	let abi = ['function setZeroExAddress(address _zeroExAddress) public'];
	let contract = new ethers.Contract(BinaryOptionMarketManagerAddress, abi, owner);
	let setZeroEx = await contract.setZeroExAddress(
			ZeroExAddress,
			{
				from: owner.address,
				gasLimit: 5000000
			}
		);
	console.log(setZeroEx)
	setZeroEx.wait().then(console.log('Done transfer! $$$$ >'));

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
