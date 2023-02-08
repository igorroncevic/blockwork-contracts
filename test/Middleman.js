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
        it("should revert due to insufficient funds", async () => {
            const { middleman, owner, recipient, amount } = await loadFixture(
                deployMiddlemanFixture,
            );

            // https://hardhat.org/hardhat-chai-matchers/docs/overview#reverts
            await expect(
                middleman.connect(owner).lockFunds(newUUID(), recipient.address, amount),
            ).to.be.revertedWith("Insufficient funds.");
        });

        it("should lock funds", async () => {
            const { middleman, owner, recipient, amount } = await loadFixture(
                deployMiddlemanFixture,
            );

            const agreementId = newUUID();

            const tx = await middleman
                .connect(owner)
                .lockFunds(agreementId, recipient.address, amount, { value: amount });

            expect(tx).to.changeEtherBalances([owner, middleman], [-amount, amount]);

            const agreement = await fetchNewAgreement(
                middleman,
                owner.address,
                recipient.address,
                agreementId,
            );

            expect(agreement.owner).to.equal(owner.address);
            expect(agreement.amount).to.equal(amount);
            expect(agreement.isCompleted).to.equal(false);
            expect(agreement.isDisputed).to.equal(false);
        });
    });

    describe("Release Funds", () => {
        it("should revert because funds are not being released by the owner", async () => {
            const { middleman, owner, recipient, amount } = await loadFixture(
                deployMiddlemanFixture,
            );

            const agreementId = newUUID();

            const tx1 = await middleman
                .connect(owner)
                .lockFunds(agreementId, recipient.address, amount, { value: amount });
            expect(tx1).to.changeEtherBalances([owner, middleman], [-amount, amount]);

            // not using await on tx2 as it won't return a response, since it will panic first
            // panic code 0x32 (Array accessed at an out-of-bounds or negative index)
            await expect(
                middleman.connect(recipient).releaseFunds(recipient.address, agreementId),
            ).to.be.reverted;
        });

        it("should revert because the agreement is still disputed", async () => {
            const { middleman, owner, recipient, amount } = await loadFixture(
                deployMiddlemanFixture,
            );

            const agreementId = newUUID();

            const tx1 = await middleman
                .connect(owner)
                .lockFunds(agreementId, recipient.address, amount, { value: amount });
            expect(tx1).to.changeEtherBalances([owner, middleman], [-amount, amount]);

            await expect(
                middleman
                    .connect(owner)
                    .initiateDispute(owner.address, recipient.address, agreementId, newUUID()),
            ).to.not.be.reverted;

            await expect(
                middleman.connect(owner).releaseFunds(recipient.address, agreementId),
            ).to.be.revertedWith("This agreement is disputed.");
        });

        it("should revert because funds have already been released", async () => {
            const { middleman, owner, recipient, amount } = await loadFixture(
                deployMiddlemanFixture,
            );

            const agreementId = newUUID();

            const tx1 = await middleman
                .connect(owner)
                .lockFunds(agreementId, recipient.address, amount, { value: amount });
            expect(tx1).to.changeEtherBalances([owner, middleman], [-amount, amount]);

            const tx2 = await middleman.connect(owner).releaseFunds(recipient.address, agreementId);
            expect(tx2).to.changeEtherBalances([middleman, recipient], [-amount, amount]);

            const agreement = await fetchNewAgreement(
                middleman,
                owner.address,
                recipient.address,
                agreementId,
            );

            expect(agreement.isCompleted).to.equal(true);

            await expect(
                middleman.connect(owner).releaseFunds(recipient.address, agreementId),
            ).to.be.revertedWith("This agreement has already been completed.");
        });

        it("should release funds", async () => {
            const { middleman, owner, recipient, amount } = await loadFixture(
                deployMiddlemanFixture,
            );

            const agreementId = newUUID();

            const tx1 = await middleman
                .connect(owner)
                .lockFunds(agreementId, recipient.address, amount, { value: amount });

            expect(tx1).to.changeEtherBalances([owner, middleman], [-amount, amount]);

            const tx2 = await middleman.connect(owner).releaseFunds(recipient.address, agreementId);
            expect(tx2).to.changeEtherBalances([middleman, recipient], [-amount, amount]);

            const agreement = await fetchNewAgreement(
                middleman,
                owner.address,
                recipient.address,
                agreementId,
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
            const disputeId = newUUID();

            const tx1 = await middleman
                .connect(owner)
                .lockFunds(agreementId, recipient.address, amount, { value: amount });
            expect(tx1).to.changeEtherBalances([owner, middleman], [-amount, amount]);

            const tx2 = await middleman
                .connect(owner)
                .initiateDispute(owner.address, recipient.address, agreementId, disputeId);

            const agreement = await fetchNewAgreement(
                middleman,
                owner.address,
                recipient.address,
                agreementId,
            );
            const dispute = await fetchNewDispute(
                middleman,
                owner.address,
                recipient.address,
                disputeId,
            );

            expect(agreement.isDisputed).to.equal(true);
            expect(dispute.agreementId).to.equal(agreementId);

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
                const {
                    middleman,
                    owner,
                    recipient,
                    agreement,
                } = await createAgreementAndInitiateDispute();

                await expect(
                    middleman
                        .connect(owner)
                        .initiateDispute(owner.address, recipient.address, agreement.id, newUUID()),
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

                const tx2 = await middleman
                    .connect(owner)
                    .releaseFunds(recipient.address, agreementId);
                expect(tx2).to.changeEtherBalances([middleman, recipient], [-amount, amount]);

                const agreement = await fetchNewAgreement(
                    middleman,
                    owner.address,
                    recipient.address,
                    agreementId,
                );

                expect(agreement.isCompleted).to.equal(true);

                await expect(
                    middleman
                        .connect(owner)
                        .initiateDispute(
                            owner.address,
                            recipient.address,
                            agreementId,
                            newUUID(),
                        ),
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
                    agreement,
                    dispute,
                } = await createAgreementAndInitiateDispute();

                await expect(
                    middleman
                        .connect(owner)
                        .resolveDispute(
                            owner.address,
                            recipient.address,
                            dispute.id,
                            agreement.id,
                            true,
                        ),
                ).to.be.revertedWith("Only the assigned arbitrator can resolve this dispute.");
            });

            it("should revert because dispute has already been resolved", async () => {
                const {
                    middleman,
                    owner,
                    recipient,
                    arbitrator,
                    agreement,
                    dispute,
                } = await createAgreementAndInitiateDispute();

                await expect(
                    middleman
                        .connect(arbitrator)
                        .resolveDispute(
                            owner.address,
                            recipient.address,
                            dispute.id,
                            agreement.id,
                            true,
                        ),
                ).to.not.be.reverted;

                const newDispute = await fetchNewDispute(
                    middleman,
                    owner.address,
                    recipient.address,
                    dispute.id,
                );

                expect(newDispute.resolved).to.equal(true);

                await expect(
                    middleman
                        .connect(arbitrator)
                        .resolveDispute(
                            owner.address,
                            recipient.address,
                            dispute.id,
                            agreement.id,
                            true,
                        ),
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
                    dispute,
                } = await createAgreementAndInitiateDispute();

                const tx = await middleman
                    .connect(arbitrator)
                    .resolveDispute(
                        owner.address,
                        recipient.address,
                        dispute.id,
                        agreement.id,
                        true,
                    );
                // isOwner = true --> ether back to owner
                expect(tx).to.changeEtherBalances([middleman, owner], [-amount, amount]);

                const newAgreement = await fetchNewAgreement(
                    middleman,
                    owner.address,
                    recipient.address,
                    agreement.id,
                );
                expect(newAgreement.isDisputed).to.equal(false);
                expect(newAgreement.isCompleted).to.equal(true);

                const newDispute = await fetchNewDispute(
                    middleman,
                    owner.address,
                    recipient.address,
                    dispute.id,
                );
                expect(newDispute.resolved).to.equal(true);
            });
        });
    });
});
