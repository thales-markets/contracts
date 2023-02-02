const { ethers } = require('hardhat');
const { getTargetAddress, txLog } = require('../../helpers');
const w3utils = require('web3-utils');
const ITEMS_METADATA = require('./taleOfThalesNFTMeta.json');
const { assert } = require('../../../test/utils/common');

async function main() {
	let accounts = await ethers.getSigners();
	let owner = accounts[0];
	let networkObj = await ethers.provider.getNetwork();
	let network = networkObj.name;
	let ToTNFTContract;
	let totNFTAddress;

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
		networkObj.name = 'optimisticEthereum';
		network = 'optimisticEthereum';
	}
	if (networkObj.chainId == 80001) {
		networkObj.name = 'polygonMumbai';
		network = 'polygonMumbai';
	}

	if (networkObj.chainId == 137) {
		networkObj.name = 'polygon';
		network = 'polygon';
	}

	if (networkObj.chainId == 420) {
		networkObj.name = 'optimisticGoerli';
		network = 'optimisticGoerli';
	}

	if (networkObj.chainId == 5) {
		networkObj.name = 'goerli';
		network = 'goerli';
	}

	console.log('Account is: ' + owner.address);
	console.log('Network:' + network);
	console.log('Network id:' + networkObj.chainId);

	/* ========== PROPERTIES ========== */

	// CHANGE addresses
	const whitelist = ['0x088cda4c48750442548ab476af5eea7135394063', '0x169379d950ceffa34f5d92e33e40B7F3787F0f71'];

	// ---> Conditions

	const collectionToVolumeMinimumAmountMap = new Map();
	collectionToVolumeMinimumAmountMap.set(2, '100');
	collectionToVolumeMinimumAmountMap.set(3, '1000');
	collectionToVolumeMinimumAmountMap.set(4, '10000');

	const collectionToWhitelistMap = new Map();
	collectionToWhitelistMap.set(1, whitelist);
	collectionToWhitelistMap.set(2, whitelist);
	collectionToWhitelistMap.set(3, whitelist);
	collectionToWhitelistMap.set(4, whitelist);
	collectionToWhitelistMap.set(5, whitelist);
	collectionToWhitelistMap.set(6, whitelist);
	collectionToWhitelistMap.set(7, whitelist);

	// --------------------------------------------------------

	ToTNFTContract = await ethers.getContractFactory('TaleOfThalesNFTs');
	totNFTAddress = getTargetAddress('TaleOfThalesNFTs', network);
	console.log('Found ToTNFTContract at:', totNFTAddress);

	const taleOfThales = await ToTNFTContract.attach(totNFTAddress);

	console.log('Script starts');
	console.log('-------------------------------------------------------');

	try {

		const { min, max } = getHighestAndLowestCollectionIndexFromMetaArray(ITEMS_METADATA);

		const latestCollectionIndexFromContract = await taleOfThales.getLatestCollectionIndex();

		if (latestCollectionIndexFromContract.toNumber() !== 0 && latestCollectionIndexFromContract.toNumber() < min) {
			console.log('Not valid collection index inside json file');
			return;
		}

		if (latestCollectionIndexFromContract.toNumber() == 0 && min !== 1) {
			console.log("Collection index must start from 1");
			return false;
		} 

		for (let collection = min; collection <= max; collection++) {
			const itemsFromCollectionIndex = ITEMS_METADATA.filter(
				(item) => item.collectionIndex == collection
			);

			if (!itemsFromCollectionIndex.length) {
				console.log('There are no items in collection');
				continue;
			}

			console.log('Latest collection index is ', latestCollectionIndexFromContract);

			const collectionAlreadyExists = latestCollectionIndexFromContract.toNumber() >= collection;

			let txAddingCollection;
			if (collectionToVolumeMinimumAmountMap.get(collection) && !collectionAlreadyExists) {
				txAddingCollection = await taleOfThales.addNewCollection(
					false,
					true,
					0,
					w3utils.toWei(collectionToVolumeMinimumAmountMap.get(collection)),
					collectionToWhitelistMap.get(collection),
					{
						from: owner.address,
					}
				);
			} else if (collectionToWhitelistMap.get(collection) && !collectionAlreadyExists) {
				txAddingCollection = await taleOfThales.addNewCollection(
					false,
					false,
					0,
					0,
					collectionToWhitelistMap.get(collection),
					{
						from: owner.address,
					}
				);
			}

			if (txAddingCollection !== undefined) {
				await txAddingCollection.wait().then((e) => {
					txLog(txAddingCollection, `Collection with index ${collection} addded`);
				});
				await delay(5000);
			} else {
				console.log(`Collection already exists => ${collection}`);
			}

			for (let item = 0; item < itemsFromCollectionIndex.length; item++) {
				const latestItemIndexFromContract = await taleOfThales.getLatestItemIndex();
				if (latestItemIndexFromContract.toNumber() >= itemsFromCollectionIndex[item].itemIndex) {
					console.log(`Item already exists => ${itemsFromCollectionIndex[item].itemIndex}`);
					continue;
				};

				const addItemTx = await taleOfThales.addItemToCollection(itemsFromCollectionIndex[item].type, itemsFromCollectionIndex[item].collectionIndex);
				await addItemTx.wait().then((e) => {
					txLog(addItemTx, `Item with index ${itemsFromCollectionIndex[item].itemIndex} is added.`);
				});
				await delay(5000);
			}
		}

	} catch (e) {
		console.log('Error ', e);
	}
}

function delay(time) {
	return new Promise(function (resolve) {
		setTimeout(resolve, time);
	});
}

function getHighestAndLowestCollectionIndexFromMetaArray(metaArray) {
	if (!metaArray.length) return false;
	const collectionIndexes = [];

	metaArray.forEach(item => {
		collectionIndexes.push(item.collectionIndex);
	});

	const max = Math.max(...collectionIndexes);
	const min = Math.min(...collectionIndexes);

	return {
		max,
		min
	};
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
