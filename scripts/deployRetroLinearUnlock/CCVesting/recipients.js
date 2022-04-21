const { ethers, upgrades } = require('hardhat');

const recipients = [
    '0x9841484A4a6C0B61C4EEa71376D76453fd05eC9C',
    '0xB27E08908D6Ecbe7F9555b9e048871532bE89302'
];

const amounts = [
    web3.utils.toWei('250000'),
    web3.utils.toWei('250000')
];

const startTimes = [
    '1650623831',
    '1650541031'
];

module.exports = {
    recipients,
    amounts,
    startTimes
}