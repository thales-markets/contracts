'use strict';

const { artifacts, contract } = require('hardhat');
const { assert } = require('../../utils/common');
const { toBytes32 } = require('../../../index');
const { expect } = require('chai');
const { fastForward, toUnit, currentTime } = require('../../utils')();
const { ZERO_ADDRESS } = require('../../utils/helpers');
const { speedMarketsInit } = require('../../utils/init');
const { getCreateSpeedAMMParams } = require('../../utils/speedMarkets');

contract('SpeedMarketsBonusIntegration', (accounts) => {
	const [owner, user, safeBox, proxyUser] = accounts;

	describe('Test Speed markets bonus integration', () => {});
});
