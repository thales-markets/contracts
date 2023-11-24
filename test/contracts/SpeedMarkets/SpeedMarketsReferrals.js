'use strict';

const { artifacts, contract } = require('hardhat');
const { assert } = require('../../utils/common');
const { toBytes32 } = require('../../../index');
const { toUnit } = require('../../utils')();
const { speedMarketsInit } = require('../../utils/init');

contract('SpeedMarketsReferrals', (accounts) => {
	const [owner, user, safeBox, referrerAddress] = accounts;

	describe('Speed markets referrals ', () => {
		it('Should referrer receive default fee', async () => {
			let { speedMarketsAMM, exoticUSD, priceFeedUpdateData, fee, initialSkewImapct, now } =
				await speedMarketsInit(accounts);

			console.log('Create Speed Market with 10 amount and referrer default fee');
			await speedMarketsAMM.createNewMarket(
				toBytes32('ETH'),
				now + 36000,
				0,
				0,
				toUnit(10),
				[priceFeedUpdateData],
				referrerAddress,
				initialSkewImapct,
				{ value: fee }
			);

			console.log('Check referrer fee 0.5%');
			let referrerBalance = await exoticUSD.balanceOf(referrerAddress);
			assert.bnEqual(referrerBalance, toUnit(0.05)); // 0.5% from 10

			console.log('Check safe box fee 2% - 0.5%');
			let safeBoxBalance = await exoticUSD.balanceOf(safeBox);
			assert.bnEqual(safeBoxBalance, toUnit(0.15)); // 2% from 10 minus referrer fee (0.5%)
		});

		it('Should referrer receive silver fee', async () => {
			let {
				speedMarketsAMM,
				exoticUSD,
				priceFeedUpdateData,
				fee,
				referrals,
				initialSkewImapct,
				now,
			} = await speedMarketsInit(accounts);

			await referrals.setSilverAddress(referrerAddress, true);

			console.log('Create Speed Market with 10 amount and referrer silver fee');
			await speedMarketsAMM.createNewMarket(
				toBytes32('ETH'),
				now + 36000,
				0,
				0,
				toUnit(10),
				[priceFeedUpdateData],
				referrerAddress,
				initialSkewImapct,
				{ value: fee }
			);

			console.log('Check referrer silver fee 0.75%');
			let referrerBalance = await exoticUSD.balanceOf(referrerAddress);
			assert.bnEqual(referrerBalance, toUnit(0.075)); // 0.75% from 10

			console.log('Check safe box fee 2% - 0.75%');
			let safeBoxBalance = await exoticUSD.balanceOf(safeBox);
			assert.bnEqual(safeBoxBalance, toUnit(0.125)); // 2% from 10 minus referrer fee (0.75%)
		});

		it('Should referrer receive gold fee', async () => {
			let {
				speedMarketsAMM,
				exoticUSD,
				priceFeedUpdateData,
				fee,
				referrals,
				initialSkewImapct,
				now,
			} = await speedMarketsInit(accounts);

			await referrals.setGoldAddress(referrerAddress, true);

			console.log('Create Speed Market with 10 amount and referrer gold fee');
			await speedMarketsAMM.createNewMarket(
				toBytes32('ETH'),
				now + 36000,
				0,
				0,
				toUnit(10),
				[priceFeedUpdateData],
				referrerAddress,
				initialSkewImapct,
				{ value: fee }
			);

			console.log('Check referrer gold fee 1%');
			let referrerBalance = await exoticUSD.balanceOf(referrerAddress);
			assert.bnEqual(referrerBalance, toUnit(0.1)); // 1% from 10

			console.log('Check safe box fee 2% - 1%');
			let safeBoxBalance = await exoticUSD.balanceOf(safeBox);
			assert.bnEqual(safeBoxBalance, toUnit(0.1)); // 2% from 10 minus referrer fee (1%)
		});
	});
});
