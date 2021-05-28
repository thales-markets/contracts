'use strict';

const w3utils = require('web3-utils');
const abiDecoder = require('abi-decoder');

const networks = ['local', 'ropsten', 'mainnet'];

const chainIdMapping = Object.entries({
	1: {
		network: 'mainnet',
	},
	3: {
		network: 'ropsten',
	},

	// Hardhat fork of mainnet: https://hardhat.org/config/#hardhat-network
	31337: {
		network: 'mainnet',
		fork: true,
	},

	// now append any defaults
}).reduce((memo, [id, body]) => {
	memo[id] = Object.assign({ useOvm: false, fork: false }, body);
	return memo;
}, {});

const getNetworkFromId = ({ id }) => chainIdMapping[id];

const networkToChainId = Object.entries(chainIdMapping).reduce(
	(memo, [id, { network, useOvm, fork }]) => {
		memo[network + (useOvm ? '-ovm' : '') + (fork ? '-fork' : '')] = id;
		return memo;
	},
	{}
);

const constants = {
	BUILD_FOLDER: 'build',
	CONTRACTS_FOLDER: 'contracts',
	COMPILED_FOLDER: 'compiled',
	FLATTENED_FOLDER: 'flattened',
	AST_FOLDER: 'ast',

	CONFIG_FILENAME: 'config.json',
	PARAMS_FILENAME: 'params.json',
	SYNTHS_FILENAME: 'synths.json',
	STAKING_REWARDS_FILENAME: 'rewards.json',
	SHORTING_REWARDS_FILENAME: 'shorting-rewards.json',
	OWNER_ACTIONS_FILENAME: 'owner-actions.json',
	DEPLOYMENT_FILENAME: 'deployment.json',
	VERSIONS_FILENAME: 'versions.json',
	FEEDS_FILENAME: 'feeds.json',

	AST_FILENAME: 'asts.json',

	ZERO_ADDRESS: '0x' + '0'.repeat(40),
	ZERO_BYTES32: '0x' + '0'.repeat(64),

	OVM_MAX_GAS_LIMIT: '8999999',

	inflationStartTimestampInSecs: 1551830400, // 2019-03-06T00:00:00Z
};

const knownAccounts = {
	mainnet: [
		{
			name: 'binance', // Binance 8 Wallet
			address: '0xF977814e90dA44bFA03b6295A0616a897441aceC',
		},
		{
			name: 'renBTCWallet', // KeeperDAO wallet (has renBTC and ETH)
			address: '0x35ffd6e268610e764ff6944d07760d0efe5e40e5',
		},
		{
			name: 'loansAccount',
			address: '0x62f7A1F94aba23eD2dD108F8D23Aa3e7d452565B',
		},
	],
	rinkeby: [],
	kovan: [],
};

