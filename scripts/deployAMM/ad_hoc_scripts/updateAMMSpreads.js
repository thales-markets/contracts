const { ethers } = require('hardhat');
const w3utils = require('web3-utils');
const snx = require('synthetix-2.50.4-ovm');
const { artifacts, contract, web3 } = require('hardhat');
const { getTargetAddress, setTargetAddress } = require('../../helpers');
const { toBytes32 } = require('../../../index');

async function main() {
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	let priceFeedAddress, ProxyERC20sUSDaddress;

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

	if (networkObj.chainId == 10) {
		ProxyERC20sUSDaddress = getTargetAddress('ProxysUSD', network);
	} else if (networkObj.chainId == 69) {
		networkObj.name = 'optimisticKovan';
		ProxyERC20sUSDaddress = getTargetAddress('ProxysUSD', network);
	} else {
		const ProxyERC20sUSD = snx.getTarget({ network, contract: 'ProxyERC20sUSD' });
		ProxyERC20sUSDaddress = ProxyERC20sUSD.address;
	}

	const privateKey1 = process.env.PRIVATE_KEY;
	const privateKey2 = process.env.PRIVATE_KEY_2;
	const privateKey3 = process.env.PRIVATE_KEY_3;

	const proxyOwner = new ethers.Wallet(privateKey1, ethers.provider);
	const owner = new ethers.Wallet(privateKey2, ethers.provider);
	const user = new ethers.Wallet(privateKey3, ethers.provider);

	let ThalesAMMaddress = getTargetAddress('ThalesAMM', network);
	console.log('ThalesAMMaddress:' + ThalesAMMaddress);
	const ThalesAMM = await ethers.getContractFactory('ThalesAMM');
	const ThalesAMMDProxyeployed = ThalesAMM.connect(owner).attach(ThalesAMMaddress);

	let tx = await ThalesAMMDProxyeployed.setMinSpread(w3utils.toWei('0.01'));
	await tx.wait().then((e) => {
		console.log('ThalesAMM: setMinSpread(0.01)');
	});

	tx = await ThalesAMMDProxyeployed.setMaxSpread(w3utils.toWei('0.05'));
	await tx.wait().then((e) => {
		console.log('ThalesAMM: setMaxSpread(0.05)');
	});
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
