// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface ITherundownConsumerWrapper {
    function callUpdateOddsForSpecificGame(address _marketAddress) external;

    function callUpdateOddsForSpecificPlayerProps(address _marketAddress) external;
}
