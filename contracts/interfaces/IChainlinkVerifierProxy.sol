pragma solidity ^0.8.0;

import "@chainlink/contracts-0.8.0/src/v0.8/llo-feeds/interfaces/IVerifierFeeManager.sol";

interface IChainlinkVerifierProxy {
    /**
     * @notice Route a report to the correct verifier and (optionally) bill fees.
     * @param payload           Full report payload (header + signed report).
     * @param parameterPayload  ABI-encoded fee metadata.
     */
    function verify(bytes calldata payload, bytes calldata parameterPayload)
        external
        payable
        returns (bytes memory verifierResponse);

    function verifyBulk(bytes[] calldata payloads, bytes calldata parameterPayload)
        external
        payable
        returns (bytes[] memory verifiedReports);

    function s_feeManager() external view returns (IVerifierFeeManager);
}
