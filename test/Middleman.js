const { ethers } = require("hardhat");
const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { fetchNewAgreement } = require("./utils");

describe("Middleman Contract", () => {
    const deployMiddlemanFixture = async () => {
        const deployer = (await ethers.getSigners())[0];
        const owner = (await ethers.getSigners())[1];
        const recipient = (await ethers.getSigners())[2];
        const arbitrator = (await ethers.getSigners())[3];
        const amount = ethers.utils.parseEther("1.0");

        const Middleman = await ethers.getContractFactory("Middleman");
        const middleman = await Middleman.deploy();
        await middleman.deployed();

        return { deployer, owner, recipient, arbitrator, amount, middleman };
    };

    describe("LockFunds", () => {
        it("should lock funds", async () => {
            const { middleman, owner, recipient, amount } = await loadFixture(
                deployMiddlemanFixture,
            );

            const tx = await middleman
                .connect(owner)
                .lockFunds(recipient.address, amount, { value: amount });

            expect(tx).to.changeEtherBalances([owner, middleman], [-amount, amount]);

            const agreement = await fetchNewAgreement(middleman, tx);

            expect(agreement.owner).to.equal(owner.address);
            expect(agreement.recipient).to.equal(recipient.address);
            expect(agreement.amount).to.equal(amount);
        });

        it("should revert due to insufficient funds", async () => {
            const { middleman, owner, recipient, amount } = await loadFixture(
                deployMiddlemanFixture,
            );

            // https://hardhat.org/hardhat-chai-matchers/docs/overview#reverts
            await expect(
                middleman.connect(owner).lockFunds(recipient.address, amount),
            ).to.be.revertedWith("Insufficient funds.");
        });
    });

    // it("should claim funds", async () => {
    //     await middleman.lockFunds(recipient.address, amount);
    //     await middleman.claimFunds(recipient.address);
    //     const balance = await middleman.balanceOf(recipient.address);
    //     expect(balance).to.equal(amount);
    // });

    // it("should handle dispute", async () => {
    //     await middleman.lockFunds(recipient.address, amount);
    //     const disputeIndex = await middleman.dispute(recipient.address, amount);
    //     const assignedArbitrator = await middleman.disputes(disputeIndex).arbitrator;
    //     expect(assignedArbitrator).to.equal("0x0000000000000000000000000000000000000000");
    //     await middleman.assignArbitrator(disputeIndex, arbitrator.address);
    //     const updatedArbitrator = await middleman.disputes(disputeIndex).arbitrator;
    //     expect(updatedArbitrator).to.equal(arbitrator.address);
    //     await middleman.resolveDispute(disputeIndex, true);
    //     const balance = await middleman.balanceOf(owner.address);
    //     expect(balance).to.equal(amount);
    // });
});
