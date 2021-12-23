'use strict';

const { artifacts, contract, web3 } = require('hardhat');
const { BigNumber } = require('ethers');

const { assert } = require('../../utils/common');

const { currentTime, toUnit, bytesToString, fastForward } = require('../../utils')();

const {
	onlyGivenAddressCanInvoke,
	convertToDecimals,
	encodePriceSqrt,
} = require('../../utils/helpers');

const { toBytes32 } = require('../../../index');
const { setupAllContracts } = require('../../utils/setup');

const ZERO_ADDRESS = '0x' + '0'.repeat(40);

const MockAggregator = artifacts.require('MockAggregatorV2V3');
const MockUniswapV3Factory = artifacts.require('MockUniswapV3Factory');
let deployerSigner, ownerSigner, oracleSigner, accountOneSigner;

contract('Price Feed', async accounts => {
	const [deployerAccount, owner, oracle, accountOne, accountTwo] = accounts;
	const [SNX, JPY, XTZ, BNB, sUSD, EUR, LINK, LYRA, fastGasPrice] = [
		'SNX',
		'JPY',
		'XTZ',
		'BNB',
		'sUSD',
		'EUR',
		'LINK',
		'LYRA',
		'fastGasPrice',
	].map(toBytes32);
	let instance,
		aggregatorJPY,
		aggregatorXTZ,
		aggregatorLINK,
		aggregatorLYRA,
		aggregatorFastGasPrice,
		initialTime,
		timeSent,
		pool_LYRA_DAI,
		uniswapFactory,
		price;

	const tokens = [
		'0xd917287d0423beb3d2f6620b6eaa590c80600658', // LYRA
		'0x6b175474e89094c44da98b954eedeac495271d0f', // DAI
	];

	before(async () => {
		initialTime = await currentTime();
		[deployerSigner, ownerSigner, oracleSigner, accountOneSigner] = await ethers.getSigners();
		({ PriceFeed: instance } = await setupAllContracts({
			accounts,
			contracts: ['PriceFeed'],
		}));

		aggregatorJPY = await MockAggregator.new({ from: owner });
		aggregatorXTZ = await MockAggregator.new({ from: owner });
		aggregatorLINK = await MockAggregator.new({ from: owner });
		aggregatorLYRA = await MockAggregator.new({ from: owner });
		aggregatorFastGasPrice = await MockAggregator.new({ from: owner });

		aggregatorJPY.setDecimals('8');
		aggregatorXTZ.setDecimals('8');
		aggregatorLINK.setDecimals('8');
		aggregatorLYRA.setDecimals('8');
		aggregatorFastGasPrice.setDecimals('0');

		uniswapFactory = await MockUniswapV3Factory.new({ from: owner });

		// create LYRA/DAI pool
		await uniswapFactory.createPool(tokens[0], tokens[1], 3000);
		const poolAddress = await uniswapFactory.getPool(tokens[0], tokens[1], 3000);

		const MockUniswapV3Pool = await ethers.getContractFactory('MockUniswapV3Pool');
		pool_LYRA_DAI = MockUniswapV3Pool.attach(poolAddress);

		// initial ratio is 1/5 = 0.2
		price = BigNumber.from(encodePriceSqrt(1, 5));
		await pool_LYRA_DAI.initialize(price);

		const { sqrtPriceX96, observationIndex } = await pool_LYRA_DAI.slot0();
		console.log(sqrtPriceX96.toString(), observationIndex);
		console.log('tick spacing', await pool_LYRA_DAI.tickSpacing());
		console.log('token0', await pool_LYRA_DAI.token0());
	});

	beforeEach(async () => {
		timeSent = await currentTime();
	});

	describe('pricing aggregators', () => {
		describe('When an aggregator with more than 18 decimals is added', () => {
			it('an aggregator should return a value with 18 decimals or less', async () => {
				const newAggregator = await MockAggregator.new({ from: owner });
				await newAggregator.setDecimals('19');
				await assert.revert(
					instance.connect(ownerSigner).addAggregator(JPY, newAggregator.address),
					'Aggregator decimals should be lower or equal to 18'
				);
			});
		});

		describe('when a user queries the first entry in currencyKeys', () => {
			it('then it is empty', async () => {
				await assert.invalidOpcode(instance.currencyKeys(0));
			});
		});

		describe('when the owner attempts to add an invalid address for JPY ', () => {
			it('then zero address is invalid', async () => {
				await assert.revert(
					instance.connect(ownerSigner).addAggregator(JPY, ZERO_ADDRESS)
					// 'function call to a non-contract account' (this reason is not valid in Ganache so fails in coverage)
				);
			});
			it('and a non-aggregator address is invalid', async () => {
				await assert.revert(
					instance.connect(ownerSigner).addAggregator(JPY, instance.address)
					// 'function selector was not recognized'  (this reason is not valid in Ganache so fails in coverage)
				);
			});
		});

		describe('when the owner adds JPY added as an aggregator', () => {
			let txn;
			beforeEach(async () => {
				txn = await instance.connect(ownerSigner).addAggregator(JPY, aggregatorJPY.address);
			});

			it('then the list of currencyKeys lists it', async () => {
				assert.equal('JPY', bytesToString(await instance.currencyKeys(0)));
				await assert.invalidOpcode(instance.currencyKeys(1));
			});

			it('and the AggregatorAdded event is emitted', async () => {
				let receipt = await txn.wait();
				assert.equal(receipt.events[0].event, 'AggregatorAdded');
				assert.equal(receipt.events[0].args.currencyKey, JPY);
				assert.equal(receipt.events[0].args.aggregator, aggregatorJPY.address);
			});

			it('only an owner can remove an aggregator', async () => {
				const REVERT =
					'VM Exception while processing transaction: revert Only the contract owner may perform this action';
				await assert.revert(instance.connect(accountOneSigner).removeAggregator(JPY), REVERT);
			});

			describe('when the owner adds the same aggregator to two other rates', () => {
				beforeEach(async () => {
					await instance.connect(ownerSigner).addAggregator(EUR, aggregatorJPY.address);
					await instance.connect(ownerSigner).addAggregator(BNB, aggregatorJPY.address);
				});
			});
			describe('when the owner tries to remove an invalid aggregator', () => {
				it('then it reverts', async () => {
					await assert.revert(
						instance.connect(ownerSigner).removeAggregator(XTZ),
						'No aggregator exists for key'
					);
				});
			});

			describe('when the owner adds XTZ as an aggregator', () => {
				beforeEach(async () => {
					txn = await instance.connect(ownerSigner).addAggregator(XTZ, aggregatorXTZ.address);
				});

				it('then the list of currencyKeys lists it also', async () => {
					assert.equal('JPY', bytesToString(await instance.currencyKeys(0)));
					assert.equal('XTZ', bytesToString(await instance.currencyKeys(1)));
					await assert.invalidOpcode(instance.currencyKeys(2));
				});

				it('and the AggregatorAdded event is emitted', async () => {
					let receipt = await txn.wait();
					assert.equal(receipt.events[0].event, 'AggregatorAdded');
					assert.equal(receipt.events[0].args.currencyKey, XTZ);
					assert.equal(receipt.events[0].args.aggregator, aggregatorXTZ.address);
				});
			});

			describe('when the aggregator price is set to set a specific number (with support for 8 decimals)', () => {
				const newRate = 123.456;
				let timestamp;
				beforeEach(async () => {
					timestamp = await currentTime();
					// Multiply by 1e8 to match Chainlink's price aggregation
					await aggregatorJPY.setLatestAnswer(convertToDecimals(newRate, 8), timestamp);
				});

				describe('when the price is fetched for JPY', () => {
					it('the specific number is returned with 18 decimals', async () => {
						const result = await instance.connect(accountOneSigner).rateForCurrency(JPY);
						assert.bnEqual(result, toUnit(newRate.toString()));
					});
				});
			});

			describe('when the aggregator price is set to set a specific number, other than 8 decimals', () => {
				const gasPrice = 189.9;
				let timestamp;
				beforeEach(async () => {
					await instance
						.connect(ownerSigner)
						.addAggregator(fastGasPrice, aggregatorFastGasPrice.address);
					timestamp = await currentTime();
					// fastGasPrice has no decimals, so no conversion needed
					await aggregatorFastGasPrice.setLatestAnswer(
						web3.utils.toWei(gasPrice.toString(), 'gwei'),
						timestamp
					);
				});

				describe('when the price is fetched for fastGasPrice', () => {
					it('the specific number is returned with 18 decimals', async () => {
						const result = await instance.connect(accountOneSigner).rateForCurrency(fastGasPrice);
						assert.bnEqual(result, web3.utils.toWei(gasPrice.toString(), 'gwei'));
					});
				});
			});
		});
	});

	describe('pricing uni pools', () => {
		describe('when the owner attempts to add an invalid address for LYRA ', () => {
			it('then zero address is invalid', async () => {
				await assert.revert(
					instance.connect(ownerSigner).addPool(LYRA, ZERO_ADDRESS)
					// 'function call to a non-contract account' (this reason is not valid in Ganache so fails in coverage)
				);
			});
			it('and a non uniswap pool address is invalid', async () => {
				await assert.revert(
					instance.connect(ownerSigner).addPool(LYRA, instance.address)
					// 'function selector was not recognized'  (this reason is not valid in Ganache so fails in coverage)
				);
			});
		});

		describe('when the owner adds LYRA/DAI pool', () => {
			let txn;
			beforeEach(async () => {
				txn = await instance.connect(ownerSigner).addPool(LYRA, pool_LYRA_DAI.address);
			});

			it('then the list of currencyKeys lists it', async () => {
				assert.equal('LYRA', bytesToString(await instance.currencyKeys(3)));
				await assert.invalidOpcode(instance.currencyKeys(4));
			});

			it('and the PoolAdded event is emitted', async () => {
				let receipt = await txn.wait();
				assert.equal(receipt.events[0].event, 'PoolAdded');
				assert.equal(receipt.events[0].args.currencyKey, LYRA);
				assert.equal(receipt.events[0].args.pool, pool_LYRA_DAI.address);
			});

			it('only an owner can remove a pool', async () => {
				const REVERT =
					'VM Exception while processing transaction: revert Only the contract owner may perform this action';
				await assert.revert(instance.connect(accountOneSigner).removePool(LYRA), REVERT);
			});

			describe('when the owner tries to remove an invalid pool', () => {
				it('then it reverts', async () => {
					await assert.revert(
						instance.connect(ownerSigner).removePool(XTZ),
						'No pool exists for key'
					);
				});
			});

			describe('when the price is fetched for LYRA', () => {
				it('when twap interval is 0 initial ratio is returned', async () => {
					await instance.connect(ownerSigner).addPool(LYRA, pool_LYRA_DAI.address);
					await instance.connect(ownerSigner).setTwapInterval(0);
					console.log((await pool_LYRA_DAI.slot0()).toString());
					const result = await instance.connect(accountOneSigner).rateForCurrency(LYRA);
					const resultDecimal = parseFloat(result.toString())/10**18;

					// initial ratio is 0.2
					expect(resultDecimal).to.be.approximately(0.2, 0.00000000001);

				});

				it('when twap interval is greater than 0', async () => {
					await instance.connect(ownerSigner).addPool(LYRA, pool_LYRA_DAI.address);
					
					await instance.connect(ownerSigner).setTwapInterval(300);
					await fastForward(300);
				
					const observeResult = await pool_LYRA_DAI.observe([300, 0]);
					const tickCumulatives = observeResult.tickCumulatives;
					const ratioAtTick = parseInt((tickCumulatives[1].sub(tickCumulatives[0])).div(300).toString());
					console.log('ratio at tick', ratioAtTick.toString());

					// price = 1.0001^tick
					const expectedPrice = Math.pow(1.0001, ratioAtTick);
					console.log('expected price', expectedPrice);
				
					const result = await instance.connect(accountOneSigner).rateForCurrency(LYRA);
					const resultDecimal = parseFloat(result.toString())/10**18;
					expect(resultDecimal).to.be.approximately(expectedPrice, 0.00000000001);
				});
				
			});

			describe('when an aggregator is added for LYRA', () => {
				const newRate = 12345.67;
				let timestamp;
				beforeEach(async () => {
					timestamp = await currentTime();
					await instance.connect(ownerSigner).addAggregator(LYRA, aggregatorLYRA.address);
					await aggregatorLYRA.setLatestAnswer(convertToDecimals(newRate, 8), timestamp);
				});
				it('the specific number is returned from aggregator not from pool', async () => {
					const result = await instance.connect(accountOneSigner).rateForCurrency(LYRA);
					assert.bnEqual(result, toUnit(newRate.toString()));
				});
			});
		});
	});
});
