'use strict';

const { expect } = require('chai');
const { artifacts, contract, network } = require('hardhat');

const { assert } = require('../../utils/common');

const { toUnit } = require('../../utils')();

contract('MarchMadness', (accounts) => {
	const [first, owner, second, third] = accounts;
	let MarchMadnessContract;
	let marchMadness;

	const bracketsArray = Array(61).fill(1);

	beforeEach(async () => {
		MarchMadnessContract = artifacts.require('MarchMadness');

		marchMadness = await MarchMadnessContract.new({
			from: owner,
		});
	});

	describe('Contract managment', () => {
		it('Init checking', async () => {
			assert.bnEqual('Overtime March Madness', await marchMadness.name());
			assert.bnEqual('OMM', await marchMadness.symbol());
		});

		it('Should revert, paused contract', async () => {
			await marchMadness.pause({ from: owner });

			await expect(marchMadness.mint(bracketsArray, { from: first })).to.be.revertedWith(
				'Pausable: paused'
			);
		});

		it('Should revert, trying to set up date range, not owner', async () => {
			// Initial value not provided
			assert.bnEqual(await marchMadness.canNotMintOrUpdateBefore(), 0);
			assert.bnEqual(await marchMadness.canNotMintOrUpdateAfter(), 0);

			const dateFrom = new Date('01-01-2023').getTime();
			const dateTo = new Date('01-12-2023').getTime();

			await expect(marchMadness.setDateRange(dateFrom, dateTo, { from: first })).to.be.revertedWith(
				'Ownable: caller is not the owner'
			);
		});

		it('Should set date range and emit event', async () => {
			// Initial value not provided
			assert.bnEqual(await marchMadness.canNotMintOrUpdateBefore(), 0);
			assert.bnEqual(await marchMadness.canNotMintOrUpdateAfter(), 0);

			const dateFrom = new Date('01-01-2023').getTime();
			const dateTo = new Date('01-12-2023').getTime();

			const tx = await marchMadness.setDateRange(dateFrom, dateTo, { from: owner });

			assert.bnEqual(dateFrom, await marchMadness.canNotMintOrUpdateBefore());
			assert.bnEqual(dateTo, await marchMadness.canNotMintOrUpdateAfter());

			assert.eventEqual(tx.logs[0], 'DateRangeUpdated', {
				_fromDate: dateFrom,
				_toDate: dateTo,
			});
		});

		it('Should revert adding the result for game, not owner', async () => {
			await expect(marchMadness.setResultForGame(1, 1, { from: first })).to.be.revertedWith(
				'Ownable: caller is not the owner'
			);
		});
	});

	describe('Minting', () => {
		it('Should revert revert minting, not in date range', async () => {
			const currentBlockTime = new Date('02-17-2023').getTime() / 1000;
			await network.provider.send('evm_setNextBlockTimestamp', [currentBlockTime]);

			const dateFrom = new Date('01-01-2023').getTime() / 1000;
			const dateTo = new Date('02-15-2023').getTime() / 1000;

			await marchMadness.setDateRange(dateFrom, dateTo, { from: owner });

			await expect(marchMadness.mint(bracketsArray, { from: first })).to.be.revertedWith(
				'Can not mint after settled date'
			);

			const newDateFrom = new Date('02-18-2023').getTime() / 1000;
			const newDateTo = new Date('03-18-2023').getTime() / 1000;

			await marchMadness.setDateRange(newDateFrom, newDateTo, { from: owner });

			await expect(marchMadness.mint(bracketsArray, { from: first })).to.be.revertedWith(
				'Can not mint before settled date'
			);
		});

		it('Should mint', async () => {
			const dateFrom = new Date('01-01-2023').getTime() / 1000;
			const dateTo = new Date('02-25-2023').getTime() / 1000;

			await marchMadness.setDateRange(dateFrom, dateTo, { from: owner });

			await marchMadness.mint(bracketsArray, { from: first });

			assert.bnGt(await marchMadness.balanceOf(first), 0);
		});

		it('Should revert, already minted from address', async () => {
			const dateFrom = new Date('01-01-2023').getTime() / 1000;
			const dateTo = new Date('02-25-2023').getTime() / 1000;

			await marchMadness.setDateRange(dateFrom, dateTo, { from: owner });

			await marchMadness.mint(bracketsArray, { from: first });

			assert.bnGt(await marchMadness.balanceOf(first), 0);

			await expect(marchMadness.mint(bracketsArray, { from: first })).to.be.revertedWith(
				'Address already minted'
			);
		});
	});

	describe('Updating minted positions/Getting corrent positions', () => {
		it('Should update already minted position, before that testing reverting on update brackets', async () => {
			const dateFrom = new Date('01-01-2023').getTime() / 1000;
			const dateTo = new Date('02-25-2023').getTime() / 1000;

			await marchMadness.setDateRange(dateFrom, dateTo, { from: owner });

			await marchMadness.mint(bracketsArray, { from: first });

			assert.bnGt(await marchMadness.balanceOf(first), 0);

			const newBrackets = Array.from({ length: 61 }, () =>
				Math.floor(Math.random() == 0 ? 1 : Math.random() * 68)
			);

            const newFirstPosition = 3;
            const newSecondPosition = 4;

            newBrackets[0] = newFirstPosition;
            newBrackets[1] = newSecondPosition;

            await expect(marchMadness.updateBracketsForAlreadyMintedItem(1, newBrackets, { from: second })).to.be.revertedWith(
                'Caller is not owner of entered tokenId'
            );

            await expect(marchMadness.updateBracketsForAlreadyMintedItem(2, newBrackets, { from: second })).to.be.revertedWith(
                'Item does not exists'
            );

            await marchMadness.updateBracketsForAlreadyMintedItem(1, newBrackets, { from: first });

            assert.bnEqual(await marchMadness.itemToBrackets(1, 0), newFirstPosition);
            assert.bnEqual(await marchMadness.itemToBrackets(1, 1), newSecondPosition);
		});

        it('Should display count of correct positions', async() => {
            const dateFrom = new Date('01-01-2023').getTime() / 1000;
			const dateTo = new Date('02-25-2023').getTime() / 1000;

			await marchMadness.setDateRange(dateFrom, dateTo, { from: owner });

            const newBrackets = Array.from({ length: 61 }, () =>
				Math.floor((Math.random() + 0.1) * 68)
			);

            const newFirstPosition = 3;
            const newSecondPosition = 4;

            const newLastPosition = 50;

            newBrackets[0] = newFirstPosition;
            newBrackets[1] = newSecondPosition;

            newBrackets[60] = newLastPosition;

			await marchMadness.mint(newBrackets, { from: first });

			assert.bnGt(await marchMadness.balanceOf(first), 0);

            await marchMadness.setResultForGame(0, newFirstPosition, { from: owner });
            await marchMadness.setResultForGame(1, newSecondPosition, { from: owner });
            await marchMadness.setResultForGame(60, newLastPosition, { from: owner });

            assert.bnEqual(await marchMadness.getCorrectPositionsByTokenId(1), 3);
            assert.bnEqual(await marchMadness.getCorrectPositionsByTokenId(1), 3);
            
            assert.bnEqual(await marchMadness.getCorrectPositionsByMinterAddress(first), 3);
            assert.bnEqual(await marchMadness.getCorrectPositionsByMinterAddress(first), 3);
        })
	});
});
