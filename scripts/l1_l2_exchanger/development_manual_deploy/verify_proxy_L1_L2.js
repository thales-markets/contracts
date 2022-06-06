const { ethers } = require('hardhat');
const { getTargetAddress } = require('../../helpers');


async function main() {
	let networkObj = await ethers.provider.getNetwork();
	
	if(networkObj.chainId == '42') {
		console.log("network: ", networkObj.name, "\nchainID: ", networkObj.chainId);
		const net_kovan = 'kovan';

		const ProxyThalesExchangerAddress = getTargetAddress('ProxyThalesExchangerLogic', net_kovan);
		
		await hre.run('verify:verify', {
			address: ProxyThalesExchangerAddress,
			constructorArguments: [],
		});
	}
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
