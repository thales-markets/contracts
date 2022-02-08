pragma solidity ^0.8.0;

import "@openzeppelin/contracts-4.4.1/access/Ownable.sol";
import "@openzeppelin/contracts-4.4.1/utils/math/SafeMath.sol";
import "@openzeppelin/upgrades-core/contracts/Initializable.sol";

contract ExoticPositionalMarket is Ownable {
    using SafeMath for uint;

    struct Position {
        bytes32 phrase;
        uint position;
    }

    bool private _initialized;

    bytes32 public marketQuestion;
    Position[] public position;
    uint public endOfPositioning;
    uint public marketMaturityDate;
    uint public fixedTicketPrice;
    bool public withdrawalAllowed;
    uint public withdrawalFee;
    uint public tag;


    function initializeWithTwoParameters(
        bytes32 marketQuestion, 
        bytes32 phrase1,
        bytes32 phrase2,
        uint endOfPositioning,
        uint marketMaturityDate,
        uint fixedTicketPrice,
        uint withdrawalFee,
        uint defaultPosition,
        uint tag
    ) external initializer {
        _initializeWithTwoParameters(
            marketQuestion, 
            phrase1,
            phrase2,
            endOfPositioning,
            marketMaturityDate,
            fixedTicketPrice,
            withdrawalFee,
            defaultPosition,
            tag
        );
    }

    function initializeWithThreeParameters(
        bytes32 marketQuestion, 
        bytes32 phrase1,
        bytes32 phrase2,
        bytes32 phrase3,
        uint endOfPositioning,
        uint marketMaturityDate,
        uint fixedTicketPrice,
        uint withdrawalFee,
        uint defaultPosition,
        uint tag
    ) external initializer {
        _initializeWithTwoParameters(
            marketQuestion, 
            phrase1,
            phrase2,
            endOfPositioning,
            marketMaturityDate,
            fixedTicketPrice,
            withdrawalFee,
            defaultPosition,
            tag
        );
    }

    function initializeWithFourParameters(
        bytes32 marketQuestion, 
        bytes32 phrase1,
        bytes32 phrase2,
        bytes32 phrase3,
        bytes32 phrase4,
        uint endOfPositioning,
        uint marketMaturityDate,
        uint fixedTicketPrice,
        uint withdrawalFee,
        uint defaultPosition,
        uint tag
    ) external initializer {
        _initializeWithTwoParameters(
            marketQuestion, 
            phrase1,
            phrase2,
            endOfPositioning,
            marketMaturityDate,
            fixedTicketPrice,
            withdrawalFee,
            defaultPosition,
            tag
        );
    }

    function initializeWithFiveParameters(
        bytes32 marketQuestion, 
        bytes32 phrase1,
        bytes32 phrase2,
        bytes32 phrase3,
        bytes32 phrase4,
        bytes32 phrase5,
        uint endOfPositioning,
        uint marketMaturityDate,
        uint fixedTicketPrice,
        uint withdrawalFee,
        uint defaultPosition,
        uint tag
    ) external initializer {
        _initializeWithTwoParameters(
            marketQuestion, 
            phrase1,
            phrase2,
            endOfPositioning,
            marketMaturityDate,
            fixedTicketPrice,
            withdrawalFee,
            defaultPosition,
            tag
        );
    }

    
    
    function _initializeWithTwoParameters(
        bytes32 marketQuestion, 
        bytes32 phrase1,
        bytes32 phrase2,
        uint endOfPositioning,
        uint marketMaturityDate,
        uint fixedTicketPrice,
        uint withdrawalFee,
        uint defaultPosition,
        uint tag
    ) internal {

    }
 
}