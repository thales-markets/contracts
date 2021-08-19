const { deployArgs } = require('../snx-data/xsnx-snapshot/helpers');

const ONGOING_AIRDROP = '0xE0A55FeE3a4c20AB47eCdf3ba99F8E73125eF79f'; // localhost
const THALES = '0x829828604A09CcC381f3080e4aa5557b42C4c87A'; // localhost

async function testDeployEscrow() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];

	const escrowThales = await deployArgs(
		'EscrowThales',
		owner.address,
		THALES,
		owner.address,
		ONGOING_AIRDROP
	);
	await escrowThales.deployed();
	console.log('escrowThales deployed at', escrowThales.address);

	await hre.run('verify:verify', {
		address: escrowThales.address,
		constructorArguments: [owner.address, THALES, owner.address, ONGOING_AIRDROP],
	});
}

testDeployEscrow()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});
