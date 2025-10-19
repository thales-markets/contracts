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
	isChainlink = false,
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
	isChainlink ? 1 : 0,
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
	isChainlink = false,
	directions,
	collateral,
	referrer
) => [
	toBytes32(asset),
	timeFrame,
	toBN(strikePrice * 1e8), // pyth price is with 8 decimals
	toUnit(strikePriceSlippage),
	isChainlink ? 1 : 0,
	directions || [0, 0],
	collateral || ZERO_ADDRESS,
	toUnit(buyinAmount),
	referrer || ZERO_ADDRESS,
];

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
	186342931000,
	publishTime,
	0,
	direction || 0,
	collateral || ZERO_ADDRESS,
	toUnit(buyinAmount),
	referrer || ZERO_ADDRESS,
	skewImpact || 0,
];

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
	pythPrice,
	0,
	directions || [0, 1, 0, 0, 0, 0], // UP, DOWN, UP, UP, UP, UP
	collateral || ZERO_ADDRESS,
	toUnit(buyinAmount),
	referrer || ZERO_ADDRESS,
];

const getSkewImpact = (riskPerAssetAndDirectionData, maxSkewImpact) => {
	const skewImapctDecimal =
		(riskPerAssetAndDirectionData[0].current /
			1e18 /
			(riskPerAssetAndDirectionData[0].max / 1e18)) *
		maxSkewImpact;
	return toUnit(skewImapctDecimal.toFixed(5));
};

const getPendingSpeedParamsZkSync = (
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
	const params = [
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
		0,
	];

	return params;
};

module.exports = {
	getPendingSpeedParams,
	getPendingChainedSpeedParams,
	getCreateSpeedAMMParams,
	getCreateChainedSpeedAMMParams,
	getSkewImpact,
	getPendingSpeedParamsZkSync,
	getCreateSpeedAMMParamsZkSync,
};
