const path = require('path');
const { ethers } = require('hardhat');
const w3utils = require('web3-utils');
const snx = require('synthetix-2.50.4-ovm');
const { artifacts, contract, web3 } = require('hardhat');
const { Watcher } = require('@eth-optimism/core-utils');
const { getMessagesAndProofsForL2Transaction } = require('@eth-optimism/message-relayer');
const { predeploys } = require("@eth-optimism/contracts");

const user_key = process.env.PRIVATE_KEY;

const {
	fastForward,
	toUnit,
	fromUnit,
	currentTime,
	multiplyDecimalRound,
	divideDecimalRound,
} = require('../../test/utils/index')();

const ZERO_ADDRESS = '0x' + '0'.repeat(40);

const L2_BRIDGE_ADDRESS = '0x4200000000000000000000000000000000000010';
const L1_MESSENGER_ADDRESS = '0x4361d0F75A0186C05f971c566dC6bEa5957483fD';
const STATE_COMMITMENT_CHAIN_ADDRESS = '0xD7754711773489F31A0602635f3F167826ce53C5';
const old_tx_hash = '0xd84ecfc22b3ce5b4605abcd5170e69da701e8d189fa10a52fa82533d4e59e527'

const { getTargetAddress, setTargetAddress } = require('../helpers');

const L2StandardBridgeArtifacts = require('@eth-optimism/contracts/artifacts/contracts/optimistic-ethereum/OVM/bridge/tokens/OVM_L2StandardBridge.sol/OVM_L2StandardBridge.json');
const L1StandardBridgeArtifacts = require('@eth-optimism/contracts/artifacts/contracts/optimistic-ethereum/OVM/bridge/tokens/OVM_L1StandardBridge.sol/OVM_L1StandardBridge.json');
const L1CrossDomainMessengerArtifacts = require('@eth-optimism/contracts/artifacts/contracts/optimistic-ethereum/OVM/bridge/messaging/OVM_L1CrossDomainMessenger.sol/OVM_L1CrossDomainMessenger.json');
const L2CrossDomainMessengerArtifacts = require('@eth-optimism/contracts/artifacts/contracts/optimistic-ethereum/OVM/bridge/messaging/OVM_L2CrossDomainMessenger.sol/OVM_L2CrossDomainMessenger.json');

