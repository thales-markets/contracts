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
        uint[] positions;
        bool alive;
    }

    function generateSVG(SVGParams memory params) internal pure returns (string memory svg) {
        return
            string(
                abi.encodePacked(
                    generateSVGBase(),
                    //generateSVGStamps(params.round, params.positions),
                    generateSVGData(params.player, params.timestamp, params.round, params.season),
                    "</g></svg>"
                )
            );
    }

    function generateSVGBase() private pure returns (string memory svg) {
        svg = string(
            abi.encodePacked(
                '<?xml version="1.0" encoding="utf-8"?>',
                '<svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 492.2 700" style="enable-background:new 0 0 492.2 700;" xml:space="preserve">',
                '<defs><style type="text/css">@import url(\'http://fonts.googleapis.com/css?family=Lobster|Fontdiner+Swanky|Crafty+Girls|Pacifico|Satisfy|Gloria+Hallelujah|Bangers|Audiowide|Sacramento\');</style></defs>',
                "<style type=\"text/css\">st0{fill:#F5F0EB;}.st1{fill:#A0482D;}.st2{fill:#299956;}.st3{enable-background:new;}.st4{fill:#7F6F6F;}.st5{font-family:'Satisfy';}.st6{font-size:22.0664px;}</style>",
                '<g><image style="overflow:visible;" width="1984" height="2851" xlink:href="https://thales-ajlyy.s3.eu-central-1.amazonaws.com/main.png"  transform="matrix(0.2484 0 0 0.2484 -1.4276 -4.1244)"></image>'
            )
        );
    }

    function generateSVGData(
        address player,
        uint timestamp,
        uint round,
        uint season
    ) private pure returns (string memory svg) {
        svg = string(
            abi.encodePacked(
                '<text transform="matrix(1 0 0 1 15.8619 477.3381)" class="st4 st5 st6">',
                addressToString(player),
                "</text>",
                '<text transform="matrix(1 0 0 1 15.8619 503.8186)" class="st4 st5 st6">Timestamp ',
                Strings.toString(timestamp),
                "</text>",
                '<text transform="matrix(1 0 0 1 15.8619 530.2961)" class="st4 st5 st6">Round #',
                Strings.toString(round),
                "</text>",
                '<text transform="matrix(1 0 0 1 15.8619 556.7766)" class="st4 st5 st6">Season ',
                Strings.toString(season),
                "</text>"
            )
        );
    }

    // function generateSVGStamps(uint round, uint[] memory positions) private pure returns (string memory stamps) {
    //     stamps = string(abi.encodePacked(""));
    //     for (uint i = 1; i <= round; i++) {
    //         uint position = positions[i];
    //         string memory stamp = Stamps.getStamp(round, position);
    //         stamps = string(abi.encodePacked(stamps, stamp));
    //     }
    // }

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
