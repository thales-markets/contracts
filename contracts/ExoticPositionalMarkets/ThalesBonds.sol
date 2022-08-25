// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

// external
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

// internal
import "../utils/proxy/solidity-0.8.0/ProxyReentrancyGuard.sol";
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../interfaces/IExoticPositionalMarketManager.sol";
import "../interfaces/IExoticPositionalMarket.sol";
import "../interfaces/IStakingThales.sol";
import "../interfaces/ICurveSUSD.sol";

contract ThalesBonds is Initializable, ProxyOwned, PausableUpgradeable, ProxyReentrancyGuard {
    using SafeMathUpgradeable for uint;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    IExoticPositionalMarketManager public marketManager;
    struct MarketBond {
        uint totalDepositedMarketBond;
        uint totalMarketBond;
        uint creatorBond;
        uint resolverBond;
        uint disputorsTotalBond;
        uint disputorsCount;
        mapping(address => uint) disputorBond;
    }

    mapping(address => MarketBond) public marketBond;
    mapping(address => uint) public marketFunds;

    uint private constant MAX_APPROVAL = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
    uint private constant ONE = 1e18;
    uint private constant ONE_PERCENT = 1e16;

    bool public curveOnrampEnabled;
    ICurveSUSD public curveSUSD;
    address public usdc;
    address public usdt;
    address public dai;

    uint private constant CREATOR_BOND = 101;
    uint private constant RESOLVER_BOND = 102;
    uint private constant DISPUTOR_BOND = 103;
    uint private constant CREATOR_AND_DISPUTOR = 104;
    uint private constant RESOLVER_AND_DISPUTOR = 105;

    IStakingThales public stakingThales;

    function initialize(address _owner) public initializer {
        setOwner(_owner);
        initNonReentrant();
    }

    function getTotalDepositedBondAmountForMarket(address _market) external view returns (uint) {
        return marketBond[_market].totalDepositedMarketBond;
    }

    function getClaimedBondAmountForMarket(address _market) external view returns (uint) {
        return marketBond[_market].totalDepositedMarketBond.sub(marketBond[_market].totalMarketBond);
    }

    function getClaimableBondAmountForMarket(address _market) external view returns (uint) {
        return marketBond[_market].totalMarketBond;
    }

    function getDisputorBondForMarket(address _market, address _disputorAddress) external view returns (uint) {
        return marketBond[_market].disputorBond[_disputorAddress];
    }

    function getCreatorBondForMarket(address _market) external view returns (uint) {
        return marketBond[_market].creatorBond;
    }

    function getResolverBondForMarket(address _market) external view returns (uint) {
        return marketBond[_market].resolverBond;
    }

    // different deposit functions to flag the bond amount : creator
    function sendCreatorBondToMarket(
        address _market,
        address _creatorAddress,
        uint _amount
    ) external onlyOracleCouncilManagerAndOwner nonReentrant {
        require(_amount > 0, "Bond zero");
        // no checks for active market, market creation not finalized
        marketBond[_market].creatorBond = _amount;
        marketBond[_market].totalMarketBond = marketBond[_market].totalMarketBond.add(_amount);
        marketBond[_market].totalDepositedMarketBond = marketBond[_market].totalDepositedMarketBond.add(_amount);
        transferToMarketBond(_creatorAddress, _amount);
        emit CreatorBondSent(_market, _creatorAddress, _amount);
    }

    // different deposit functions to flag the bond amount : resolver
    function sendResolverBondToMarket(
        address _market,
        address _resolverAddress,
        uint _amount
    ) external onlyOracleCouncilManagerAndOwner nonReentrant {
        require(_amount > 0, "Bond zero");
        require(marketManager.isActiveMarket(_market), "Invalid address");
        // in case the creator is the resolver, move the bond to the resolver
        marketBond[_market].resolverBond = _amount;
        marketBond[_market].totalMarketBond = marketBond[_market].totalMarketBond.add(_amount);
        marketBond[_market].totalDepositedMarketBond = marketBond[_market].totalDepositedMarketBond.add(_amount);
        transferToMarketBond(_resolverAddress, _amount);
        emit ResolverBondSent(_market, _resolverAddress, _amount);
    }

    // different deposit functions to flag the bond amount : disputor
    function sendDisputorBondToMarket(
        address _market,
        address _disputorAddress,
        uint _amount
    ) external onlyOracleCouncilManagerAndOwner nonReentrant {
        require(_amount > 0, "Bond zero");
        require(marketManager.isActiveMarket(_market), "Invalid address");

        // if it is first dispute for the disputor, the counter is increased
        if (marketBond[_market].disputorBond[_disputorAddress] == 0) {
            marketBond[_market].disputorsCount = marketBond[_market].disputorsCount.add(1);
        }
        marketBond[_market].disputorBond[_disputorAddress] = marketBond[_market].disputorBond[_disputorAddress].add(_amount);
        marketBond[_market].disputorsTotalBond = marketBond[_market].disputorsTotalBond.add(_amount);
        marketBond[_market].totalMarketBond = marketBond[_market].totalMarketBond.add(_amount);
        marketBond[_market].totalDepositedMarketBond = marketBond[_market].totalDepositedMarketBond.add(_amount);
        transferToMarketBond(_disputorAddress, _amount);
        emit DisputorBondSent(_market, _disputorAddress, _amount);
    }

    // universal claiming amount function to adapt for different scenarios, e.g. SafeBox
    function sendBondFromMarketToUser(
        address _market,
        address _account,
        uint _amount,
        uint _bondToReduce,
        address _disputorAddress
    ) external onlyOracleCouncilManagerAndOwner nonReentrant {
        require(marketManager.isActiveMarket(_market), "Invalid address");
        require(_amount <= marketBond[_market].totalMarketBond, "Exceeds bond");
        require(_bondToReduce >= CREATOR_BOND && _bondToReduce <= RESOLVER_AND_DISPUTOR, "Invalid bondToReduce");
        if (_bondToReduce == CREATOR_BOND && _amount <= marketBond[_market].creatorBond) {
            marketBond[_market].creatorBond = marketBond[_market].creatorBond.sub(_amount);
        } else if (_bondToReduce == RESOLVER_BOND && _amount <= marketBond[_market].resolverBond) {
            marketBond[_market].resolverBond = marketBond[_market].resolverBond.sub(_amount);
        } else if (
            _bondToReduce == DISPUTOR_BOND &&
            marketBond[_market].disputorBond[_disputorAddress] >= 0 &&
            _amount <= IExoticPositionalMarket(_market).disputePrice()
        ) {
            marketBond[_market].disputorBond[_disputorAddress] = marketBond[_market].disputorBond[_disputorAddress].sub(
                _amount
            );
            marketBond[_market].disputorsTotalBond = marketBond[_market].disputorsTotalBond.sub(_amount);
            marketBond[_market].disputorsCount = marketBond[_market].disputorBond[_disputorAddress] > 0
                ? marketBond[_market].disputorsCount
                : marketBond[_market].disputorsCount.sub(1);
        } else if (
            _bondToReduce == CREATOR_AND_DISPUTOR &&
            _amount <= marketBond[_market].creatorBond.add(IExoticPositionalMarket(_market).disputePrice()) &&
            _amount > marketBond[_market].creatorBond
        ) {
            marketBond[_market].disputorBond[_disputorAddress] = marketBond[_market].disputorBond[_disputorAddress].sub(
                _amount.sub(marketBond[_market].creatorBond)
            );
            marketBond[_market].disputorsTotalBond = marketBond[_market].disputorsTotalBond.sub(
                _amount.sub(marketBond[_market].creatorBond)
            );
            marketBond[_market].creatorBond = 0;
            marketBond[_market].disputorsCount = marketBond[_market].disputorBond[_disputorAddress] > 0
                ? marketBond[_market].disputorsCount
                : marketBond[_market].disputorsCount.sub(1);
        } else if (
            _bondToReduce == RESOLVER_AND_DISPUTOR &&
            _amount <= marketBond[_market].resolverBond.add(IExoticPositionalMarket(_market).disputePrice()) &&
            _amount > marketBond[_market].resolverBond
        ) {
            marketBond[_market].disputorBond[_disputorAddress] = marketBond[_market].disputorBond[_disputorAddress].sub(
                _amount.sub(marketBond[_market].resolverBond)
            );
            marketBond[_market].disputorsTotalBond = marketBond[_market].disputorsTotalBond.sub(
                _amount.sub(marketBond[_market].resolverBond)
            );
            marketBond[_market].resolverBond = 0;
            marketBond[_market].disputorsCount = marketBond[_market].disputorBond[_disputorAddress] > 0
                ? marketBond[_market].disputorsCount
                : marketBond[_market].disputorsCount.sub(1);
        }
        marketBond[_market].totalMarketBond = marketBond[_market].totalMarketBond.sub(_amount);
        transferBondFromMarket(_account, _amount);
        emit BondTransferredFromMarketBondToUser(_market, _account, _amount);
    }

    function sendOpenDisputeBondFromMarketToDisputor(
        address _market,
        address _account,
        uint _amount
    ) external onlyOracleCouncilManagerAndOwner nonReentrant {
        require(marketManager.isActiveMarket(_market), "Invalid address");
        require(
            _amount <= marketBond[_market].totalMarketBond && _amount <= marketBond[_market].disputorsTotalBond,
            "Exceeds bond"
        );
        require(
            marketBond[_market].disputorsCount > 0 && marketBond[_market].disputorBond[_account] >= _amount,
            "Already claimed"
        );
        marketBond[_market].totalMarketBond = marketBond[_market].totalMarketBond.sub(_amount);
        marketBond[_market].disputorBond[_account] = marketBond[_market].disputorBond[_account].sub(_amount);
        marketBond[_market].disputorsTotalBond = marketBond[_market].disputorsTotalBond.sub(_amount);
        marketBond[_market].disputorsCount = marketBond[_market].disputorBond[_account] > 0
            ? marketBond[_market].disputorsCount
            : marketBond[_market].disputorsCount.sub(1);
        transferBondFromMarket(_account, _amount);
        emit BondTransferredFromMarketBondToUser(_market, _account, _amount);
    }

    function issueBondsBackToCreatorAndResolver(address _market) external onlyOracleCouncilManagerAndOwner nonReentrant {
        require(marketManager.isActiveMarket(_market), "Invalid address");
        uint totalIssuedBack;
        if (marketBond[_market].totalMarketBond >= marketBond[_market].creatorBond.add(marketBond[_market].resolverBond)) {
            marketBond[_market].totalMarketBond = marketBond[_market].totalMarketBond.sub(
                marketBond[_market].creatorBond.add(marketBond[_market].resolverBond)
            );
            if (
                marketManager.creatorAddress(_market) != marketManager.resolverAddress(_market) &&
                marketBond[_market].creatorBond > 0
            ) {
                totalIssuedBack = marketBond[_market].creatorBond;
                marketBond[_market].creatorBond = 0;
                transferBondFromMarket(marketManager.creatorAddress(_market), totalIssuedBack);
                emit BondTransferredFromMarketBondToUser(_market, marketManager.creatorAddress(_market), totalIssuedBack);
            }
            if (marketBond[_market].resolverBond > 0) {
                totalIssuedBack = marketBond[_market].resolverBond;
                marketBond[_market].resolverBond = 0;
                transferBondFromMarket(marketManager.resolverAddress(_market), totalIssuedBack);
                emit BondTransferredFromMarketBondToUser(_market, marketManager.resolverAddress(_market), totalIssuedBack);
            }
        }
    }

    function transferCreatorToResolverBonds(address _market) external onlyOracleCouncilManagerAndOwner nonReentrant {
        require(marketManager.isActiveMarket(_market), "Invalid address");
        require(marketBond[_market].creatorBond > 0, "Creator bond 0");
        marketBond[_market].resolverBond = marketBond[_market].creatorBond;
        marketBond[_market].creatorBond = 0;
        emit BondTransferredFromCreatorToResolver(_market, marketBond[_market].resolverBond);
    }

    function transferToMarket(address _account, uint _amount) external whenNotPaused {
        require(marketManager.isActiveMarket(msg.sender), "Not active market.");
        marketFunds[msg.sender] = marketFunds[msg.sender].add(_amount);
        if (address(stakingThales) != address(0)) {
            stakingThales.updateVolume(_account, _amount);
        }
        transferToMarketBond(_account, _amount);
    }

    function transferToMarket(
        address _account,
        uint _amount,
        address collateral,
        uint expectedPayout,
        uint additionalSlippage
    ) external whenNotPaused {
        require(marketManager.isActiveMarket(msg.sender), "Not active market.");
        marketFunds[msg.sender] = marketFunds[msg.sender].add(_amount);
        if (address(stakingThales) != address(0)) {
            stakingThales.updateVolume(_account, _amount);
        }

        if (collateral == marketManager.paymentToken()) {
            transferToMarketBond(_account, _amount);
        } else {
            int128 curveIndex = _mapCollateralToCurveIndex(collateral);
            require(curveIndex > 0 && curveOnrampEnabled, "unsupported collateral");

            uint collateralQuote = getCurveQuoteForDifferentCollateral(_amount, collateral, true);
            require(collateralQuote.mul(ONE).div(expectedPayout) <= ONE.add(additionalSlippage), "Slippage too high!");
            require(IERC20Upgradeable(collateral).balanceOf(_account) >= collateralQuote, "Sender balance low");
            require(
                IERC20Upgradeable(collateral).allowance(_account, marketManager.thalesBonds()) >= collateralQuote,
                "No allowance."
            );

            IERC20Upgradeable collateralToken = IERC20Upgradeable(collateral);
            collateralToken.safeTransferFrom(_account, address(this), collateralQuote);
            curveSUSD.exchange_underlying(curveIndex, 0, collateralQuote, _amount);
        }
    }

    function transferFromMarket(address _account, uint _amount) external whenNotPaused {
        require(marketManager.isActiveMarket(msg.sender), "Not active market.");
        require(marketFunds[msg.sender] >= _amount, "Low funds.");
        marketFunds[msg.sender] = marketFunds[msg.sender].sub(_amount);

        transferBondFromMarket(_account, _amount);
    }

    function transferToMarketBond(address _account, uint _amount) internal whenNotPaused {
        IERC20Upgradeable(marketManager.paymentToken()).safeTransferFrom(_account, address(this), _amount);
    }

    function transferBondFromMarket(address _account, uint _amount) internal whenNotPaused {
        IERC20Upgradeable(marketManager.paymentToken()).safeTransfer(_account, _amount);
    }

    function setMarketManager(address _managerAddress) external onlyOwner {
        require(_managerAddress != address(0), "Invalid OC");
        marketManager = IExoticPositionalMarketManager(_managerAddress);
        emit NewManagerAddress(_managerAddress);
    }

    function setStakingThalesContract(address _stakingThales) external onlyOwner {
        require(_stakingThales != address(0), "Invalid address");
        stakingThales = IStakingThales(_stakingThales);
        emit NewStakingThalesAddress(_stakingThales);
    }

    modifier onlyOracleCouncilManagerAndOwner() {
        require(
            msg.sender == marketManager.oracleCouncilAddress() ||
                msg.sender == address(marketManager) ||
                msg.sender == owner,
            "Not OC/Manager/Owner"
        );
        require(address(marketManager) != address(0), "Invalid Manager");
        require(marketManager.oracleCouncilAddress() != address(0), "Invalid OC");
        _;
    }

    /// @notice Updates contract parametars
    /// @param _curveSUSD curve sUSD pool exchanger contract
    /// @param _dai DAI address
    /// @param _usdc USDC address
    /// @param _usdt USDT addresss
    /// @param _curveOnrampEnabled whether AMM supports curve onramp
    function setCurveSUSD(
        address _curveSUSD,
        address _dai,
        address _usdc,
        address _usdt,
        bool _curveOnrampEnabled
    ) external onlyOwner {
        curveSUSD = ICurveSUSD(_curveSUSD);
        dai = _dai;
        usdc = _usdc;
        usdt = _usdt;

        IERC20Upgradeable(dai).approve(_curveSUSD, MAX_APPROVAL);
        IERC20Upgradeable(usdc).approve(_curveSUSD, MAX_APPROVAL);
        IERC20Upgradeable(usdt).approve(_curveSUSD, MAX_APPROVAL);
        IERC20Upgradeable(marketManager.paymentToken()).approve(_curveSUSD, MAX_APPROVAL);

        curveOnrampEnabled = _curveOnrampEnabled;
    }

    function _mapCollateralToCurveIndex(address collateral) internal view returns (int128) {
        if (collateral == dai) {
            return 1;
        }
        if (collateral == usdc) {
            return 2;
        }
        if (collateral == usdt) {
            return 3;
        }
        return 0;
    }

    /// @notice get a quote in the collateral of choice (USDC, USDT or DAI) on how much the trader would need to pay to get sUSD
    /// @param amount number of positions to buy with 18 decimals
    /// @param collateral USDT, USDC or DAI address
    /// @param toSUSD flag that determines should we get a quote for swapping to sUSD or from sUSD
    /// @return collateralQuote quote in collateral on how much the trader would need to pay to get sUSD
    function getCurveQuoteForDifferentCollateral(
        uint amount,
        address collateral,
        bool toSUSD
    ) public view returns (uint collateralQuote) {
        int128 curveIndex = _mapCollateralToCurveIndex(collateral);
        if (curveIndex == 0 || !curveOnrampEnabled) {
            return (0);
        }

        if (toSUSD) {
            //cant get a quote on how much collateral is needed from curve for sUSD,
            //so rather get how much of collateral you get for the sUSD quote and add 0.2% to that
            collateralQuote = curveSUSD.get_dy_underlying(0, curveIndex, amount).mul(ONE.add(ONE_PERCENT.div(5))).div(ONE);
        } else {
            // decreasing the amount by 0.1% due to possible slippage
            collateralQuote = curveSUSD.get_dy_underlying(0, curveIndex, amount).mul(ONE.sub(ONE_PERCENT.div(10))).div(ONE);
        }
    }

    event CreatorBondSent(address market, address creator, uint amount);
    event ResolverBondSent(address market, address resolver, uint amount);
    event DisputorBondSent(address market, address disputor, uint amount);
    event BondTransferredFromMarketBondToUser(address market, address account, uint amount);
    event NewOracleCouncilAddress(address oracleCouncil);
    event NewManagerAddress(address managerAddress);
    event BondTransferredFromCreatorToResolver(address market, uint amount);
    event NewStakingThalesAddress(address stakingThales);
}