// The solidity defaults are managed here in the same format they will be stored, hence all
// numbers are converted to strings and those with 18 decimals are also converted to wei amounts
const defaults = {
	WAITING_PERIOD_SECS: (60 * 5).toString(), // 5 mins
	PRICE_DEVIATION_THRESHOLD_FACTOR: w3utils.toWei('3'),
	TRADING_REWARDS_ENABLED: false,
	ISSUANCE_RATIO: w3utils
		.toBN(1)
		.mul(w3utils.toBN(1e18))
		.div(w3utils.toBN(6))
		.toString(), // 1/6 = 0.16666666667
	FEE_PERIOD_DURATION: (3600 * 24 * 7).toString(), // 1 week
	TARGET_THRESHOLD: '1', // 1% target threshold (it will be converted to a decimal when set)
	LIQUIDATION_DELAY: (3600 * 24 * 3).toString(), // 3 days
	LIQUIDATION_RATIO: w3utils.toWei('0.5'), // 200% cratio
	LIQUIDATION_PENALTY: w3utils.toWei('0.1'), // 10% penalty
	RATE_STALE_PERIOD: (3600 * 25).toString(), // 25 hours
	EXCHANGE_FEE_RATES: {
		forex: w3utils.toWei('0.003'),
		commodity: w3utils.toWei('0.003'),
		equities: w3utils.toWei('0.003'),
		crypto: w3utils.toWei('0.01'),
		index: w3utils.toWei('0.01'),
	},
	MINIMUM_STAKE_TIME: (3600 * 24).toString(), // 1 days
	DEBT_SNAPSHOT_STALE_TIME: (43800).toString(), // 12 hour heartbeat + 10 minutes mining time
	AGGREGATOR_WARNING_FLAGS: {
		mainnet: '0x4A5b9B4aD08616D11F3A402FF7cBEAcB732a76C6',
		kovan: '0x6292aa9a6650ae14fbf974e5029f36f95a1848fd',
	},
	RENBTC_ERC20_ADDRESSES: {
		mainnet: '0xEB4C2781e4ebA804CE9a9803C67d0893436bB27D',
		kovan: '0x9B2fE385cEDea62D839E4dE89B0A23EF4eacC717',
		rinkeby: '0xEDC0C23864B041607D624E2d9a67916B6cf40F7a',
	},
	INITIAL_ISSUANCE: w3utils.toWei(`${100e6}`),
	CROSS_DOMAIN_DEPOSIT_GAS_LIMIT: `${3e6}`,
	CROSS_DOMAIN_ESCROW_GAS_LIMIT: `${8e6}`,
	CROSS_DOMAIN_REWARD_GAS_LIMIT: `${3e6}`,
	CROSS_DOMAIN_WITHDRAWAL_GAS_LIMIT: `${3e6}`,

	COLLATERAL_MANAGER: {
		SYNTHS: ['sUSD', 'sBTC', 'sETH'],
		SHORTS: [
			{ long: 'sBTC', short: 'iBTC' },
			{ long: 'sETH', short: 'iETH' },
		],
		MAX_DEBT: w3utils.toWei('75000000'), // 75 million sUSD
		BASE_BORROW_RATE: Math.round((0.005 * 1e18) / 31556926).toString(), // 31556926 is CollateralManager seconds per year
		BASE_SHORT_RATE: Math.round((0.005 * 1e18) / 31556926).toString(),
	},
	COLLATERAL_ETH: {
		SYNTHS: ['sUSD', 'sETH'],
		MIN_CRATIO: w3utils.toWei('1.3'),
		MIN_COLLATERAL: w3utils.toWei('2'),
		ISSUE_FEE_RATE: w3utils.toWei('0.001'),
	},
	COLLATERAL_RENBTC: {
		SYNTHS: ['sUSD', 'sBTC'],
		MIN_CRATIO: w3utils.toWei('1.3'),
		MIN_COLLATERAL: w3utils.toWei('0.05'),
		ISSUE_FEE_RATE: w3utils.toWei('0.001'),
	},
	COLLATERAL_SHORT: {
		SYNTHS: ['sBTC', 'sETH'],
		MIN_CRATIO: w3utils.toWei('1.2'),
		MIN_COLLATERAL: w3utils.toWei('1000'),
		ISSUE_FEE_RATE: w3utils.toWei('0.005'),
		INTERACTION_DELAY: '3600', // 1 hour in secs
	},
};

/**
 * Converts a string into a hex representation of bytes32, with right padding
 */
const toBytes32 = key => w3utils.rightPad(w3utils.asciiToHex(key), 64);
const fromBytes32 = key => w3utils.hexToAscii(key);

const getFolderNameForNetwork = ({ network, useOvm = false }) => {
	if (network.includes('ovm')) {
		return network;
	}

	return useOvm ? `${network}-ovm` : network;
};

const getPathToNetwork = ({ network = 'mainnet', file = '', useOvm = false, path } = {}) =>
	path.join(__dirname, 'publish', 'deployed', getFolderNameForNetwork({ network, useOvm }), file);


/**
 * Retrieve the list of targets for the network - returning the name, address, source file and link to etherscan
 */
