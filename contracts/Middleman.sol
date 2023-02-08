//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract Middleman {
    event FundsLocked(address indexed owner, address indexed recipient, string agreementId, uint256 amount);
    event FundsReleased(
        address indexed owner,
        address indexed recipient,
        string agreementId
    );
    event DisputeInitiated(
        address indexed owner,
        address indexed recipient,
        string disputeId,
        string agreementId
    );
    event DisputeResolved(
        address indexed owner,
        address indexed recipient,
        string disputeId,
        string agreementId,
        bool isOwner
    );

    address private arbitrator;
    uint256 public balance;

    struct Agreement {
        address owner; // keeping this to allow for owner check when releasing funds
        uint256 amount;
        bool isCompleted;
        bool isDisputed;
    }

    mapping(address => mapping(address => mapping(string => Agreement))) public agreements; // owner -> (recipient -> (agreementId -> agrement))

    struct Dispute {
        string agreementId;
        address arbitrator;
        uint256 amount;
        bool resolved;
    }

    mapping(address => mapping(address => mapping(string => Dispute))) public disputes; // owner -> (recipient -> (disputeId -> dispute))

    constructor(address _arbitrator) {
        arbitrator = _arbitrator;
    }

    function lockFunds(
        string memory agreementId,
        address _recipient,
        uint256 _amount
    ) public payable {
        require(msg.value >= _amount, "Insufficient funds.");

        agreements[msg.sender][_recipient][agreementId] = Agreement({
            owner: msg.sender,
            amount: _amount,
            isCompleted: false,
            isDisputed: false
        });

        balance += msg.value; // This just allows us to preview current balance, payable keyword is the one that allows sending ether to the smart contract

        emit FundsLocked(msg.sender, _recipient, agreementId, _amount);
    }

    function releaseFunds(address _recipient, string memory _agreementId) public {
        Agreement storage agreement = agreements[msg.sender][_recipient][_agreementId];

        require(agreement.owner == msg.sender, "Only the agreement owner can release funds.");
        require(!agreement.isDisputed, "This agreement is disputed.");
        require(!agreement.isCompleted, "This agreement has already been completed.");

        agreement.isCompleted = true;
        payable(_recipient).transfer(agreement.amount);

        emit FundsReleased(msg.sender, _recipient, _agreementId);
    }

    function initiateDispute(
        address _owner,
        address _recipient,
        string memory _agreementId,
        string memory _disputeId
    ) public {
        Agreement storage agreement = agreements[_owner][_recipient][_agreementId];

        // require(msg.sender == _owner || msg.sender == _recipient, "You can only initiate disputes for your own agreements.");
        require(!agreement.isDisputed, "This agreement is already disputed.");
        require(!agreement.isCompleted, "Cannot dispute a completed agreement.");

        disputes[_owner][_recipient][_disputeId] = Dispute({
            agreementId: _agreementId,
            arbitrator: chooseArbitrator(),
            amount: agreement.amount,
            resolved: false
        });

        agreement.isDisputed = true;

        emit DisputeInitiated(_owner, _recipient, _disputeId, _agreementId);
    }

    function chooseArbitrator() public view returns (address) {
        return arbitrator; // TODO: Implement arbitrator logic
    }

    function resolveDispute(
        address _owner,
        address _recipient,
        string memory _disputeId,
        string memory _agreementId,
        bool _isOwner
    ) public {
        Dispute storage dispute = disputes[_owner][_recipient][_disputeId];
        require(
            dispute.arbitrator == msg.sender,
            "Only the assigned arbitrator can resolve this dispute."
        );
        require(!dispute.resolved, "This dispute has already been resolved.");

        dispute.resolved = true;

        Agreement storage agreement = agreements[_owner][_recipient][_agreementId];
        agreement.isDisputed = false;
        agreement.isCompleted = true;

        if (_isOwner) {
            payable(_owner).transfer(dispute.amount);
        } else {
            payable(_recipient).transfer(dispute.amount);
        }

        emit DisputeResolved(_owner, _recipient, _disputeId, _agreementId, _isOwner);
    }
}
