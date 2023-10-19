// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Inheritance
import "../../interfaces/IParlayMarketsAMM.sol";
import "../../interfaces/ISportPositionalMarket.sol";
import "../../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../../utils/proxy/solidity-0.8.0/ProxyPausable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

import "../../interfaces/ISportsAMMTiny.sol";
import "../../interfaces/IParlayPolicy.sol";

import "../../interfaces/ITherundownConsumer.sol";
import "../../interfaces/IGamesPlayerProps.sol";
import "../../interfaces/IGamesOddsObtainer.sol";
import "../../interfaces/ISportPositionalMarket.sol";

contract ParlayPolicy is Initializable, ProxyOwned, ProxyPausable {
    IParlayMarketsAMM public parlayMarketsAMM;
    ISportsAMMTiny public sportsAMM;
    address public consumer;
    mapping(uint => bool) public eligibleSportForSamePropsCombination;

    function initialize(address _owner, address _parlayMarketsAMM) external initializer {
        setOwner(_owner);
        parlayMarketsAMM = IParlayMarketsAMM(_parlayMarketsAMM);
        sportsAMM = ISportsAMMTiny(parlayMarketsAMM.sportsAmm());
        consumer = sportsAMM.theRundownConsumer();
    }

    function areEligiblePropsMarkets(
        address _childMarket1,
        address _childMarket2,
        uint _tag1
    ) external view returns (bool isEligible) {
        IGamesPlayerProps gamePlayerProps = IGamesPlayerProps(ITherundownConsumer(consumer).playerProps());
        if (
            eligibleSportForSamePropsCombination[_tag1] &&
            gamePlayerProps.optionIdPerChildMarket(_childMarket1) > 0 &&
            gamePlayerProps.optionIdPerChildMarket(_childMarket1) == gamePlayerProps.optionIdPerChildMarket(_childMarket2)
        ) {
            isEligible = true;
        }
    }

    function getSgpFeePerCombination(IParlayPolicy.SGPData memory params) external view returns (uint sgpFee) {
        sgpFee = parlayMarketsAMM.getSgpFeePerCombination(
            params.tag1,
            params.tag2_1,
            params.tag2_2,
            params.position1,
            params.position2
        );
    }

    function getMarketDefaultOdds(address _sportMarket, uint _position) external view returns (uint odd) {
        odd = sportsAMM.getMarketDefaultOdds(_sportMarket, false)[_position];
    }

    function getChildMarketTotalLine(address _sportMarket) external view returns (uint childTotalsLine) {
        if (ISportPositionalMarket(_sportMarket).isChild()) {
            childTotalsLine = ISportPositionalMarket(_sportMarket).parentMarket().optionsCount();
            if (childTotalsLine > 2) {
                childTotalsLine = uint(
                    IGamesOddsObtainer(ITherundownConsumer(consumer).oddsObtainer()).childMarketTotal(_sportMarket)
                );
            }
        }
    }

    function setEligibleSportForSamePropsCombination(uint _tag1, bool _eligible) external onlyOwner {
        eligibleSportForSamePropsCombination[_tag1] = _eligible;
        emit SetEligibleSportForSamePropsCombination(_tag1, _eligible);
    }

    function setParlayMarketsAMM(address _parlayMarketsAMM) external onlyOwner {
        parlayMarketsAMM = IParlayMarketsAMM(_parlayMarketsAMM);
        sportsAMM = ISportsAMMTiny(parlayMarketsAMM.sportsAmm());
        consumer = sportsAMM.theRundownConsumer();
        emit SetParlayMarketsAMM(_parlayMarketsAMM);
    }

    modifier onlyParlayAMM() {
        _onlyParlayAMM();
        _;
    }

    function _onlyParlayAMM() internal view {
        require(msg.sender == address(parlayMarketsAMM), "Not ParlayAMM");
    }

    event SetParlayMarketsAMM(address _parlayMarketsAMM);
    event SetEligibleSportForSamePropsCombination(uint _tag1, bool _eligible);
}
