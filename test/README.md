# Hardhat test notes

-   In case we have a case where we need smart contract's address in advance, before deploying it, here's how:
    -   https://stackoverflow.com/questions/73359845/how-to-find-out-in-advance-the-address-of-the-smart-contract-i-am-going-to-deplo
    -   in short, address can be pre-computer based on owner's nonce

```
const contractAddress = ethers.utils.getContractAddress({
            from: deployer.address,
            nonce: (await ethers.provider.getTransactionCount(deployer.address)) + 1,
        });
```

-   Don't forget to pass value / gasLimit to transaction as object and last parameter of the function call

```
await expect(() =>
  sender.sendTransaction({ to: someAddress, value: 200 })
).to.changeEtherBalance(sender, "-200");
```

- Returning values from non-view / pure functions is inaccessible outside of the chain (i.e. other smart contracts). Hence, to retrieve the return value, one must use events instead.
https://ethereum.stackexchange.com/a/94873
https://ethereum.stackexchange.com/questions/88119/i-see-no-way-to-obtain-the-return-value-of-a-non-view-function-ethers-js
