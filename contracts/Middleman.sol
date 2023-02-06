//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract Middleman {
    event FundsLocked(address indexed _owner, uint _index);

    uint256 public balance;

    struct Agreement {
        address owner;
        address recipient;
        uint256 amount;
        bool isCompleted;
        bool isDisputed;
    }

    mapping(address => Agreement[]) public agreements; // owner -> []agrement

    struct Dispute {
        address owner;
        address recipient;
        address arbitrator;
        uint256 amount;
        bool resolved;
    }

    mapping(address => Dispute[]) public disputes; // owner -> []dispute

    function lockFunds(address _recipient, uint256 _amount) public payable {
        require(msg.value >= _amount, "Insufficient funds.");

        agreements[msg.sender].push(
            Agreement({
                owner: msg.sender,
                recipient: _recipient,
                amount: _amount,
                isCompleted: false,
                isDisputed: false
            })
        );

        balance += msg.value; // This just allows us to preview current balance, payable keyword is the one that allows sending ether to the smart contract
        emit FundsLocked(msg.sender, agreements[msg.sender].length - 1);
    }

    // TODO: Correct this, as it will return only the first agreement between 2 parties.
    function findAgreement(address _owner, address _recipient) private view returns (uint) {
        uint index = 0;
        bool found = false;

        for (uint i = 0; i < agreements[_owner].length; i++) {
            if (agreements[_owner][i].recipient == _recipient) {
                index = i;
                found = true;
                break;
            }
        }

        require(found, "Agreement not found.");

        return index;
    }

    function releaseFunds(address _recipient) public {
        uint agreementIndex = findAgreement(msg.sender, _recipient);

        Agreement storage agreement = agreements[msg.sender][uint(agreementIndex)];
        require(!agreement.isDisputed, "This agreement is disputed.");
        require(!agreement.isCompleted, "This agreement has already been completed.");
        require(agreement.owner == msg.sender, "Only the agreement owner can release funds.");

        agreement.isCompleted = true;
        payable(_recipient).transfer(agreement.amount);
    }

    function initiateDispute(address _owner, address _recipient) public {
        uint agreementIndex = findAgreement(_owner, _recipient);
        Agreement storage agreement = agreements[_owner][agreementIndex];
        require(!agreement.isDisputed, "This agreement is already disputed.");
        require(!agreement.isCompleted, "Cannot dispute a completed agreement.");

        disputes[_owner].push(
            Dispute({
                owner: _owner,
                recipient: _recipient,
                arbitrator: chooseArbitrator(),
                amount: agreement.amount,
                resolved: false
            })
        );
        agreement.isDisputed = true;
    }

    function chooseArbitrator() public pure returns (address) {
        // swap pure for view when logic is implemented
        // In this function, you can implement the logic to select an arbitrator to resolve disputes.
        // There are many different ways to select an arbitrator, and it depends on the requirements of your use case.
        // You can choose a random address from a pre-approved list of arbitrators, or use a random number generator to select an arbitrator from a decentralized network of arbitrators.
        return address(0); // Example return, replace with actual implementation
    }

    function resolveDispute(address _owner, uint _disputeIndex, bool _isOwner) public {
        Dispute storage dispute = disputes[_owner][_disputeIndex];
        require(
            dispute.arbitrator == msg.sender,
            "Only the assigned arbitrator can resolve this dispute."
        );
        require(!dispute.resolved, "This dispute has already been resolved.");

        dispute.resolved = true;
        Agreement storage agreement = agreements[dispute.owner][
            findAgreement(dispute.owner, dispute.recipient)
        ];
        agreement.isDisputed = false;

        if (_isOwner) {
            payable(dispute.owner).transfer(dispute.amount);
        } else {
            payable(dispute.recipient).transfer(dispute.amount);
        }
    }

    // TODO: Test this helper function
    function getAgreement(
        address _owner,
        address _recipient
    ) private view returns (Agreement storage) {
        uint index;
        bool found = false;

        for (uint i = 0; i < agreements[_owner].length; i++) {
            if (agreements[_owner][i].recipient == _recipient) {
                index = i;
                found = true;
                break;
            }
        }

        require(found, "Agreement not found.");

        return agreements[_owner][index];
    }
}
