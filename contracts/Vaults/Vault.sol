// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-4.4.1/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";

import "../utils/proxy/solidity-0.8.0/ProxyReentrancyGuard.sol";
import "../utils/proxy/solidity-0.8.0/ProxyOwned.sol";

import "../interfaces/IThalesAMM.sol";
import "../interfaces/IPositionalMarket.sol";

contract Vault is Initializable, ProxyOwned, PausableUpgradeable, ProxyReentrancyGuard {
    using SafeERC20 for IERC20;

    uint private constant HUNDRED = 1e20;
    uint public round;
    uint public roundLength;
    mapping(uint => uint) public roundStartTime;
    mapping(uint => uint) public roundEndTime;
    bool public roundStarted;

    IThalesAMM public thalesAMM;
    IERC20 public sUSD;

    enum Asset {
        ETH,
        BTC,
        Other
    }

    mapping(uint => mapping(address => uint)) public balancesPerRound;

    mapping(uint => address[]) public usersPerRound;

    mapping(uint => uint) public allocationPerRound;

    mapping(Asset => uint) public allocationLimits;
    mapping(uint => mapping(Asset => uint)) public allocationSpentPerRound;

    uint public priceLowerLimit;
    uint public priceUpperLimit;
    uint public skewImpactLimit;

    mapping(uint => address[]) public tradingMarketsPerRound;
    mapping(uint => mapping(address => bool)) public isTradingMarketInARound;

    mapping(uint => uint) public profitAndLossPerRound;
    mapping(uint => mapping(address => bool)) public claimedPerRound;

    function initialize(
        address _owner,
        IThalesAMM _thalesAmm,
        IERC20 _sUSD,
        uint _roundLength,
        uint _priceLowerLimit,
        uint _priceUpperLimit,
        uint _skewImpactLimit,
        uint _allocationLimitBTC,
        uint _allocationLimitETH,
        uint _allocationLimitOtherAssets
    ) external initializer {
        setOwner(_owner);
        initNonReentrant();
        thalesAMM = IThalesAMM(_thalesAmm);
        sUSD = _sUSD;
        roundLength = _roundLength;
        priceLowerLimit = _priceLowerLimit;
        priceUpperLimit = _priceUpperLimit;
        skewImpactLimit = _skewImpactLimit;
        allocationLimits[Asset.ETH] = _allocationLimitETH;
        allocationLimits[Asset.BTC] = _allocationLimitBTC;
        allocationLimits[Asset.Other] = _allocationLimitOtherAssets;

        round = 1;
    }

    function startRound() external onlyOwner {
        require(!roundStarted, "Round has already started");

        roundStartTime[round] = block.timestamp;
        roundEndTime[round] = roundStartTime[round] + roundLength;
        roundStarted = true;

        // include unclaimed amounts in next round allocation
        allocationPerRound[round] = sUSD.balanceOf(address(this));

        emit RoundStarted(round);
    }

    function closeRound() external onlyOwner {
        require(block.timestamp > (roundStartTime[round] + roundLength), "Can't close round yet");
        roundStarted = false;

        for (uint i = 0; i < tradingMarketsPerRound[round].length; i++) {
            IPositionalMarket(tradingMarketsPerRound[round][i]).exerciseOptions();
        }

        uint currentVaultBalance = sUSD.balanceOf(address(this));
        // calculate PnL
        profitAndLossPerRound[round] = (currentVaultBalance * 1e18) / allocationPerRound[round];

        round = round + 1;
        emit RoundClosed(round);
    }

    function deposit(uint amount) external canDeposit(amount) {
        sUSD.safeTransferFrom(msg.sender, address(this), amount);

        uint balanceInARound = calculateBalanceInARound(msg.sender, round - 1);

        if (balancesPerRound[round][msg.sender] == 0) {
            usersPerRound[round].push(msg.sender);
        }

        balancesPerRound[round][msg.sender] = balanceInARound + amount;
        //allocationPerRound[round] += amount;

        emit Deposited(msg.sender, amount);
    }

    function calculateBalanceInARound(address user, uint _round) internal returns (uint) {
        if (_round == 0 || _round == 1) {
            return balancesPerRound[1][user];
        } else {
            for (uint i = 2; i <= _round; i++) {
                if (!claimedPerRound[i][user]) {
                    // double check decimals !!!!!
                    balancesPerRound[i][user] = (balancesPerRound[i - 1][user] * profitAndLossPerRound[i]) / 1e18;
                    claimedPerRound[i][user] = true;
                } else {
                    continue;
                }
            }
            return balancesPerRound[_round][user];
        }
    }

    function claim() external nonReentrant {
        require(!roundStarted, "Cannot claim in a round");
        require(!claimedPerRound[round][msg.sender], "User already claimed");

        uint amount = calculateBalanceInARound(msg.sender, round);
        require(amount > 0, "Nothing to claim");

        sUSD.safeTransfer(msg.sender, amount);
        emit Claimed(msg.sender, amount);
    }

    function trade(address market, uint amount) external {
        require(roundStarted, "Round has not started");

        IPositionalMarket marketContract = IPositionalMarket(market);
        (bytes32 key, , ) = marketContract.getOracleDetails();
        (uint maturity, ) = marketContract.times();
        require(maturity < roundEndTime[round], "Market not valid");

        uint priceUp = thalesAMM.price(address(market), IThalesAMM.Position.Up);
        uint priceDown = thalesAMM.price(address(market), IThalesAMM.Position.Down);
        uint priceUpImpact = thalesAMM.buyPriceImpact(address(market), IThalesAMM.Position.Up, amount);
        uint priceDownImpact = thalesAMM.buyPriceImpact(address(market), IThalesAMM.Position.Down, amount);

        if (priceUp >= priceLowerLimit && priceUp <= priceUpperLimit && priceUpImpact < skewImpactLimit) {
            _buyFromAmm(market, _getAsset(key), IThalesAMM.Position.Up, amount);
        } else if (priceDown >= priceLowerLimit && priceDown <= priceUpperLimit && priceDownImpact < skewImpactLimit) {
            _buyFromAmm(market, _getAsset(key), IThalesAMM.Position.Down, amount);
        }

        if (!isTradingMarketInARound[round][market]) {
            tradingMarketsPerRound[round].push(market);
            isTradingMarketInARound[round][market] = true;
        }
    }

    function _buyFromAmm(
        address market,
        Asset asset,
        IThalesAMM.Position position,
        uint amount
    ) internal {
        uint quote = thalesAMM.buyFromAmmQuote(market, position, amount);
        uint allocationAsset = (allocationPerRound[round] * allocationLimits[asset]) / HUNDRED; //  divide by 100 and 10^18 - check!!!!
        require(
            quote + allocationSpentPerRound[round][asset] < allocationAsset,
            "Weekly allocation already spent for asset"
        );

        thalesAMM.buyFromAMM(market, position, amount, quote, 500000000000000000);

        allocationSpentPerRound[round][asset] = allocationSpentPerRound[round][asset] + quote;

        emit TradeExecuted(market, position, asset, amount, quote);
    }

    function _getAsset(bytes32 key) internal view returns (Asset asset) {
        if (key == "ETH") {
            asset = Asset.ETH;
        } else if (key == "BTC") {
            asset = Asset.BTC;
        } else {
            asset = Asset.Other;
        }
    }

    function getBalancesPerRound(uint _round, address user) external view returns (uint) {
        return balancesPerRound[_round][user];
    }

    function getClaimedPerRound(uint _round, address user) external view returns (bool) {
        return claimedPerRound[_round][user];
    }

    function setRoundLength(uint _roundLength) external onlyOwner {
        roundLength = _roundLength;
        emit RoundLengthChanged(_roundLength);
    }

    function setThalesAMM(IThalesAMM _thalesAMM) external onlyOwner {
        thalesAMM = _thalesAMM;
        emit ThalesAMMChanged(address(_thalesAMM));
    }

    function setSUSD(IERC20 _sUSD) external onlyOwner {
        sUSD = _sUSD;
        emit SetSUSD(address(sUSD));
    }

    function setAllocationLimits(
        uint _allocationETH,
        uint _allocationBTC,
        uint _allocationOtherAssets
    ) external onlyOwner {
        require(_allocationBTC + _allocationETH + _allocationOtherAssets == HUNDRED, "Invalid allocation limit values");
        allocationLimits[Asset.ETH] = _allocationETH;
        allocationLimits[Asset.BTC] = _allocationBTC;
        allocationLimits[Asset.Other] = _allocationOtherAssets;
        emit SetAllocationLimits(_allocationETH, _allocationBTC, _allocationOtherAssets);
    }

    function setPriceLimits(uint _priceLowerLimit, uint _priceUpperLimit) external onlyOwner {
        require(_priceLowerLimit < _priceUpperLimit, "Invalid price limit values");
        priceLowerLimit = _priceLowerLimit;
        priceUpperLimit = _priceUpperLimit;
        emit SetPriceLimits(_priceLowerLimit, _priceUpperLimit);
    }

    function setSkewImpactLimit(uint _skewImpactLimit) external onlyOwner {
        skewImpactLimit = _skewImpactLimit;
        emit SetSkewImpactLimit(_skewImpactLimit);
    }

    modifier canDeposit(uint amount) {
        require(sUSD.balanceOf(msg.sender) >= amount, "No enough sUSD");
        require(sUSD.allowance(msg.sender, address(this)) >= amount, "No allowance");
        require(!roundStarted, "Round has already started");
        _;
    }

    event RoundStarted(uint round);
    event RoundClosed(uint round);
    event RoundLengthChanged(uint roundLength);
    event ThalesAMMChanged(address thalesAmm);
    event SetSUSD(address sUSD);
    event SetAllocationLimits(uint allocationETH, uint allocationBTC, uint allocationOtherAssets);
    event SetPriceLimits(uint priceLowerLimit, uint priceUpperLimit);
    event SetSkewImpactLimit(uint skewImpact);
    event TradeExecuted(address market, IThalesAMM.Position position, Asset asset, uint amount, uint quote);
    event Deposited(address user, uint amount);
    event Claimed(address user, uint amount);
}
