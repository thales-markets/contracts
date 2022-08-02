'use strict';

const { artifacts, contract, web3 } = require('hardhat');
const { BigNumber } = require('ethers');

const { assert } = require('../../utils/common');

const { currentTime, toUnit, bytesToString, fastForward } = require('../../utils')();

const { convertToDecimals, encodePriceSqrt } = require('../../utils/helpers');

const { toBytes32 } = require('../../../index');
const { setupAllContracts } = require('../../utils/setup');

const ZERO_ADDRESS = '0x' + '0'.repeat(40);

const MockAggregator = artifacts.require('MockAggregatorV2V3');
const MockUniswapV3Factory = artifacts.require('MockUniswapV3Factory');
let ownerSigner, accountOneSigner, deployerSigner, oracleSigner;

contract('Price Feed', async accounts => {
	const [owner] = accounts;
	const [JPY, XTZ, BNB, AELIN, EUR, ETH, LYRA, fastGasPrice] = [
		'JPY',
		'XTZ',
		'BNB',
		'AELIN',
		'EUR',
		'ETH',
		'LYRA',
		'fastGasPrice',
	].map(toBytes32);
	let instance,
		aggregatorJPY,
		aggregatorXTZ,
		aggregatorLINK,
		aggregatorLYRA,
		aggregatorETH,
		aggregatorFastGasPrice,
		initialTime,
		timeSent,
		pool_LYRA_ETH,
		pool_AELIN_ETH,
		pool_LYRA_AELIN,
		uniswapFactory,
		price_LYRA_ETH,
		price_AELIN_ETH;

	const tokens = [
		'0xd917287d0423beb3d2f6620b6eaa590c80600658', // LYRA
		'0x61baadcf22d2565b0f471b291c475db5555e0b76', // AELIN
		'0x4200000000000000000000000000000000000006', // ETH
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
		aggregatorETH = await MockAggregator.new({ from: owner });
		aggregatorFastGasPrice = await MockAggregator.new({ from: owner });

		aggregatorJPY.setDecimals('8');
		aggregatorXTZ.setDecimals('8');
		aggregatorLINK.setDecimals('8');
		aggregatorLYRA.setDecimals('8');
		aggregatorETH.setDecimals('8');
		aggregatorFastGasPrice.setDecimals('0');

		// set ETH address
		await instance.connect(ownerSigner).setETH(tokens[2]);
		await instance.connect(ownerSigner).addAggregator(ETH, aggregatorETH.address);

		uniswapFactory = await MockUniswapV3Factory.new({ from: owner });

		// create ETH/LYRA pool, token0 = ETH, token1 = LYRA
		await uniswapFactory.createPool(tokens[2], tokens[0], 3000);
		const poolAddressLYRA = await uniswapFactory.getPool(tokens[2], tokens[0], 3000);

		// create ETH/AELIN pool, token0 = AELIN, token1 = ETH
		// OBSERVE - tokenA AELIN < tokenB ETH, so token0 will be ETH
		await uniswapFactory.createPool(tokens[1], tokens[2], 3000);
		const poolAddressAELIN = await uniswapFactory.getPool(tokens[1], tokens[2], 3000);

		// create LYRA/AELIN pool
		await uniswapFactory.createPool(tokens[0], tokens[1], 3000);
		const poolAddress_LYRA_AELIN = await uniswapFactory.getPool(tokens[0], tokens[1], 3000);

		const MockUniswapV3Pool = await ethers.getContractFactory('MockUniswapV3Pool');
		pool_LYRA_ETH = MockUniswapV3Pool.attach(poolAddressLYRA);
		pool_AELIN_ETH = MockUniswapV3Pool.attach(poolAddressAELIN);
		pool_LYRA_AELIN = MockUniswapV3Pool.attach(poolAddress_LYRA_AELIN);

		// initial ratio ETH/LYRA is e.g. 12/5 = 2.4
		price_LYRA_ETH = BigNumber.from(encodePriceSqrt(12, 5));
		await pool_LYRA_ETH.initialize(price_LYRA_ETH);

		// initial ratio ETH/AELIN is e.g. 1/4 = 0.25
		price_AELIN_ETH = BigNumber.from(encodePriceSqrt(1, 4));
		await pool_AELIN_ETH.initialize(price_AELIN_ETH);
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
				assert.equal('JPY', bytesToString(await instance.currencyKeys(1)));
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
					assert.equal('JPY', bytesToString(await instance.currencyKeys(1)));
					assert.equal('XTZ', bytesToString(await instance.currencyKeys(2)));
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
					instance.connect(ownerSigner).addPool(LYRA, tokens[0], ZERO_ADDRESS)
					// 'function call to a non-contract account' (this reason is not valid in Ganache so fails in coverage)
				);
			});
			it('and a non uniswap pool address is invalid', async () => {
				await assert.revert(
					instance.connect(ownerSigner).addPool(LYRA, tokens[0], instance.address)
					// 'function selector was not recognized'  (this reason is not valid in Ganache so fails in coverage)
				);
			});
		});

		describe('when the owner adds LYRA/ETH pool', () => {
			let txn;
			beforeEach(async () => {
				txn = await instance.connect(ownerSigner).addPool(LYRA, tokens[0], pool_LYRA_ETH.address);
			});

			it('then the list of currencyKeys lists it', async () => {
				assert.equal('LYRA', bytesToString(await instance.currencyKeys(4)));
			});

			it('and the PoolAdded event is emitted', async () => {
				let receipt = await txn.wait();
				assert.equal(receipt.events[0].event, 'PoolAdded');
				assert.equal(receipt.events[0].args.currencyKey, LYRA);
				assert.equal(receipt.events[0].args.pool, pool_LYRA_ETH.address);
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

			describe('when the currency is not an asset in pool', () => {
				it('then it reverts', async () => {
					await assert.revert(
						instance.connect(ownerSigner).addPool(LYRA, tokens[0], pool_AELIN_ETH.address),
						'Pool not valid: currency is not an asset'
					);
				});
			});

			describe('when ETH is not an asset in pool', () => {
				it('then it reverts', async () => {
					await assert.revert(
						instance.connect(ownerSigner).addPool(LYRA, tokens[0], pool_LYRA_AELIN.address),
						'Pool not valid: ETH is not an asset'
					);
				});
			});

			describe('when the price is fetched for LYRA', () => {
				it('should set useLastTickForTWAP and return initial ratio', async () => {
					const newRate = 3395.73255295;
					let timestamp = await currentTime();
					await aggregatorETH.setLatestAnswer(convertToDecimals(newRate, 8), timestamp);

					await instance.connect(ownerSigner).addPool(LYRA, tokens[0], pool_LYRA_ETH.address);
					await instance.connect(ownerSigner).setLastTickForTWAP(LYRA);

					assert.equal(await instance.useLastTickForTWAP(LYRA), true);

					const result = await instance.connect(accountOneSigner).rateForCurrency(LYRA);
					const resultDecimal = parseFloat(result.toString()) / 10 ** 18;

					// initial ratio ETH/LYRA = 2.4
					const price = newRate / 2.4;

					expect(resultDecimal).to.be.approximately(price, 0.00000000001);

					// set last tick to false
					await instance.connect(ownerSigner).setLastTickForTWAP(LYRA);
					assert.equal(await instance.useLastTickForTWAP(LYRA), false);
				});

				it('when twap interval is 0 initial ratio is returned', async () => {
					const newRate = 3395.73255295;
					let timestamp = await currentTime();
					await aggregatorETH.setLatestAnswer(convertToDecimals(newRate, 8), timestamp);

					await instance.connect(ownerSigner).addPool(LYRA, tokens[0], pool_LYRA_ETH.address);
					await instance.connect(ownerSigner).setTwapInterval(0);

					const result = await instance.connect(accountOneSigner).rateForCurrency(LYRA);
					const resultDecimal = parseFloat(result.toString()) / 10 ** 18;

					// initial ratio ETH/LYRA = 2.4
					const price = newRate / 2.4;

					expect(resultDecimal).to.be.approximately(price, 0.00000000001);
				});

				it('when twap interval is greater than 0', async () => {
					const newRate = 3395.73255295;
					let timestamp = await currentTime();
					await aggregatorETH.setLatestAnswer(convertToDecimals(newRate, 8), timestamp);

					await instance.connect(ownerSigner).addPool(LYRA, tokens[0], pool_LYRA_ETH.address);

					await instance.connect(ownerSigner).setTwapInterval(1200);
					await fastForward(1200);

					const observeResult = await pool_LYRA_ETH.observe([1200, 0]);
					const tickCumulatives = observeResult.tickCumulatives;
					const ratioAtTick = parseInt(
						tickCumulatives[1]
							.sub(tickCumulatives[0])
							.div(1200)
							.toString()
					);

					// ratio = 1.0001^tick
					const expectedRatio = Math.pow(1.0001, ratioAtTick);

					// initial ratio ETH/LYRA = 2.4
					const price = newRate / 2.4;

					const result = await instance.connect(accountOneSigner).rateForCurrency(LYRA);
					const resultDecimal = parseFloat(result.toString()) / 10 ** 18;

					expect(expectedRatio).to.be.approximately(expectedRatio, 0.00000000001);
					expect(resultDecimal).to.be.approximately(price, 0.1);
				});
			});

			describe('when the price is fetched for AELIN', () => {
				it('when twap interval is 0 initial ratio is returned', async () => {
					const newRate = 3395.73255295;
					let timestamp = await currentTime();
					await aggregatorETH.setLatestAnswer(convertToDecimals(newRate, 8), timestamp);

					await instance.connect(ownerSigner).addPool(AELIN, tokens[1], pool_AELIN_ETH.address);
					await instance.connect(ownerSigner).setTwapInterval(0);
					const result = await instance.connect(accountOneSigner).rateForCurrency(AELIN);
					const resultDecimal = parseFloat(result.toString()) / 10 ** 18;

					// initial ratio ETH/AELIN = 0.25;
					const price = newRate / 0.25;

					expect(resultDecimal).to.be.approximately(price, 0.00000000001);
				});

				it('when twap interval is greater than 0', async () => {
					const newRate = 3395.73255295;
					let timestamp = await currentTime();
					await aggregatorETH.setLatestAnswer(convertToDecimals(newRate, 8), timestamp);

					await instance.connect(ownerSigner).addPool(AELIN, tokens[1], pool_AELIN_ETH.address);

					await instance.connect(ownerSigner).setTwapInterval(1200);
					await fastForward(1200);

					const observeResult = await pool_AELIN_ETH.observe([1200, 0]);
					const tickCumulatives = observeResult.tickCumulatives;
					const ratioAtTick = parseInt(
						tickCumulatives[1]
							.sub(tickCumulatives[0])
							.div(1200)
							.toString()
					);

					// ratio = 1.0001^tick
					const expectedRatio = Math.pow(1.0001, ratioAtTick);

					// initial ratio ETH/AELIN = 0.25;
					const price = newRate / 0.25;

					const result = await instance.connect(accountOneSigner).rateForCurrency(AELIN);
					const resultDecimal = parseFloat(result.toString()) / 10 ** 18;

					expect(expectedRatio).to.be.approximately(expectedRatio, 0.00000000001);
					expect(resultDecimal).to.be.approximately(price, 1);
				});
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

			it('cannot add pool for LYRA if aggregator already exists', async () => {
				await assert.revert(
					instance.connect(ownerSigner).addPool(LYRA, tokens[0], pool_LYRA_ETH.address),
					'Aggregator already exists for key'
				);
			});

			it('can add pool for LYRA when aggregator is removed', async () => {
				await instance.connect(ownerSigner).removeAggregator(LYRA);
				await instance.connect(ownerSigner).addPool(LYRA, tokens[0], pool_LYRA_ETH.address);

				assert.equal(await instance.connect(ownerSigner).pools(LYRA), pool_LYRA_ETH.address);
				assert.equal(await instance.connect(ownerSigner).aggregators(LYRA), ZERO_ADDRESS);
			});
		});
	});
});
