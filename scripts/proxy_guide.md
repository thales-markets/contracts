# Proxy guide

Guide for Proxy contracts

## Overview

We are using Transparent Proxy pattern from the Upgradeability using Unstructured Storage.

Links:

Logic scheme:  
https://blog.openzeppelin.com/proxy-patterns/#:~:text=new%20state%20variables.-,Upgradeability%20using%20Unstructured%20Storage,-The%20Unstructured%20Storage

Trasparent characteristics:

https://docs.openzeppelin.com/upgrades-plugins/1.x/proxies#transparent-proxies-and-function-clashes

## How to deploy a Proxy Contract of an Implementation

1. Deploy a Proxy instance of `OwnedUpgradeabilityProxy` using *proxyOwner* deploy account
2. Deploy an instance of the Implementation contract `Implementation`. This contract is the logic contract where all the functions are contained (without a constructor).
3. Run the upgrade and call function from the Proxy instance. Example:
    
    `const tx_no_init = await OwnedUpgradeabilityProxy_instance.upgradeTo(Implementation_instance.address, {from: proxyOwner});`
    
    or

    `const tx_with_init = await OwnedUpgradeabilityProxy_instance.upgradeToAndCall(Implementation_instance.address, [initializeParameters], {from: proxyOwner});`

    where the `initializeParameters` are parameters passed to the `initialize` function of the `Implementation` instance. Note that in the intitialize parameters different address is added as the *owner* of the Implementation instance (different from *proxyOwner*). 

4. Then, running functions using the Proxy instance is by using the Implementation ABI with the Proxy instance address attached:

    ```
    const ProxyContract = await Implementation_ABI.connect(owner).attach(OwnedUpgradeabilityProxy_instance);
    const getInfo = ProxyContract.getInfo();    
    ```

    Note that `owner != proxyOwner`

For deployment examples check the deployment scripts used for `ProxyThalesExchanger`
[scripts/l1_l2_exchanger/deploy_proxy_exchanger_only](https://github.com/thales-markets/contracts/blob/main/scripts/l1_l2_exchanger/deploy_proxy_exchanger_only.js)

[test/Exchange_L1_L2/Proxy/ProxyExchange](https://github.com/thales-markets/contracts/blob/TD-176-feat-proxy-stalking-escrow/test/contracts/Exchange_L1_L2/Proxy/ProxyExchange.js)

### Automatized OpenZeppelin solution 

More automated and straight-forward solution is using the OpenZeppelin hardhat solution:

https://docs.openzeppelin.com/upgrades-plugins/1.x/hardhat-upgrades

NOTE: there might be an issue if in the `initialize` function of the `Implementation` contract there is a gas-consuming or function that calls external contract. The automated deployment of OpenZeppelin may brake during deployment. 


## How to upgrade a Proxy Contract with a new Implementation

1. Deploy an instance of the new `Implementation_V2`
2. Run `upgradeTo` in the Proxy instance of the `OwnedUpgradeabilityProxy`:

    `const upgradeToNew = await OwnedUpgradeabilityProxy_instance.upgradeTo(Implementation_V2_instance.address, {from: proxyOwner});`

3. The state from the old contract is perserved. Additionally the new functions added in the `Implementation_V2` can be called

    ```
    // getInfo will be the same
    const getInfo = ProxyContract.getInfo(); 

    // getAdditionalInfo is enabled only after upgrade. In previous implementation did not exist
    const getAdditionalInfo = ProxyContract.getAdditionalInfo()
    ```
## Important requirements

There are few important key requirements for Contracts to be upgradable in the Proxy patterns.

1. **Implementation contract is only the logic (the definition of functions and variables). The Proxy instance is where the variable states are stored (storage).**

    Hence with every new implementation, the state and the storage is not changed. Only additional variables can be append, but can not be deleted.

2. **Implementation contract can not have `constructor()` function**

3. **Implementation contract can not have variables pre-set, unless they are constants.**

4. **Implementation contract should not have *selfDestruct()* function**

5. **Order of variables declared in the new Implementation can not be changed**

6. **In the new implementation new variables can be only appended**

More regarding modification of Contracts to make them `upgradable`:

https://docs.openzeppelin.com/upgrades-plugins/1.x/writing-upgradeable

https://docs.openzeppelin.com/upgrades-plugins/1.x/api-hardhat-upgrades