const { ethers } = require('hardhat');
const { getTargetAddress } = require('../../helpers');
const w3utils = require('web3-utils');
var crypto = require('crypto');

async function main() {

	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	let players = [];

	if (network === 'unknown') {
		network = 'localhost';
	}

	if (network == 'homestead') {
		network = 'mainnet';
	}

	if (networkObj.chainId == 69) {
		networkObj.name = 'optimisticKovan';
		network = 'optimisticKovan';
	}
	if (networkObj.chainId == 10) {
		networkObj.name = 'optimistic';
		network = 'optimistic';
	}

	console.log('Account is: ' + owner.address);
	console.log('Network:' + network);
	console.log('Network id:' + networkObj.chainId);

	/* ========== PROPERTIES ========== */

	const season = 2;

	players = [
		'0x00ae7fe77ab7c4e77f894c76c167dc310766c57a',
		'0x0404bba9218774da40106de4fb8a8970bcaf4dae',
		'0x0a04362fbdc46b8af04e26246fa07cc636a7790b',
		'0x19eff04ddeea89d0762c80e5d3c9369e00a9fce4',
		'0x20f9ddfa193d0fe2f73d8b7d749b1355ef019887',
		'0x21f6f13f78a18c3b12616e7ebe8b3fdff869b14f',
		'0x2421134c8e8278ad199f6886ae70c5c373da3b48',
		'0x2cfdc3a7d7f597426f37fbae1c45a3d9f1c8b190',
		'0x2ecd6c4df59d45548a57e4c7efdb2e3ae0d6fd0e',
		'0x3432f2e175b57c904058a90528201280414ecce7',
		'0x378d85b8de65cbb4ff5a278f58b5e37e44ad7981',
		'0x3a20d6cde0f85303f0fd623d3dc5755d41f7ab41',
		'0x3fb4185036dbf5e0322c23584948fa97597b482c',
		'0x47d228fb786bb14117625147f1055638f46b6893',
		'0x4f862899c42645bec4b73ab20e4d06688f592f6f',
		'0x647b41b745cf5e32e244e432902468c4bd89643c',
		'0x71d87aabb42de94a7214976a05134935f73e64aa',
		'0x73064f6c1c5dad8d917782aec16ab564feb3c011',
		'0x7e788c62c9ca849dce399e90f912beae14424616',
		'0x865fc5c542280c9dba0d559f67112179e20574d2',
		'0x8adace41ec579423f149d7402f282301fcfaff36',
		'0x8af0a5658776b68912b22ec954a91b9c20d3f8aa',
		'0x8be60fe9f7c8d940d8da9d5ddd0d8e0c15a4288b',
		'0x8bf0083ecea9bbe0b6ca47bdb3cd1c39f10bdf02',
		'0x8f009a96f45514c31ee806fba7c4bfb842ff497e',
		'0x9223f2e38510aa77ded779c5f22c67f4e8315eea',
		'0x9a027b64d6fc4a77e34ae40f5e6f9310c457737f',
		'0x9ba8c70a8fd922e97a4e78c46583742c7d41796c',
		'0xa3b31b5292600d48172cfe3b588a8406a41f42b7',
		'0xa982bbdaf783eb7c3914d988b7e2a0be865ccb53',
		'0xab12253171a0d73df64b115cd43fe0a32feb9daa',
		'0xab7ab9b6495072c1136f96e301bd8f8de900f119',
		'0xad91bae71e4569ec5ff09be170e223cc6b388ab0',
		'0xba790fffee3cf670f24c0685cf218ee2ea8388af',
		'0xbbb33d2e7bd7ddc722e53da9ca8ee97df41cfabf',
		'0xcb744534a44083acd8c3b0b0b2d6e06faa50b9aa',
		'0xcc2b9fde1e59342c1ae10ebc02bb44e1dbe2b02d',
		'0xda0691163e9beae3745f6584c5ab5fef3d1276eb',
		'0xdbd0b8b6851ea7bea7b443f4d1bbdf0f2c524789',
		'0xe1f02f7e90ea5f21d0ac6f12c659c3484c143b03',
		'0xea04a9fe2cef51b504e7da8cf1b859454ae27030'
	]

	/* ========== SIGN IN ROYALE ========== */

	const ThalesRoyale = await ethers.getContractFactory('ThalesRoyale');
	const thalesRoyaleAddress = getTargetAddress('ThalesRoyale', network);
	console.log('Found ThalesRoyale at:', thalesRoyaleAddress);

	const royale = await ThalesRoyale.attach(
		thalesRoyaleAddress
	);

	console.log('Starting!')
	console.log('No. players: ' + players.length)

	//sign in on behalf
	for (let i = 0; i < players.length;) {
		console.log('Sign up ' + players[i], ', season is ' + season, ', which is ' + i);
		try {
			await royale.signUpOnBehalf(players[i], season, { from: owner.address });
			console.log('Signed up!');
			i++;
		}catch(e){
			console.log('Retry');
		}
	}

}

main()
	.then(() => process.exit(0))
	.catch(error => {
		console.error(error);
		process.exit(1);
	});