// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-4.4.1/utils/Strings.sol";
import "base64-sol/base64.sol";

/// @title NFTSVG
/// @notice Provides a function for generating an SVG associated with a ThalesRoyalePassport NFT
library NFTSVG {
    using Strings for uint;

    struct SVGParams {
        address player;
        uint timestamp;
        uint tokenId;
        uint season;
        uint round;
        bool alive;
    }

    function generateSVG(SVGParams memory params) internal pure returns (string memory svg) {
        return
            string(
                abi.encodePacked(
                    generateSVGBase(params),
                    generateSVGStamps(params.round, params.alive),
                    generateSVGRareSparkle(params.tokenId, params.timestamp),
                    "</svg>"
                )
            );
    }

    function generateSVGBase(SVGParams memory params) private pure returns (string memory svg) {
        svg = string(
            abi.encodePacked(
                '<svg width="450" height="300" viewBox="0 0 450 300" xmlns="http://www.w3.org/2000/svg">',
                '<rect x="25"  y="25"  width="350" height="175" fill="white" stroke="black"/>',
                '<text x="30" y="45" fill="blue">Thales royale</text>',
                '<text x="30" y="70" fill="green">Player ',
                addressToString(params.player),
                "</text>",
                '<text x="30" y="95" fill="green">Issued ',
                params.timestamp.toString(),
                "</text>",
                '<text x="30" y="115" fill="green">Season ',
                params.season.toString(),
                "</text>"
            )
        );
    }

    function generateSVGStamps(uint round, bool alive) private pure returns (string memory svg) {
        string memory stamps = string(abi.encodePacked("Stamps: "));
        for(uint i; i < round; i++) {
            stamps = string(abi.encodePacked(stamps, " #", round));
        }

        if (!alive) {
            svg = string(
                abi.encodePacked(
                    '<text x="30" y="135" fill="black">',
                    "Dead - Last alive in round #",
                    round.toString(),
                    "</text>"
                )
            );
        } else {
            svg = "";
        }
    }

    function generateSVGRareSparkle(uint tokenId, uint timestamp) private pure returns (string memory svg) {
        if (isRare(tokenId, timestamp)) {
            svg = string(abi.encodePacked(""));
        } else {
            svg = "";
        }
    }

    function isRare(uint tokenId, uint timestamp) internal pure returns (bool) {
        return false;
    }

    function addressToString(address _addr) internal pure returns (string memory) {
        bytes memory s = new bytes(40);
        for (uint i = 0; i < 20; i++) {
            bytes1 b = bytes1(uint8(uint256(uint160(_addr)) / (2**(8 * (19 - i)))));
            bytes1 hi = bytes1(uint8(b) / 16);
            bytes1 lo = bytes1(uint8(b) - 16 * uint8(hi));
            s[2 * i] = _char(hi);
            s[2 * i + 1] = _char(lo);
        }
        return string(abi.encodePacked("0x", string(s)));
    }

    function _char(bytes1 b) private pure returns (bytes1 c) {
        if (uint8(b) < 10) return bytes1(uint8(b) + 0x30);
        else return bytes1(uint8(b) + 0x57);
    }
}
