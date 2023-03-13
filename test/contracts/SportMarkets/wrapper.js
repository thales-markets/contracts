'use strict';

const { artifacts, contract } = require('hardhat');

const w3utils = require('web3-utils');

const { assert } = require('../../utils/common');

const { toUnit } = require('../../utils')();

const { toBytes32 } = require('../../../index');

contract('TherundownConsumerWrapper', (accounts) => {
	const [first, owner, second, third, manager] = accounts;
	const SportPositionContract = artifacts.require('SportPosition');
	const SportPositionalMarketContract = artifacts.require('SportPositionalMarket');
	const SportPositionalMarketDataContract = artifacts.require('SportPositionalMarketData');
	const SportPositionalMarketManagerContract = artifacts.require('SportPositionalMarketManager');
	const SportPositionalMarketFactoryContract = artifacts.require('SportPositionalMarketFactory');
	const SportsAMMContract = artifacts.require('SportsAMM');
	let TherundownConsumerWrapper;
	let TherundownConsumerWrapperDeployed;
	let TherundownConsumer;
	let TherundownConsumerDeployed;
	let wrapper;
	let consumer;
	let ThalesDeployed;
	let MockPriceFeedDeployed;
	let paymentCreate;
	let paymentResolve;
	let paymentOdds;
	let verifier;
	let dummyAddress, dummyReqId;
	let GamesOddsObtainerDeployed;
	let SportPositionalMarketManager,
		SportPositionalMarketFactory,
		SportPositionalMarketData,
		SportPositionalMarket,
		SportPositionalMarketMastercopy,
		SportPositionMastercopy,
		SportsAMM;

	beforeEach(async () => {
		dummyAddress = '0xb69e74324bc030f1b8889236efa461496d439226';
		dummyReqId = '0xd96bdf45d698fc8da0ddef0ddfd4a700aa1fb2fbe36d315f4eee8bf3e5bd1f0c';

		SportPositionalMarketManager = await SportPositionalMarketManagerContract.new({
			from: manager,
		});
		SportPositionalMarketFactory = await SportPositionalMarketFactoryContract.new({
			from: manager,
		});
		SportPositionalMarketMastercopy = await SportPositionalMarketContract.new({ from: manager });
		SportPositionMastercopy = await SportPositionContract.new({ from: manager });
		SportPositionalMarketData = await SportPositionalMarketDataContract.new({ from: manager });
		SportsAMM = await SportsAMMContract.new({ from: manager });

		let MockPriceFeed = artifacts.require('MockPriceFeed');
		MockPriceFeedDeployed = await MockPriceFeed.new(owner);

		let Thales = artifacts.require('Thales');
		ThalesDeployed = await Thales.new({ from: owner });

		TherundownConsumer = artifacts.require('TherundownConsumer');
		TherundownConsumerDeployed = await TherundownConsumer.new({ from: owner });

		consumer = await TherundownConsumer.at(TherundownConsumerDeployed.address);

		paymentCreate = toUnit(1);
		paymentResolve = toUnit(2);
		paymentOdds = toUnit(3);

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

		let ConsumerVerifier = artifacts.require('TherundownConsumerVerifier');
		verifier = await ConsumerVerifier.new({ from: owner });

		await verifier.initialize(
			owner,
			TherundownConsumerDeployed.address,
			['TBD TBD', 'TBA TBA'],
			['create', 'resolve'],
			20,
			{
				from: owner,
			}
		);

		TherundownConsumerWrapper = artifacts.require('TherundownConsumerWrapper');
		TherundownConsumerWrapperDeployed = await TherundownConsumerWrapper.new(
			ThalesDeployed.address,
			ThalesDeployed.address,
			TherundownConsumerDeployed.address,
			paymentCreate,
			paymentResolve,
			paymentOdds,
			'0x3465326264623338336437393962343662653663656562336463366465306363',
			third,
			verifier.address,
			{ from: owner }
		);

		wrapper = await TherundownConsumerWrapper.at(TherundownConsumerWrapperDeployed.address);

		let GamesOddsObtainer = artifacts.require('GamesOddsObtainer');
		GamesOddsObtainerDeployed = await GamesOddsObtainer.new({ from: owner });

		await GamesOddsObtainerDeployed.initialize(
			owner,
			TherundownConsumerDeployed.address,
			verifier.address,
			SportPositionalMarketManager.address,
			[4, 16],
			{ from: owner }
		);

		await consumer.setSportContracts(
			TherundownConsumerWrapperDeployed.address,
			MockPriceFeedDeployed.address,
			MockPriceFeedDeployed.address,
			verifier.address,
			GamesOddsObtainerDeployed.address,
			{
				from: owner,
			}
		);
	});

	describe('Wrapper tests', () => {
		it('Init checking', async () => {
			assert.bnEqual(ThalesDeployed.address, await wrapper.getOracleAddress());
			assert.bnEqual(ThalesDeployed.address, await wrapper.getTokenAddress());
			assert.bnEqual(false, await wrapper.requestIdGamesOddsFulFilled(dummyReqId));
			assert.bnEqual(false, await wrapper.requestIdGamesCreatedFulFilled(dummyReqId));
			assert.bnEqual(false, await wrapper.requestIdGamesResolvedFulFilled(dummyReqId));
			assert.bnEqual(false, await wrapper.areOddsRequestIdsFulFilled([dummyReqId]));
			assert.bnEqual(false, await wrapper.areCreatedRequestIdsFulFilled([dummyReqId]));
			assert.bnEqual(false, await wrapper.areResolvedRequestIdsFulFilled([dummyReqId]));
			assert.bnEqual(paymentCreate, await wrapper.paymentCreate());
			assert.bnEqual(paymentResolve, await wrapper.paymentResolve());
			assert.bnEqual(paymentOdds, await wrapper.paymentOdds());

			assert.equal(true, await TherundownConsumerDeployed.supportedSport(4));
			assert.equal(false, await TherundownConsumerDeployed.supportedSport(5));

			assert.equal(true, await verifier.isSupportedMarketType('create'));
			assert.equal(true, await verifier.isSupportedMarketType('resolve'));
			assert.equal(false, await verifier.isSupportedMarketType('aaa'));
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

			const tx_verifier = await wrapper.setVerifier(first, {
				from: owner,
			});

			await expect(wrapper.setVerifier(first, { from: first })).to.be.revertedWith(
				'Ownable: caller is not the owner'
			);

			// check if event is emited
			assert.eventEqual(tx_verifier.logs[0], 'NewVerifier', {
				_verifier: first,
			});

			const payment = w3utils.toWei('0.3');

			const tx_payment_c = await wrapper.setPaymentCreate(payment, {
				from: owner,
			});

			await expect(wrapper.setPaymentCreate(first, { from: first })).to.be.revertedWith(
				'Ownable: caller is not the owner'
			);

			// check if event is emited
			assert.eventEqual(tx_payment_c.logs[0], 'NewPaymentAmountCreate', {
				_paymentCreate: payment,
			});

			const tx_payment_r = await wrapper.setPaymentResolve(payment, {
				from: owner,
			});

			await expect(wrapper.setPaymentResolve(first, { from: first })).to.be.revertedWith(
				'Ownable: caller is not the owner'
			);

			// check if event is emited
			assert.eventEqual(tx_payment_r.logs[0], 'NewPaymentAmountResolve', {
				_paymentResolve: payment,
			});

			const tx_payment_o = await wrapper.setPaymentOdds(payment, {
				from: owner,
			});

			await expect(wrapper.setPaymentOdds(first, { from: first })).to.be.revertedWith(
				'Ownable: caller is not the owner'
			);

			// check if event is emited
			assert.eventEqual(tx_payment_o.logs[0], 'NewPaymentAmountOdds', {
				_paymentOdds: payment,
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

			const tx_amm = await wrapper.setSportsAmmAddress(first, {
				from: owner,
			});

			await expect(wrapper.setSportsAmmAddress(first, { from: first })).to.be.revertedWith(
				'Ownable: caller is not the owner'
			);

			// check if event is emited
			assert.eventEqual(tx_amm.logs[0], 'NewSportsAmmAddress', {
				_sportsAmm: first,
			});

			const tx_odds_spec = await wrapper.setOddsSpecId(
				`0x3465326264623338336437393962343662653663656562336463366465306364`,
				{
					from: owner,
				}
			);

			await expect(
				wrapper.setOddsSpecId(
					`0x3465326264623338336437393962343662653663656562336463366465306364`,
					{ from: first }
				)
			).to.be.revertedWith('Ownable: caller is not the owner');

			// check if event is emited
			assert.eventEqual(tx_odds_spec.logs[0], 'NewOddsSpecId', {
				_specId: `0x3465326264623338336437393962343662653663656562336463366465306364`,
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

			await expect(
				wrapper.requestGamesResolveWithFilters(
					toBytes32('RSX'),
					'create',
					5,
					1655215501,
					emptyArray,
					emptyArray,
					{
						from: second,
					}
				)
			).to.be.revertedWith('SportId is not supported');

			await expect(
				wrapper.callUpdateOddsForSpecificGame(dummyAddress, {
					from: second,
				})
			).to.be.revertedWith('Only Sports AMM can call this function');
		});
	});
});
