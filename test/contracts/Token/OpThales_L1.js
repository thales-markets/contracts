const { expect } = require('chai');

describe('OpThales', function () {
	it('Deployment should assign the total supply of tokens to the owner', async function () {
		const [owner] = await ethers.getSigners();

		const Thales = await ethers.getContractFactory('contracts/Token/OpThales_L1.sol:OpThales');

		const ThalesDeployed = await Thales.deploy();

		const ownerBalance = await ThalesDeployed.balanceOf(owner.address);
		expect(await ThalesDeployed.totalSupply()).to.equal(ownerBalance);
	});
});
