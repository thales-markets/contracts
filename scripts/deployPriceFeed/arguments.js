module.exports = [
    "0x9d6b7cEE42F012b6C39f21bef869d8cEDdAef076", // logic contract
    "0x186183410Ec51F5a4B0a5FD700fb6Ef298D8c0a6", // proxy admin contract
    "0x696e697469616c697a65" // data
  ];

// VERIFY PROXY
// $ npx hardhat verify --constructor-args arguments.js --network kovan 0x20E9516E8Ea6e6259FaD9b456F65205C049C3AeD
// logic contract address and proxy admin admin are found under .oppenzeppelin/kovan.json manifest file