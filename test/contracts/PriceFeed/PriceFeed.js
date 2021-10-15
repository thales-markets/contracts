'use strict';

const { artifacts, contract, web3 } = require('hardhat');

const { assert } = require('../../utils/common');

const { currentTime, fastForward, toUnit, bytesToString } = require('../../utils')();

const { onlyGivenAddressCanInvoke, convertToDecimals } = require('../../utils/helpers');

const { toBytes32 } = require('../../../index');
const { setupAllContracts } = require('../../utils/setup');

const ZERO_ADDRESS = '0x' + '0'.repeat(40);

const MockAggregator = artifacts.require('MockAggregatorV2V3');

const getRandomCurrencyKey = () =>
	Math.random()
		.toString(36)
		.substring(2, 6)
		.toUpperCase();

const createRandomKeysAndRates = quantity => {
	const uniqueCurrencyKeys = {};
	for (let i = 0; i < quantity; i++) {
		const rate = Math.random() * 100;
		const key = toBytes32(getRandomCurrencyKey());
		uniqueCurrencyKeys[key] = web3.utils.toWei(rate.toFixed(18), 'ether');
	}

	const rates = [];
	const currencyKeys = [];
	Object.entries(uniqueCurrencyKeys).forEach(([key, rate]) => {
		currencyKeys.push(key);
		rates.push(rate);
	});

	return { currencyKeys, rates };
};

