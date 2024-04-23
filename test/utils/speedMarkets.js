const { toUnit } = require('./')();
const { toBytes32 } = require('../../index');
const { ZERO_ADDRESS } = require('./helpers');

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
	referral
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
	referral || ZERO_ADDRESS,
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
	referral
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
	referral || ZERO_ADDRESS,
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
	getCreateSpeedAMMParams,
	getCreateChainedSpeedAMMParams,
	getCreateSpeedParams,
	getSkewImpact,
};
