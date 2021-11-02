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

	// 3. Deployment BinaryOption Market Factory
	const SynthetixAddress = '0xCAA5c8e9E67BBa010D2D7F589F02d588Fb49f93D';
	let abi = ['function issueMaxSynths() external'];
	let contract = new ethers.Contract(SynthetixAddress, abi, owner);
	let issueMax = await contract.issueMaxSynths(
			{
				from: owner.address,
			}
		);
	console.log(issueMax)
	issueMax.wait().then(console.log('Done transfer! $$$$ >'));

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
