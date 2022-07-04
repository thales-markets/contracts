'use strict';

const { artifacts, contract } = require('hardhat');

const w3utils = require('web3-utils');

const { assert } = require('../../utils/common');

const { toUnit } = require('../../utils')();

const { toBytes32 } = require('../../../index');

contract('TherundownConsumerWrapper', accounts => {
	const [first, owner, second, third] = accounts;
	let TherundownConsumerWrapper;
	let TherundownConsumerWrapperDeployed;
	let TherundownConsumer;
	let TherundownConsumerDeployed;
	let wrapper;
	let consumer;
	let ThalesDeployed;
	let MockPriceFeedDeployed;
	let payment;

	beforeEach(async () => {
		let MockPriceFeed = artifacts.require('MockPriceFeed');
		MockPriceFeedDeployed = await MockPriceFeed.new(owner);

		let Thales = artifacts.require('Thales');
		ThalesDeployed = await Thales.new({ from: owner });

		TherundownConsumer = artifacts.require('TherundownConsumer');
		TherundownConsumerDeployed = await TherundownConsumer.new({ from: owner });

		consumer = await TherundownConsumer.at(TherundownConsumerDeployed.address);

		payment = toUnit(1);

		await consumer.initialize(
			owner,
			[4],
			MockPriceFeedDeployed.address,
			[4],
			MockPriceFeedDeployed.address,
			[4],
			[10],
			{ from: owner }
		);

		TherundownConsumerWrapper = artifacts.require('TherundownConsumerWrapper');
		TherundownConsumerWrapperDeployed = await TherundownConsumerWrapper.new(
			ThalesDeployed.address,
			ThalesDeployed.address,
			TherundownConsumerDeployed.address,
			payment,
			{ from: owner }
		);

		wrapper = await TherundownConsumerWrapper.at(TherundownConsumerWrapperDeployed.address);
	});

	describe('Wrapper tests', () => {
		it('Init checking', async () => {
			assert.bnEqual(ThalesDeployed.address, await wrapper.getOracleAddress());
			assert.bnEqual(ThalesDeployed.address, await wrapper.getTokenAddress());
			assert.bnEqual(payment, await wrapper.payment());
		});

		it('Contract management', async () => {
			const tx_Oracle = await wrapper.setOracle(first, {
				from: owner,
			});

			await expect(wrapper.setOracle(first, { from: first })).to.be.revertedWith(
				'Ownable: caller is not the owner'
			);

			// check if event is emited
			assert.eventEqual(tx_Oracle.logs[0], 'NewOracleAddress', {
				_oracle: first,
			});

			const tx_Consumer = await wrapper.setConsumer(first, {
				from: owner,
			});

			await expect(wrapper.setConsumer(first, { from: first })).to.be.revertedWith(
				'Ownable: caller is not the owner'
			);

			// check if event is emited
			assert.eventEqual(tx_Consumer.logs[0], 'NewConsumer', {
				_consumer: first,
			});

			const payment = w3utils.toWei('0.3');

			const tx_payment = await wrapper.setPayment(payment, {
				from: owner,
			});

			await expect(wrapper.setPayment(first, { from: first })).to.be.revertedWith(
				'Ownable: caller is not the owner'
			);

			// check if event is emited
			assert.eventEqual(tx_payment.logs[0], 'NewPaymentAmount', {
				_payment: payment,
			});

			const tx_link = await wrapper.setLink(first, {
				from: owner,
			});

			await expect(wrapper.setLink(first, { from: first })).to.be.revertedWith(
				'Ownable: caller is not the owner'
			);

			// check if event is emited
			assert.eventEqual(tx_link.logs[0], 'NewLinkAddress', {
				_link: first,
			});
		});

		it('Test requests', async () => {
			let emptyArray = [];
			await expect(
				wrapper.requestGames(toBytes32('RSX'), 'create', 4, 1655215501, {
					from: second,
				})
			).to.be.revertedWith('SafeMath: subtraction overflow');

			await expect(
				wrapper.requestGames(toBytes32('RSX'), 'create1', 4, 1655215501, {
					from: second,
				})
			).to.be.revertedWith('Market is not supported');

			await expect(
				wrapper.requestGames(toBytes32('RSX'), 'create', 5, 1655215501, {
					from: second,
				})
			).to.be.revertedWith('SportId is not supported');

			await expect(
				wrapper.requestOddsWithFilters(toBytes32('RSX'), 5, 1655215501, emptyArray, {
					from: second,
				})
			).to.be.revertedWith('SportId is not supported');

			await expect(
				wrapper.requestGamesResolveWithFilters(
					toBytes32('RSX'),
					'create1',
					4,
					1655215501,
					emptyArray,
					emptyArray,
					{
						from: second,
					}
				)
			).to.be.revertedWith('Market is not supported');
		});
	});
});
