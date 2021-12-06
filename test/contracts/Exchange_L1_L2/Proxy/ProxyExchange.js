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
let ThalesToken, OpThalesToken, ProxyExchanger, Proxy, ProxyImplementation, ProxyImplementation2

contract('Proxy Exhanger L1 <=> L2', async accounts => {
    const [proxyOwner, owner, userOne, userTwo] = accounts;
    let initializeData;
    beforeEach(async () => {
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
        ProxyImplementation2 = await ProxyThalesExchanger.new({from:owner});
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
              const { logs } = await Proxy.transferProxyOwnership(newOwner, { from: proxyOwner });
    
              assert.equal(logs.length, 1);
              assert.equal(logs[0].event, 'ProxyOwnershipTransferred');
              assert.equal(logs[0].args.previousOwner, proxyOwner);
              assert.equal(logs[0].args.newOwner, newOwner);
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

    describe('implementation', function () {
      describe('when no initial implementation was provided', function () {
        it('zero address is returned', async function () {
          const implementation = await Proxy.implementation()
          assert.equal(implementation, ZERO_ADDRESS)
        })
      })
  
      describe('when an initial implementation was provided', function () {
        beforeEach(async () => await Proxy.upgradeTo(ProxyImplementation.address, { from: proxyOwner }));
  
        it('returns the given implementation', async function () {
          const implementation = await Proxy.implementation()
          assert.equal(implementation, ProxyImplementation.address);
        });
      });
    });
    
    describe('upgrade', function () {
      describe('when the new implementation is not the zero address', function () {
  
        describe('when the sender is the proxy owner', function () {
          const from = proxyOwner;
  
          describe('when no initial implementation was provided', function () {
            it('upgrades to the given implementation', async function () {
              await Proxy.upgradeTo(ProxyImplementation.address, { from: proxyOwner })
  
              const implementation = await Proxy.implementation();
              assert.equal(implementation, ProxyImplementation.address);
            })
          })
  
          describe('when an initial implementation was provided', function () {
            beforeEach(async () => await Proxy.upgradeTo(ProxyImplementation.address, { from: proxyOwner }))
  
            describe('when the given implementation is equal to the current one', function () {
              it('reverts', async function () {
                await expect(Proxy.upgradeTo(ProxyImplementation.address, { from: proxyOwner })).to.be.revertedWith(
                  'Transaction reverted without a reason'
                );
              })
            })
  
            describe('when the given implementation is different than the current one', function () {
              it('upgrades to the new implementation', async function () {
                await Proxy.upgradeTo(ProxyImplementation2.address, { from: proxyOwner })
  
                const implementation = await Proxy.implementation();
                assert.equal(implementation, ProxyImplementation2.address);
              })
            })
          })
        })
  
        describe('when the sender is not the proxy owner', function () {
          
          it('reverts', async function () {
            await expect(Proxy.upgradeTo(ProxyImplementation2.address, { from:userTwo })).to.be.revertedWith(
              'Transaction reverted without a reason'
            );
          })
        })
      })
  
      describe('when the new implementation is the zero address', function () {
        it('reverts', async function () {
          await expect(Proxy.upgradeTo(0x0, { from: proxyOwner })).to.be.reverted;
        })
      })
    });

    describe('upgrade and call', function () {

      describe('when the new implementation is not the zero address', function () {
  
        describe('when the sender is the proxy owner', function () {
            
          it('upgrades to the given implementation', async function () {
            await Proxy.upgradeToAndCall(ProxyImplementation.address, initializeData, { from:proxyOwner })
  
            const implementation = await Proxy.implementation();
            assert.equal(implementation, ProxyImplementation.address);
          })
  
          it('calls the implementation using the given data as msg.data', async function () {
            await Proxy.upgradeToAndCall(ProxyImplementation.address, initializeData, { from:proxyOwner })
            
            const impl_owner = await ProxyExchanger.owner();
            assert.equal(impl_owner, owner);
            
            let isEnabled = await ProxyExchanger.enabledThalesToOpThales();
            assert.equal(isEnabled, true);

            await expect(ProxyExchanger.setEnabledThalesToOpThales(false, { from: userTwo })).to.be.reverted;
            await ProxyExchanger.setEnabledThalesToOpThales(false, { from: owner });
  
            isEnabled = await ProxyExchanger.enabledThalesToOpThales();
            assert.equal(isEnabled, false);
          })
        })
  
        describe('when the sender is not the proxy owner', function () {
            
          it('reverts', async function () {
            await expect(Proxy.upgradeToAndCall(ProxyImplementation.address, initializeData, { from:userTwo })).to.be.reverted;
          })
        })
      })
  
      describe('when the new implementation is the zero address', function () {
        it('reverts', async function () {
          await expect(Proxy.upgradeToAndCall(0x0, initializeData, { from: proxyOwner })).to.be.reverted;
        })
      })
    });


    describe('delegatecall', function () {
      describe('when no implementation was given', function () {
        it('reverts', async function () {
          await expect(ProxyExchanger.enabledThalesToOpThales()).to.be.reverted;
        })
      })
  
      describe('when an initial implementation was given', function () {
        
        beforeEach(async () => await Proxy.upgradeToAndCall(ProxyImplementation.address, initializeData, { from: proxyOwner }))
  
        describe('when there were no further upgrades', function () {
  
          it('delegates calls to the initial implementation', async function() {
            let isEnabled = await ProxyExchanger.enabledThalesToOpThales();
            assert.equal(isEnabled, true);
            // console.log("isEnabled:", isEnabled);
            await expect(ProxyExchanger.setEnabledThalesToOpThales(false, { from: userTwo })).to.be.reverted;
            await ProxyExchanger.setEnabledThalesToOpThales(false, { from: owner });
            
            isEnabled = await ProxyExchanger.enabledThalesToOpThales();
            assert.equal(isEnabled, false);
            // console.log("isEnabled:", isEnabled);
          })
  
          it('fails after setting false', async function () {
            await ProxyExchanger.setEnabledThalesToOpThales(false, { from: owner });
  
            await expect(ProxyExchanger.exchangeThalesToL2OpThales(20, { from: userTwo })).to.be.revertedWith(
              'Exchanging disabled'
              );
          })
        })
  
        describe('when there was another upgrade, initial settings perserved', function () {
          beforeEach(async () => {
            await ProxyExchanger.setEnabledThalesToOpThales(false, { from: owner });
            
          })
  
          it('set false before upgrade, delegates calls to the last upgraded implementation, setting false perserved', async function() {
            let isEnabled = await ProxyExchanger.enabledThalesToOpThales();
            assert.equal(isEnabled, false);
            assert.notEqual(ProxyImplementation2.address, ProxyImplementation.address);
            await Proxy.upgradeTo(ProxyImplementation2.address, { from: proxyOwner });
            isEnabled = await ProxyExchanger.enabledThalesToOpThales();
            // console.log("isEnabled:", isEnabled);
            assert.equal(isEnabled, false);
          });
        });
      
      });
    });

});