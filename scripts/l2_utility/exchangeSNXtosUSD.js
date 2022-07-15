const { ethers } = require('hardhat');

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

	// 3. Deployment Position Market Factory
	const SynthetixAddress = '0xCAA5c8e9E67BBa010D2D7F589F02d588Fb49f93D';
	let abi = ['function issueMaxSynths() external'];
	let contract = new ethers.Contract(SynthetixAddress, abi, owner);
	let issueMax = await contract.issueMaxSynths({
		from: owner.address,
	});
	console.log(issueMax);
	issueMax.wait().then(console.log('Done transfer! $$$$ >'));
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});
