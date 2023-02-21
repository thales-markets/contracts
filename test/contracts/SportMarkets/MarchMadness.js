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

		marchMadness = await MarchMadnessContract.new(
			{
				from: owner,
			}
		);

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

        it('Should revert, trying to set up date range, not owner', async() => {
            // Initial value not provided
            assert.bnEqual(await marchMadness.canNotMintOrUpdateBefore(), 0);
            assert.bnEqual(await marchMadness.canNotMintOrUpdateAfter(), 0);

            const dateFrom = new Date('01-01-2023').getTime();
            const dateTo = new Date('01-12-2023').getTime();

            await expect(marchMadness.setDateRange(dateFrom, dateTo, { from: first })).to.be.revertedWith(
                'Ownable: caller is not the owner'
            );
        });

        it('Should set date range and emit event', async() => {
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

        it('Should revert adding the result for game, not owner', async() => {
            await expect(marchMadness.setResultForGame(1, 1, { from: first })).to.be.revertedWith(
                'Ownable: caller is not the owner'
            ); 
        });

	});

    describe('Minting', () => {
        it('Should revert revert minting, not in date range', async() => {
            const currentBlockTime = new Date('02-17-2023').getTime() / 1000;
            await network.provider.send('evm_setNextBlockTimestamp', [currentBlockTime]);

            const dateFrom = new Date('01-01-2023').getTime() / 1000;
            const dateTo = new Date('02-15-2023').getTime() / 1000;

            await marchMadness.setDateRange(dateFrom, dateTo, { from: owner });

            await expect(marchMadness.mint(bracketsArray, { from: first })).to.be.revertedWith(
                'Can not mint after settled date'
            )
        });

        it('Should mint', async() => {
            const dateFrom = new Date('01-01-2023').getTime() / 1000;
            const dateTo = new Date('02-25-2023').getTime() / 1000;

            await marchMadness.setDateRange(dateFrom, dateTo, { from: owner });

            await marchMadness.mint(bracketsArray, { from: first });

            assert.bnGt(await marchMadness.balanceOf(first), 0);

        });
    })
});
