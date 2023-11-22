pragma solidity ^0.8.0;

// Inheritance
import "../../utils/proxy/solidity-0.8.0/ProxyOwned.sol";

// Internal references
import "./SportPosition.sol";
import "./SportPositionalMarket.sol";
import "./SportPositionalMarketFactory.sol";
import "@openzeppelin/contracts-4.4.1/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-4.4.1/proxy/Clones.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract SportPositionalMarketFactory is Initializable, ProxyOwned {
    /* ========== STATE VARIABLES ========== */
    address public positionalMarketManager;

    address public positionalMarketMastercopy;
    address public positionMastercopy;

    address public sportsAMM;

    struct SportPositionCreationMarketParameters {
        address creator;
        IERC20 _sUSD;
        bytes32 gameId;
        string gameLabel;
        uint[2] times; // [maturity, expiry]
        uint initialMint;
        uint positionCount;
        address theRundownConsumer;
        uint[] tags;
        bool isChild;
        address parentMarket;
        bool isDoubleChance;
    }

    /* ========== INITIALIZER ========== */

    function initialize(address _owner) external initializer {
        setOwner(_owner);
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    function createMarket(SportPositionCreationMarketParameters calldata _parameters)
        external
        returns (SportPositionalMarket)
    {
        require(positionalMarketManager == msg.sender, "Only permitted by the manager.");

        SportPositionalMarket pom = SportPositionalMarket(Clones.clone(positionalMarketMastercopy));
        address[] memory positions = new address[](_parameters.positionCount);

        pom.initialize(
            SportPositionalMarket.SportPositionalMarketParameters(
                positionalMarketManager,
                _parameters._sUSD,
                _parameters.creator,
                _parameters.gameId,
                _parameters.gameLabel,
                _parameters.times,
                _parameters.initialMint,
                _parameters.theRundownConsumer,
                sportsAMM,
                _parameters.positionCount,
                positions,
                _parameters.tags,
                _parameters.isChild,
                _parameters.parentMarket,
                _parameters.isDoubleChance,
                positionMastercopy
            )
        );
        emit MarketCreated(
            address(pom),
            _parameters.gameId,
            _parameters.gameLabel,
            _parameters.times[0],
            _parameters.times[1],
            _parameters.initialMint,
            _parameters.positionCount,
            _parameters.tags,
            _parameters.isChild,
            _parameters.parentMarket
        );
        return pom;
    }

    /* ========== SETTERS ========== */
    function setSportPositionalMarketManager(address _positionalMarketManager) external onlyOwner {
        positionalMarketManager = _positionalMarketManager;
        emit SportPositionalMarketManagerChanged(_positionalMarketManager);
    }

    function setSportPositionalMarketMastercopy(address _positionalMarketMastercopy) external onlyOwner {
        positionalMarketMastercopy = _positionalMarketMastercopy;
        emit SportPositionalMarketMastercopyChanged(_positionalMarketMastercopy);
    }

    function setSportPositionMastercopy(address _positionMastercopy) external onlyOwner {
        positionMastercopy = _positionMastercopy;
        emit SportPositionMastercopyChanged(_positionMastercopy);
    }

    function setSportsAMM(address _sportsAMM) external onlyOwner {
        sportsAMM = _sportsAMM;
        emit SetSportsAMM(_sportsAMM);
    }

    event SportPositionalMarketManagerChanged(address _positionalMarketManager);
    event SportPositionalMarketMastercopyChanged(address _positionalMarketMastercopy);
    event SportPositionMastercopyChanged(address _positionMastercopy);
    event SetSportsAMM(address _sportsAMM);
    event SetLimitOrderProvider(address _limitOrderProvider);
    event MarketCreated(
        address market,
        bytes32 indexed gameId,
        string gameLabel,
        uint maturityDate,
        uint expiryDate,
        uint initialMint,
        uint positionCount,
        uint[] tags,
        bool isChild,
        address parent
    );
}
