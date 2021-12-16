const { ethers } = require('hardhat');
const w3utils = require('web3-utils');
const snx = require('synthetix-2.50.4-ovm');
const { artifacts, contract, web3 } = require('hardhat');
const { getTargetAddress, setTargetAddress } = require('../helpers');
const { toBytes32 } = require('../../index');

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
		networkObj.name = 'optimistic';
		network = 'optimistic';
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
	const ThalesAMMDProxyeployed = ThalesAMM.connect(user).attach(ThalesAMMaddress);

	let manager = await ThalesAMMDProxyeployed.manager();
	console.log('manager: ' + manager);

	let min_spread = await ThalesAMMDProxyeployed.min_spread();
	console.log('min_spread: ' + min_spread);

	let max_spread = await ThalesAMMDProxyeployed.max_spread();
	console.log('max_spread: ' + max_spread);

	let capPerMarket = await ThalesAMMDProxyeployed.capPerMarket();
	console.log('capPerMarket: ' + capPerMarket);

	let isMarketInAMMTrading = await ThalesAMMDProxyeployed.isMarketInAMMTrading(
		'0xf633bfb0ddb5bc64e0cbbd50f4b793d2cb8ca833'
	);
	console.log('isMarketInAMMTrading: ' + isMarketInAMMTrading);

	let availableToBuyFromAMMLong = await ThalesAMMDProxyeployed.availableToBuyFromAMM(
		'0xf633bfb0ddb5bc64e0cbbd50f4b793d2cb8ca833',
		0
	);
	let availableToBuyFromAMMShort = await ThalesAMMDProxyeployed.availableToBuyFromAMM(
		'0xf633bfb0ddb5bc64e0cbbd50f4b793d2cb8ca833',
		1
	);
	console.log('availableToBuyFromAMMLong: ' + availableToBuyFromAMMLong);
	console.log('availableToBuyFromAMMShort: ' + availableToBuyFromAMMShort);

	let availableToSellToAMMLong = await ThalesAMMDProxyeployed.availableToSellToAMM(
		'0xf633bfb0ddb5bc64e0cbbd50f4b793d2cb8ca833',
		0
	);
	let availableToSellToAMMShort = await ThalesAMMDProxyeployed.availableToSellToAMM(
		'0xf633bfb0ddb5bc64e0cbbd50f4b793d2cb8ca833',
		1
	);
	console.log('availableToSellToAMMLong: ' + availableToSellToAMMLong);
	console.log('availableToSellToAMMShort: ' + availableToSellToAMMShort);

	let buyFromAmmQuoteLong = await ThalesAMMDProxyeployed.buyFromAmmQuote(
		'0xf633bfb0ddb5bc64e0cbbd50f4b793d2cb8ca833',
		0,
		w3utils.toWei('1000')
	);
	let sellToAmmQuoteLong = await ThalesAMMDProxyeployed.sellToAmmQuote(
		'0xf633bfb0ddb5bc64e0cbbd50f4b793d2cb8ca833',
		0,
		w3utils.toWei('1000')
	);
	console.log('buyFromAmmQuoteLong: ' + buyFromAmmQuoteLong);
	console.log('sellToAmmQuoteLong: ' + sellToAmmQuoteLong);

	let spentOnMarket = await ThalesAMMDProxyeployed.spentOnMarket(
		'0xf633bfb0ddb5bc64e0cbbd50f4b793d2cb8ca833'
	);
	console.log('spentOnMarket: ' + spentOnMarket);
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});

function delay(time) {
	return new Promise(function(resolve) {
		setTimeout(resolve, time);
	});
}
