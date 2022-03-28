// SPDX-License-Identifier: MIT
pragma solidity >=0.5.16;

interface IThalesAMM {


    enum Position {Up, Down}

    function availableToBuyFromAMM(address market, Position position) external view returns (uint);

}
