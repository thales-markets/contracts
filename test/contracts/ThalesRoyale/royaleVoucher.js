'use strict';

const { artifacts, contract } = require('hardhat');

const { assert } = require('../../utils/common');

const {
	toUnit
} = require('../../utils')();

contract('ThalesRoyalePass', accounts => {
	const [first, owner, second, third] = accounts;
	let ThalesDeployed;
	let ThalesRoyalePass;
	let ThalesRoyaleDeployed;
	let voucher;
	const price = toUnit(30);
	const priceDouble = toUnit(60);
	const uri = 'http://my-json-server.typicode.com/abcoathup/samplenft/tokens/0';

	beforeEach(async () => {

        let ThalesRoyale = artifacts.require('TestThalesRoyale');
		ThalesRoyaleDeployed = await ThalesRoyale.new({ from: owner });
		let Thales = artifacts.require('Thales');
		ThalesDeployed = await Thales.new({ from: owner });

		ThalesRoyalePass = artifacts.require('ThalesRoyalePass');

		voucher = await ThalesRoyalePass.new(
			ThalesDeployed.address,
			uri,
			ThalesRoyaleDeployed.address
		);

		await ThalesRoyaleDeployed.setBuyInAmount(price);

		await ThalesDeployed.transfer(voucher.address, price, { from: owner });
		await ThalesDeployed.approve(voucher.address, price, { from: owner });

		await ThalesDeployed.transfer(first, price, { from: owner });
		await ThalesDeployed.approve(voucher.address, price, { from: first });

		await ThalesDeployed.transfer(second, price, { from: owner });
		await ThalesDeployed.approve(voucher.address, price, { from: second });

	});

	describe('Thales royale voucher', () => {
		it('Init checking', async () => {
			assert.bnEqual(toUnit(30), await ThalesRoyaleDeployed.getBuyInAmount());
			assert.bnEqual("Thales Royale Pass", await voucher.name());
			assert.bnEqual("TRP", await voucher.symbol());

		});

		it('Minting voucher', async () => {

			const id = 1;

			await voucher.mint(first);

			await expect(voucher.mint(third)).to.be.revertedWith('No enough sUSD');

			assert.bnEqual(id, await voucher.balanceOf(first));
			assert.equal(first, await voucher.ownerOf(id));

			await voucher.safeTransferFrom(first, second, id);

			assert.equal(second, await voucher.ownerOf(id));

			assert.bnEqual(price, await voucher.pricePaidForPass(id));

		});

		it('Top Up', async () => {

			const id_1 = 1;

			await voucher.mint(first);

			assert.bnEqual(1, await voucher.balanceOf(first));
			assert.equal(first, await voucher.ownerOf(id_1));
			assert.bnEqual(price, await voucher.pricePaidForPass(id_1));

			await voucher.safeTransferFrom(first, second, id_1);

			assert.equal(second, await voucher.ownerOf(id_1));

			await voucher.topUp(id_1, price, {from: second});

			assert.bnEqual(priceDouble, await voucher.pricePaidForPass(id_1));

		});

		it('Burning voucher', async () => {

			const id_1 = 1;
			const id_2 = 2;

			await voucher.mint(first);

			assert.bnEqual(1, await voucher.balanceOf(first));
			assert.equal(first, await voucher.ownerOf(id_1));
			assert.bnEqual(price, await voucher.pricePaidForPass(id_1));

			await voucher.safeTransferFrom(first, second, id_1);

			assert.equal(second, await voucher.ownerOf(id_1));

			await expect(voucher.burnWithTransfer(first, id_1, { from: first })).to.be.revertedWith('Sender must be thales royale contract');
		});
	});
});