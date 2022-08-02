const { getTargetAddress } = require('../helpers.js');

async function deploy_ongoing_airdrop() {
	let accounts = await ethers.getSigners();
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	let THALES, Thales;
	if (network === 'homestead') {
		network = 'mainnet';
	} else if (networkObj.chainId == 69) {
		network = 'optimisticKovan';
		THALES = getTargetAddress('OpThales_L2', network);
		Thales = await ethers.getContractFactory('/contracts/Token/OpThales_L2.sol:OpThales');
	} else if (networkObj.chainId == 10) {
		networkObj.name = 'optimisticEthereum';
		network = 'optimisticEthereum';
		THALES = getTargetAddress('OpThales_L2', network);
		Thales = await ethers.getContractFactory('/contracts/Token/OpThales_L2.sol:OpThales');
	} else if (network === 'unknown') {
		network = 'localhost';
		THALES = getTargetAddress('Thales', network);
		Thales = await ethers.getContractFactory('Thales');
	}
	console.log('Network name:' + network);

	let owner = accounts[0];

	// deploy EscrowThales
	const OngoingAirdrop = await ethers.getContractFactory('OngoingAirdrop');
	const ongoingAirdropAddress = getTargetAddress('OngoingAirdrop', network);
	const ongoingAirdrop = await OngoingAirdrop.attach(ongoingAirdropAddress);
	console.log('OngoingAirdrop attached at', ongoingAirdrop.address);

	// deploy EscrowThales
	const EscrowThales = await ethers.getContractFactory('EscrowThales');
	const EscrowAddress = getTargetAddress('EscrowThales', network);
	const escrowThales = await EscrowThales.attach(EscrowAddress);
	console.log('EscrowThales attached at', escrowThales.address);
	// update deployments.json file
	// setTargetAddress('EscrowThales', network, escrowThales.address);

	// set OngoingAirdrop address
	let tx = await escrowThales.setAirdropContract(ongoingAirdrop.address, { from: owner.address });
	await tx.wait().then(e => {
		console.log('EscrowThales: setAirdropContract');
	});

	// set EscrowThales address
	await ongoingAirdrop.setEscrow(escrowThales.address, { from: owner.address });
	await tx.wait().then(e => {
		console.log('OngoingAirdrop: setEscrow');
	});
}

deploy_ongoing_airdrop()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});
