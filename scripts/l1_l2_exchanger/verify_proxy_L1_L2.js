const path = require('path');
const { ethers } = require('hardhat');
const w3utils = require('web3-utils');
const { artifacts, contract, web3 } = require('hardhat');



const { getTargetAddress, setTargetAddress } = require('../helpers');


async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
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

function delay(time) {
	return new Promise(function (resolve) {
		setTimeout(resolve, time);
	});
}
