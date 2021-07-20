const { expect } = require("chai");

describe("Thales", function() {
  it("Deployment should assign the total supply of tokens to the owner", async function() {
    const [owner] = await ethers.getSigners();

    const Thales = await ethers.getContractFactory("Thales");

    const ThalesDeployed = await Thales.deploy();

    const ownerBalance = await ThalesDeployed.balanceOf(owner.address);
    expect(await ThalesDeployed.totalSupply()).to.equal(ownerBalance);
  });
});