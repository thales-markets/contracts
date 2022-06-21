How to deploy sports markets:

1. run script scripts/deploySportMarkets/deployRundown/deploy_TherundownConsumer_and_GamesQueue.js
   `npx hardhat run --network XXXXXX scripts/deploySportMarkets/deployRundown/deploy_TherundownConsumer_and_GamesQueue.js`
2. Verify the proxy using the link:
   - Kovan OP: https://kovan-optimistic.etherscan.io/proxyContractChecker
   - OP Mainnet: https://optimistic.etherscan.io/proxyContractChecker
   - Mumbai Polygon: https://mumbai.polygonscan.com/proxyContractChecker
   - Polygon: https://polygonscan.com/proxyContractChecker
3. run script scripts/deploySportMarkets/deployRundown/deploy_TherundownConsumerWrapper.js
   `npx hardhat run --network XXXXXX scripts/deploySportMarkets/deployRundown/deploy_TherundownConsumerWrapper.js`
4. add whitelisted address to wrapper and consumer contracts via `addToWhiteList` method (addresses which can resolve/create games/markets and pull odds)
5. after deploy od sports manager add address to a consumer contract via `setSportsManager` method
6. add LINK to a wrapper contract
