const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');
const { web3 } = require('hardhat');
const fs = require('fs');
const { ethers } = require('hardhat');
const odds = require(`./odds.json`);
const { getTargetAddress } = require('../../helpers');

async function updateMerkleTree() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;

	if (networkObj.chainId == 420) {
		networkObj.name = 'optimisticGoerli';
		network = 'optimisticGoerli';
	}
	if (networkObj.chainId == 10) {
		networkObj.name = 'optimisticEthereum';
		network = 'optimisticEthereum';
	}
	if (networkObj.chainId == 42161) {
		networkObj.name = 'arbitrumOne';
		network = 'arbitrumOne';
	}
	if (networkObj.chainId == 8453) {
		networkObj.name = 'baseMainnet';
		network = 'baseMainnet';
	}
	console.log('Account is:', owner.address);
	console.log('Network name:', network);

	let treeOddsHashes = [];
	let treeOddsAndHashes = [];

	odds.forEach((oddsItem, index) => {
		console.log('oddsItem: ', oddsItem);

		let hash = keccak256(
			oddsItem.odds.length > 2
				? web3.utils.encodePacked(
						oddsItem.marketAddress,
						oddsItem.sportId,
						ethers.utils.parseEther(oddsItem.odds[0].toString()).toString(),
						ethers.utils.parseEther(oddsItem.odds[1].toString()).toString(),
						ethers.utils.parseEther(oddsItem.odds[2].toString()).toString()
				  )
				: web3.utils.encodePacked(
						oddsItem.marketAddress,
						oddsItem.sportId,
						ethers.utils.parseEther(oddsItem.odds[0].toString()).toString(),
						ethers.utils.parseEther(oddsItem.odds[1].toString()).toString()
				  )
		);
		let balance = {
			marketAddress: oddsItem.marketAddress,
			oddsItem: oddsItem.sportId,
			odds: oddsItem.odds.map((o) => ethers.utils.parseEther(o.toString()).toString()),
			hash,
			proof: '',
			index: index,
		};
		treeOddsHashes.push(hash);
		treeOddsAndHashes.push(balance);
	});

	// create merkle tree
	const merkleTree = new MerkleTree(treeOddsHashes, keccak256, {
		sortLeaves: true,
		sortPairs: true,
	});

	// fet tree root
	const root = merkleTree.getHexRoot();
	console.log('Merkle Tree root:', root);

	for (let toh in treeOddsAndHashes) {
		treeOddsAndHashes[toh].proof = merkleTree.getHexProof(treeOddsAndHashes[toh].hash);
		delete treeOddsAndHashes[toh].hash;
	}

	const sportsAMMAddress = getTargetAddress('SportsAMM', network);
	console.log('Found SportsAMM at:', sportsAMMAddress);

	const SportsAMM = await ethers.getContractFactory('SportsAMM');
	const sportsAMM = SportsAMM.attach(sportsAMMAddress);

	// set new root on contract
	// const tx = await sportsAMM.setRoot(root);
	// await tx.wait().then(() => {
	// 	console.log('New root set');
	// });

	fs.writeFileSync(
		`scripts/deploySportMarkets/updateMerkleTree/treeOddsAndHashes.json`,
		JSON.stringify(treeOddsAndHashes),
		function (err) {
			if (err) return console.log(err);
		}
	);
}

updateMerkleTree()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
