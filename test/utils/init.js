const { toBytes32 } = require('../../index');
const { toUnit, currentTime } = require('./')();
const { getSkewImpact } = require('./speedMarkets');
const { ZERO_ADDRESS } = require('./helpers');

module.exports = {
	async speedMarketsInit(accounts = []) {
		const [owner, user, safeBox, creatorAccount] = accounts;

		let SpeedMarketsAMMContract = artifacts.require('SpeedMarketsAMM');
		let speedMarketsAMM = await SpeedMarketsAMMContract.new();

		let SpeedMarketsAMMDataContract = artifacts.require('SpeedMarketsAMMData');
		let speedMarketsAMMData = await SpeedMarketsAMMDataContract.new();
		await speedMarketsAMMData.initialize(owner, speedMarketsAMM.address);
		await speedMarketsAMMData.setSpeedMarketsAMM(speedMarketsAMM.address, ZERO_ADDRESS, {
			from: owner,
		});

		let FreeBetsHolderContract = artifacts.require('MockFreeBetsHolder');
		let freeBetsHolder = await FreeBetsHolderContract.new(speedMarketsAMM.address);

		const Over = artifacts.require('ExoticUSD');
		const over = await Over.new();

		let ExoticUSD = artifacts.require('ExoticUSD');
		let exoticUSD = await ExoticUSD.new();

		await exoticUSD.setDefaultAmount(toUnit(100));
		await over.setDefaultAmount(toUnit(100));

		await exoticUSD.mintForUser(user);
		await over.mintForUser(user);
		let balance = await exoticUSD.balanceOf(user);

		await exoticUSD.transfer(speedMarketsAMM.address, toUnit(100), { from: user });
		await over.transfer(speedMarketsAMM.address, toUnit(100), { from: user });

		await exoticUSD.mintForUser(user);
		await exoticUSD.approve(speedMarketsAMM.address, toUnit(100), { from: user });
		console.log('Balance of user is ' + balance / 1e18);

		await over.mintForUser(user);
		await over.approve(speedMarketsAMM.address, toUnit(100), { from: user });
		console.log('Balance of user is ' + balance / 1e18);

		await exoticUSD.mintForUser(owner);
		balance = await exoticUSD.balanceOf(owner);
		console.log('Balance of owner is ' + balance / 1e18);

		await over.mintForUser(owner);
		balance = await over.balanceOf(owner);
		console.log('Balance of owner is ' + balance / 1e18);

		let balanceOfSpeedMarketAMMBefore = await exoticUSD.balanceOf(speedMarketsAMM.address);

		let MockPriceFeed = artifacts.require('MockPriceFeed');
		let MockPriceFeedDeployed = await MockPriceFeed.new(owner);
		await MockPriceFeedDeployed.setPricetoReturn(10000);

		await speedMarketsAMM.initialize(owner, exoticUSD.address);
		await speedMarketsAMM.setSusdAddress(exoticUSD.address);
		await speedMarketsAMM.setLimitParams(toUnit(5), toUnit(1000), 3600, 86400, 60, 30);
		await speedMarketsAMM.setSupportedAsset(toBytes32('ETH'), true);
		await speedMarketsAMM.setMaxRisks(toBytes32('ETH'), toUnit(1000), toUnit(100));
		await speedMarketsAMM.setMaxRisks(toBytes32('BTC'), toUnit(1000), toUnit(100));
		await speedMarketsAMM.setSafeBoxAndMaxSkewImpact(toUnit(0.02), toUnit(0.05), toUnit(0.02));
		await speedMarketsAMM.setLPFeeParams(
			[15, 30, 60, 120],
			[toUnit(0.18), toUnit(0.13), toUnit(0.08), toUnit(0.05)],
			toUnit(0.04)
		);

		await speedMarketsAMM.setAssetToPythID(
			toBytes32('ETH'),
			'0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace'
		);

		let pythId = await speedMarketsAMM.assetToPythId(toBytes32('ETH'));
		console.log('Pyth Id is ' + pythId);

		let now = await currentTime();

		let MockPyth = artifacts.require('MockPythCustom');
		let mockPyth = await MockPyth.new(60, 1e6);

		let priceFeedUpdateData = await mockPyth.createPriceFeedUpdateData(
			'0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace', // ETH
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

		await mockPyth.updatePriceFeeds([priceFeedUpdateData], { value: fee });

		let minimalTimeToMaturity = await speedMarketsAMM.minimalTimeToMaturity();
		console.log('minimalTimeToMaturity ' + minimalTimeToMaturity);

		const Referrals = artifacts.require('Referrals');
		const referrals = await Referrals.new();

		await referrals.initialize(owner, ZERO_ADDRESS, ZERO_ADDRESS);
		await referrals.setWhitelistedAddress(speedMarketsAMM.address, true);
		await referrals.setReferrerFees(toUnit(0.005), toUnit(0.0075), toUnit(0.01));

		let AddressManagerContract = artifacts.require('AddressManager');
		let addressManager = await AddressManagerContract.new();

		await addressManager.initialize(
			owner,
			safeBox,
			referrals.address,
			ZERO_ADDRESS,
			ZERO_ADDRESS,
			mockPyth.address,
			speedMarketsAMM.address
		);

		await addressManager.setAddressInAddressBook('SpeedMarketsAMMCreator', creatorAccount);
		await addressManager.setAddressInAddressBook('FreeBetsHolder', freeBetsHolder.address);

		// Deploy a minimal ChainedSpeedMarketsAMM to satisfy resolver initialization
		let ChainedSpeedMarketsAMMContract = artifacts.require('ChainedSpeedMarketsAMM');
		let chainedSpeedMarketsAMM = await ChainedSpeedMarketsAMMContract.new();
		await chainedSpeedMarketsAMM.initialize(owner, exoticUSD.address);
		await addressManager.setAddressInAddressBook(
			'ChainedSpeedMarketsAMM',
			chainedSpeedMarketsAMM.address
		);

		// Deploy SpeedMarketsAMMResolver
		let SpeedMarketsAMMResolverContract = artifacts.require('SpeedMarketsAMMResolver');
		let speedMarketsAMMResolver = await SpeedMarketsAMMResolverContract.new();
		await speedMarketsAMMResolver.initialize(
			owner,
			speedMarketsAMM.address,
			addressManager.address
		);
		await addressManager.setAddressInAddressBook(
			'SpeedMarketsAMMResolver',
			speedMarketsAMMResolver.address
		);

		let SpeedMarketMastercopy = artifacts.require('SpeedMarketMastercopy');
		let speedMarketMastercopy = await SpeedMarketMastercopy.new();

		let SpeedMarketsAMMUtilsContract = artifacts.require('SpeedMarketsAMMUtils');
		let speedMarketsAMMUtils = await SpeedMarketsAMMUtilsContract.new();

		await speedMarketsAMM.setAMMAddresses(
			speedMarketMastercopy.address,
			speedMarketsAMMUtils.address,
			addressManager.address,
			{
				from: owner,
			}
		);

		await speedMarketsAMMUtils.initialize(owner, addressManager.address);
		await addressManager.setAddressInAddressBook(
			'SpeedMarketsAMMUtils',
			speedMarketsAMMUtils.address
		);
		await addressManager.setAddressInAddressBook('SpeedMarketsAMM', speedMarketsAMM.address);
		await addressManager.setAddressInAddressBook('PriceFeed', MockPriceFeedDeployed.address);

		await speedMarketsAMM.setSupportedNativeCollateralAndBonus(
			over.address,
			true,
			toUnit(0.02),
			toBytes32('OVER')
		);
		await MockPriceFeedDeployed.setStaticPricePerCurrencyKey(toBytes32('OVER'), toUnit(0.3));

		await MockPriceFeedDeployed.setStaticPricePerCurrencyKey(toBytes32('eUSD'), toUnit(1));
		await MockPriceFeedDeployed.setStaticPricePerCurrencyKey(toBytes32('ExoticUSD'), toUnit(2));

		await addressManager.setAddressInAddressBook('PriceFeed', MockPriceFeedDeployed.address);
		await addressManager.setAddressInAddressBook('SpeedMarketsAMM', speedMarketsAMM.address);

		const maxSkewImpact = (await speedMarketsAMM.maxSkewImpact()) / 1e18;
		let riskPerAssetAndDirectionData = await speedMarketsAMMData.getDirectionalRiskPerAsset(
			toBytes32('ETH')
		);
		let initialSkewImapct = getSkewImpact(riskPerAssetAndDirectionData, maxSkewImpact);

		return {
			creatorAccount,
			speedMarketsAMM,
			speedMarketsAMMData,
			speedMarketsAMMResolver,
			addressManager,
			balanceOfSpeedMarketAMMBefore,
			priceFeedUpdateData,
			fee,
			mockPyth,
			MockPriceFeedDeployed,
			pythId,
			over,
			exoticUSD,
			referrals,
			initialSkewImapct,
			now,
			chainedSpeedMarketsAMM,
		};
	},
};