const getTarget = ({
	network = 'mainnet',
	useOvm = false,
	contract,
	path,
	fs,
	deploymentPath,
} = {}) => {
	const deployment = loadDeploymentFile({ network, useOvm, path, fs, deploymentPath });
	if (contract) return deployment.targets[contract];
	else return deployment.targets;
};

/**
 * Retrieve the list of solidity sources for the network - returning the abi and bytecode
 */
const getSource = ({
	network = 'mainnet',
	useOvm = false,
	contract,
	path,
	fs,
	deploymentPath,
} = {}) => {
	const deployment = loadDeploymentFile({ network, useOvm, path, fs, deploymentPath });
	if (contract) return deployment.sources[contract];
	else return deployment.sources;
};

/**
 * Retrieve the list of system user addresses
 */
const getUsers = ({ network = 'mainnet', user, useOvm = false } = {}) => {
	const testnetOwner = '0x73570075092502472e4b61a7058df1a4a1db12f2';
	const base = {
		owner: testnetOwner,
		deployer: testnetOwner,
		marketClosure: testnetOwner,
		oracle: '0xac1e8B385230970319906C03A1d8567e3996d1d5',
		fee: '0xfeEFEEfeefEeFeefEEFEEfEeFeefEEFeeFEEFEeF',
		zero: '0x' + '0'.repeat(40),
	};

	const map = {
		mainnet: Object.assign({}, base, {
			owner: '0xEb3107117FEAd7de89Cd14D463D340A2E6917769',
			deployer: '0xDe910777C787903F78C89e7a0bf7F4C435cBB1Fe',
			marketClosure: '0xC105Ea57Eb434Fbe44690d7Dec2702e4a2FBFCf7',
			oracle: '0xaC1ED4Fabbd5204E02950D68b6FC8c446AC95362',
		}),
		kovan: Object.assign({}, base),
		'kovan-ovm': Object.assign({}, base),
		'mainnet-ovm': Object.assign({}, base, {
			owner: '0xDe910777C787903F78C89e7a0bf7F4C435cBB1Fe',
		}),
		rinkeby: Object.assign({}, base),
		ropsten: Object.assign({}, base),
		goerli: Object.assign({}, base),
		'goerli-ovm': Object.assign({}, base),
		local: Object.assign({}, base, {
			// Deterministic account #0 when using `npx hardhat node`
			owner: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
		}),
	};

	const users = Object.entries(
		map[getFolderNameForNetwork({ network, useOvm })]
	).map(([key, value]) => ({ name: key, address: value }));

	return user ? users.find(({ name }) => name === user) : users;
};

const decode = ({ network = 'mainnet', fs, path, data, target, useOvm = false } = {}) => {
	const sources = getSource({ network, path, fs, useOvm });
	for (const { abi } of Object.values(sources)) {
		abiDecoder.addABI(abi);
	}
	const targets = getTarget({ network, path, fs, useOvm });
	let contract;
	if (target) {
		contract = Object.values(targets).filter(
			({ address }) => address.toLowerCase() === target.toLowerCase()
		)[0].name;
	}
	return { method: abiDecoder.decodeMethod(data), contract };
};

const wrap = ({ network, deploymentPath, fs, path, useOvm = false }) =>
	[
		'decode',
		'getAST',
		'getPathToNetwork',
		'getSource',
		'getStakingRewards',
		'getShortingRewards',
		'getFeeds',
		'getSynths',
		'getTarget',
		'getTokens',
		'getUsers',
		'getVersions',
	].reduce((memo, fnc) => {
		memo[fnc] = (prop = {}) =>
			module.exports[fnc](Object.assign({ network, deploymentPath, fs, path, useOvm }, prop));
		return memo;
	}, {});

module.exports = {
	chainIdMapping,
	constants,
	decode,
	defaults,
	getNetworkFromId,
	getPathToNetwork,
	getSource,
	getTarget,
	getUsers,
	networks,
	networkToChainId,
	toBytes32,
	fromBytes32,
	wrap,
	knownAccounts,
};
