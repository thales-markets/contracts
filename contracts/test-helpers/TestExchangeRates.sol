// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;

import "synthetix-2.50.4-ovm/contracts/ExchangeRates.sol";
import "synthetix-2.50.4-ovm/contracts/SystemSettings.sol";
import "synthetix-2.50.4-ovm/contracts/FlexibleStorage.sol";
import "synthetix-2.50.4-ovm/contracts/ExchangeState.sol";
import "synthetix-2.50.4-ovm/contracts/SystemStatus.sol";
import "synthetix-2.50.4-ovm/contracts/Exchanger.sol";
import "synthetix-2.50.4-ovm/contracts/TokenState.sol";
import "synthetix-2.50.4-ovm/contracts/test-helpers/MockSynth.sol";
import "synthetix-2.50.4-ovm/contracts/test-helpers/GenericMock.sol";
import "synthetix-2.50.4-ovm/contracts/SystemStatus.sol";

contract TestExchangeRates is ExchangeRates {}
