'use strict';

const { artifacts, contract } = require('hardhat');
const { assert } = require('../../utils/common');
const { toBytes32 } = require('../../../index');
const { expect } = require('chai');
const { fastForward, toUnit, currentTime } = require('../../utils')();

contract('SpeedMarketsReferrals', (accounts) => {
	const [owner, user, safeBox] = accounts;

	describe('Test Speed markets referrals ', () => {
		it('test referrer', async () => {});
	});
});
