# Royale Seasons Guide for deployment

Guide for Royale Seasons Deploy

## Overview

Royale Seasons is contract which covers TIP-13 and source code is on [GIT Repo - Royale Seassons](https://github.com/thales-markets/contracts/blob/main/contracts/ThalesRoyale/ThalesRoyale.sol)

## How to deploy a Royale Seasons

1. Deploy script [git version](https://github.com/thales-markets/contracts/blob/main/scripts/deployThalesRoyale/thalesRoyale/deployRoyale.js)

`npx hardhat run --network XXXXX scripts/deployThalesRoyale/thalesRoyale/deployRoyale.js`

2. Put Funds into season [git version](https://github.com/thales-markets/contracts/blob/main/scripts/deployThalesRoyale/thalesRoyale/putFundsInRoyaleSeason.js)

Note: for each season you need to change propery inside script (propery season)

`npx hardhat run --network XXXXX scripts/deployThalesRoyale/thalesRoyale/putFundsInRoyaleSeason.js`

3. Set Royale owner to pDAO

4. Start Royale season at Monday 4PM UTC [git version](https://github.com/thales-markets/contracts/blob/main/scripts/deployThalesRoyale/thalesRoyale/startSeason.js)

`npx hardhat run --network XXXXX scripts/deployThalesRoyale/thalesRoyale/startSeason.js`

5. Change setNextSeasonStartsAutomatically

`setNextSeasonStartsAutomatically=true`

## Additional scripts

1. Script for upgrading royale season impl. [git version](https://github.com/thales-markets/contracts/blob/main/scripts/deployThalesRoyale/thalesRoyale/upgradeRoyale.js)

`npx hardhat run --network XXXXX scripts/deployThalesRoyale/thalesRoyale/upgradeRoyale.js`

2. Script for setting safebox [git version](https://github.com/thales-markets/contracts/blob/main/scripts/deployThalesRoyale/thalesRoyale/changeSafeBoxRoyaleSeason.js)

`npx hardhat run --network XXXXX scripts/deployThalesRoyale/thalesRoyale/changeSafeBoxRoyaleSeason.js`

Note: In script you can change percentage and also address for safebox

@Deprecated -  reason deleted signUpOnBehalf method in Royale contract
3. Script for sign up players on behalf of owner [git version](https://github.com/thales-markets/contracts/blob/main/scripts/deployThalesRoyale/thalesRoyale/signUpOnBehalf.js)

`npx hardhat run --network XXXXX scripts/deployThalesRoyale/thalesRoyale/signUpOnBehalf.js`

Note: In script you can change players which you need to sign up. SEASON must be started first.

4. Script for minting passes [git version](https://github.com/thales-markets/contracts/blob/main/scripts/deployThalesRoyale/thalesRoyalePass/mintPasses.js)

`npx hardhat run --network XXXXX scripts/deployThalesRoyale/thalesRoyalePass/mintPasses.js`

Note: In script you can change players for which you mint passes. Aslo, amount sUSD for which you approve 30 sUSD x N (number of players) 