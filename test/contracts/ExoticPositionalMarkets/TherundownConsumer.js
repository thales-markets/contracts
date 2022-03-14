'use strict';

const { artifacts, contract, web3 } = require('hardhat');
const { toBN } = web3.utils;

const { assert, addSnapshotBeforeRestoreAfterEach } = require('../../utils/common');

const { toBytes32 } = require('../../../index');

var ethers2 = require('ethers');
var crypto = require('crypto');

const SECOND = 1000;
const HOUR = 3600;
const DAY = 86400;
const WEEK = 604800;
const YEAR = 31556926;

const {
	fastForward,
	toUnit,
	currentTime,
	multiplyDecimalRound,
	divideDecimalRound,
} = require('../../utils')();

const {
        onlyGivenAddressCanInvoke,
        convertToDecimals,
        encodeCall,
        assertRevert,
} = require('../../utils/helpers');

contract('TherundownConsumer', accounts => {
	const [first, owner, second, third, fourth] = accounts;

    let consumer;  
	let TherundownConsumer;
	let TherundownConsumerImplementation;
	let TherundownConsumerDeployed;
	let MockExoticMarket;
	let MockTherundownConsumerWrapper;
	let initializeConsumerData;

	beforeEach(async () => {

        let OwnedUpgradeabilityProxy = artifacts.require('OwnedUpgradeabilityProxy');

        TherundownConsumer = artifacts.require('TherundownConsumer');
        
		TherundownConsumerDeployed = await OwnedUpgradeabilityProxy.new({ from: owner });
		TherundownConsumerImplementation = await TherundownConsumer.new({from:owner});
		consumer = await TherundownConsumer.at(TherundownConsumerDeployed.address);

        initializeConsumerData = encodeCall(
            'initialize',
            ['address', 'uint256[]', 'address', 'uint256[]'],
            [
                owner,
                [4, 16],
                owner,
                [4]
            ]
        );

		await TherundownConsumerDeployed.upgradeToAndCall(TherundownConsumerImplementation.address, initializeConsumerData, {
			from: owner,
        });
    });

    describe('Init', () => {

        it('Check init', async () => {

            assert.equal(true, await consumer.isSupportedSport(4));
            assert.equal(true, await consumer.isSupportedSport(16));
            assert.equal(false, await consumer.isSupportedSport(0));
            assert.equal(false, await consumer.isSupportedSport(1));


            assert.equal(true, await consumer.isSportTwoPositionsSport(4));
            assert.equal(false, await consumer.isSportTwoPositionsSport(16));
            assert.equal(false, await consumer.isSportTwoPositionsSport(7));

            assert.equal(true, await consumer.isSupportedMarket("create"));
            assert.equal(true, await consumer.isSupportedMarket("resolve"));
            assert.equal(false, await consumer.isSupportedMarket("aaa"));

		});




    });
});
