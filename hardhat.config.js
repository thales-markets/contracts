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

const {
	constants: { inflationStartTimestampInSecs, AST_FILENAME, AST_FOLDER, BUILD_FOLDER },
} = require('.');

const GAS_PRICE = 20e9; // 20 GWEI
const CACHE_FOLDER = 'cache';

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const INFURA = process.env.INFURA;
const ETHERSCAN_KEY = process.env.ETHERSCAN_KEY;
const PRIVATE_KEY_OPTIMISTIC_KOVAN = process.env.PRIVATE_KEY_OPTIMISTIC_KOVAN;
const LOCAL_OPT_IP = process.env.LOCAL_OPT_IP ? process.env.LOCAL_OPT_IP : "http://127.0.0.1:8545";

module.exports = {
	etherscan: {
		// Your API key for Etherscan
		// Obtain one at https://etherscan.io/
		apiKey: ETHERSCAN_KEY,
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
				version: '0.8.2',
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
			gas: 12e6,
			blockGasLimit: 12e6,
			allowUnlimitedContractSize: true,
			gasPrice: GAS_PRICE,
			initialDate: new Date(inflationStartTimestampInSecs * 1000).toISOString(),
			// Note: forking settings are injected at runtime by hardhat/tasks/task-node.js
		},
		localhost: {
			gas: 12e6,
			blockGasLimit: 12e6,
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
		optimistic: {
			url: LOCAL_OPT_IP,
			accounts: {
			  mnemonic: "test test test test test test test test test test test junk",
			},
			gasPrice: 10000,
		},
		optimisticKovan: {
			gasPrice: 10000,
			url: "https://kovan.optimism.io",
			accounts: [PRIVATE_KEY],
		},
	},
	gasReporter: {
		enabled: (process.env.REPORT_GAS) ? true : false,
		showTimeSpent: true,
		currency: 'USD',
		maxMethodDiff: 25, // CI will fail if gas usage is > than this %
		// outputFile: 'test-gas-used.log',
	},
	mocha: {
		timeout: 120e3, // 30s
	},
	abiExporter: {
		path: './scripts/abi',
		clear: true,
		flat: true,
		only: [],
		spacing: 2
	  }
};
