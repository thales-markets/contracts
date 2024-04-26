const { toBN } = require('web3-utils');
const { toUnit } = require('./')();
const { toBytes32 } = require('../../index');
const { ZERO_ADDRESS } = require('./helpers');

const getPendingSpeedParams = (
	asset,
	deltaTime,
	strikePrice,
	strikePriceSlippage,
	buyinAmount,
	direction,
	skewImpact,
	strikeTime,
	collateral,
	referrer
) => [
	toBytes32(asset),
	strikeTime || 0,
	deltaTime,
	toBN(strikePrice * 1e8), // pyth price is with 8 decimals
	toUnit(strikePriceSlippage),
	direction || 0,
	collateral || ZERO_ADDRESS,
	toUnit(buyinAmount),
	referrer || ZERO_ADDRESS,
	skewImpact || 0,
];

const getPendingChainedSpeedParams = (
	asset,
	timeFrame,
	strikePrice,
	strikePriceSlippage,
	buyinAmount,
	directions,
	collateral,
	referrer
) => [
	toBytes32(asset),
	timeFrame,
	toBN(strikePrice * 1e8), // pyth price is with 8 decimals
	toUnit(strikePriceSlippage),
	directions || [0, 0],
	collateral || ZERO_ADDRESS,
	toUnit(buyinAmount),
	referrer || ZERO_ADDRESS,
];

const getAssetPriceData = (assets, priceUpdateDataArray) =>
	assets.map((asset, i) => [toBytes32(asset), [priceUpdateDataArray[i]]]);

const getCreateSpeedAMMParams = (
	user,
	asset,
	strikeTime,
	publishTime,
	buyinAmount,
	direction,
	skewImpact,
	deltaTime,
	collateral,
	referrer
) => [
	user,
	toBytes32(asset),
	strikeTime,
	deltaTime || 0,
	{
		price: 186342931000,
		conf: 1742265769,
		expo: -8,
		publishTime,
	},
	direction || 0,
	collateral || ZERO_ADDRESS,
	toUnit(buyinAmount),
	referrer || ZERO_ADDRESS,
	skewImpact || 0,
];

const getCreateSpeedAMMParamsZkSync = (
	user,
	asset,
	strikeTime,
	publishTime,
	buyinAmount,
	direction,
	skewImpact,
	deltaTime,
	collateral,
	referrer
) => {
	const params = getCreateSpeedAMMParams(
		user,
		asset,
		strikeTime,
		publishTime,
		buyinAmount,
		direction,
		skewImpact,
		deltaTime,
		collateral,
		referrer
	);
	params.push(0);

	return params;
};

const getCreateChainedSpeedAMMParams = (
	user,
	asset,
	timeFrame,
	pythPrice,
	publishTime,
	buyinAmount,
	directions,
	collateral,
	referrer
) => [
	user,
	toBytes32(asset),
	timeFrame,
	{
		price: pythPrice,
		conf: 1742265769,
		expo: -8,
		publishTime,
	},
	directions || [0, 1, 0, 0, 0, 0], // UP, DOWN, UP, UP, UP, UP
	collateral || ZERO_ADDRESS,
	toUnit(buyinAmount),
	referrer || ZERO_ADDRESS,
];

const getCreateSpeedParams = (asset, strikeTime, buyinAmount) => [
	toBytes32(asset),
	strikeTime,
	0,
	186342931000,
	2000000, // 2 %
	0,
	ZERO_ADDRESS,
	toUnit(buyinAmount),
	ZERO_ADDRESS,
	0,
];

const getSkewImpact = (riskPerAssetAndDirectionData, maxSkewImpact) => {
	const skewImapctDecimal =
		(riskPerAssetAndDirectionData[0].current /
			1e18 /
			(riskPerAssetAndDirectionData[0].max / 1e18)) *
		maxSkewImpact;
	return toUnit(skewImapctDecimal.toFixed(5));
};

module.exports = {
	getPendingSpeedParams,
	getPendingChainedSpeedParams,
	getAssetPriceData,
	getCreateSpeedAMMParams,
	getCreateSpeedAMMParamsZkSync,
	getCreateChainedSpeedAMMParams,
	getCreateSpeedParams,
	getSkewImpact,
};
