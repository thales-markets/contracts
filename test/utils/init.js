const { toBytes32 } = require('../../index');
const { toUnit, currentTime } = require('./')();

const ZERO_ADDRESS = '0x' + '0'.repeat(40);

module.exports = {
	async speedMarketsInit(accounts = []) {
		const [owner, user, safeBox] = accounts;

		let SpeedMarketsAMMContract = artifacts.require('SpeedMarketsAMM');
		let speedMarketsAMM = await SpeedMarketsAMMContract.new();

		let ExoticUSD = artifacts.require('ExoticUSD');
		let exoticUSD = await ExoticUSD.new();

		await exoticUSD.setDefaultAmount(toUnit(100));

		await exoticUSD.mintForUser(user);
		let balance = await exoticUSD.balanceOf(user);
		console.log('Balance of user is ' + balance / 1e18);

		await exoticUSD.transfer(speedMarketsAMM.address, toUnit(100), { from: user });

		await exoticUSD.mintForUser(owner);
		balance = await exoticUSD.balanceOf(owner);
		console.log('Balance of owner is ' + balance / 1e18);

		let balanceOfSpeedMarketAMMBefore = await exoticUSD.balanceOf(speedMarketsAMM.address);

		await exoticUSD.approve(speedMarketsAMM.address, toUnit(100));

		let MockPriceFeed = artifacts.require('MockPriceFeed');
		let MockPriceFeedDeployed = await MockPriceFeed.new(owner);
		await MockPriceFeedDeployed.setPricetoReturn(10000);

		let MockPyth = artifacts.require('MockPythCustom');
		let mockPyth = await MockPyth.new(60, 1e6);

		await speedMarketsAMM.initialize(owner, exoticUSD.address, mockPyth.address);

		let SpeedMarketMastercopy = artifacts.require('SpeedMarketMastercopy');
		let speedMarketMastercopy = await SpeedMarketMastercopy.new();

		await speedMarketsAMM.setMastercopy(speedMarketMastercopy.address);

		await speedMarketsAMM.setAmounts(toUnit(5), toUnit(1000));

		await speedMarketsAMM.setTimes(3600, 86400);

		await speedMarketsAMM.setMaximumPriceDelays(60, 30);

		await speedMarketsAMM.setSupportedAsset(toBytes32('ETH'), true);
		await speedMarketsAMM.setMaxRiskPerAsset(toBytes32('ETH'), toUnit(1000));
		await speedMarketsAMM.setMaxRiskPerAssetAndDirection(toBytes32('ETH'), toUnit(100));
		await speedMarketsAMM.setMaxRiskPerAssetAndDirection(toBytes32('BTC'), toUnit(100));
		await speedMarketsAMM.setSafeBoxParams(safeBox, toUnit(0.02));
		await speedMarketsAMM.setLPFee(toUnit(0.01));

		await speedMarketsAMM.setAssetToPythID(
			toBytes32('ETH'),
			'0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace'
		);

		let pythId = await speedMarketsAMM.assetToPythId(toBytes32('ETH'));
		console.log('Pyth Id is ' + pythId);

		let now = await currentTime();

		let priceFeedUpdateData = await mockPyth.createPriceFeedUpdateData(
			'0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
			186342931000,
			74093100,
			-8,
			186342931000,
			74093100,
			now
		);

		console.log('price feed update data is ' + priceFeedUpdateData);

		let updateDataArray = [];
		updateDataArray[0] = priceFeedUpdateData;

		let fee = await mockPyth.getUpdateFee(updateDataArray);
		console.log('Fee is ' + fee);

		// await mockPyth.updatePriceFeeds([priceFeedUpdateData], { value: fee });

		let minimalTimeToMaturity = await speedMarketsAMM.minimalTimeToMaturity();
		console.log('minimalTimeToMaturity ' + minimalTimeToMaturity);

		let Referrals = artifacts.require('Referrals');
		let referrals = await Referrals.new();

		await referrals.initialize(owner, ZERO_ADDRESS, ZERO_ADDRESS);
		await referrals.setWhitelistedAddress(speedMarketsAMM.address, true);
		await referrals.setReferrerFees(toUnit(0.005), toUnit(0.0075), toUnit(0.01));

		await speedMarketsAMM.setAddresses(mockPyth.address, referrals.address, ZERO_ADDRESS, {
			from: owner,
		});

		return {
			speedMarketsAMM,
			balanceOfSpeedMarketAMMBefore,
			priceFeedUpdateData,
			fee,
			mockPyth,
			MockPriceFeedDeployed,
			pythId,
			exoticUSD,
			referrals,
			now,
		};
	},
};
