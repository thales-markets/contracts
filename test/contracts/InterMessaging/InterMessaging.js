'use strict';

const { artifacts, contract, web3 } = require('hardhat');
const { toBN } = web3.utils;

const { assert, addSnapshotBeforeRestoreAfterEach } = require('../../utils/common');

const { toBytes32 } = require('../../../index');

var ethers2 = require('ethers');
var crypto = require('crypto');

const SECOND = 1000;
const HOUR = 3600;
const DAY = 86400;
const WEEK = 604800;
const YEAR = 31556926;

const {
	fastForward,
	toUnit,
	fromUnit,
	currentTime,
	bytesToString,
	multiplyDecimalRound,
	divideDecimalRound,
} = require('../../utils')();

const {
	onlyGivenAddressCanInvoke,
	convertToDecimals,
	encodeCall,
	assertRevert,
} = require('../../utils/helpers');

contract('InterMessaging', (accounts) => {
	const [manager, first, owner, second, third, fourth, safeBox, wrapper, minter] = accounts;

	const ZERO_ADDRESS = '0x' + '0'.repeat(40);
	const MAX_NUMBER =
		'115792089237316195423570985008687907853269984665640564039457584007913129639935';

	const ContractTestContract = artifacts.require('ContractTest');
	const InvokerContract = artifacts.require('Invoker');
	const CrossChainTestContract = artifacts.require('CrossChainTest');
	const MessageBusContract = artifacts.require('MessageBus');
	const ThalesContract = artifacts.require('contracts/Token/OpThales_L1.sol:OpThales');

	let ContractTest;
	let Invoker;
	let CrossChainTest;
	let MessageBus;
	let Thales;

	beforeEach(async () => {
		ContractTest = await ContractTestContract.new({
			from: manager,
		});
		Invoker = await InvokerContract.new(ContractTest.address, {
			from: manager,
		});
		MessageBus = await MessageBusContract.new(second, second, second, second, second, second, {
			from: manager,
		});
		CrossChainTest = await CrossChainTestContract.new({
			from: manager,
		});

		await CrossChainTest.initialize(owner, MessageBus.address, { from: owner });
		Thales = await ThalesContract.new({ from: owner });
		await Thales.transfer(first, toUnit('1000'), { from: owner });
		await Thales.transfer(second, toUnit('1000'), { from: owner });
		await Thales.transfer(third, toUnit('1000'), { from: owner });
		await CrossChainTest.setUSD(Thales.address, { from: owner });
	});

	describe('Test InterMessaging', () => {
		beforeEach(async () => {});

		it('Do a call', async () => {
			let tx = await Invoker.addValuesWithCall(ContractTest.address, 10, 5);
			console.log(tx.logs[0].args);
			let readValue = await ContractTest.storedValue();
			console.log('value:', readValue);
			let sum = parseFloat(fromUnit(tx.logs[0].args.a)) + parseFloat(fromUnit(tx.logs[0].args.b));
			assert.equal(parseFloat(fromUnit(readValue)), sum);
		});
		it('Do a call with selector', async () => {
			let tx = await Invoker.addValuesWithCall(ContractTest.address, 10, 5);
			console.log(tx.logs[0].args);
			let readValue = await ContractTest.storedValue();
			console.log('value:', readValue);
			let sum = parseFloat(fromUnit(tx.logs[0].args.a)) + parseFloat(fromUnit(tx.logs[0].args.b));
			assert.equal(parseFloat(fromUnit(readValue)), sum);
		});

		it('Send Message', async () => {
			let tx = await Invoker.simulateBuyFromAMM(first, 0, 1, 2, 3, { from: owner });
			console.log(tx);
			// console.log(tx.logs[0].args);
			// console.log(tx.logs[1].args);
			// console.log(tx.logs[2].args);
			console.log(tx.logs[3].args);
			console.log(tx.logs[4].args);
		});

		it('Compile-> Send -> Read -> Exercise', async () => {
			let tx = await Invoker.compileAndSendMessage(ContractTest.address, 10, 5, { from: owner });
			console.log(tx);
			console.log(tx.logs[0].args);
			let message = tx.logs[0].args.message;
			let readValue = await ContractTest.storedValue();
			assert.equal(parseFloat(fromUnit(readValue)), parseFloat(0));
			let tx2 = await Invoker.executeMessage(message, { from: owner });
			console.log(tx2);
			console.log('>>>>> TX LOG LENGTH: ', tx2.logs.length);
			console.log(tx2.logs[0].args);
			readValue = await ContractTest.storedValue();
			assert.equal(parseFloat(readValue), parseFloat(15));
		});

		it('Using CrossChainTest to send message', async () => {
			let balance1 = await Thales.balanceOf(first);
			let balance2 = await Thales.balanceOf(second);
			console.log('Balance 1: ', balance1.toString());
			console.log('Balance 2: ', balance2.toString());
			let allowance = await Thales.allowance(first, CrossChainTest.address);
			console.log('Allowance 1 to contract: ', allowance.toString());
			let tx = await CrossChainTest.sendExoticUSD(first, second, 100, { from: owner });
			console.log(tx.logs[0].args);
			let tx2 = await CrossChainTest.executeThalesMessage(tx.logs[0].args.message, { from: owner });
			console.log('\n\nTX2');
			console.log(tx2.logs[0].args);

			await Thales.approve(CrossChainTest.address, toUnit(101), { from: first });
			allowance = await Thales.allowance(first, CrossChainTest.address);
			console.log('Allowance 1 to contract: ', allowance.toString());

			tx2 = await CrossChainTest.executeThalesMessage(tx.logs[0].args.message, { from: owner });
			console.log('\n\nTX2 SECOND TIME');
			console.log(tx2.logs[0].args);

			balance1 = await Thales.balanceOf(first);
			balance2 = await Thales.balanceOf(second);
			console.log('Owner: ', owner);
			console.log('Balance 1: ', balance1.toString());
			console.log('Balance 2: ', balance2.toString());
		});

		// it('Buy from SportsAMM, position 1, value: 100', async () => {
		// 	let availableToBuy = await SportsAMM.availableToBuyFromAMM(deployedMarket.address, 1);
		// 	let additionalSlippage = toUnit(0.01);
		// 	let buyFromAmmQuote = await SportsAMM.buyFromAmmQuote(deployedMarket.address, 1, toUnit(100));
		// 	answer = await Thales.balanceOf(first);
		// 	let before_balance = answer;
		// 	console.log('acc balance: ', fromUnit(answer));
		// 	console.log('buyQuote: ', fromUnit(buyFromAmmQuote));
		// 	answer = await SportsAMM.buyFromAMM(
		// 		deployedMarket.address,
		// 		1,
		// 		toUnit(100),
		// 		buyFromAmmQuote,
		// 		additionalSlippage,
		// 		{ from: first }
		// 	);
		// 	answer = await Thales.balanceOf(first);
		// 	console.log('acc after buy balance: ', fromUnit(answer));
		// 	console.log('cost: ', fromUnit(before_balance.sub(answer)));
		// 	let options = await deployedMarket.balancesOf(first);
		// 	console.log('Balances', options[0].toString(), fromUnit(options[1]), options[2].toString());
		// });
	});
});
