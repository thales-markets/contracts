'use strict';

const { contract } = require('hardhat');
const { assert } = require('../../utils/common');
const { toUnit } = require('../../utils')();
const { speedMarketsInit } = require('../../utils/init');
const { getCreateSpeedAMMParams } = require('../../utils/speedMarkets');
const { ZERO_ADDRESS } = require('../../utils/helpers');

contract('SpeedMarketsReferrals', (accounts) => {
	const [owner, user, safeBox, referrerAddress] = accounts;

	describe('Speed markets referrals ', () => {
		it('Should referrer receive default fee', async () => {
			let { creatorAccount, speedMarketsAMM, exoticUSD, initialSkewImapct, now } =
				await speedMarketsInit(accounts);
			await speedMarketsAMM.setSupportedNativeCollateralAndBonus(exoticUSD.address, true, 0);
			const strikeTimeParam = now + 10 * 60 * 60; // 10 hours from now
			const createSpeedAMMParams = getCreateSpeedAMMParams(
				user,
				'ETH',
				strikeTimeParam,
				now,
				10,
				0,
				initialSkewImapct,
				0,
				ZERO_ADDRESS,
				referrerAddress
			);

			console.log('Create Speed Market with 10 amount and referrer default fee');
			await speedMarketsAMM.createNewMarket(createSpeedAMMParams, { from: creatorAccount });

			console.log('Check referrer fee 0.5%');
			let referrerBalance = await exoticUSD.balanceOf(referrerAddress);
			assert.bnEqual(referrerBalance, toUnit(0.05)); // 0.5% from 10

			console.log('Check safe box fee 2% - 0.5%');
			let safeBoxBalance = await exoticUSD.balanceOf(safeBox);
			assert.bnEqual(safeBoxBalance, toUnit(0.15)); // 2% from 10 minus referrer fee (0.5%)
		});

		it('Should referrer receive silver fee', async () => {
			let { creatorAccount, speedMarketsAMM, exoticUSD, referrals, initialSkewImapct, now } =
				await speedMarketsInit(accounts);

			await referrals.setSilverAddress(referrerAddress, true);

			const strikeTimeParam = now + 10 * 60 * 60; // 10 hours from now
			const createSpeedAMMParams = getCreateSpeedAMMParams(
				user,
				'ETH',
				strikeTimeParam,
				now,
				10,
				0,
				initialSkewImapct,
				0,
				ZERO_ADDRESS,
				referrerAddress
			);

			console.log('Create Speed Market with 10 amount and referrer silver fee');
			await speedMarketsAMM.createNewMarket(createSpeedAMMParams, { from: creatorAccount });

			console.log('Check referrer silver fee 0.75%');
			let referrerBalance = await exoticUSD.balanceOf(referrerAddress);
			assert.bnEqual(referrerBalance, toUnit(0.075)); // 0.75% from 10

			console.log('Check safe box fee 2% - 0.75%');
			let safeBoxBalance = await exoticUSD.balanceOf(safeBox);
			assert.bnEqual(safeBoxBalance, toUnit(0.125)); // 2% from 10 minus referrer fee (0.75%)
		});

		it('Should referrer receive gold fee', async () => {
			let { creatorAccount, speedMarketsAMM, exoticUSD, referrals, initialSkewImapct, now } =
				await speedMarketsInit(accounts);

			await referrals.setGoldAddress(referrerAddress, true);

			const strikeTimeParam = now + 10 * 60 * 60; // 10 hours from now
			const createSpeedAMMParams = getCreateSpeedAMMParams(
				user,
				'ETH',
				strikeTimeParam,
				now,
				10,
				0,
				initialSkewImapct,
				0,
				ZERO_ADDRESS,
				referrerAddress
			);

			console.log('Create Speed Market with 10 amount and referrer gold fee');
			await speedMarketsAMM.createNewMarket(createSpeedAMMParams, { from: creatorAccount });

			console.log('Check referrer gold fee 1%');
			let referrerBalance = await exoticUSD.balanceOf(referrerAddress);
			assert.bnEqual(referrerBalance, toUnit(0.1)); // 1% from 10

			console.log('Check safe box fee 2% - 1%');
			let safeBoxBalance = await exoticUSD.balanceOf(safeBox);
			assert.bnEqual(safeBoxBalance, toUnit(0.1)); // 2% from 10 minus referrer fee (1%)
		});

		it('Default fee set to 0', async () => {
			let { creatorAccount, speedMarketsAMM, exoticUSD, initialSkewImapct, now, referrals } =
				await speedMarketsInit(accounts);

			await referrals.setReferrerFees(toUnit(0), toUnit(0.0075), toUnit(0.01));

			const strikeTimeParam = now + 10 * 60 * 60; // 10 hours from now
			const createSpeedAMMParams = getCreateSpeedAMMParams(
				user,
				'ETH',
				strikeTimeParam,
				now,
				10,
				0,
				initialSkewImapct,
				0,
				ZERO_ADDRESS,
				referrerAddress
			);

			console.log('Create Speed Market with 10 amount and referrer default fee');
			await speedMarketsAMM.createNewMarket(createSpeedAMMParams, { from: creatorAccount });

			console.log('Check referrer fee 0%');
			let referrerBalance = await exoticUSD.balanceOf(referrerAddress);
			assert.bnEqual(referrerBalance, toUnit(0));

			console.log('Check safe box fee 2% - 0%');
			let safeBoxBalance = await exoticUSD.balanceOf(safeBox);
			assert.bnEqual(safeBoxBalance, toUnit(0.2));
		});
	});
});
