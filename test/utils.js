const fetchNewAgreement = async (middleman, tx) => {
    const receipt = await tx.wait();
    let fundsLockedEvent;

    for (let i = 0; i < receipt.events.length; i++) {
        const event = receipt.events[i];
        if (event.event === "FundsLocked") {
            fundsLockedEvent = { ...event.args };
            break;
        }
    }

    const agreement = await middleman.agreements(fundsLockedEvent["0"], fundsLockedEvent["1"]);

    return { ...agreement };
};

module.exports = { fetchNewAgreement };
