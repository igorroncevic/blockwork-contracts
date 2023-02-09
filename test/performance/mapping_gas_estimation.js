const { ethers } = require("hardhat");
const { expect } = require("chai");

const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { newUUID } = require("../utils");

/* 09 Feb 2023 - Results
      ~~~ Save ~~~
Simple TX gas cost: 250295
Complex TX gas cost: 139201

  ~~~ Find and Pay ~~~
Simple TX gas cost: 37813
Complex TX gas cost: 31113

Conclusion --> nested "relationship" mappings are more cost efficient than simple mappings
*/

// npx hardhat test ./test/performance/mapping_gas_estimation.js
describe.only("Mapping Performance Test", () => {
    const deployMPTFixture = async () => {
        const deployer = (await ethers.getSigners())[0];
        const owner = (await ethers.getSigners())[1];
        const recipient = (await ethers.getSigners())[2];
        const arbitrator = (await ethers.getSigners())[3];
        const amount = ethers.utils.parseEther("1.0");

        const mappingPerformanceTest = await ethers.getContractFactory("MappingPerformanceTest");
        const mpt = await mappingPerformanceTest.deploy();
        await mpt.deployed();

        return { deployer, owner, recipient, arbitrator, amount, mpt };
    };

    const saveMethod = async () => {
        const { mpt, owner, arbitrator, recipient, amount } = await loadFixture(deployMPTFixture);

        const disputeId1 = newUUID();
        const agreementId1 = newUUID();

        const disputeId2 = newUUID();
        const agreementId2 = newUUID();

        const simpleSaveTx = await mpt
            .connect(owner)
            .DisputeSimpleMappingSaveTest(
                disputeId1,
                agreementId1,
                recipient.address,
                arbitrator.address,
                amount,
                { value: amount },
            );

        const complexSaveTx = await mpt
            .connect(owner)
            .DisputeComplexMappingSaveTest(
                disputeId2,
                agreementId2,
                recipient.address,
                arbitrator.address,
                amount,
                { value: amount },
            );

        const simpleSaveTxReceipt = await simpleSaveTx.wait();
        const complexSaveTxReceipt = await complexSaveTx.wait();

        return {
            mpt,
            owner,
            recipient,
            simpleDisputeId: disputeId1,
            complexDisputeId: disputeId2,
            simpleSaveTxReceipt,
            complexSaveTxReceipt,
        };
    };

    it("should compare Save methods", async () => {
        const { simpleSaveTxReceipt, complexSaveTxReceipt } = await saveMethod();

        console.log("\n~~~ Save ~~~\n");
        console.log(`Simple TX gas cost: ${simpleSaveTxReceipt.gasUsed}`);
        console.log(`Complex TX gas cost: ${complexSaveTxReceipt.gasUsed}\n`);

        expect(true).to.equal(true);
    });

    it("should compare Find and Pay methods", async () => {
        const { mpt, owner, recipient, simpleDisputeId, complexDisputeId } = await saveMethod();

        const simpleFindAndPayTx = await mpt
            .connect(owner)
            .DisputeSimpleMappingFindAndPayTest(
                owner.address,
                recipient.address,
                simpleDisputeId,
                false,
            );

        const complexFindAndPayTx = await mpt
            .connect(owner)
            .DisputeSimpleMappingFindAndPayTest(
                owner.address,
                recipient.address,
                complexDisputeId,
                false,
            );

        const simpleFindAndPayTxReceipt = await simpleFindAndPayTx.wait();
        const complexFindAndPayTxReceipt = await complexFindAndPayTx.wait();

        console.log("\n~~~ Find and Pay ~~~");
        console.log(`Simple TX gas cost: ${simpleFindAndPayTxReceipt.gasUsed}`);
        console.log(`Complex TX gas cost: ${complexFindAndPayTxReceipt.gasUsed}\n`);

        expect(true).to.equal(true);
    });
});
