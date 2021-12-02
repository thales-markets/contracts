'use strict';

const { artifacts, contract, web3 } = require('hardhat');

const { assert } = require('../../../utils/common');

const { currentTime, toUnit, bytesToString } = require('../../../utils')();

const { onlyGivenAddressCanInvoke, convertToDecimals } = require('../../../utils/helpers');

const { toBytes32 } = require('../../../../index');
const { setupAllContracts } = require('../../../utils/setup');

const ZERO_ADDRESS = '0x' + '0'.repeat(40);

const MockStandardBridgeL1 = artifacts.require('MockStandardBridgeL1');
let StandardBridgeL1;

contract('Proxy Exhanger L1 <=> L2', async accounts => {
    before(async () => {
        StandardBridgeL1 = await MockStandardBridgeL1.new();

    });

});