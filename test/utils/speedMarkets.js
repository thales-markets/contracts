const { toUnit } = require('./index')();

module.exports = {
	getSkewImpact(riskPerAssetAndDirectionData, maxSkewImpact) {
		const skewImapctDecimal =
			(riskPerAssetAndDirectionData[0].current /
				1e18 /
				(riskPerAssetAndDirectionData[0].max / 1e18)) *
			maxSkewImpact;
		return toUnit(skewImapctDecimal.toFixed(5));
	},
};
