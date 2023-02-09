//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract MappingPerformanceTest {
    struct DisputeComplexMapping {
        string agreementId;
        address arbitrator;
        uint256 amount;
        bool resolved;
    }

    mapping(address => mapping(address => mapping(string => DisputeComplexMapping))) public disputesComplexMapping; // owner -> (recipient -> (disputeId -> dispute))

    struct DisputeSimpleMapping {
        string id;
        address owner;
        address recipient;
        string agreementId;
        address arbitrator;
        uint256 amount;
        bool resolved;
    }

    mapping(string => DisputeSimpleMapping) public disputesSimpleMapping;

    function DisputeComplexMappingSaveTest(
        string memory _disputeId,
        string memory _agreementId,
        address _recipient,
        address _arbitrator,
        uint256 _amount
    ) public payable {
        disputesComplexMapping[msg.sender][_recipient][_disputeId] = DisputeComplexMapping({
            agreementId: _agreementId,
            arbitrator: _arbitrator,
            amount: _amount,
            resolved: false
        });
    }

    function DisputeComplexMappingFindAndPayTest(
        address _owner,
        address _recipient,
        string memory _disputeId,
        bool _isOwner
    ) public {
        DisputeComplexMapping storage dispute = disputesComplexMapping[_owner][_recipient][_disputeId];

        require(dispute.resolved == false, "Dispute is resolved");

        if (_isOwner) {
            payable(_owner).transfer(dispute.amount);
        } else {
            payable(_recipient).transfer(dispute.amount);
        }
    }

    function DisputeSimpleMappingSaveTest(
        string memory _disputeId,
        string memory _agreementId,
        address _recipient,
        address _arbitrator,
        uint256 _amount
    ) public payable {
        disputesSimpleMapping[_disputeId] = DisputeSimpleMapping({
            id: _disputeId,
            owner: msg.sender,
            recipient: _recipient,
            agreementId: _agreementId,
            arbitrator: _arbitrator,
            amount: _amount,
            resolved: false
        });
    }

    function DisputeSimpleMappingFindAndPayTest(
        address _owner,
        address _recipient,
        string memory _disputeId,
        bool _isOwner
    ) public {
        DisputeSimpleMapping storage dispute = disputesSimpleMapping[_disputeId];

        require(dispute.resolved == false, "Dispute is resolved");

        if (_isOwner) {
            payable(_owner).transfer(dispute.amount);
        } else {
            payable(_recipient).transfer(dispute.amount);
        }
    }
}
