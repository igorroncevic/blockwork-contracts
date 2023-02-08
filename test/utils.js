const crypto = require("crypto");

const matchObjects = (obj, matcher) => {
    const objLength = Object.keys(obj).length;
    const matcherLength = Object.keys(matcher).length;

    if (objLength >= matcherLength) {
        return Object.keys(matcher).every(
            (key) => Object.prototype.hasOwnProperty.call(obj, key) && matcher[key] === obj[key],
        );
    }

    return false;
};

const fetchNewAgreement = async (middleman, tx, agreementId, owner, recipient) => {
    const receipt = await tx.wait();
    let fundsLockedEvent;

    for (let i = 0; i < receipt.events.length; i++) {
        const event = receipt.events[i];
        if (event.event === "FundsLocked") {
            const eventObj = { ...event.args };
            console.log(event);
            if (matchObjects(eventObj, { agreementId, owner, recipient })) {
                fundsLockedEvent = { ...eventObj };
                break;
            }
        }
    }

    if (fundsLockedEvent === undefined) {
        throw new Error("no FundsLocked event for this agreement has been found");
    }

    const agreement = await middleman.agreements(
        fundsLockedEvent.owner,
        fundsLockedEvent.recipient,
        fundsLockedEvent.agreementId,
    );

    return { ...agreement };
};

const fetchNewDispute = async (middleman, tx, disputeId, owner, recipient) => {
    const receipt = await tx.wait();
    let disputeInitiatedEvent;

    for (let i = 0; i < receipt.events.length; i++) {
        const event = receipt.events[i];
        if (event.event === "DisputeInitiated") {
            const eventObj = { ...event.args };
            if (matchObjects(eventObj, { disputeId, owner, recipient })) {
                disputeInitiatedEvent = { ...eventObj };
                break;
            }
        }
    }

    if (disputeInitiatedEvent === undefined) {
        throw new Error("no DisputeInitiated event for this agreement has been found");
    }

    const dispute = await middleman.disputes(
        disputeInitiatedEvent.owner,
        disputeInitiatedEvent.recipient,
        disputeInitiatedEvent.disputeId,
    );

    return { ...dispute };
};

const newUUID = () => crypto.randomUUID();

module.exports = { fetchNewAgreement, fetchNewDispute, newUUID };
