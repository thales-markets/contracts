// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-4.4.1/utils/Strings.sol";
import "./NFTSVG.sol";
import "base64-sol/base64.sol";

library NFTDescriptor {
    function constructTokenURI(NFTSVG.SVGParams memory params) internal pure returns (string memory) {
        string memory svg = generateSVGImage(params);
        string memory imageURI = generateImageURI(svg);
        return
            string(
                abi.encodePacked(
                    "data:application/json;base64,",
                    Base64.encode(
                        bytes(
                            abi.encodePacked(
                                '{"name":"',
                                "Thales Royale Passport",
                                '", "description": "',
                                generateDescription(params.season),
                                '", "attributes":"", "image":"',
                                imageURI,
                                '"}'
                            )
                        )
                    )
                )
            );
    }

    function generateDescription(uint season) private pure returns (string memory) {
        return string(abi.encodePacked("Thales Royale Passport - season ", Strings.toString(season)));
    }

    function generateSVGImage(NFTSVG.SVGParams memory params) private pure returns (string memory svg) {
        return
            NFTSVG.generateSVG(
                NFTSVG.SVGParams(
                    params.player,
                    params.timestamp,
                    params.tokenId,
                    params.season,
                    params.round,
                    params.positions,
                    params.alive,
                    params.seasonFinished
                )
            );
    }

    function generateImageURI(string memory svg) private pure returns (string memory) {
        string memory baseURL = "data:image/svg+xml;base64,";
        string memory svgBase64Encoded = Base64.encode(bytes(string(abi.encodePacked(svg))));
        return string(abi.encodePacked(baseURL, svgBase64Encoded));
    }
}
