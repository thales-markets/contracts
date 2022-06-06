// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IExoticPositionalMarket {
    /* ========== VIEWS / VARIABLES ========== */
    function isMarketCreated() external view returns (bool);
    function creatorAddress() external view returns (address);
    function resolverAddress() external view returns (address);
    function totalBondAmount() external view returns(uint);

    function marketQuestion() external view returns(string memory);
    function marketSource() external view returns(string memory);
    function positionPhrase(uint index) external view returns(string memory);

    function getTicketType() external view returns(uint);
    function positionCount() external view returns(uint);
    function endOfPositioning() external view returns(uint);
    function resolvedTime() external view returns(uint);
    function fixedTicketPrice() external view returns(uint);
    function creationTime() external view returns(uint);
    function winningPosition() external view returns(uint);
    function getTags() external view returns(uint[] memory);
    function getTotalPlacedAmount() external view returns(uint);
    function getTotalClaimableAmount() external view returns(uint);
    function getPlacedAmountPerPosition(uint index) external view returns(uint);
    function fixedBondAmount() external view returns(uint);
    function disputePrice() external view returns(uint);
    function safeBoxLowAmount() external view returns(uint);
    function arbitraryRewardForDisputor() external view returns(uint);
    function backstopTimeout() external view returns(uint);
    function disputeClosedTime() external view returns(uint);
    function totalUsersTakenPositions() external view returns(uint);
    
    function withdrawalAllowed() external view returns(bool);
    function disputed() external view returns(bool);
    function resolved() external view returns(bool);
    function canUsersPlacePosition() external view returns (bool);
    function canMarketBeResolvedByPDAO() external view returns(bool);
    function canMarketBeResolved() external view returns (bool);
    function canUsersClaim() external view returns (bool);
    function isMarketCancelled() external view returns (bool);
    function paused() external view returns (bool);
    function canCreatorCancelMarket() external view returns (bool);
    function getAllFees() external view returns (uint, uint, uint, uint);
    function canIssueFees() external view returns (bool);
    function noWinners() external view returns (bool);


    function transferBondToMarket(address _sender, uint _amount) external;
    function resolveMarket(uint _outcomePosition, address _resolverAddress) external;
    function cancelMarket() external;
    function resetMarket() external;
    function claimWinningTicketOnBehalf(address _user) external;
    function openDispute() external;
    function closeDispute() external;
    function setBackstopTimeout(uint _timeoutPeriod) external;


}
