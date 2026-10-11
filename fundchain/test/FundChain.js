const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FundChain", function () {
  async function setup() {
    const [creator, donor, other] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("FundChain");
    const contract = await Factory.deploy();
    await contract.waitForDeployment();
    const latest = await ethers.provider.getBlock("latest");
    const deadline = latest.timestamp + 3600;
    await contract.createCampaign("Save the library", "Books for students", "", ethers.parseEther("1"), deadline);
    return { contract, creator, donor, other, deadline };
  }

  it("creates a campaign and records a donation", async function () {
    const { contract, donor } = await setup();
    await contract.connect(donor).donate(1, { value: ethers.parseEther("0.25") });
    const campaign = await contract.getCampaign(1);
    expect(campaign.raisedWei).to.equal(ethers.parseEther("0.25"));
    expect(await contract.getDonation(1, donor.address)).to.equal(ethers.parseEther("0.25"));
  });

  it("prevents a non-creator from withdrawing", async function () {
    const { contract, donor } = await setup();
    await contract.connect(donor).donate(1, { value: ethers.parseEther("1") });
    await expect(contract.connect(donor).withdraw(1)).to.be.revertedWith("Only creator can withdraw");
  });

  it("lets creator withdraw after reaching the goal", async function () {
    const { contract, creator, donor } = await setup();
    await contract.connect(donor).donate(1, { value: ethers.parseEther("1") });
    await expect(contract.connect(creator).withdraw(1)).to.emit(contract, "FundsWithdrawn");
    expect((await contract.getCampaign(1)).withdrawn).to.equal(true);
  });

  it("allows a donor to refund a failed campaign after deadline", async function () {
    const { contract, donor, deadline } = await setup();
    await contract.connect(donor).donate(1, { value: ethers.parseEther("0.1") });
    await ethers.provider.send("evm_setNextBlockTimestamp", [deadline + 1]);
    await ethers.provider.send("evm_mine", []);
    await expect(contract.connect(donor).refund(1)).to.emit(contract, "RefundClaimed");
    expect(await contract.getDonation(1, donor.address)).to.equal(0);
  });
});
