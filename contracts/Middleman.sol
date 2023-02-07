//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract Middleman {
    event FundsLocked(address indexed owner, address indexed recipient, string id, uint index);
    event FundsReleased(address indexed owner, address indexed recipient, string id, uint index);
    event DisputeInitiated(
        address indexed owner,
        address indexed recipient,
        address initiatedBy,
        string agreementId,
        uint disputeIndex
    );
    event DisputeResolved(
        address indexed owner,
        address indexed recipient,
        string agreementId,
        uint disputeIndex,
        bool isOwner
    );

    address private arbitrator;
    uint256 public balance;

    struct Agreement {
        string id;
        address owner;
        address recipient;
        uint256 amount;
        bool isCompleted;
        bool isDisputed;
    }

    mapping(address => mapping(address => Agreement[])) public agreements; // owner -> (recipient -> []agrement)

    struct Dispute {
        string agreementId;
        address owner;
        address recipient;
        address arbitrator;
        uint256 amount;
        bool resolved;
    }

    mapping(address => mapping(address => Dispute[])) public disputes; // owner -> (recipient -> []dispute)

    constructor(address _arbitrator) {
        arbitrator = _arbitrator;
    }

    function lockFunds(string memory id, address _recipient, uint256 _amount) public payable {
        require(msg.value >= _amount, "Insufficient funds.");

        agreements[msg.sender][_recipient].push(
            Agreement({
                id: id,
                owner: msg.sender,
                recipient: _recipient,
                amount: _amount,
                isCompleted: false,
                isDisputed: false
            })
        );

        balance += msg.value; // This just allows us to preview current balance, payable keyword is the one that allows sending ether to the smart contract

        emit FundsLocked(msg.sender, _recipient, id, agreements[msg.sender][_recipient].length - 1);
    }

    function releaseFunds(address _recipient, uint _index) public {
        Agreement storage agreement = agreements[msg.sender][_recipient][_index];

        require(agreement.owner == msg.sender, "Only the agreement owner can release funds.");
        require(!agreement.isDisputed, "This agreement is disputed.");
        require(!agreement.isCompleted, "This agreement has already been completed.");

        agreement.isCompleted = true;
        payable(_recipient).transfer(agreement.amount);

        emit FundsReleased(msg.sender, _recipient, agreement.id, _index);
    }

    function initiateDispute(address _owner, address _recipient, uint _index) public {
        Agreement storage agreement = agreements[_owner][_recipient][_index];

        // require(msg.sender == _owner || msg.sender == _recipient, "You can only initiate disputes for your own agreements.");
        require(!agreement.isDisputed, "This agreement is already disputed.");
        require(!agreement.isCompleted, "Cannot dispute a completed agreement.");

        disputes[_owner][_recipient].push(
            Dispute({
                agreementId: agreement.id,
                owner: _owner,
                recipient: _recipient,
                arbitrator: chooseArbitrator(),
                amount: agreement.amount,
                resolved: false
            })
        );
        agreement.isDisputed = true;

        emit DisputeInitiated(_owner, _recipient, msg.sender, agreement.id, _index);
    }

    function chooseArbitrator() public view returns (address) {
        return arbitrator; // TODO: Implement arbitrator logic
    }

    function resolveDispute(
        address _owner,
        address _recipient,
        uint _disputeIndex,
        uint _agreementIndex,
        bool _isOwner
    ) public {
        Dispute storage dispute = disputes[_owner][_recipient][_disputeIndex];
        require(
            dispute.arbitrator == msg.sender,
            "Only the assigned arbitrator can resolve this dispute."
        );
        require(!dispute.resolved, "This dispute has already been resolved.");

        dispute.resolved = true;

        Agreement storage agreement = agreements[dispute.owner][dispute.recipient][_agreementIndex];
        agreement.isDisputed = false;
        agreement.isCompleted = true;

        if (_isOwner) {
            payable(dispute.owner).transfer(dispute.amount);
        } else {
            payable(dispute.recipient).transfer(dispute.amount);
        }

        emit DisputeResolved(_owner, _recipient, agreement.id, _disputeIndex, _isOwner);
    }
}
