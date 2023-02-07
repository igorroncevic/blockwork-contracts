const { ethers } = require("hardhat");
const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { fetchNewAgreement, newUUID } = require("./utils");

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

    describe("Lock Funds", () => {
        it("should lock funds", async () => {
            const { middleman, owner, recipient, amount } = await loadFixture(
                deployMiddlemanFixture,
            );

            const id = newUUID();

            const tx = await middleman
                .connect(owner)
                .lockFunds(id, recipient.address, amount, { value: amount });

            expect(tx).to.changeEtherBalances([owner, middleman], [-amount, amount]);

            const agreement = await fetchNewAgreement(
                middleman,
                tx,
                0,
                id,
                owner.address,
                recipient.address,
            );

            expect(agreement.id).to.equal(id);
            expect(agreement.owner).to.equal(owner.address);
            expect(agreement.recipient).to.equal(recipient.address);
            expect(agreement.amount).to.equal(amount);
            expect(agreement.isCompleted).to.equal(false);
            expect(agreement.isDisputed).to.equal(false);
        });

        it("should revert due to insufficient funds", async () => {
            const { middleman, owner, recipient, amount } = await loadFixture(
                deployMiddlemanFixture,
            );

            // https://hardhat.org/hardhat-chai-matchers/docs/overview#reverts
            await expect(
                middleman.connect(owner).lockFunds(newUUID(), recipient.address, amount),
            ).to.be.revertedWith("Insufficient funds.");
        });
    });

    describe("Release Funds", () => {
        it("should revert because funds are not being released by the owner", async () => {
            const { middleman, owner, recipient, amount } = await loadFixture(
                deployMiddlemanFixture,
            );

            const tx1 = await middleman
                .connect(owner)
                .lockFunds(newUUID(), recipient.address, amount, { value: amount });
            expect(tx1).to.changeEtherBalances([owner, middleman], [-amount, amount]);

            // not using await on tx2 as it won't return a response, since it will panic first
            // panic code 0x32 (Array accessed at an out-of-bounds or negative index)
            await expect(
                middleman.connect(recipient).releaseFunds(recipient.address, 0),
            ).to.be.reverted;
        });

        it("should revert because the agreement is still disputed", async () => {
            const { middleman, owner, recipient, amount } = await loadFixture(
                deployMiddlemanFixture,
            );

            const tx1 = await middleman
                .connect(owner)
                .lockFunds(newUUID(), recipient.address, amount, { value: amount });
            expect(tx1).to.changeEtherBalances([owner, middleman], [-amount, amount]);

            await expect(
                middleman.initiateDispute(owner.address, recipient.address, 0),
            ).to.not.be.reverted;

            await expect(
                middleman.connect(owner).releaseFunds(recipient.address, 0),
            ).to.be.revertedWith("This agreement is disputed.");
        });

        it("should revert because funds have already been released", async () => {
            const { middleman, owner, recipient, amount } = await loadFixture(
                deployMiddlemanFixture,
            );

            const tx1 = await middleman
                .connect(owner)
                .lockFunds(newUUID(), recipient.address, amount, { value: amount });
            expect(tx1).to.changeEtherBalances([owner, middleman], [-amount, amount]);

            expect(
                await middleman.connect(owner).releaseFunds(recipient.address, 0),
            ).to.changeEtherBalances([middleman, recipient], [-amount, amount]);

            await expect(
                middleman.connect(owner).releaseFunds(recipient.address, 0),
            ).to.be.revertedWith("This agreement has already been completed.");
        });

        it("should release funds", async () => {
            const { middleman, owner, recipient, amount } = await loadFixture(
                deployMiddlemanFixture,
            );

            const tx1 = await middleman
                .connect(owner)
                .lockFunds(newUUID(), recipient.address, amount, { value: amount });

            expect(tx1).to.changeEtherBalances([owner, middleman], [-amount, amount]);

            expect(
                await middleman.connect(owner).releaseFunds(recipient.address, 0),
            ).to.changeEtherBalances([middleman, recipient], [-amount, amount]);
        });
    });

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
