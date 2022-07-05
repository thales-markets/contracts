// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Inheritance
import "./SportPosition.sol";
import "./SportPositionalMarket.sol";
import "./SportPositionalMarketManager.sol";
import "../../utils/proxy/solidity-0.8.0/ProxyOwned.sol";
import "../../utils/proxy/solidity-0.8.0/ProxyPausable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract SportPositionalMarketData is Initializable, ProxyOwned, ProxyPausable {
    struct OptionValues {
        uint home;
        uint away;
        uint draw;
    }

    struct Deposits {
        uint deposited;
    }

    struct Resolution {
        bool resolved;
        bool canResolve;
    }

    // used for things that don't change over the lifetime of the contract
    struct MarketParameters {
        address creator;
        SportPositionalMarket.Times times;
        SportPositionalMarketManager.Fees fees;
    }

    struct MarketData {
        Deposits deposits;
        Resolution resolution;
        SportPositionalMarket.Phase phase;
        SportPositionalMarket.Side result;
        OptionValues totalSupplies;
    }

    struct AccountData {
        OptionValues balances;
    }

    function initialize(address _owner) external initializer {
        setOwner(_owner);
    }

    function getMarketParameters(SportPositionalMarket market) external view returns (MarketParameters memory) {
        // (SportPosition up, SportPosition down) = market.options();
        (uint maturityDate, uint expiryDate) = market.times();
        (uint poolFee, uint creatorFee) = market.fees();

        MarketParameters memory data =
            MarketParameters(
                market.creator(),
                SportPositionalMarket.Times(maturityDate, expiryDate),
                SportPositionalMarketManager.Fees(poolFee, creatorFee)
            );

        return data;
    }

    function getMarketData(SportPositionalMarket market) external view returns (MarketData memory) {
        (uint homeSupply, uint awaySupply, uint drawSupply) = market.totalSupplies();
        return
            MarketData(
                Deposits(market.deposited()),
                Resolution(market.resolved(), market.canResolve()),
                market.phase(),
                market.result(),
                OptionValues(homeSupply, awaySupply, drawSupply)
            );
    }

    function getAccountMarketData(SportPositionalMarket market, address account) external view returns (AccountData memory) {
        (uint upBalance, uint downBalance, uint drawBalances) = market.balancesOf(account);

        return AccountData(OptionValues(upBalance, downBalance, drawBalances));
    }
}
