'use strict';

const { artifacts, contract } = require('hardhat');

const w3utils = require('web3-utils');

const { assert } = require('../../utils/common');

const { toUnit } = require('../../utils')();

contract('ApexConsumerWrapper', (accounts) => {
	const [first, owner, second, third] = accounts;
	let ApexConsumerWrapper;
	let ApexConsumerWrapperDeployed;
	let ApexConsumer;
	let ApexConsumerDeployed;
	let wrapper;
	let consumer;
	let ThalesDeployed;
	let MockPriceFeedDeployed;
	let paymentMetadata;
	let paymentMatchup;
	let paymentResults;
	let requestMetadataJobId;
	let requestMatchupJobId;
	let requestResultsJobId;
	let supportedBetTypes;

	beforeEach(async () => {
		let MockPriceFeed = artifacts.require('MockPriceFeed');
		MockPriceFeedDeployed = await MockPriceFeed.new(owner);

		let Thales = artifacts.require('Thales');
		ThalesDeployed = await Thales.new({ from: owner });

		ApexConsumer = artifacts.require('ApexConsumer');
		ApexConsumerDeployed = await ApexConsumer.new({ from: owner });

		consumer = await ApexConsumer.at(ApexConsumerDeployed.address);

		paymentMetadata = toUnit(1);
		paymentMatchup = toUnit(2);
		paymentResults = toUnit(3);
		requestMetadataJobId = '29d9ac9ad5244c0fbbbf02089c308be5';
		requestMatchupJobId = '3712fada98f54c159d9ab653fd0547f4';
		requestResultsJobId = '481d9a5f62744b75ae096ce2c27fceef';
		supportedBetTypes = ['outright_head_to_head', 'top3', 'top5', 'top10'];

		await consumer.initialize(owner, ['formula1'], MockPriceFeedDeployed.address, { from: owner });

		ApexConsumerWrapper = artifacts.require('ApexConsumerWrapper');
		ApexConsumerWrapperDeployed = await ApexConsumerWrapper.new(
			ThalesDeployed.address,
			ThalesDeployed.address,
			ApexConsumerDeployed.address,
			paymentMetadata,
			paymentMatchup,
			paymentResults,
			requestMetadataJobId,
			requestMatchupJobId,
			requestResultsJobId,
			supportedBetTypes,
			{ from: owner }
		);

		wrapper = await ApexConsumerWrapper.at(ApexConsumerWrapperDeployed.address);
	});

	describe('ApexConsumerWrapper tests', () => {
		it('Init checking', async () => {
			assert.bnEqual(ThalesDeployed.address, await wrapper.getOracleAddress());
			assert.bnEqual(ThalesDeployed.address, await wrapper.getTokenAddress());
			assert.bnEqual(paymentMetadata, await wrapper.paymentMetadata());
			assert.bnEqual(paymentMatchup, await wrapper.paymentMatchup());
			assert.bnEqual(paymentResults, await wrapper.paymentResults());
			assert.bnEqual(requestMetadataJobId, await wrapper.requestMetadataJobId());
			assert.bnEqual(requestMatchupJobId, await wrapper.requestMatchupJobId());
			assert.bnEqual(requestResultsJobId, await wrapper.requestResultsJobId());
			assert.equal(true, await wrapper.supportedBetType('top3'));
			assert.equal(false, await wrapper.supportedBetType('top7'));
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

			const payment1 = w3utils.toWei('0.1');
			const payment2 = w3utils.toWei('0.2');
			const payment3 = w3utils.toWei('0.3');

			const tx_payment_c = await wrapper.setPaymentAmounts(payment1, payment2, payment3, {
				from: owner,
			});

			await expect(
				wrapper.setPaymentAmounts(payment1, payment2, payment3, { from: first })
			).to.be.revertedWith('Ownable: caller is not the owner');

			// check if event is emited
			assert.eventEqual(tx_payment_c.logs[0], 'NewPaymentAmounts', {
				_paymentMetadata: payment1,
				_paymentMatchup: payment2,
				_paymentResults: payment3,
			});

			const requestJobId1 = '29d9ac9ad5244c0fbbbf02089c308be5';
			const requestJobId2 = '29d9ac9ad5244c0fbbbf02089c308be5';
			const requestJobId3 = '29d9ac9ad5244c0fbbbf02089c308be5';

			const tx_payment_r = await wrapper.setRequestsJobIds(
				requestJobId1,
				requestJobId2,
				requestJobId3,
				{
					from: owner,
				}
			);

			await expect(
				wrapper.setRequestsJobIds(requestJobId1, requestJobId2, requestJobId3, { from: first })
			).to.be.revertedWith('Ownable: caller is not the owner');

			// check if event is emited
			assert.eventEqual(tx_payment_r.logs[0], 'NewRequestsJobIds', {
				_requestMetadataJobId: requestJobId1,
				_requestMatchupJobId: requestJobId2,
				_requestResultsJobId: requestJobId3,
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

			const tx_BetTypes1 = await wrapper.setSupportedBetType('top7', true, {
				from: owner,
			});
			assert.equal(true, await wrapper.supportedBetType('top7'));

			// check if event is emited
			assert.eventEqual(tx_BetTypes1.logs[0], 'BetTypesChanged', {
				_betType: 'top7',
				_isSupported: true,
			});

			await expect(wrapper.setSupportedBetType('top7', true, { from: owner })).to.be.revertedWith(
				'Already set'
			);

			await expect(wrapper.setSupportedBetType('top7', true, { from: first })).to.be.revertedWith(
				'Ownable: caller is not the owner'
			);

			await expect(wrapper.setSupportedBetType('top3', true, { from: owner })).to.be.revertedWith(
				'Already set'
			);
			const tx_BetTypes2 = await wrapper.setSupportedBetType('top3', false, {
				from: owner,
			});
			assert.equal(false, await wrapper.supportedBetType('top3'));

			// check if event is emited
			assert.eventEqual(tx_BetTypes2.logs[0], 'BetTypesChanged', {
				_betType: 'top3',
				_isSupported: false,
			});
		});

		it('Test requests', async () => {
			await expect(
				wrapper.requestMetaData('basketball', {
					from: second,
				})
			).to.be.revertedWith('Sport is not supported');

			await expect(
				wrapper.requestMetaData('formula1', {
					from: second,
				})
			).to.be.revertedWith('SafeMath: subtraction overflow');

			await expect(
				wrapper.requestMatchup('f1r_16_22', 'top3', '10', 'pre1', {
					from: second,
				})
			).to.be.revertedWith('Qualifying status is not supported');

			await expect(
				wrapper.requestMatchup('f1r_16_22', 'top7', '10', 'pre', {
					from: second,
				})
			).to.be.revertedWith('Bet type is not supported');

			await expect(
				wrapper.requestMatchup('f1r_16_22', 'top3', '10', 'pre', {
					from: second,
				})
			).to.be.revertedWith('SafeMath: subtraction overflow');

			await expect(
				wrapper.requestResults('f1r_16_22', 'top3', '10', {
					from: second,
				})
			).to.be.revertedWith('SafeMath: subtraction overflow');
		});
	});
});
