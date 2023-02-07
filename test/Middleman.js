const { ethers } = require("hardhat");
const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { fetchNewAgreement, newUUID, fetchNewDispute } = require("./utils");

describe("Middleman Contract", () => {
    const deployMiddlemanFixture = async () => {
        const deployer = (await ethers.getSigners())[0];
        const owner = (await ethers.getSigners())[1];
        const recipient = (await ethers.getSigners())[2];
        const arbitrator = (await ethers.getSigners())[3];
        const amount = ethers.utils.parseEther("1.0");

        const Middleman = await ethers.getContractFactory("Middleman");
        const middleman = await Middleman.deploy(arbitrator.address);
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

            const id = newUUID();

            const tx1 = await middleman
                .connect(owner)
                .lockFunds(id, recipient.address, amount, { value: amount });
            expect(tx1).to.changeEtherBalances([owner, middleman], [-amount, amount]);

            const tx2 = await middleman.connect(owner).releaseFunds(recipient.address, 0);
            expect(tx2).to.changeEtherBalances([middleman, recipient], [-amount, amount]);

            const agreement = await fetchNewAgreement(
                middleman,
                tx1,
                0,
                id,
                owner.address,
                recipient.address,
            );

            expect(agreement.isCompleted).to.equal(true);

            await expect(
                middleman.connect(owner).releaseFunds(recipient.address, 0),
            ).to.be.revertedWith("This agreement has already been completed.");
        });

        it("should release funds", async () => {
            const { middleman, owner, recipient, amount } = await loadFixture(
                deployMiddlemanFixture,
            );

            const id = newUUID();

            const tx1 = await middleman
                .connect(owner)
                .lockFunds(id, recipient.address, amount, { value: amount });

            expect(tx1).to.changeEtherBalances([owner, middleman], [-amount, amount]);

            const tx2 = await middleman.connect(owner).releaseFunds(recipient.address, 0);
            expect(tx2).to.changeEtherBalances([middleman, recipient], [-amount, amount]);

            const agreement = await fetchNewAgreement(
                middleman,
                tx1,
                0,
                id,
                owner.address,
                recipient.address,
            );

            expect(agreement.isCompleted).to.equal(true);
        });
    });

    describe("Handle Disputes", () => {
        const createAgreementAndInitiateDispute = async () => {
            const { middleman, owner, recipient, arbitrator, amount } = await loadFixture(
                deployMiddlemanFixture,
            );

            const agreementId = newUUID();

            const tx1 = await middleman
                .connect(owner)
                .lockFunds(agreementId, recipient.address, amount, { value: amount });
            expect(tx1).to.changeEtherBalances([owner, middleman], [-amount, amount]);

            const tx2 = await middleman
                .connect(owner)
                .initiateDispute(owner.address, recipient.address, 0);

            const agreement = await fetchNewAgreement(
                middleman,
                tx1,
                0,
                agreementId,
                owner.address,
                recipient.address,
            );
            const dispute = await fetchNewDispute(
                middleman,
                tx2,
                0,
                agreementId,
                owner.address,
                recipient.address,
            );

            expect(agreement.isDisputed).to.equal(true);
            expect(agreement.id).to.equal(dispute.agreementId).to.equal(agreementId);
            expect(agreement.owner).to.equal(dispute.owner);
            expect(agreement.recipient).to.equal(dispute.recipient);

            return {
                middleman,
                owner,
                recipient,
                arbitrator,
                agreement,
                dispute,
                agreementTx: tx1,
                disputeTx: tx2,
            };
        };

        describe("Initiate Dispute", () => {
            it("should revert because the agreement is already disputed", async () => {
                const { middleman, owner, recipient } = await createAgreementAndInitiateDispute();

                await expect(
                    middleman.connect(owner).initiateDispute(owner.address, recipient.address, 0),
                ).to.be.revertedWith("This agreement is already disputed.");
            });

            it("should revert because the agreement is already completed", async () => {
                const { middleman, owner, recipient, amount } = await loadFixture(
                    deployMiddlemanFixture,
                );

                const agreementId = newUUID();

                const tx1 = await middleman
                    .connect(owner)
                    .lockFunds(agreementId, recipient.address, amount, { value: amount });
                expect(tx1).to.changeEtherBalances([owner, middleman], [-amount, amount]);

                const tx2 = await middleman.connect(owner).releaseFunds(recipient.address, 0);
                expect(tx2).to.changeEtherBalances([middleman, recipient], [-amount, amount]);

                const agreement = await fetchNewAgreement(
                    middleman,
                    tx1,
                    0,
                    agreementId,
                    owner.address,
                    recipient.address,
                );

                expect(agreement.isCompleted).to.equal(true);

                await expect(
                    middleman.connect(owner).initiateDispute(owner.address, recipient.address, 0),
                ).to.be.revertedWith("Cannot dispute a completed agreement.");
            });

            it("should initiate a dispute", createAgreementAndInitiateDispute);
        });

        describe("Resolve Dispute", () => {
            it("should revert because non-arbitrators cannot resolve disputes", async () => {
                const {
                    middleman,
                    owner,
                    recipient,
                } = await createAgreementAndInitiateDispute();

                await expect(
                    middleman
                        .connect(owner)
                        .resolveDispute(owner.address, recipient.address, 0, 0, true),
                ).to.be.revertedWith("Only the assigned arbitrator can resolve this dispute.");
            });

            it("should revert because dispute has already been resolved", async () => {
                const {
                    middleman,
                    owner,
                    recipient,
                    arbitrator,
                    agreement,
                    disputeTx,
                } = await createAgreementAndInitiateDispute();

                await expect(
                    middleman
                        .connect(arbitrator)
                        .resolveDispute(owner.address, recipient.address, 0, 0, true),
                ).to.not.be.reverted;

                const dispute = await fetchNewDispute(
                    middleman,
                    disputeTx,
                    0,
                    agreement.id,
                    owner.address,
                    recipient.address,
                );

                expect(dispute.resolved).to.equal(true);

                await expect(
                    middleman
                        .connect(arbitrator)
                        .resolveDispute(owner.address, recipient.address, 0, 0, true),
                ).to.be.revertedWith("This dispute has already been resolved.");
            });

            it("should resolve a dispute", async () => {
                const {
                    middleman,
                    owner,
                    recipient,
                    arbitrator,
                    amount,
                    agreement,
                    agreementTx,
                    disputeTx,
                } = await createAgreementAndInitiateDispute();

                const tx = await middleman
                    .connect(arbitrator)
                    .resolveDispute(owner.address, recipient.address, 0, 0, true);
                // isOwner = true --> ether back to owner
                expect(tx).to.changeEtherBalances([middleman, owner], [-amount, amount]);

                const newAgreement = await fetchNewAgreement(
                    middleman,
                    agreementTx,
                    0,
                    agreement.id,
                    owner.address,
                    recipient.address,
                );
                expect(newAgreement.isDisputed).to.equal(false);
                expect(newAgreement.isCompleted).to.equal(true);

                const dispute = await fetchNewDispute(
                    middleman,
                    disputeTx,
                    0,
                    agreement.id,
                    owner.address,
                    recipient.address,
                );
                expect(dispute.resolved).to.equal(true);
            });
        });
    });
});
