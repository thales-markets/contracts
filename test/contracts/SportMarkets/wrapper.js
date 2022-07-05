'use strict';

const { artifacts, contract } = require('hardhat');

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

	beforeEach(async () => {
		let MockPriceFeed = artifacts.require('MockPriceFeed');
		MockPriceFeedDeployed = await MockPriceFeed.new(owner);

		let Thales = artifacts.require('Thales');
		ThalesDeployed = await Thales.new({ from: owner });

		TherundownConsumer = artifacts.require('TherundownConsumer');
		TherundownConsumerDeployed = await TherundownConsumer.new({ from: owner });

		consumer = await TherundownConsumer.at(TherundownConsumerDeployed.address);

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
			{ from: owner }
		);

		wrapper = await TherundownConsumerWrapper.at(TherundownConsumerWrapperDeployed.address);
	});

	describe('Wrapper tests', () => {
		it('Init checking', async () => {
			assert.bnEqual(ThalesDeployed.address, await wrapper.getOracleAddress());
			assert.bnEqual(ThalesDeployed.address, await wrapper.getTokenAddress());
		});

		it('Contract management', async () => {
			const tx_AddToWhitelist = await wrapper.addToWhitelist(first, {
				from: owner,
			});

			await expect(wrapper.addToWhitelist(first, { from: first })).to.be.revertedWith(
				'Ownable: caller is not the owner'
			);

			// check if event is emited
			assert.eventEqual(tx_AddToWhitelist.logs[0], 'AddedIntoWhitelist', {
				_whitelistAddress: first,
			});

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
		});

		it('Test requests', async () => {
			await wrapper.addToWhitelist(first, { from: owner });

			await expect(
				wrapper.requestGames(toBytes32('RSX'), toUnit('1'), 'create', 4, 1655215501, {
					from: second,
				})
			).to.be.revertedWith('Address not supported');

			await expect(
				wrapper.requestGames(toBytes32('RSX'), toUnit('1'), 'create1', 4, 1655215501, {
					from: second,
				})
			).to.be.revertedWith('Market is not supported');

			await expect(
				wrapper.requestGames(toBytes32('RSX'), toUnit('1'), 'create', 5, 1655215501, {
					from: second,
				})
			).to.be.revertedWith('SportId is not supported');
		});
	});
});
