'use strict';

const { artifacts, contract, web3 } = require('hardhat');

const { assert } = require('../../../utils/common');

const { currentTime, toUnit, bytesToString } = require('../../../utils')();

const { onlyGivenAddressCanInvoke, convertToDecimals, encodeCall, assertRevert } = require('../../../utils/helpers');

const { toBytes32 } = require('../../../../index');
const { setupAllContracts } = require('../../../utils/setup');
const { expect } = require('chai');
const ZERO_ADDRESS = '0x' + '0'.repeat(40);

const MockStandardBridgeL1 = artifacts.require('MockStandardBridgeL1');
let Thales = artifacts.require('Thales');
let OwnedUpgradeabilityProxy = artifacts.require('OwnedUpgradeabilityProxy');
let ProxyThalesExchanger = artifacts.require('ProxyThalesExchanger');
let OP_Thales_L1 = artifacts.require('contracts/Token/OpThales_L1.sol:OpThales');
let OP_Thales_L2 = artifacts.require('contracts/Token/OpThales_L2.sol:OpThales');



let StandardBridgeL1, OpThalesTokenL2;
let ThalesToken, OpThalesToken, ProxyExchanger, Proxy, ProxyImplementation

contract('Proxy Exhanger L1 <=> L2', async accounts => {
    const [proxyOwner, owner, userOne, userTwo] = accounts;
    let initializeData;
    before(async () => {
        StandardBridgeL1 = await MockStandardBridgeL1.new();
        ThalesToken = await Thales.new({from:owner});
        OpThalesToken = await OP_Thales_L1.new({from:owner});
        OpThalesTokenL2 = await OP_Thales_L2.new(
            StandardBridgeL1.address,
            OpThalesToken.address,
            "OpThales L2",
            "OpThalesL2",
            {from:owner}
            );
        Proxy =  await OwnedUpgradeabilityProxy.new({from:proxyOwner});
        ProxyImplementation = await ProxyThalesExchanger.new({from:owner});
        ProxyExchanger = await ProxyThalesExchanger.at(Proxy.address);
    
        initializeData = encodeCall('initialize', [
            'address',
            'address',
            'address',
            'address',
            'address'
        ],
        [
            owner, 
            ThalesToken.address,
            OpThalesToken.address,
            StandardBridgeL1.address,
            OpThalesTokenL2.address
        ]);
        

    });

    describe('owner', function () {
        it('has an owner', async function () {
          const _proxyOwner = await Proxy.proxyOwner()
          assert.equal(proxyOwner, _proxyOwner);
        })
      });

      describe('transferOwnership', function () {
        describe('when the new proposed owner is not the zero address', function () {
          const newOwner = userTwo
    
          describe('when the sender is the owner', function () {
            const from = proxyOwner
    
            it('transfers the ownership', async function () {
              await Proxy.transferProxyOwnership(newOwner, { from: proxyOwner })
    
              const _owner = await Proxy.proxyOwner()
              assert.equal(_owner, newOwner)
            })
    
            it('emits an event', async function () {
              const { logs } = await Proxy.transferProxyOwnership(proxyOwner, { from: newOwner });
    
              assert.equal(logs.length, 1);
              assert.equal(logs[0].event, 'ProxyOwnershipTransferred');
              assert.equal(logs[0].args.previousOwner, newOwner);
              assert.equal(logs[0].args.newOwner, proxyOwner);
            })
          });

          describe('when the sender is the token owner', function () {
    
            beforeEach(async () => await Proxy.upgradeToAndCall(ProxyImplementation.address, initializeData, { from: proxyOwner }))
            
            it('reverts', async function () {
                await expect(Proxy.transferProxyOwnership(newOwner, { from: owner })).to.be.revertedWith(
                    'Transaction reverted without a reason'
                );
            })
          })
    
          describe('when the sender is not the owner', function () {
            it('reverts', async function () {
                await expect(Proxy.transferProxyOwnership(newOwner, { from: userTwo })).to.be.revertedWith(
                    'Transaction reverted without a reason'
                );
            })
          });

        });
    
        
    
    });

});