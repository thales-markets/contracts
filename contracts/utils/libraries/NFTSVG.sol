// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-4.4.1/utils/Strings.sol";
import "base64-sol/base64.sol";
import "../../interfaces/IPassportPosition.sol";

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
        IPassportPosition.Position[] positions;
        bool alive;
        bool seasonFinished;
        string baseURI;
    }

    function generateSVG(SVGParams memory params) internal pure returns (string memory svg) {
        if (!params.alive) {
            svg = string(abi.encodePacked(generateSVGEliminated(params.baseURI)));
        } else {
            svg = string(
                abi.encodePacked(
                    generateSVGBase(params.seasonFinished, params.baseURI),
                    generateSVGData(params.player, params.timestamp, params.round, params.season, params.seasonFinished),
                    generateSVGStamps(params.positions, params.baseURI, params.seasonFinished, params.round),
                    "</svg>"
                )
            );
        }
    }

    function generateSVGBase(bool seasonFinished, string memory baseURI) private pure returns (string memory svg) {
        // season is finished -> token is winner token
        if (seasonFinished) {
            svg = string(
                abi.encodePacked(
                    '<?xml version="1.0" encoding="utf-8"?>',
                    '<svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 492.2 700" style="enable-background:new 0 0 492.2 700;" xml:space="preserve">',
                    "<defs><style type=\"text/css\">@import url('http://fonts.googleapis.com/css?family=Lobster|Fontdiner+Swanky|Crafty+Girls|Pacifico|Satisfy|Gloria+Hallelujah|Bangers|Audiowide|Sacramento');</style></defs>",
                    "<style type=\"text/css\">st0{fill:#F5F0EB;}.st1{fill:#A0482D;}.st2{fill:#299956;}.st3{enable-background:new;}.st4{fill:#7F6F6F;}.st5{font-family:'Satisfy';}.st6{font-size:22.0664px;}</style>",
                    '<image style="overflow:visible;" width="1984" height="2851" xlink:href="',
                    baseURI,
                    '/winner.png"  transform="matrix(0.2486 0 0 0.2486 1.2623 -2.4119)"></image>'
                )
            );
        } else {
            svg = string(
                abi.encodePacked(
                    '<?xml version="1.0" encoding="utf-8"?>',
                    '<svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 492.2 700" style="enable-background:new 0 0 492.2 700;" xml:space="preserve">',
                    "<defs><style type=\"text/css\">@import url('https://thales-ajlyy.s3.eu-central-1.amazonaws.com/ELEGANT+TYPEWRITER+Regular.ttf');</style></defs>",
                    "<style type=\"text/css\">st0{fill:#F5F0EB;}.st1{fill:#A0482D;}.st2{fill:#299956;}.st3{enable-background:new;}.st4{fill:#7F6F6F;}.st5{font-family:'ELEGANT TYPEWRITER Regular';}.st6{font-size:22.0664px;}</style>",
                    '<image style="overflow:visible;" width="1984" height="2851" xlink:href="',
                    baseURI,
                    '/main.png"  transform="matrix(0.2484 0 0 0.2484 -1.4276 -4.1244)"></image>'
                )
            );
        }
    }

    function generateSVGEliminated(string memory baseURI) private pure returns (string memory svg) {
        svg = string(
            abi.encodePacked(
                '<?xml version="1.0" encoding="utf-8"?>',
                '<svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 492.2 700" style="enable-background:new 0 0 492.2 700;" xml:space="preserve">',
                '<g><image style="overflow:visible;" width="1984" height="2851" xlink:href="',
                baseURI,
                '/eliminated.png"  transform="matrix(0.2484 0 0 0.2484 -1.4276 -4.1244)"></image>',
                "</g></svg>"
            )
        );
    }

    function generateSVGData(
        address player,
        uint timestamp,
        uint round,
        uint season,
        bool seasonFinished
    ) private pure returns (string memory svg) {
        svg = string(
            abi.encodePacked(
                generateSVGAddress(player, seasonFinished),
                generateSVGTimestamp(timestamp, seasonFinished),
                '<text transform="',
                !seasonFinished ? "matrix(1 0 0 1 15.8619 530.2961)" : "matrix(1 0 0 1 34.7126 571.7894)",
                '" class="st4 st5 st6">Round #',
                Strings.toString(round),
                "</text>",
                '<text transform="',
                !seasonFinished ? "matrix(1 0 0 1 15.8619 556.7766)" : "matrix(1 0 0 1 34.7126 596.3534)",
                '" class="st4 st5 st6">Season ',
                Strings.toString(season),
                "</text>"
            )
        );
    }

    function generateSVGAddress(address player, bool seasonFinished) private pure returns (string memory svg) {
        svg = string(
            abi.encodePacked(
                '<text transform="',
                !seasonFinished ? "matrix(1 0 0 1 15.8619 477.3381)" : "matrix(1 0 0 1 34.7126 522.6644)",
                '" class="st4 st5 st6">',
                addressToString(player),
                "</text>"
            )
        );
    }

    function generateSVGTimestamp(uint timestamp, bool seasonFinished) private pure returns (string memory svg) {
        svg = string(
            abi.encodePacked(
                '<text transform="',
                !seasonFinished ? "matrix(1 0 0 1 15.8619 503.8186)" : "matrix(1 0 0 1 34.7126 547.2279)",
                '" class="st4 st5 st6">Timestamp ',
                Strings.toString(timestamp),
                "</text>"
            )
        );
    }

    function generateSVGStamps(
        IPassportPosition.Position[] memory positions,
        string memory baseURI,
        bool seasonFinished,
        uint currentRound
    ) private pure returns (string memory stamps) {
        stamps = string(abi.encodePacked(""));
        for (uint i = 0; i < positions.length; i++) {
            uint position = positions[i].position;
            uint round = positions[i].round;
            if(currentRound >= round) {
                string memory stamp = generateSVGStamp(round, position, baseURI, seasonFinished);
                stamps = string(abi.encodePacked(stamps, stamp));
            }
        }
    }

    function generateSVGStamp(
        uint round,
        uint position,
        string memory baseURI,
        bool seasonFinished
    ) private pure returns (string memory stamp) {
        string memory matrix = "";
        if (round == 1) {
            matrix = !seasonFinished ? "matrix(1 0 0 1 18.6021 246.25)" : "matrix(1 0 0 1 32 312.7)";
        } else if (round == 2) {
            matrix = !seasonFinished ? "matrix(1 0 0 1 104 296.9571)" : "matrix(1 0 0 1 115.6 360.4313)";
        } else if (round == 3) {
            matrix = !seasonFinished ? "matrix(1 0 0 1 152.6021 233.7428)" : "matrix(1 0 0 1 158.3 298.95)";
        } else if (round == 4) {
            matrix = !seasonFinished ? "matrix(1 0 0 1 244.55 280.5463)" : "matrix(1 0 0 1 249.7 342.502)";
        } else if (round == 5) {
            matrix = !seasonFinished ? "matrix(1 0 0 1 320.7201 293.2936)" : "matrix(1 0 0 1 320.15 355.3)";
        } else {
            matrix = !seasonFinished ? "matrix(1 0 0 1 344.4658 216.4674)" : "matrix(1 0 0 1 342.9762 282.35)";
        }

        stamp = string(
            abi.encodePacked(
                '<image style="overflow:visible;" width="130" height="130" xlink:href="',
                baseURI,
                "/",
                Strings.toString(round),
                "_",
                Strings.toString(position),
                '.png"  transform="',
                matrix,
                '"></image>'
            )
        );
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
