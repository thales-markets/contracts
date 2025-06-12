'use strict';

const { artifacts, contract } = require('hardhat');
const { assert } = require('../../utils/common');
const { toBytes32 } = require('../../../index');
const { expect } = require('chai');
const { toUnit, currentTime } = require('../../utils')();
const { ZERO_ADDRESS } = require('../../utils/helpers');

contract('SpeedMarketsBonus', (accounts) => {
	const [owner, user, safeBox] = accounts;

	describe('Test Speed markets bonus configuration', () => {});
});
