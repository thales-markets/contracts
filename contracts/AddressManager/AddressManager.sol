// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// external
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

// internal
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../utils/proxy/solidity-0.8.0/ProxyPausable.sol";

import "../interfaces/IAddressManager.sol";

/// @title An address manager where all common addresses are stored
contract AddressManager is Initializable, ProxyOwned, ProxyPausable {
    address public safeBox;

    address public referrals;

    address public stakingThales;

    address public multiCollateralOnOffRamp;

    address public pyth;

    address public speedMarketsAMM;

    mapping(bytes32 => address) public addressBook;

    function initialize(
        address _owner,
        address _safeBox,
        address _referrals,
        address _stakingThales,
        address _multiCollateralOnOffRamp,
        address _pyth,
        address _speedMarketsAMM
    ) external initializer {
        setOwner(_owner);
        safeBox = _safeBox;
        referrals = _referrals;
        stakingThales = _stakingThales;
        multiCollateralOnOffRamp = _multiCollateralOnOffRamp;
        pyth = _pyth;
        speedMarketsAMM = _speedMarketsAMM;
    }

    //////////////////getters/////////////////

    /// @notice get all addresses
    function getAddresses() external view returns (IAddressManager.Addresses memory) {
        IAddressManager.Addresses memory allAddresses;

        allAddresses.safeBox = safeBox;
        allAddresses.referrals = referrals;
        allAddresses.stakingThales = stakingThales;
        allAddresses.multiCollateralOnOffRamp = multiCollateralOnOffRamp;
        allAddresses.pyth = pyth;
        allAddresses.speedMarketsAMM = speedMarketsAMM;

        return allAddresses;
    }

    function getContractFromAddressBook(bytes32 _contractName) external view returns (address contract_) {
        require(addressBook[_contractName] != address(0), "InvalidAddressForContractName");
        contract_ = addressBook[_contractName];
    }

    //////////////////setters/////////////////

    /// @notice set corresponding addresses
    function setAddresses(
        address _safeBox,
        address _referrals,
        address _stakingThales,
        address _multiCollateralOnOffRamp,
        address _pyth,
        address _speedMarketsAMM
    ) external onlyOwner {
        safeBox = _safeBox;
        referrals = _referrals;
        stakingThales = _stakingThales;
        multiCollateralOnOffRamp = _multiCollateralOnOffRamp;
        pyth = _pyth;
        speedMarketsAMM = _speedMarketsAMM;
        emit SetAddresses(_safeBox, _referrals, _stakingThales, _multiCollateralOnOffRamp, _pyth, _speedMarketsAMM);
    }

    /// @notice Set contract name and address in the address book
    /// @param _contractName name of the contract
    /// @param _address the address of the contract
    function setAddressInAddressBook(bytes32 _contractName, address _address) external onlyOwner {
        require(_address != address(0), "InvalidAddress");
        addressBook[_contractName] = _address;
        emit NewContractInAddressBook(_contractName, _address);
    }

    //////////////////events/////////////////

    event NewContractInAddressBook(bytes32 _contractName, address _address);
    event SetAddresses(
        address _safeBox,
        address _referrals,
        address _stakingThales,
        address _multiCollateralOnOffRamp,
        address _pyth,
        address _speedMarketsAMM
    );
}
