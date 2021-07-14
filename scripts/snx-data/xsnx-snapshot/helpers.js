const { ethers, network } = require("hardhat");


/**
 * Deploy a contract by name without constructor arguments
 */
async function deploy(contractName) {
    let Contract = await ethers.getContractFactory(contractName);
    return await Contract.deploy();
}

/**
 * Deploy a contract by name with constructor arguments
 */
async function deployArgs(contractName, ...args) {
    let Contract = await ethers.getContractFactory(contractName);
    return await Contract.deploy(...args);
}

/**
 * Deploy a contract with abi
 */
 async function deployWithAbi(contract, deployer, ...args) {
    let Factory = new ethers.ContractFactory(contract.abi, contract.bytecode, deployer);
    return await Factory.deploy(...args);
}

/**
 * Return BigNumber
 */
function bn(amount) {
    return new ethers.BigNumber.from(amount);
}

/**
 * Returns bignumber scaled to 18 decimals
 */
function bnDecimal(amount) {
    let decimal = Math.pow(10, 18);
    let decimals = bn(decimal.toString());
    return bn(amount).mul(decimals);
}

/**
 * Returns bignumber scaled to custom amount of decimals
 */
 function bnDecimals(amount, _decimals) {
    let decimal = Math.pow(10, _decimals);
    let decimals = bn(decimal.toString());
    return bn(amount).mul(decimals);
}

/**
 * Returns number representing BigNumber without decimal precision
 */
function getNumberNoDecimals(amount) {
    let decimal = Math.pow(10, 18);
    let decimals = bn(decimal.toString());
    return amount.div(decimals).toNumber();
}

/**
 * Returns number representing BigNumber without decimal precision (custom)
 */
 function getNumberDivDecimals(amount, _decimals) {
    let decimal = Math.pow(10, _decimals);
    let decimals = bn(decimal.toString());
    return amount.div(decimals).toNumber();
}

module.exports = {
    deploy, deployArgs, deployWithAbi, bn, bnDecimal, bnDecimals, getNumberNoDecimals, getNumberDivDecimals
}