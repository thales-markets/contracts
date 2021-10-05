'use strict';

const { artifacts, contract, web3 } = require('hardhat');
const { assert } = require('../../utils/common');
const { toUnit } = require('../../utils')();

const BTC_TOTAL_MARKETCAP = '0x47E1e89570689c13E723819bf633548d611D630C';
const ETH_TOTAL_MARKETCAP = '0xAA2FE1324b84981832AafCf7Dc6E6Fe6cF124283';

contract('FlippeningRatioOracle', accounts => {
	const [first, owner] = accounts;

	describe('Test flippening ratio', () => {
		it('Parses result properly', async () => {

			let FlippeningRatioOracleContract = artifacts.require('TestFlippeningRatioOracle');
			let ratioOracle = await FlippeningRatioOracleContract.new(
                owner,
                ETH_TOTAL_MARKETCAP,
                BTC_TOTAL_MARKETCAP,
			);
	
            console.log('ratio ETH/BTC marketcap', (await ratioOracle.getRatio()).toString());

			let FlippeningRatioOracleInstanceContract = artifacts.require('FlippeningRatioOracleInstance');

			let customOracle = await FlippeningRatioOracleInstanceContract.new(
				owner,
				ratioOracle.address,
                'ETH/BTC Flippening Market',
		        toUnit(0.7), // 0.7 * 1e18
                'flippening markets'
			);

			assert.equal(await customOracle.getOutcome(), false);
		});

	});
});
