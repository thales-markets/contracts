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
    }

    function generateSVG(SVGParams memory params) internal pure returns (string memory svg) {
        if (!params.alive) {
            svg = string(abi.encodePacked(generateSVGEliminated(params.season, params.tokenId)));
        } else {
            svg = string(
                abi.encodePacked(
                    generateSVGBase(),
                    generateSVGData(params.player, params.tokenId, params.timestamp, params.season, params.seasonFinished),
                    generateSVGStamps(params.positions, params.round, params.seasonFinished),
                    generateSVGBackground()
                )
            );
        }
    }

    function generateSVGBase() private pure returns (string memory svg) {
        svg = string(
            abi.encodePacked(
                '<svg viewBox="0 0 350 550" fill="none" xmlns="http://www.w3.org/2000/svg">',
                '<g class="background">',
                '<path id="gornji" d="M350 0H0V275H350V0Z" fill="url(#paint0_linear_44_340)"/>',
                '<path id="donji" d="M350 275H0V550H350V275Z" fill="url(#paint1_linear_44_340)"/>',
                "</g>",
                '<g class="logoRoyale">',
                '<rect id="rectangle" x="123.113" y="33.2568" width="27" height="27" stroke="#7F6F6F" stroke-width="3.35159"/>',
                '<circle id="krug" cx="224.402" cy="47.0822" r="13.4064" stroke="#7F6F6F" stroke-width="3.35159"/>',
                '<path id="triangle" d="M168.589 59.5459L182.557 35.3516L196.526 59.5459H168.589Z" stroke="#7F6F6F" stroke-width="3.35159"/></g>',
                '<text x="36" y="85" font-family="Courier New" font-size="21" fill="#7F6F6F">Thales Royale Passport</text>'
            )
        );
    }

    function generateSVGEliminated(uint season, uint tokenId) private pure returns (string memory svg) {
        svg = string(
            abi.encodePacked(
                generateSVGBase(),
                '<text x="120" y="115" font-family="Helvetica" font-size="24" fill="#7F6F6F">SEASON ',
                Strings.toString(season),
                '</text>',
                '<text x="60" y="240" font-family="Courier New" font-size="38" fill="#D10019" text-decoration="line-through">ELIMINATED</text>',
                '<text x="50" y="520" font-family="Courier New" font-size="20" fill="#7F6F6F">Passport No: #',
                Strings.toString(tokenId),
                '</text>',
                generateSVGBackground()
            )
        );
    }

    function generateSVGData(
        address player,
        uint tokenId,
        uint timestamp,
        uint season,
        bool seasonFinished
    ) private pure returns (string memory svg) {
        svg = string(
            abi.encodePacked(
                '<text x="',
                seasonFinished ? '63' : '120',
                '" y="115" font-family="Helvetica" font-size="24" fill="#7F6F6F">',
                seasonFinished ? 'WINNER SEASON ' : 'SEASON ',
                Strings.toString(season),
                '</text>',
                '<text x="10" y="460" font-family="Courier New" font-size="13" fill="#7F6F6F">',
                addressToString(player), 
                '</text>',
                '<text x="30" y="490" font-family="Courier New" font-size="20" fill="#7F6F6F">Issued On: ',
                Strings.toString(timestamp),
                '</text>',
                '<text x="50" y="520" font-family="Courier New" font-size="20" fill="#7F6F6F">Passport No: #',
                Strings.toString(tokenId),
                '</text>'
            )
        );
    }

    function generateSVGStamps(IPassportPosition.Position[] memory positions, uint currentRound, bool seasonFinished)
        private
        pure
        returns (string memory stamps)
    {
        stamps = string(abi.encodePacked(""));
        uint rounds = seasonFinished ? currentRound - 1 : currentRound;
        for (uint i = 0; i < positions.length; i++) {
            uint position = positions[i].position;
            uint round = positions[i].round;
            if (rounds >= round) {
                string memory stamp = generateSVGStamp(round, position);
                stamps = string(abi.encodePacked(stamps, stamp));
            }
        }
    }

    function generateSVGStamp(
        uint round,
        uint position
    ) private pure returns (string memory stamp) {
        string memory item = "";
        if (round == 1) {
            item = position == 1
                ? '<circle cx="72.5005" cy="200.5" r="28" transform="rotate(-9.01508 72.5005 200.5)" stroke="#D10019"/><text x="63" y="215" font-family="Courier New" font-size="40" rotate="-9" fill="#D10019">1</text>'
                : '<path d="M41.7387 226.599L69.954 167.136L107.343 221.302L41.7387 226.599Z" stroke="#00957E"/><text x="63" y="215" font-family="Courier New" font-size="40" rotate="-9" fill="#00957E">1</text>';
        } else if (round == 2) {
            item = position == 1
                ? '<circle cx="72.9395" cy="288.94" r="28" transform="rotate(12.3593 72.9395 288.94)" stroke="#D10019"/><text x="59" y="299" font-family="Courier New" font-size="40" rotate="13" fill="#D10019">2</text>'
                : '<path d="M35.7644 295.445L80.2057 246.896L100.029 309.658L35.7644 295.445Z" stroke="#00957E"/><text x="59" y="293" font-family="Courier New" font-size="40" rotate="15" fill="#00957E">2</text>';
        } else if (round == 3) {
            item = position == 1
                ? '<circle cx="145.903" cy="304.902" r="28" transform="rotate(-14.9925 145.903 304.902)" stroke="#D10019"/><text x="139" y="322" font-family="Courier New" font-size="40" rotate="-18" fill="#D10019">3</text>'
                : '<path d="M128.895 330.635L145.93 267.059L192.47 313.6L128.895 330.635Z" stroke="#00957E"/><text x="147" y="319" font-family="Courier New" font-size="40" rotate="-18" fill="#00957E">3</text>';
        } else if (round == 4) {
            item = position == 1
                ? '<circle cx="175.979" cy="262.979" r="28" transform="rotate(3.05675 175.979 262.979)" stroke="#D10019"/><text x="162" y="276" font-family="Courier New" font-size="40" rotate="3" fill="#D10019">4</text>'
                : '<path d="M150.739 289.599L178.954 230.136L216.343 284.302L150.739 289.599Z" stroke="#00957E"/><text x="170" y="281" font-family="Courier New" font-size="40" rotate="-7" fill="#00957E">4</text>';
        } else if (round == 5) {
            item = position == 1
                ? '<circle cx="279.614" cy="230.614" r="28" transform="rotate(-9.01508 279.614 230.614)" stroke="#D10019"/><text x="271" y="246" font-family="Courier New" font-size="40" rotate="-9" fill="#D10019">5</text>'
                : '<path d="M233.007 266.845L266.205 210.013L298.824 267.18L233.007 266.845Z" stroke="#00957E"/><text x="255" y="260" font-family="Courier New" font-size="40" fill="#00957E">5</text>';
        } else {
            item = position == 1
                ? '<circle cx="273.833" cy="332.833" r="28" transform="rotate(14.7947 273.833 332.833)" stroke="#D10019"/><text x="258" y="343" font-family="Courier New" font-size="40" rotate="9" fill="#D10019">6</text>'
                : '<path d="M203.483 347.285L240.321 292.742L269.138 351.916L203.483 347.285Z" stroke="#00957E"/><text x="224" y="342" font-family="Courier New" font-size="40"  fill="#00957E">6</text>';
        }

        stamp = string(abi.encodePacked(item));
    }

    function generateSVGBackground() internal pure returns (string memory) {
        return
            string(
                abi.encodePacked(
                    '<defs><linearGradient id="paint0_linear_44_340" x1="174.381" y1="274.968" x2="175.554" y2="36.6047" gradientUnits="userSpaceOnUse">',
                    '<stop stop-color="#E3D4C7"/><stop offset="0.0547" stop-color="#E6D9CE"/><stop offset="0.2045" stop-color="#ECE2D9"/><stop offset="0.4149" stop-color="#EFE7E0"/>',
                    '<stop offset="1" stop-color="#F0E8E2"/></linearGradient>',
                    '<linearGradient id="paint1_linear_44_340" x1="0.00270863" y1="412.497" x2="350.002" y2="412.497" gradientUnits="userSpaceOnUse">'
                    '<stop stop-color="#EEE4DC"/><stop offset="1" stop-color="#F7F3EF"/></linearGradient></defs></svg>'
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
