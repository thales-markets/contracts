'use strict';
require('dotenv').config();

const path = require('path');

require('./hardhat');
require('@nomiclabs/hardhat-truffle5');
require('solidity-coverage');
require('hardhat-gas-reporter');
require('@nomiclabs/hardhat-waffle');
require('@nomiclabs/hardhat-etherscan');
require('hardhat-abi-exporter');
require('@nomiclabs/hardhat-ethers');
require('@openzeppelin/hardhat-upgrades');
require('hardhat-contract-sizer');

const {
	constants: { inflationStartTimestampInSecs, AST_FILENAME, AST_FOLDER, BUILD_FOLDER },
} = require('.');

const GAS_PRICE = 20e9; // 20 GWEI
const CACHE_FOLDER = 'cache';

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const INFURA = process.env.INFURA;
const INFURA_POLYGON = process.env.INFURA_POLYGON;
const ETHERSCAN_KEY = process.env.ETHERSCAN_KEY;
const OP_ETHERSCAN_KEY = process.env.OP_ETHERSCAN_KEY;
const POLYGONSCAN_API_KEY = process.env.POLYGONSCAN_API_KEY;
const BSC_API_KEY = process.env.BSC_API_KEY;
const ARBITRUM_API_KEY = process.env.ARBITRUM_API_KEY;
const BASESCAN_API_KEY = process.env.BASESCAN_API_KEY;
const LOCAL_OPT_IP = process.env.LOCAL_OPT_IP ? process.env.LOCAL_OPT_IP : 'http://127.0.0.1:8545';

module.exports = {
	etherscan: {
		// not supported by default by hardhat
		customChains: [
			{
				network: 'optimisticGoerli',
				chainId: 420,
				urls: {
					apiURL: 'https://api-goerli-optimism.etherscan.io/api',
					browserURL: 'https://goerli-optimism.etherscan.io/',
				},
			},
			{
				network: 'baseMainnet',
				chainId: 8453,
				urls: {
					apiURL: 'https://api.basescan.org/api',
					browserURL: 'https://basescan.org/',
				},
			},
		],
		// Your API key for Etherscan
		// Obtain one at https://etherscan.io/
		apiKey: {
			mainnet: ETHERSCAN_KEY,
			ropsten: ETHERSCAN_KEY,
			rinkeby: ETHERSCAN_KEY,
			goerli: ETHERSCAN_KEY,
			kovan: ETHERSCAN_KEY,
			// optimism
			optimisticEthereum: OP_ETHERSCAN_KEY,
			optimisticGoerli: OP_ETHERSCAN_KEY,
			// polygon
			polygon: POLYGONSCAN_API_KEY,
			polygonMumbai: POLYGONSCAN_API_KEY,
			bsc: BSC_API_KEY,
			arbitrumOne: ARBITRUM_API_KEY,
			baseMainnet: BASESCAN_API_KEY,
		},
		// apiURL: "https://api-kovan-optimistic.etherscan.io",
	},
	GAS_PRICE,
	// ovm: {
	// 	solcVersion: '0.5.16',
	// },
	solidity: {
		compilers: [
			{
				version: '0.4.21',
				settings: {
					optimizer: {
						enabled: true,
						runs: 200,
					},
				},
			},
			{
				version: '0.5.16',
				settings: {
					optimizer: {
						enabled: true,
						runs: 200,
					},
				},
			},
			{
				version: '0.6.10',
				settings: {
					optimizer: {
						enabled: true,
						runs: 200,
					},
				},
			},
			{
				version: '0.7.6',
				settings: {
					optimizer: {
						enabled: true,
						runs: 200,
					},
				},
			},
			{
				version: '0.8.2',
				settings: {
					optimizer: {
						enabled: true,
						runs: 200,
					},
				},
			},
			{
				version: '0.8.4',
				settings: {
					optimizer: {
						enabled: true,
						runs: 200,
					},
				},
			},
		],
	},
	paths: {
		sources: './contracts',
		tests: './test/contracts',
		artifacts: path.join(BUILD_FOLDER, 'artifacts'),
		cache: path.join(BUILD_FOLDER, CACHE_FOLDER),
	},
	astdocs: {
		path: path.join(BUILD_FOLDER, AST_FOLDER),
		file: AST_FILENAME,
		ignores: 'test-helpers',
	},
	defaultNetwork: 'hardhat',
	networks: {
		hardhat: {
			gas: 30e6,
			blockGasLimit: 30e6,
			allowUnlimitedContractSize: true,
			gasPrice: GAS_PRICE,
			initialDate: new Date(inflationStartTimestampInSecs * 1000).toISOString(),
			// Note: forking settings are injected at runtime by hardhat/tasks/task-node.js
		},
		localhost: {
			gas: 30e6,
			blockGasLimit: 30e6,
			url: 'http://localhost:8545',
			loggingEnabled: true,
		},
		ropsten: {
			gasPrice: 'auto',
			url: 'https://ropsten.infura.io/v3/' + INFURA,
			accounts: [PRIVATE_KEY],
		},
		goerli: {
			gasPrice: 'auto',
			url: 'https://goerli.infura.io/v3/' + INFURA,
			accounts: [PRIVATE_KEY],
		},
		kovan: {
			gasPrice: 'auto',
			url: 'https://kovan.infura.io/v3/' + INFURA,
			accounts: [PRIVATE_KEY],
		},
		mainnet: {
			gasPrice: 'auto',
			url: 'https://mainnet.infura.io/v3/' + INFURA,
			accounts: [PRIVATE_KEY],
		},
		optimisticLocal: {
			url: LOCAL_OPT_IP,
			accounts: {
				mnemonic: 'test test test test test test test test test test test junk',
			},
			gasPrice: 10000,
		},
		optimisticEthereum: {
			url: 'https://optimism-mainnet.infura.io/v3/' + INFURA,
			accounts: [PRIVATE_KEY],
		},
		optimisticGoerli: {
			gasPrice: 10000,
			url: 'https://goerli.optimism.io',
			accounts: [PRIVATE_KEY],
		},
		polygonMumbai: {
			url: 'https://polygon-mumbai.infura.io/v3/' + INFURA,
			accounts: [PRIVATE_KEY],
			gasPrice: 80000000000,
		},
		polygon: {
			url: 'https://polygon-mainnet.infura.io/v3/' + INFURA,
			accounts: [PRIVATE_KEY],
		},
		bsc: {
			url: 'https://bsc-dataseed.binance.org/',
			chainId: 56,
			//gasPrice: 5000000000,
			accounts: [PRIVATE_KEY],
		},
		arbitrumOne: {
			url: 'https://arbitrum-mainnet.infura.io/v3/' + INFURA,
			chainId: 42161,
			//gasPrice: 5000000000,
			accounts: [PRIVATE_KEY],
		},
		baseMainnet: {
			url: 'https://mainnet.base.org',
			chainId: 8453,
			accounts: [PRIVATE_KEY],
			gasPrice: 1000000000,
		},
	},

	gasReporter: {
		enabled: process.env.REPORT_GAS ? true : false,
		showTimeSpent: true,
		currency: 'USD',
		maxMethodDiff: 25, // CI will fail if gas usage is > than this %
		// outputFile: 'test-gas-used.log',
	},
	mocha: {
		timeout: 180e3, // 30s
	},
	abiExporter: {
		path: './scripts/abi',
		clear: true,
		flat: true,
		only: [],
		spacing: 2,
	},
};
