const w3utils = require('web3-utils');

const recipients = [
    '0x8c42138C925d1049EC6B29F1EcF817b1628e54Ba',
    '0xb8D08D9537FC8E5624c298302137c5b5ce2F301D',
    '0x0D858351A5FB419C9A3760647900d2F7aD526c83',
    '0xDC6a112C8BFcCfA46Db464ccEE7daa9669e97565',
    '0xB27E08908D6Ecbe7F9555b9e048871532bE89302',
    '0x9dB26e239F550C972573f64c3131399cC3E11eB7',
    '0x551d8708C28fa593BEC2697174DC2a1E60595fA2'  
];

const amounts = [
    w3utils.toWei('5000000'),
    w3utils.toWei('1750000'),
    w3utils.toWei('1750000'),
    w3utils.toWei('1750000'),
    w3utils.toWei('300000'),
    w3utils.toWei('200000'),
    w3utils.toWei('100000')
];

const startTimes = [
    '1648771200',
    '1648771200',
    '1648771200',
    '1648771200',
    '1648771200',
    '1648771200',
    '1648771200'
];

const TOTAL_AMOUNT = w3utils.toWei('10850000');

module.exports = {
    recipients,
    amounts,
    startTimes,
    TOTAL_AMOUNT
}