contract('Price Feed', async accounts => {
	const [deployerAccount, owner, oracle, accountOne, accountTwo] = accounts;
	const [SNX, JPY, XTZ, BNB, sUSD, EUR, LINK, fastGasPrice] = [
		'SNX',
		'JPY',
		'XTZ',
		'BNB',
		'sUSD',
		'EUR',
		'LINK',
		'fastGasPrice',
	].map(toBytes32);
	let instance;
	let aggregatorJPY;
	let aggregatorXTZ;
	let aggregatorLINK;
	let aggregatorFastGasPrice;
	let initialTime;
	let timeSent;

	before(async () => {
		initialTime = await currentTime();
		({ PriceFeed: instance } = await setupAllContracts({
			accounts,
			contracts: ['PriceFeed'],
		}));

		aggregatorJPY = await MockAggregator.new({ from: owner });
		aggregatorXTZ = await MockAggregator.new({ from: owner });
		aggregatorLINK = await MockAggregator.new({ from: owner });
		aggregatorFastGasPrice = await MockAggregator.new({ from: owner });

		aggregatorJPY.setDecimals('8');
		aggregatorXTZ.setDecimals('8');
		aggregatorLINK.setDecimals('8');
		aggregatorFastGasPrice.setDecimals('0');
	});

	beforeEach(async () => {
		timeSent = await currentTime();
	});

	describe('updateRates()', () => {
		it('should be able to update rates of only one currency without affecting other rates', async () => {
			await fastForward(1);

			await instance.updateRates(
				[toBytes32('lABC'), toBytes32('lDEF'), toBytes32('lGHI')],
				[
					web3.utils.toWei('1.3', 'ether'),
					web3.utils.toWei('2.4', 'ether'),
					web3.utils.toWei('3.5', 'ether'),
				],
				timeSent,
				{ from: owner }
			);

			await fastForward(10);
			const updatedTime = timeSent + 10;

			const updatedRate = '64.33';
			await instance.updateRates(
				[toBytes32('lABC')],
				[web3.utils.toWei(updatedRate, 'ether')],
				updatedTime,
				{ from: owner }
			);

			const updatedTimelDEF = await instance.lastRateUpdateTimes.call(toBytes32('lDEF'));
			const updatedTimelGHI = await instance.lastRateUpdateTimes.call(toBytes32('lGHI'));

			assert.etherEqual(await instance.rateForCurrency(toBytes32('lABC')), updatedRate);
			assert.etherEqual(await instance.rateForCurrency(toBytes32('lDEF')), '2.4');
			assert.etherEqual(await instance.rateForCurrency(toBytes32('lGHI')), '3.5');

			const lastUpdatedTimeLABC = await instance.lastRateUpdateTimes.call(toBytes32('lABC'));
			assert.equal(lastUpdatedTimeLABC.toNumber(), updatedTime);
			const lastUpdatedTimeLDEF = await instance.lastRateUpdateTimes.call(toBytes32('lDEF'));
			assert.equal(lastUpdatedTimeLDEF.toNumber(), updatedTimelDEF.toNumber());
			const lastUpdatedTimeLGHI = await instance.lastRateUpdateTimes.call(toBytes32('lGHI'));
			assert.equal(lastUpdatedTimeLGHI.toNumber(), updatedTimelGHI.toNumber());
		});

		it('should be able to update rates of all currencies', async () => {
			await fastForward(1);

			await instance.updateRates(
				[toBytes32('lABC'), toBytes32('lDEF'), toBytes32('lGHI')],
				[
					web3.utils.toWei('1.3', 'ether'),
					web3.utils.toWei('2.4', 'ether'),
					web3.utils.toWei('3.5', 'ether'),
				],
				timeSent,
				{ from: owner }
			);

			await fastForward(5);
			const updatedTime = timeSent + 5;

			const updatedRate1 = '64.33';
			const updatedRate2 = '2.54';
			const updatedRate3 = '10.99';
			await instance.updateRates(
				[toBytes32('lABC'), toBytes32('lDEF'), toBytes32('lGHI')],
				[
					web3.utils.toWei(updatedRate1, 'ether'),
					web3.utils.toWei(updatedRate2, 'ether'),
					web3.utils.toWei(updatedRate3, 'ether'),
				],
				updatedTime,
				{ from: owner }
			);

			assert.etherEqual(await instance.rateForCurrency(toBytes32('lABC')), updatedRate1);
			assert.etherEqual(await instance.rateForCurrency(toBytes32('lDEF')), updatedRate2);
			assert.etherEqual(await instance.rateForCurrency(toBytes32('lGHI')), updatedRate3);

			const lastUpdatedTimeLABC = await instance.lastRateUpdateTimes.call(toBytes32('lABC'));
			assert.equal(lastUpdatedTimeLABC.toNumber(), updatedTime);
			const lastUpdatedTimeLDEF = await instance.lastRateUpdateTimes.call(toBytes32('lDEF'));
			assert.equal(lastUpdatedTimeLDEF.toNumber(), updatedTime);
			const lastUpdatedTimeLGHI = await instance.lastRateUpdateTimes.call(toBytes32('lGHI'));
			assert.equal(lastUpdatedTimeLGHI.toNumber(), updatedTime);
		});

		it('should revert when trying to set sUSD price', async () => {
			await fastForward(1);

			await assert.revert(
				instance.updateRates([sUSD], [web3.utils.toWei('1.0', 'ether')], timeSent, {
					from: owner,
				}),
				"Rate of sUSD cannot be updated, it's always UNIT"
			);
		});

		it('should emit RatesUpdated event when rate updated', async () => {
			const rates = [
				web3.utils.toWei('1.3', 'ether'),
				web3.utils.toWei('2.4', 'ether'),
				web3.utils.toWei('3.5', 'ether'),
			];

			const keys = ['lABC', 'lDEF', 'lGHI'];
			const currencyKeys = keys.map(toBytes32);
			const txn = await instance.updateRates(currencyKeys, rates, await currentTime(), {
				from: owner,
			});

			assert.eventEqual(txn, 'RatesUpdated', {
				currencyKeys,
				newRates: rates,
			});
		});

		it('should be able to handle lots of currency updates', async () => {
			const numberOfCurrencies = 150;
			const { currencyKeys, rates } = createRandomKeysAndRates(numberOfCurrencies);

			const updatedTime = await currentTime();
			await instance.updateRates(currencyKeys, rates, updatedTime, { from: owner });

			for (let i = 0; i < currencyKeys.length; i++) {
				assert.equal(await instance.rateForCurrency(currencyKeys[i]), rates[i]);
				const lastUpdatedTime = await instance.lastRateUpdateTimes.call(currencyKeys[i]);
				assert.equal(lastUpdatedTime.toNumber(), updatedTime);
			}
		});

		it('should revert when currency keys length != new rates length on update', async () => {
			await assert.revert(
				instance.updateRates(
					[sUSD, SNX, toBytes32('GOLD')],
					[web3.utils.toWei('1', 'ether'), web3.utils.toWei('0.2', 'ether')],
					await currentTime(),
					{ from: owner }
				),
				'Currency key array length must match rates array length'
			);
		});

		it('should not be able to set exchange rate to 0 on update', async () => {
			await assert.revert(
				instance.updateRates(
					[toBytes32('ZERO')],
					[web3.utils.toWei('0', 'ether')],
					await currentTime(),
					{ from: owner }
				),
				'Zero is not a valid rate, please call deleteRate instead'
			);
		});

		it('only owner can update exchange rates', async () => {
			await onlyGivenAddressCanInvoke({
				fnc: instance.updateRates,
				args: [
					[toBytes32('GOLD'), toBytes32('FOOL')],
					[web3.utils.toWei('10', 'ether'), web3.utils.toWei('0.9', 'ether')],
					timeSent,
				],
				address: owner,
				accounts,
				skipPassCheck: true,
				reason: 'Only the contract owner may perform this action',
			});

			assert.etherNotEqual(await instance.rateForCurrency(toBytes32('GOLD')), '10');
			assert.etherNotEqual(await instance.rateForCurrency(toBytes32('FOOL')), '0.9');

			const updatedTime = await currentTime();

			await instance.updateRates(
				[toBytes32('GOLD'), toBytes32('FOOL')],
				[web3.utils.toWei('10', 'ether'), web3.utils.toWei('0.9', 'ether')],
				updatedTime,
				{ from: owner }
			);
			assert.etherEqual(await instance.rateForCurrency(toBytes32('GOLD')), '10');
			assert.etherEqual(await instance.rateForCurrency(toBytes32('FOOL')), '0.9');

			const lastUpdatedTimeGOLD = await instance.lastRateUpdateTimes.call(toBytes32('GOLD'));
			assert.equal(lastUpdatedTimeGOLD.toNumber(), updatedTime);
			const lastUpdatedTimeFOOL = await instance.lastRateUpdateTimes.call(toBytes32('FOOL'));
			assert.equal(lastUpdatedTimeFOOL.toNumber(), updatedTime);
		});

		it('should not be able to update rates if they are too far in the future', async () => {
			const timeTooFarInFuture = (await currentTime()) + 10 * 61;
			await assert.revert(
				instance.updateRates(
					[toBytes32('GOLD')],
					[web3.utils.toWei('1', 'ether')],
					timeTooFarInFuture,
					{ from: owner }
				),
				'Time is too far into the future'
			);
		});
	});

	describe('deleteRate()', () => {
		it('should be able to remove specific rate', async () => {
			const foolsRate = '0.002';
			const encodedRateGOLD = toBytes32('GLD');

			await instance.updateRates(
				[encodedRateGOLD, toBytes32('FOOL')],
				[web3.utils.toWei('10.123', 'ether'), web3.utils.toWei(foolsRate, 'ether')],
				timeSent,
				{ from: owner }
			);

			const beforeRate = await instance.rateForCurrency(encodedRateGOLD);
			console.log('before rate', beforeRate.toString());
			const beforeRateUpdatedTime = await instance.lastRateUpdateTimes.call(encodedRateGOLD);

			await instance.deleteRate(encodedRateGOLD, { from: owner });

			const afterRate = await instance.rateForCurrency(encodedRateGOLD);
			console.log('after rate', afterRate.toString());
			const afterRateUpdatedTime = await instance.lastRateUpdateTimes.call(encodedRateGOLD);
			assert.notEqual(afterRate, beforeRate);
			assert.equal(afterRate, '0');
			assert.notEqual(afterRateUpdatedTime, beforeRateUpdatedTime);
			assert.equal(afterRateUpdatedTime, '0');

			// Other rates are unaffected
			assert.etherEqual(await instance.rateForCurrency(toBytes32('FOOL')), foolsRate);
		});

		it('only owner can delete a rate', async () => {
			const encodedRateName = toBytes32('COOL');
			await instance.updateRates(
				[encodedRateName],
				[web3.utils.toWei('10.123', 'ether')],
				await currentTime(),
				{ from: owner }
			);

			await onlyGivenAddressCanInvoke({
				fnc: instance.deleteRate,
				args: [encodedRateName],
				accounts,
				address: owner,
				reason: 'Only the contract owner may perform this action',
			});
		});

		it("deleting rate that doesn't exist causes revert", async () => {
			// This key shouldn't exist but let's do the best we can to ensure that it doesn't
			const encodedCurrencyKey = toBytes32('7NEQ');
			const currentRate = await instance.rateForCurrency(encodedCurrencyKey);
			if (currentRate > 0) {
				await instance.deleteRate(encodedCurrencyKey, { from: owner });
			}

			// Ensure rate deletion attempt results in revert
			await assert.revert(instance.deleteRate(encodedCurrencyKey, { from: owner }), 'Rate is zero');
			assert.etherEqual(await instance.rateForCurrency(encodedCurrencyKey), '0');
		});

		it('should emit RateDeleted event when rate deleted', async () => {
			const updatedTime = await currentTime();
			const rate = 'GOLD';
			const encodedRate = toBytes32(rate);
			await instance.updateRates(
				[encodedRate],
				[web3.utils.toWei('10.123', 'ether')],
				updatedTime,
				{
					from: owner,
				}
			);

			const txn = await instance.deleteRate(encodedRate, { from: owner });
			assert.eventEqual(txn, 'RateDeleted', { currencyKey: encodedRate });
		});
	});

	describe('getting rates', () => {
		it('should be able to get exchange rate with key', async () => {
			const updatedTime = await currentTime();
			const encodedRate = toBytes32('GOLD');
			const rateValueEncodedStr = web3.utils.toWei('10.123', 'ether');
			await instance.updateRates([encodedRate], [rateValueEncodedStr], updatedTime, {
				from: owner,
			});

			const rate = await instance.rateForCurrency(encodedRate);
			assert.equal(rate, rateValueEncodedStr);
		});

		it('all users should be able to get exchange rate with key', async () => {
			const updatedTime = await currentTime();
			const encodedRate = toBytes32('FETC');
			const rateValueEncodedStr = web3.utils.toWei('910.6661293879', 'ether');
			await instance.updateRates([encodedRate], [rateValueEncodedStr], updatedTime, {
				from: owner,
			});

			await instance.rateForCurrency(encodedRate, { from: accountOne });
			await instance.rateForCurrency(encodedRate, { from: accountTwo });
			await instance.rateForCurrency(encodedRate, { from: owner });
			await instance.rateForCurrency(encodedRate, { from: deployerAccount });
		});

		it('Fetching non-existent rate returns 0', async () => {
			const encodedRateKey = LINK;
			const currentRate = await instance.rateForCurrency(encodedRateKey);
			if (currentRate > 0) {
				await instance.deleteRate(encodedRateKey, { from: owner });
			}

			const rate = await instance.rateForCurrency(encodedRateKey);
			assert.equal(rate.toString(), '0');
		});

		it('should be able to get the latest exchange rate and updated time', async () => {
			const updatedTime = await currentTime();
			const encodedRate = toBytes32('GOLD');
			const rateValueEncodedStr = web3.utils.toWei('10.123', 'ether');
			await instance.updateRates([encodedRate], [rateValueEncodedStr], updatedTime, {
				from: owner,
			});

			const rateAndTime = await instance.rateAndUpdatedTime(encodedRate);
			assert.equal(rateAndTime.rate, rateValueEncodedStr);
			assert.bnEqual(rateAndTime.time, updatedTime);
		});
	});

	describe('lastRateUpdateTimesForCurrencies()', () => {
		it('should return correct last rate update time for a specific currency', async () => {
			const abc = toBytes32('lABC');
			const def = toBytes32('lDEF');
			const ghi = toBytes32('lGHI');
			const timeSent = await currentTime();
			await instance.updateRates(
				[abc, def],
				[web3.utils.toWei('1.3', 'ether'), web3.utils.toWei('2.4', 'ether')],
				timeSent,
				{ from: owner }
			);
			await fastForward(10000);
			const timeSent2 = await currentTime();
			await instance.updateRates([ghi], [web3.utils.toWei('2.4', 'ether')], timeSent2, {
				from: owner,
			});

			const [firstTS, secondTS] = await Promise.all([
				instance.lastRateUpdateTimes(abc),
				instance.lastRateUpdateTimes(ghi),
			]);
			assert.equal(firstTS, timeSent);
			assert.equal(secondTS, timeSent2);
		});
	});

	describe('pricing aggregators', () => {
		describe('When an aggregator with more than 18 decimals is added', () => {
			it('an aggregator should return a value with 18 decimals or less', async () => {
				const newAggregator = await MockAggregator.new({ from: owner });
				await newAggregator.setDecimals('19');
				await assert.revert(
					instance.addAggregator(JPY, newAggregator.address, {
						from: owner,
					}),
					'Aggregator decimals should be lower or equal to 18'
				);
			});
		});

		describe('when a user queries the first entry in aggregatorKeys', () => {
			it('then it is empty', async () => {
				await assert.invalidOpcode(instance.aggregatorKeys(0));
			});
		});

		describe('when the owner attempts to add an invalid address for JPY ', () => {
			it('then zero address is invalid', async () => {
				await assert.revert(
					instance.addAggregator(JPY, ZERO_ADDRESS, {
						from: owner,
					})
					// 'function call to a non-contract account' (this reason is not valid in Ganache so fails in coverage)
				);
			});
			it('and a non-aggregator address is invalid', async () => {
				await assert.revert(
					instance.addAggregator(JPY, instance.address, {
						from: owner,
					})
					// 'function selector was not recognized'  (this reason is not valid in Ganache so fails in coverage)
				);
			});
		});

		it('currenciesUsingAggregator for a rate returns an empty', async () => {
			assert.deepEqual(await instance.currenciesUsingAggregator(aggregatorJPY.address), []);
			assert.deepEqual(await instance.currenciesUsingAggregator(ZERO_ADDRESS), []);
		});

		describe('when the owner adds JPY added as an aggregator', () => {
			let txn;
			beforeEach(async () => {
				txn = await instance.addAggregator(JPY, aggregatorJPY.address, {
					from: owner,
				});
			});

			it('then the list of aggregatorKeys lists it', async () => {
				assert.equal('JPY', bytesToString(await instance.aggregatorKeys(0)));
				await assert.invalidOpcode(instance.aggregatorKeys(1));
			});

			it('and the AggregatorAdded event is emitted', () => {
				assert.eventEqual(txn, 'AggregatorAdded', {
					currencyKey: JPY,
					aggregator: aggregatorJPY.address,
				});
			});

			it('only an owner can remove an aggregator', async () => {
				await onlyGivenAddressCanInvoke({
					fnc: instance.removeAggregator,
					args: [JPY],
					accounts,
					address: owner,
				});
			});

			it('and currenciesUsingAggregator for that aggregator returns JPY', async () => {
				assert.deepEqual(await instance.currenciesUsingAggregator(aggregatorJPY.address), [JPY]);
			});

			describe('when the owner adds the same aggregator to two other rates', () => {
				beforeEach(async () => {
					await instance.addAggregator(EUR, aggregatorJPY.address, {
						from: owner,
					});
					await instance.addAggregator(BNB, aggregatorJPY.address, {
						from: owner,
					});
				});
				it('and currenciesUsingAggregator for that aggregator returns JPY', async () => {
					assert.deepEqual(await instance.currenciesUsingAggregator(aggregatorJPY.address), [
						JPY,
						EUR,
						BNB,
					]);
				});
			});
			describe('when the owner tries to remove an invalid aggregator', () => {
				it('then it reverts', async () => {
					await assert.revert(
						instance.removeAggregator(XTZ, { from: owner }),
						'No aggregator exists for key'
					);
				});
			});

			describe('when the owner adds XTZ as an aggregator', () => {
				beforeEach(async () => {
					txn = await instance.addAggregator(XTZ, aggregatorXTZ.address, {
						from: owner,
					});
				});

				it('then the list of aggregatorKeys lists it also', async () => {
					assert.equal('JPY', bytesToString(await instance.aggregatorKeys(0)));
					assert.equal('XTZ', bytesToString(await instance.aggregatorKeys(3)));
					await assert.invalidOpcode(instance.aggregatorKeys(4));
				});

				it('and the AggregatorAdded event is emitted', () => {
					assert.eventEqual(txn, 'AggregatorAdded', {
						currencyKey: XTZ,
						aggregator: aggregatorXTZ.address,
					});
				});

				it('and currenciesUsingAggregator for that aggregator returns XTZ', async () => {
					assert.deepEqual(await instance.currenciesUsingAggregator(aggregatorXTZ.address), [XTZ]);
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
						const result = await instance.rateForCurrency(JPY, {
							from: accountOne,
						});
						assert.bnEqual(result, toUnit(newRate.toString()));
					});
					it('and the timestamp is the latest', async () => {
						const result = await instance.lastRateUpdateTimes(JPY, {
							from: accountOne,
						});
						assert.bnEqual(result.toNumber(), timestamp);
					});
				});
			});

			describe('when the aggregator price is set to set a specific number, other than 8 decimals', () => {
				const gasPrice = 189.9;
				let timestamp;
				beforeEach(async () => {
					await instance.addAggregator(fastGasPrice, aggregatorFastGasPrice.address, {
						from: owner,
					});
					timestamp = await currentTime();
					// fastGasPrice has no decimals, so no conversion needed
					await aggregatorFastGasPrice.setLatestAnswer(
						web3.utils.toWei(gasPrice.toString(), 'gwei'),
						timestamp
					);
				});

				describe('when the price is fetched for fastGasPrice', () => {
					it('the specific number is returned with 18 decimals', async () => {
						const result = await instance.rateForCurrency(fastGasPrice, {
							from: accountOne,
						});
						assert.bnEqual(result, web3.utils.toWei(gasPrice.toString(), 'gwei'));
					});
					it('and the timestamp is the latest', async () => {
						const result = await instance.lastRateUpdateTimes(fastGasPrice, {
							from: accountOne,
						});
						assert.bnEqual(result.toNumber(), timestamp);
					});
				});
			});
		});

		describe('when a price already exists for LINK', () => {
			const oldPrice = 100;
			let timeOldSent;
			beforeEach(async () => {
				timeOldSent = await currentTime();

				await instance.updateRates([LINK], [web3.utils.toWei(oldPrice.toString())], timeOldSent, {
					from: owner,
				});
			});

			describe('when the price is inspected for LINK', () => {
				it('then the price is returned as expected', async () => {
					const result = await instance.rateForCurrency(LINK, {
						from: accountOne,
					});
					assert.equal(result.toString(), toUnit(oldPrice));
				});
				it('then the timestamp is returned as expected', async () => {
					const result = await instance.lastRateUpdateTimes(LINK, {
						from: accountOne,
					});
					assert.equal(result.toNumber(), timeOldSent);
				});
			});

			describe('when LINK added as an aggregator (replacing existing)', () => {
				beforeEach(async () => {
					await instance.addAggregator(LINK, aggregatorLINK.address, {
						from: owner,
					});
				});
				describe('when the price is fetched for LINK', () => {
					it('0 is returned', async () => {
						const result = await instance.rateForCurrency(LINK, {
							from: accountOne,
						});
						assert.equal(result.toNumber(), 0);
					});
				});
				describe('when the timestamp is fetched for LINK', () => {
					it('0 is returned', async () => {
						const result = await instance.lastRateUpdateTimes(LINK, {
							from: accountOne,
						});
						assert.equal(result.toNumber(), 0);
					});
				});

				describe('when the aggregator price is set to set a specific number (with support for 8 decimals)', () => {
					const newRate = 9.55;
					let timestamp;
					beforeEach(async () => {
						await fastForward(50);
						timestamp = await currentTime();
						await aggregatorLINK.setLatestAnswer(convertToDecimals(newRate, 8), timestamp);
					});

					describe('when the price is fetched for LINK', () => {
						it('the new aggregator rate is returned instead of the old price', async () => {
							const result = await instance.rateForCurrency(LINK, {
								from: accountOne,
							});
							assert.bnEqual(result, toUnit(newRate.toString()));
						});
						it('and the timestamp is the new one', async () => {
							const result = await instance.lastRateUpdateTimes(LINK, {
								from: accountOne,
							});
							assert.bnEqual(result.toNumber(), timestamp);
						});
					});

					describe('when the aggregator is removed for LINK', () => {
						beforeEach(async () => {
							await instance.removeAggregator(LINK, {
								from: owner,
							});
						});
						describe('when a user queries the fifth entry in aggregatorKeys', () => {
							it('then they are empty', async () => {
								await assert.invalidOpcode(instance.aggregatorKeys(5));
							});
						});
						describe('when the price is inspected for LINK', () => {
							it('then the old price is returned', async () => {
								const result = await instance.rateForCurrency(LINK, {
									from: accountOne,
								});
								assert.equal(result.toString(), toUnit(oldPrice));
							});
							it('and the timestamp is returned as expected', async () => {
								const result = await instance.lastRateUpdateTimes(LINK, {
									from: accountOne,
								});
								assert.equal(result.toNumber(), timeOldSent);
							});
						});
					});
				});
			});

			describe('when XTZ added as an aggregator', () => {
				beforeEach(async () => {
					await instance.addAggregator(XTZ, aggregatorXTZ.address, {
						from: owner,
					});
				});
			});
		});
	});
});
