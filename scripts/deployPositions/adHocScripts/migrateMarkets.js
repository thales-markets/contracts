'use strict';

const w3utils = require('web3-utils');
const Web3 = require('web3');
const { gray, green, yellow } = require('chalk');
const snx = require('synthetix-2.50.4-ovm');

const sourceContractAddress = '0x46d9DB2830C005e38878b241199bb09d9d355994';
const targetContractAddress = '0x5c137947a500811672Df13fCaA21Bd7f580067d9';

const ABI = require('../../abi/PositionalMarketManager.json');

const gasPrice = '1';
const gasLimit = 2.0e6; // 1.5m;

const { loadConnections, stringify } = require('../../../publish/src/util');

const migratePositionalMarkets = async () => {
	let result;
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	if (network == 'homestead') {
		network = 'mainnet';
	}

	// set PROVIDER_URL and TESTNET_DEPLOY_PRIVATE_KEY in .env
	const {
		providerUrl,
		privateKey: envPrivateKey,
		etherscanLinkPrefix,
	} = loadConnections({
		network,
	});

	let privateKey = envPrivateKey;

	const web3 = new Web3(new Web3.providers.HttpProvider(providerUrl));
	web3.eth.accounts.wallet.add(privateKey);
	const account = web3.eth.accounts.wallet[0].address;
	console.log(gray(`Using account with public key ${yellow(account)}`));

	const addressResolver = snx.getTarget({ network, contract: 'ReadProxyAddressResolver' });
	console.log(gray(`Using AddressResolver at ${yellow(addressResolver.address)}.`));
	console.log(gray(`Gas Price: ${yellow(gasPrice)} gwei`));

	if (!w3utils.isAddress(sourceContractAddress)) {
		throw Error(
			'Invalid address detected for source (please check your inputs): ',
			sourceContractAddress
		);
	}
	if (!w3utils.isAddress(targetContractAddress)) {
		throw Error(
			'Invalid address detected for target (please check your inputs): ',
			targetContractAddress
		);
	}

	if (sourceContractAddress.toLowerCase() === targetContractAddress.toLowerCase()) {
		throw Error('Cannot use the same address as the source and the target. Check your inputs.');
	} else {
		console.log(
			gray(`Migrating from source PositionalMarketManager at: ${yellow(sourceContractAddress)}`)
		);
		console.log(
			gray(`Receiving into target PositionalMarketManager at: ${yellow(targetContractAddress)}`)
		);
	}
	const sourceContract = new web3.eth.Contract(ABI, sourceContractAddress);
	const targetContract = new web3.eth.Contract(ABI, targetContractAddress);

	const numActiveMarkets = parseInt(await sourceContract.methods.numActiveMarkets().call());
	const numMaturedMarkets = parseInt(await sourceContract.methods.numMaturedMarkets().call());

	console.log(
		gray(
			`Found ${yellow(numActiveMarkets)} active markets and ${yellow(
				numMaturedMarkets
			)} matured markets. Fetching...`
		)
	);

	const activeMarkets = [];
	const maturedMarkets = [];

	activeMarkets.push(...(await sourceContract.methods.activeMarkets(0, numActiveMarkets).call()));

	if (activeMarkets.length !== numActiveMarkets) {
		throw Error(
			`Number of active markets fetched does not match expected. (${activeMarkets.length} != ${numActiveMarkets})`
		);
	}

	maturedMarkets.push(
		...(await sourceContract.methods.maturedMarkets(0, numMaturedMarkets).call())
	);

	if (maturedMarkets.length !== numMaturedMarkets) {
		throw Error(
			`Number of active markets fetched does not match expected. (${maturedMarkets.length} != ${numMaturedMarkets})`
		);
	}

	console.log(gray('The active markets to migrate:'));
	console.log(gray(stringify(activeMarkets)));
	console.log(gray('The matured markets to migrate:'));
	console.log(gray(stringify(maturedMarkets)));

	console.log(
		gray(
			`Setting the migrating manager in ${yellow(targetContractAddress)} to ${yellow(
				sourceContractAddress
			)}.`
		)
	);

	console.log(
		yellow(
			`Attempting action PositionalMarketManager.setMigratingManager(${sourceContractAddress})`
		)
	);
	const { transactionHash } = await targetContract.methods
		.setMigratingManager(sourceContractAddress)
		.send({
			from: account,
			gasLimit: Number(gasLimit),
			gasPrice: w3utils.toWei(gasPrice.toString(), 'gwei'),
		});
	console.log(
		green(
			`Successfully set migrating manager with transaction: ${etherscanLinkPrefix}/tx/${transactionHash}`
		)
	);

	console.log(
		gray(
			`Beginning migration of active markets from ${yellow(targetContractAddress)} to ${yellow(
				sourceContractAddress
			)}.`
		)
	);

	console.log(yellow('Migrate the following active markets: '));
	console.log(yellow(stringify(activeMarkets)));

	console.log(
		gray(
			`Attempting to invoke PositionalMarketManager.migrateMarkets(${targetContractAddress}, true, ${stringify(
				activeMarkets
			)}).`
		)
	);
	result = await sourceContract.methods
		.migrateMarkets(targetContractAddress, true, activeMarkets)
		.send({
			from: account,
			gasLimit: Number(gasLimit),
			gasPrice: w3utils.toWei(gasPrice.toString(), 'gwei'),
		});
	console.log(
		green(
			`Successfully migrated markets with transaction: ${etherscanLinkPrefix}/tx/${result.transactionHash}`
		)
	);

	console.log(
		gray(
			`Beginning migration of matured markets from ${yellow(targetContractAddress)} to ${yellow(
				sourceContractAddress
			)}.`
		)
	);

	console.log(yellow('Migrate the following markets: '));
	console.log(yellow(stringify(maturedMarkets)));

	console.log(
		gray(
			`Attempting to invoke PositionalMarketManager.migrateMarkets(${targetContractAddress}, false, ${stringify(
				maturedMarkets
			)}).`
		)
	);
	result = await sourceContract.methods
		.migrateMarkets(targetContractAddress, false, maturedMarkets)
		.send({
			from: account,
			gasLimit: Number(gasLimit),
			gasPrice: w3utils.toWei(gasPrice.toString(), 'gwei'),
		});
	console.log(
		green(
			`Successfully migrated markets with transaction: ${etherscanLinkPrefix}/tx/${result.transactionHash}`
		)
	);

	console.log(gray('Action complete.'));
};

migratePositionalMarkets()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