const { toBytes32 } = require('../../index');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	// let networkObj = await ethers.provider.getNetwork();
	
	let network_kovan = new ethers.providers.InfuraProvider("kovan");
	// console.log(network_kovan);
	const net_kovan = 'kovan'
	let network_optimistic_kovan = await ethers.provider.getNetwork();
	const net_optimistic_kovan = 'optimisticKovan'
	
	console.log("OVM L2 messenger at: ", predeploys.OVM_L2CrossDomainMessenger);
	console.log("OVM L1 messenger at: ", L1_MESSENGER_ADDRESS);
	
	// const l2StandardBridgeArtifact = require(`../node_modules/@eth-optimism/contracts/artifacts/contracts/L2/messaging/L2StandardBridge.sol/L2StandardBridge.json`)
	
	
	
	const l1Wallet = new ethers.Wallet(user_key, network_kovan);
	const l2Wallet = new ethers.Wallet(user_key, ethers.provider);
	
	let blockNumber = await network_kovan.getBlockNumber();
	console.log("Kovan block number: ", blockNumber);
	
	blockNumber = await ethers.provider.getBlockNumber();
	console.log("Optimistic Kovan block number: ", blockNumber);
	
	const ThalesAddress = getTargetAddress('Thales', net_kovan);
	const ThalesExchangerAddress = getTargetAddress('ThalesExchanger', net_kovan);
	const OP_Thales_L1Address = getTargetAddress('OpThales_L1', net_kovan);
	const OP_Thales_L2Address = getTargetAddress('OpThales_L2', net_optimistic_kovan);

	// const L2StandardBridge = await ethers.getContractFactory('../../node_modules/@eth-optimism/contracts/artifacts/contracts/optimistic-ethereum/OVM/bridge/tokens/OVM_L2StandardBridge.sol:OVM_L2StandardBridge');
	const L2StandardBridge = new ethers.ContractFactory(L2StandardBridgeArtifacts.abi, L2StandardBridgeArtifacts.bytecode);
	const L1StandardBridge = new ethers.ContractFactory(L1StandardBridgeArtifacts.abi, L1StandardBridgeArtifacts.bytecode);
	const OP_Thales_L1 = await ethers.getContractFactory('/contracts/Token/OpThales_L1.sol:OpThales');
	const ThalesExchanger = await ethers.getContractFactory('ThalesExchanger');
	const OP_Thales_L2 = await ethers.getContractFactory('/contracts/Token/OpThales_L2.sol:OpThales');
	const Thales = await ethers.getContractFactory('Thales');
	

	const l2Messenger = new ethers.Contract(
		predeploys.OVM_L2CrossDomainMessenger,
		L2CrossDomainMessengerArtifacts.abi,
		ethers.provider
	);
	
	const l1Messenger = new ethers.Contract(
	L1_MESSENGER_ADDRESS,
	L1CrossDomainMessengerArtifacts.abi,
	network_kovan
	);

	const l1MessengerAddress = l1Messenger.address;
	// L2 messenger address is always the same, 0x42.....07
	const l2MessengerAddress = l2Messenger.address;

	console.log("L1 messenger:",l1MessengerAddress);
	console.log("L2 messenger:",l2MessengerAddress);
	//   // Tool that helps watches and waits for messages to be relayed between L1 and L2.
	const watcher = new Watcher({
		l1: {
		  provider: network_kovan,
		  messengerAddress: l1MessengerAddress
		},
		l2: {
		  provider: ethers.provider,
		  messengerAddress: l2MessengerAddress
		}
	  });

	const Thales_deployed= await Thales.connect(l1Wallet).attach(ThalesAddress);
	console.log("Thales on Kovan at: ", Thales_deployed.address);
	
	const ThalesExchanger_deployed = await ThalesExchanger.connect(l1Wallet).attach(ThalesExchangerAddress);
	console.log("Thales Exchanger on Kovan at: ", ThalesExchanger_deployed.address);

	const OP_Thales_L1_deployed = await OP_Thales_L1.connect(l1Wallet).attach(OP_Thales_L1Address);
	console.log("L1 Contract on Kovan at: ", OP_Thales_L1_deployed.address);

	const OP_Thales_L2_deployed = await OP_Thales_L2.connect(l2Wallet).attach(OP_Thales_L2Address);
	console.log("L2 Contract on Optimistic Kovan at: ", OP_Thales_L2_deployed.address);

	const L2StandardBridge_deployed = await L2StandardBridge.connect(l2Wallet).attach(L2_BRIDGE_ADDRESS);
	console.log("L2 Bridge on Optimistic Kovan at: ", L2StandardBridge_deployed.address);


	const L1StandardBridgeAddress = await L2StandardBridge_deployed.l1TokenBridge();
	
	const L1StandardBridge_deployed = await L1StandardBridge.connect(l1Wallet).attach(L1StandardBridgeAddress);
	
	console.log("L1 Bridge on Kovan at: ", L1StandardBridge_deployed.address);

	let balance = await OP_Thales_L1_deployed.balanceOf(owner.address);
	console.log("\n\nL1 balance", owner.address,":", fromUnit(balance.toString()));
	
	balance = await OP_Thales_L2_deployed.balanceOf(owner.address);
	console.log("L2 balance", owner.address,":", fromUnit(balance.toString()));
	let init_balance = parseInt(fromUnit(balance.toString()));

	let approved = await OP_Thales_L1_deployed.allowance(owner.address, L1StandardBridge_deployed.address);
	console.log("Approved: ", fromUnit(approved.toString()));

	let TRANSFER_ERC20 = '25'

	if(parseInt(fromUnit(approved.toString())) == 0) {
		const tx1 = await OP_Thales_L1_deployed.approve(L1StandardBridge_deployed.address, w3utils.toWei(TRANSFER_ERC20));
		await tx1.wait()
	}

	approved = await OP_Thales_L1_deployed.allowance(owner.address, L1StandardBridge_deployed.address);
	console.log("Approved: ", fromUnit(approved.toString()));

	let checkToken = await OP_Thales_L2_deployed.l1Token();
	console.log("\nL2 address for L1:", checkToken);

	if(checkToken == OP_Thales_L1_deployed.address) {
		console.log("Address match with L1 token");
	}
	else {
		console.log("Address DOES NOT match with L1 token");
	}


	console.log('Depositing tokens into L2 ...')
	const tx2 = await L1StandardBridge_deployed.depositERC20(
		OP_Thales_L1_deployed.address,
		OP_Thales_L2_deployed.address,
		w3utils.toWei(TRANSFER_ERC20),
		2000000,
		'0x')
	await tx2.wait()

	// Wait for the message to be relayed to L2.
	console.log('Waiting for deposit to be relayed to L2...');
		
	balance = parseInt(init_balance);
	let str_balance = '';
	let seconds_counter = 0;
	while(balance == init_balance) {
		await delay(10000);
		str_balance = await OP_Thales_L2_deployed.balanceOf(owner.address);
		balance = parseInt(fromUnit(str_balance.toString()));
		seconds_counter = seconds_counter+10;
		console.log(seconds_counter,"sec |", init_balance, balance)
	}
	
	balance = await OP_Thales_L1_deployed.balanceOf(owner.address);
	console.log("Balance on L1:", fromUnit(balance.toString())) // 0
	init_balance = parseInt(fromUnit(balance.toString()));
	balance = await OP_Thales_L2_deployed.balanceOf(owner.address);
	console.log("Balance on L2:", fromUnit(balance.toString())) // 0

	console.log(`\nWithdrawing tokens back to L1 ...`)
	const tx3 = await L2StandardBridge_deployed.withdraw(
		OP_Thales_L2_deployed.address,
		w3utils.toWei(TRANSFER_ERC20),
		2000000,
		'0x'
	)
	await tx3.wait()
	
	console.log("transaction hash:",tx3.hash);
	// console.log("Wait for 30 seconds....")
	// await delay(30000);
	console.log("Attempting");
	
	let messagePairs = []
	while (true) {
		try {
		  messagePairs = await getMessagesAndProofsForL2Transaction(
			network_kovan,
			ethers.provider,
			STATE_COMMITMENT_CHAIN_ADDRESS,
			predeploys.OVM_L2CrossDomainMessenger,
			tx3.hash
		  );
		  console.log("-");
		  break
		} catch (err) {
		  if (err.message.includes('unable to find state root batch for tx')) {
			await delay(5000)
		  } else {
			throw err
		  }
		}
	}

	// console.log(messagePairs);

	for (const { message, proof } of messagePairs) {
		while (true) {
		  try {
			console.log("sender:",message.sender);
			console.log("target:",message.target);
			console.log("message:",message.target);

			const result = await l1Messenger
			  .connect(l1Wallet)
			  .relayMessage(
				message.target,
				message.sender,
				message.message,
				message.messageNonce,
				proof
			  )
			await result.wait()
			break
		  } catch (err) {
			if (err.message.includes('execution failed due to an exception')) {
			  await delay(5000)
			} else if (err.message.includes('Nonce too low')) {
			  await delay(5000)
			} else if (err.message.includes('transaction was replaced')) {
			  // this happens when we run tests in parallel
			  await delay(5000)
			} else if (
			  err.message.includes(
				'another transaction with same nonce in the queue'
			  )
			) {
			  // this happens when we run tests in parallel
			  await delay(5000)
			} else if (
			  err.message.includes('message has already been received')
			) {
			  break
			} else {
			  throw err
			}
		  }
		}
	}
	
	// console.log("Wait for 30 seconds....")
	// await delay(30000);
	console.log("Attempt to finalize");
	

	console.log(`Waiting for withdrawal to be relayed to L1...`)
	balance = parseInt(init_balance);
	str_balance = '';
	seconds_counter = 0;
	while(balance == init_balance) {
		await delay(10000);
		str_balance = await OP_Thales_L1_deployed.balanceOf(owner.address);
		balance = parseInt(fromUnit(str_balance.toString()));
		seconds_counter = seconds_counter+10;
		console.log(seconds_counter,"sec |", init_balance, balance);
	}

	balance = await OP_Thales_L1_deployed.balanceOf(owner.address);
	console.log("Balance on L1:", fromUnit(balance.toString()));
	balance = await OP_Thales_L2_deployed.balanceOf(owner.address);
	console.log("Balance on L2:", fromUnit(balance.toString())); 
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});

function delay(time) {
	return new Promise(function (resolve) {
		setTimeout(resolve, time);
	});
}
