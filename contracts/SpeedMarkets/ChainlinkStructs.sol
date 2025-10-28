pragma solidity ^0.8.0;

contract ChainlinkStructs {
    // More info: https://docs.chain.link/data-streams/reference/report-schema-v3
    /**
     * @dev Data Streams report schema v3 (crypto streams).
     *      Prices, bids and asks use 8 or 18 decimals depending on the stream.
     */
    struct ReportV3 {
        bytes32 feedId;
        uint32 validFromTimestamp;
        uint32 observationsTimestamp;
        uint192 nativeFee;
        uint192 linkFee;
        uint32 expiresAt;
        int192 price;
        int192 bid;
        int192 ask;
    }

    /**
     * @dev Data Streams report schema v8 (RWA streams).
     */
    struct ReportV8 {
        bytes32 feedId;
        uint32 validFromTimestamp;
        uint32 observationsTimestamp;
        uint192 nativeFee;
        uint192 linkFee;
        uint32 expiresAt;
        uint64 lastUpdateTimestamp;
        int192 midPrice;
        uint32 marketStatus;
    }
}
