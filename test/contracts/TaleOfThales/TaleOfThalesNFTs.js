'use strict';

const { artifacts, contract } = require('hardhat');

const { assert } = require('../../utils/common');

const { toUnit } = require('../../utils')();
const { toBytes32 } = require('../../../index');
const { expect } = require('chai');

contract('TaleOfThalesNFTs', (accounts) => {
	const [first, owner, second, third] = accounts;
	let TaleOfThalesNFTs;
	let StakingThales, SNXRewards, Thales;
	let taleOfThalesContract;
	const WEEK = 604800;

	beforeEach(async () => {
		const ThalesContract = artifacts.require('contracts/Token/OpThales_L1.sol:OpThales');
		const SNXRewardsContract = artifacts.require('SNXRewards');

		const metaUri = 'https://thales-protocol.s3.eu-north-1.amazonaws.com/TaleOfThales/{id}.json';

		SNXRewards = await SNXRewardsContract.new({ from: owner });
		Thales = await ThalesContract.new({ from: owner });

		const StakingThalesContract = artifacts.require('StakingThales');
		StakingThales = await StakingThalesContract.new({ from: owner });

		await StakingThales.initialize(
			owner,
			Thales.address,
			Thales.address,
			Thales.address,
			WEEK,
			WEEK,
			SNXRewards.address,
			{ from: owner }
		);

		TaleOfThalesNFTs = artifacts.require('TaleOfThalesNFTs');

		taleOfThalesContract = await TaleOfThalesNFTs.new(StakingThales.address, metaUri, {
			from: owner,
		});
	});

	describe('Adding collection', () => {
		it('Should revert, not owner', async () => {
			await expect(
				taleOfThalesContract.addNewCollection(false, false, 0, 0, [first, second], { from: third })
			).to.be.revertedWith('Ownable: caller is not the owner');
		});

		it('Should revert because whitelist is empty', async () => {
			await expect(
				taleOfThalesContract.addNewCollection(false, false, 0, 0, [], { from: owner })
			).to.be.revertedWith('Whitelist cannot be empty');
		});

		it('Should pass with staking minimal amount', async () => {
			let minimalStakingAmount = '10';

			await taleOfThalesContract.addNewCollection(
				true,
				false,
				toUnit(minimalStakingAmount),
				0,
				[],
				{ from: owner }
			);

			let lastCollectionIndex = await taleOfThalesContract.getLatestCollectionIndex();

			assert.bnEqual(1, await taleOfThalesContract.getLatestCollectionIndex());
			assert.bnEqual(
				toUnit(minimalStakingAmount),
				await taleOfThalesContract.collectionToMinimumStakeAmount(lastCollectionIndex)
			);
		});

		it('Should create two new collections and return last created collection index', async () => {
			await taleOfThalesContract.addNewCollection(false, false, 0, 0, [first, second, third], {
				from: owner,
			});
			await taleOfThalesContract.addNewCollection(true, false, toUnit('10'), 0, [], {
				from: owner,
			});

			assert.bnEqual(2, await taleOfThalesContract.getLatestCollectionIndex());
		});

		it('Should create two new collections and check if address is in addressCanMintCollection mapping', async () => {
			await taleOfThalesContract.addNewCollection(true, false, toUnit('10'), 0, [], {
				from: owner,
			});
			await taleOfThalesContract.addNewCollection(false, false, 0, 0, [first, second], {
				from: owner,
			});

			assert.bnEqual(
				true,
				await taleOfThalesContract.addressCanMintCollection(
					await taleOfThalesContract.getLatestCollectionIndex(),
					first
				)
			);
			assert.bnEqual(
				false,
				await taleOfThalesContract.addressCanMintCollection(
					await taleOfThalesContract.getLatestCollectionIndex(),
					third
				)
			);
		});

		describe('Updating conditions for existing collection', () => {
			it('Should revert, whitelist empty array', async () => {
				await taleOfThalesContract.addNewCollection(false, false, 0, 0, [first, second], {
					from: owner,
				});
				await expect(
					taleOfThalesContract.updateWhitelistForCollection(1, [], false, { from: owner })
				).to.be.revertedWith('Whitelist cannot be empty');
			});

			it('Should revert, not owner', async () => {
				await taleOfThalesContract.addNewCollection(false, false, 0, 0, [first, second], {
					from: owner,
				});
				await expect(
					taleOfThalesContract.updateWhitelistForCollection(1, [], false, { from: third })
				).to.be.revertedWith('Ownable: caller is not the owner');
			});

			it('Should update whitelist for existing collection', async () => {
				await taleOfThalesContract.addNewCollection(false, false, 0, 0, [first, second], {
					from: owner,
				});
				await taleOfThalesContract.updateWhitelistForCollection(1, [third], true, { from: owner });
				assert.bnEqual(true, await taleOfThalesContract.addressCanMintCollection(1, third));
			});

			it('Should update whitelist update also for collection that have minting condition staking', async () => {
				await taleOfThalesContract.addNewCollection(
					false,
					true,
					0,
					toUnit('100'),
					[first, second],
					{ from: owner }
				);
				await taleOfThalesContract.updateWhitelistForCollection(1, [third], true, { from: owner });

				assert.bnEqual(await taleOfThalesContract.addressCanMintCollection(1, third), true);
				assert.bnEqual(await taleOfThalesContract.addressCanMintCollection(1, first), true);
				assert.bnEqual(await taleOfThalesContract.addressCanMintCollection(1, second), true);
			});

			it('Should change minting condition from staking to volume', async () => {
				await taleOfThalesContract.addNewCollection(
					true,
					false,
					toUnit('100'),
					0,
					[first, second],
					{ from: owner }
				);

				assert.bnEqual(await taleOfThalesContract.collectionToMinimumStakeAmount(1), toUnit('100'));

				await taleOfThalesContract.updateMintingCondition(1, toUnit('10'), 0, { from: owner });

				assert.bnEqual(await taleOfThalesContract.collectionToMinimumStakeAmount(1), 0);
				assert.bnEqual(await taleOfThalesContract.collectionToMinimalVolume(1), toUnit('10'));
			});

			it('Should revert while updating minting condition, both condition entered', async () => {
				await taleOfThalesContract.addNewCollection(
					true,
					false,
					toUnit('100'),
					0,
					[first, second],
					{ from: owner }
				);
				await expect(
					taleOfThalesContract.updateMintingCondition(1, toUnit('10'), toUnit('10'), {
						from: owner,
					})
				).to.be.revertedWith('Can not add both conditions');
			});

			it('Should revert while updating minting condition, none of the conditions entered', async () => {
				await taleOfThalesContract.addNewCollection(
					true,
					false,
					toUnit('100'),
					0,
					[first, second],
					{ from: owner }
				);
				await expect(
					taleOfThalesContract.updateMintingCondition(1, 0, 0, { from: owner })
				).to.be.revertedWith('One of the condition must be entered.');
			});
		});
	});

	describe('Adding item to collection', () => {
		it('Should revert adding the item, not owner user', async () => {
			await taleOfThalesContract.addNewCollection(false, false, 0, 0, [first, second, third], {
				from: owner,
			});
			await expect(
				taleOfThalesContract.addItemToCollection(
					0,
					await taleOfThalesContract.getLatestCollectionIndex(),
					{ from: third }
				)
			).to.be.revertedWith('Ownable: caller is not the owner');
		});

		it('Should revert adding item, wrong collection index', async () => {
			await taleOfThalesContract.addNewCollection(false, false, 0, 0, [first, second, third], {
				from: owner,
			});
			await expect(
				taleOfThalesContract.addItemToCollection(0, 2, { from: owner })
			).to.be.revertedWith('Collection with given index do not exist.');
		});

		it('Should add items to collection and emit events', async () => {
			await taleOfThalesContract.addNewCollection(false, false, 0, 0, [first, second, third], {
				from: owner,
			});
			const txFirstItem = await taleOfThalesContract.addItemToCollection(0, 1, { from: owner });
			const txSecondItem = await taleOfThalesContract.addItemToCollection(1, 1, { from: owner });

			// Check if item is added to collectionToItems mapping
			const firstItem = await taleOfThalesContract.collectionToItems(1, 0);
			const secondItem = await taleOfThalesContract.collectionToItems(1, 1);

			assert.bnEqual(0, firstItem.itemType);
			assert.bnEqual(1, firstItem.index);

			assert.bnEqual(1, secondItem.itemType);
			assert.bnEqual(2, secondItem.index);

			assert.eventEqual(txFirstItem.logs[0], 'AddedNewItemToCollection', {
				_itemIndex: 1,
				_collectionIndex: 1,
				_itemType: 0,
			});

			assert.eventEqual(txSecondItem.logs[0], 'AddedNewItemToCollection', {
				_itemIndex: 2,
				_collectionIndex: 1,
				_itemType: 1,
			});

			assert.bnEqual(2, await taleOfThalesContract.getLatestItemIndex());
			assert.bnEqual(1, await taleOfThalesContract.itemIndexToCollection(1));
			assert.bnEqual(1, await taleOfThalesContract.itemIndexToCollection(2));
		});

		it('Should revert while trying to add item with same type', async () => {
			await taleOfThalesContract.addNewCollection(false, false, 0, 0, [first, second, third], {
				from: owner,
			});
			await taleOfThalesContract.addItemToCollection(0, 1, { from: owner });
			await expect(
				taleOfThalesContract.addItemToCollection(0, 1, { from: owner })
			).to.be.revertedWith('This type of wear is already added to collection.');
		});

		it('Should revert while trying to add item with same type', async () => {
			await taleOfThalesContract.addNewCollection(false, false, 0, 0, [first, second, third], {
				from: owner,
			});
			await taleOfThalesContract.addItemToCollection(0, 1, { from: owner });
			await expect(
				taleOfThalesContract.addItemToCollection(0, 1, { from: owner })
			).to.be.revertedWith('This type of wear is already added to collection.');
		});

		it('Should return collection index from item index', async () => {
			await taleOfThalesContract.addNewCollection(false, false, 0, 0, [first, second, third], {
				from: owner,
			});
			await taleOfThalesContract.addItemToCollection(0, 1, { from: owner });
			await taleOfThalesContract.addItemToCollection(1, 1, { from: owner });
			await taleOfThalesContract.addNewCollection(false, false, 0, 0, [first, second], {
				from: owner,
			});
			await taleOfThalesContract.addItemToCollection(0, 2, { from: owner });
			await taleOfThalesContract.addItemToCollection(1, 2, { from: owner });

			assert.bnEqual(2, await taleOfThalesContract.getCollectionIndexFromItemIndex(3));
			assert.bnEqual(2, await taleOfThalesContract.getCollectionIndexFromItemIndex(4));
			assert.bnEqual(1, await taleOfThalesContract.getCollectionIndexFromItemIndex(2));
		});
	});

	describe('Minting', () => {
		it('Should revert, address not whitelisted, minting item', async () => {
			await taleOfThalesContract.addNewCollection(false, false, 0, 0, [first, second], {
				from: owner,
			});
			await taleOfThalesContract.addItemToCollection(0, 1, { from: owner });
			await taleOfThalesContract.addItemToCollection(1, 1, { from: owner });
			await taleOfThalesContract.addItemToCollection(2, 1, { from: owner });
			await expect(taleOfThalesContract.mintItem(2, { from: third })).to.be.revertedWith(
				'Address is not eligible to mint this item'
			);
		});

		it('Should mint item', async () => {
			await taleOfThalesContract.addNewCollection(false, false, 0, 0, [first, second], {
				from: owner,
			});
			await taleOfThalesContract.addItemToCollection(0, 1, { from: owner });

			const tx = await taleOfThalesContract.mintItem(1, { from: second });

			assert.bnEqual(1, await taleOfThalesContract.balanceOf(second, 1));
			assert.eventEqual(tx.logs[1], 'ItemMinted', {
				_itemIndex: 1,
				_minter: second,
			});
		});

		it('Should revert, address not whitelisted, minting collection', async () => {
			await taleOfThalesContract.addNewCollection(false, false, 0, 0, [first, second], {
				from: owner,
			});
			await taleOfThalesContract.addItemToCollection(0, 1, { from: owner });
			await taleOfThalesContract.addItemToCollection(1, 1, { from: owner });
			await taleOfThalesContract.addItemToCollection(2, 1, { from: owner });
			await expect(taleOfThalesContract.mintCollection(1, { from: third })).to.be.revertedWith(
				'Address is not eligible to mint this collection'
			);
		});

		it('Should revert, minting collection, no items added to collection', async () => {
			await taleOfThalesContract.addNewCollection(false, false, 0, 0, [first, second], {
				from: owner,
			});
			await expect(taleOfThalesContract.mintCollection(1, { from: second })).to.be.revertedWith(
				'There are no items in this collection'
			);
		});

		it('Should mint collection, also revert when user try to mint item from that collection', async () => {
			await taleOfThalesContract.addNewCollection(false, false, 0, 0, [first, second], {
				from: owner,
			});
			await taleOfThalesContract.addItemToCollection(0, 1, { from: owner });
			await taleOfThalesContract.addItemToCollection(1, 1, { from: owner });
			await taleOfThalesContract.addItemToCollection(2, 1, { from: owner });
			await taleOfThalesContract.addItemToCollection(3, 1, { from: owner });

			const tx = await taleOfThalesContract.mintCollection(1, { from: second });

			assert.eventEqual(tx.logs[1], 'CollectionMinted', {
				_items: [1, 2, 3, 4],
				_minter: second,
			});

			assert.bnEqual(1, await taleOfThalesContract.balanceOf(second, 1));
			assert.bnEqual(1, await taleOfThalesContract.balanceOf(second, 2));
			assert.bnEqual(1, await taleOfThalesContract.balanceOf(second, 3));
			assert.bnEqual(1, await taleOfThalesContract.balanceOf(second, 4));

			await expect(taleOfThalesContract.mintItem(1, { from: second })).to.be.revertedWith(
				'Address is not eligible to mint this item'
			);
		});

		it('Should mint collection, but skip item that already minted', async () => {
			await taleOfThalesContract.addNewCollection(false, false, 0, 0, [first, second], {
				from: owner,
			});
			await taleOfThalesContract.addItemToCollection(0, 1, { from: owner });
			await taleOfThalesContract.addItemToCollection(1, 1, { from: owner });
			await taleOfThalesContract.addItemToCollection(2, 1, { from: owner });
			await taleOfThalesContract.addItemToCollection(3, 1, { from: owner });

			// Minted second item
			await taleOfThalesContract.mintItem(2, { from: second });

			// Confirm that user has minted item
			assert.bnEqual(1, await taleOfThalesContract.balanceOf(second, 2));
			assert.bnEqual(0, await taleOfThalesContract.balanceOf(second, 1));

			await taleOfThalesContract.mintCollection(1, { from: second });

			assert.bnEqual(1, await taleOfThalesContract.balanceOf(second, 1));
			assert.bnEqual(1, await taleOfThalesContract.balanceOf(second, 2));
			assert.bnEqual(1, await taleOfThalesContract.balanceOf(second, 3));
			assert.bnEqual(1, await taleOfThalesContract.balanceOf(second, 4));
			assert.bnEqual(0, await taleOfThalesContract.balanceOf(second, 0));
		});

		it('Should mint collection with two items, then add items to collection and again mint same collection', async () => {
			await taleOfThalesContract.addNewCollection(false, false, 0, 0, [first, second], {
				from: owner,
			});
			await taleOfThalesContract.addItemToCollection(0, 1, { from: owner });
			await taleOfThalesContract.addItemToCollection(1, 1, { from: owner });

			const firstTx = await taleOfThalesContract.mintCollection(1, { from: second });

			// Confirm that collection is minted
			assert.bnEqual(1, await taleOfThalesContract.balanceOf(second, 1));
			assert.bnEqual(1, await taleOfThalesContract.balanceOf(second, 2));

			assert.eventEqual(firstTx.logs[1], 'CollectionMinted', {
				_items: [1, 2],
				_minter: second,
			});

			await taleOfThalesContract.addItemToCollection(2, 1, { from: owner });
			await taleOfThalesContract.addItemToCollection(3, 1, { from: owner });

			const secondTx = await taleOfThalesContract.mintCollection(1, { from: second });

			assert.eventEqual(secondTx.logs[1], 'CollectionMinted', {
				_items: [0, 0, 3, 4],
				_minter: second,
			});

			assert.bnEqual(1, await taleOfThalesContract.balanceOf(second, 1));
			assert.bnEqual(1, await taleOfThalesContract.balanceOf(second, 2));
			assert.bnEqual(1, await taleOfThalesContract.balanceOf(second, 3));
			assert.bnEqual(1, await taleOfThalesContract.balanceOf(second, 4));
		});

		describe('Transfer minted item', () => {
			it('Should transfer minted item to other address', async () => {
				await taleOfThalesContract.addNewCollection(false, false, 0, 0, [first, second], {
					from: owner,
				});
				await taleOfThalesContract.addItemToCollection(0, 1, { from: owner });

				await taleOfThalesContract.mintItem(1, { from: second });

				// Confirm that address "second" has item
				assert.bnEqual(1, await taleOfThalesContract.balanceOf(second, 1));

				await taleOfThalesContract.safeTransferFrom(second, first, 1, 1, '0x', { from: second });

				// Confirm of item transfer
				assert.bnEqual(0, await taleOfThalesContract.balanceOf(second, 1));
				assert.bnEqual(1, await taleOfThalesContract.balanceOf(first, 1));
			});

			it('Should revert minting already minted and transfered item', async () => {
				await taleOfThalesContract.addNewCollection(false, false, 0, 0, [first, second], {
					from: owner,
				});
				await taleOfThalesContract.addItemToCollection(0, 1, { from: owner });

				await taleOfThalesContract.mintItem(1, { from: second });

				// Confirm that address "second" has item
				assert.bnEqual(1, await taleOfThalesContract.balanceOf(second, 1));

				await taleOfThalesContract.safeTransferFrom(second, first, 1, 1, '0x', { from: second });

				await expect(taleOfThalesContract.mintItem(1, { from: second })).to.be.revertedWith(
					'Address is not eligible to mint this item'
				);
			});
		});
	});

	describe('Contract managment, pause', () => {
		it('Should revert, trying to pause as non owner', async () => {
			assert.bnEqual(false, await taleOfThalesContract.paused());
			await expect(taleOfThalesContract.pause({ from: first })).to.be.revertedWith(
				'Ownable: caller is not the owner'
			);
		});

		it('Should pause contract', async () => {
			assert.bnEqual(false, await taleOfThalesContract.paused());
			await taleOfThalesContract.pause({ from: owner });
			assert.bnEqual(true, await taleOfThalesContract.paused());
		});

		it('Should revert while minting, while contract is paused', async () => {
			await taleOfThalesContract.addNewCollection(false, false, 0, 0, [first, second, third], {
				from: owner,
			});
			await taleOfThalesContract.addItemToCollection(0, 1, { from: owner });
			await taleOfThalesContract.pause({ from: owner });

			// Confirmation that contract is paused
			assert.bnEqual(true, await taleOfThalesContract.paused());

			await expect(taleOfThalesContract.mintItem(1, { from: first })).to.be.revertedWith(
				'Pausable: paused'
			);
		});

		it('Should revert on creating collection, paused contract', async () => {
			await taleOfThalesContract.pause({ from: owner });
			assert.bnEqual(true, await taleOfThalesContract.paused());
			await expect(
				taleOfThalesContract.addNewCollection(false, false, 0, 0, [first, second], { from: owner })
			).to.be.revertedWith('Pausable: paused');
		});

		it('Should revert on adding item to collection, paused contract', async () => {
			await taleOfThalesContract.addNewCollection(false, false, 0, 0, [first, second, third], {
				from: owner,
			});
			await taleOfThalesContract.pause({ from: owner });
			assert.bnEqual(true, await taleOfThalesContract.paused());
			await expect(
				taleOfThalesContract.addItemToCollection(0, 1, { from: owner })
			).to.be.revertedWith('Pausable: paused');
		});

		it('Should revert setURI, not owner', async () => {
			await expect(taleOfThalesContract.setURI('https://test.com/{id}.json')).to.be.revertedWith(
				'Ownable: caller is not the owner'
			);
		});

		it('Should set new uri', async () => {
			await taleOfThalesContract.addNewCollection(false, false, 0, 0, [first, second, third], {
				from: owner,
			});
			await taleOfThalesContract.addItemToCollection(0, 1, { from: owner });

			expect(await taleOfThalesContract.uri(1)).to.equal(
				'https://thales-protocol.s3.eu-north-1.amazonaws.com/TaleOfThales/{id}.json'
			);

			await taleOfThalesContract.setURI('https://test.com/{id}.json', { from: owner });
			expect(await taleOfThalesContract.uri(1)).to.equal('https://test.com/{id}.json');
		});
	});
});
