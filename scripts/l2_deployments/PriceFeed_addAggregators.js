const { ethers } = require('hardhat');
const w3utils = require('web3-utils');
const snx = require('synthetix-2.50.4-ovm');
const { artifacts, contract, web3 } = require('hardhat');

const { getTargetAddress, setTargetAddress } = require('../helpers');

const { toBytes32 } = require('../../index');

const aggregators_kovan = {
	BTC: '0x81AE7F8fF54070C52f0eB4EB5b8890e1506AA4f4',
	DAI: '0xa18B00759bF7659Ad47d618734c8073942faFdEc',
	ETH: '0xCb7895bDC70A1a1Dce69b689FD7e43A627475A06',
	LINK: '0xb37aA79EBc31B93864Bff2d5390b385bE482897b',
	SNX: '0xd9E9047ED2d6e2130395a2Fe08033e756CC7e288',
	USDC: '0xb50cBeeFBCE78cDe83F184B275b5E80c4f01006A',
	USDT: '0x4Dab1Dc2409A037d80316F2379Ac767A477C4236',
};
const aggregators_mainnet = {
	BTC: '0xc326371d4D866C6Ff522E69298e36Fe75797D358',
	ETH: '0xA969bEB73d918f6100163Cd0fba3C586C269bee1',
	LINK: '0x74d6B50283AC1D651f9Afdc33521e4c1E3332b78',
	SNX: '0x588e1f339910c21c7E4864048E37017AafF4cBc6',
};

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	console.log(networkObj)
	let network = networkObj.name;
	let aggregators = {}
	if (network == 'homestead') {
		network = 'mainnet';
	}
	if(networkObj.chainId == 69) {
		networkObj.name = "optimisticKovan";
		network = 'optimisticKovan'
		aggregators = aggregators_kovan;
	}
	if(networkObj.chainId == 10) {
		networkObj.name = "optimistic";
		network = 'optimistic'
		aggregators = aggregators_mainnet;
		
	}

	console.log('Account is:' + owner.address);
	console.log('Network name:' + network);

	

	const addressResolverAddress = getTargetAddress('AddressResolver', network);
	const safeDecimalMathAddress = getTargetAddress('SafeDecimalMath', network);
	const proxysUSDAddress = getTargetAddress('ProxysUSD', network);
	
	
	console.log(addressResolverAddress);
	console.log(safeDecimalMathAddress);

	const addressResolverContract = await ethers.getContractFactory('synthetix-2.50.4-ovm/contracts/AddressResolver.sol:AddressResolver');
	const safeDecimalMathContract = await ethers.getContractFactory('synthetix-2.50.4-ovm/contracts/SafeDecimalMath.sol:SafeDecimalMath');
	const proxysUSDContract = await ethers.getContractFactory('synthetix-2.50.4-ovm/contracts/ProxyERC20.sol:ProxyERC20');

	let addressResolver = await addressResolverContract.attach(addressResolverAddress);
	let safeDecimalMath = await safeDecimalMathContract.attach(safeDecimalMathAddress);
	let proxysUSD = await proxysUSDContract.attach(proxysUSDAddress);

	// const addressResolver = snx.getTarget({ useOvm: true, contract: 'AddressResolver' });
	console.log('Found address resolver at:' + addressResolver.address);

	// const safeDecimalMath = snx.getTarget({ useOvm: true, contract: 'SafeDecimalMath' });
	console.log('Found safeDecimalMath at:' + safeDecimalMath.address);
	console.log('Found proxysUSD at:' + proxysUSD.address);

	//Price feed deployment
	const priceFeed = await ethers.getContractFactory('PriceFeed'
	// , 
	// 				{
	// 					libraries: {
	// 						SafeDecimalMath: safeDecimalMath.address,
	// 					},
	// 				}
				);
	let priceFeedAddress = getTargetAddress('PriceFeed', network);
	let PriceFeedDeployed; 
	console.log(priceFeedAddress);
    PriceFeedDeployed = await priceFeed.attach(priceFeedAddress);
    console.log('Found PriceFeed at:' + PriceFeedDeployed.address);


    for (let [key, aggregator] of Object.entries(aggregators)) {
        let tx = await PriceFeedDeployed.addAggregator(toBytes32(key), aggregator, { gasLimit: 5000000 });
        await tx.wait().then(e => {
            console.log('PriceFeed: addAggregator for', key);
        });
    }

    console.log("Price feed aggregators added");
}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});


function delay(time) {
	return new Promise(function (resolve) {
		setTimeout(resolve, time);
	});
}
