# MultiSigWallet — Assignment Report

## 1. What is a Multi-Sig Wallet?

A multi-signature wallet is a smart contract that requires M out of N owners to approve a transaction before it can be executed (M-of-N scheme). The main point is that there's no single private key that controls all the funds — if one key gets compromised, an attacker still can't do anything without the other approvals.

This is especially useful in DeFi for things like DAO treasury management, shared custody of large amounts of crypto, or any situation where you don't want one person to have full control.

I looked at Gnosis Safe and the ConsenSys MultiSigWallet as references when designing this. The core lifecycle I settled on is: **submit > confirm > execute**, with the ability to revoke a confirmation at any point before execution.

---

## 2. Contract Design (`contracts/MultiSigWallet.sol`)

### Data Structures

```solidity
address[] public owners;
mapping(address => bool) public isOwner;
uint256 public numConfirmationsRequired;

struct Transaction {
    address to;
    uint256 value;
    bytes data;               // empty for plain ETH transfers
    bool executed;
    uint256 numConfirmations;
}

Transaction[] public transactions;
mapping(uint256 => mapping(address => bool)) public isConfirmed;
```

### Transaction Lifecycle

```
[Owner] submitTransaction()
        │
        ▼
   PENDING (numConfirmations = 0)
        │
        ▼ confirmTransaction() × M owners
   CONFIRMED (numConfirmations >= required)
        │
        ▼ executeTransaction()
   EXECUTED

   At any point before execution:
   revokeConfirmation() → decrements the counter
```

### Functions

| Function | Who can call | Description |
|---|---|---|
| `submitTransaction(to, value, data)` | Any owner | Proposes a new transaction |
| `confirmTransaction(txIndex)` | Any owner | Adds an approval |
| `revokeConfirmation(txIndex)` | Owner who confirmed | Removes their approval |
| `executeTransaction(txIndex)` | Any owner | Executes once M approvals are reached |
| `getOwners()` | Anyone | Returns the list of owners |
| `getTransaction(txIndex)` | Anyone | Returns transaction details |
| `getTransactionCount()` | Anyone | Returns total number of transactions |

### Events

| Event | When |
|---|---|
| `Deposit(sender, amount, balance)` | ETH received |
| `SubmitTransaction(owner, txIndex, to, value, data)` | Transaction proposed |
| `ConfirmTransaction(owner, txIndex)` | Confirmation added |
| `RevokeConfirmation(owner, txIndex)` | Confirmation removed |
| `ExecuteTransaction(owner, txIndex)` | Transaction executed |

---

## 3. How to Run

### Install & test

```bash
npm install
npx hardhat test test/MultiSigWallet.ts
```

### Deploy locally

```bash
npx hardhat node
npx hardhat run scripts/deploy-multisig.ts
```

### Deploy to Sepolia

The project uses `@nomicfoundation/hardhat-keystore` instead of a `.env` file, so keys need to be added like this:

```bash
npx hardhat keystore set SEPOLIA_RPC_URL
npx hardhat keystore set SEPOLIA_PRIVATE_KEY
npx hardhat keystore set ETHERSCAN_API_KEY

npx hardhat run scripts/deploy-multisig.ts --network sepolia
```

---

## 4. Security Considerations

The main things I paid attention to:

- **Reentrancy** — I followed the Checks-Effects-Interactions pattern in `executeTransaction`: the transaction is marked as `executed = true` *before* the external call is made, so a reentrant call would hit the `notExecuted` modifier and revert.
- **Access control** — Every state-changing function has the `onlyOwner` modifier.
- **Double execution / double confirmation** — Handled by the `notExecuted` and `notConfirmed` modifiers respectively.
- **Bad initialization** — The constructor validates that all owner addresses are non-zero and unique, and that `0 < M ≤ N`.

### Known limitations

- Owners are fixed at deployment — there's no add/remove functionality. I did this intentionally to keep the attack surface small.
- If M keys are permanently lost, the funds are frozen. A real production wallet would need a recovery mechanism.
- There's no timelock — a malicious transaction can be executed immediately once it reaches M confirmations.

---

## 5. Tests

`test/MultiSigWallet.ts` — 36 tests across 7 groups, all passing.

| Group | Tests |
|---|---|
| Deployment & initialization | 9 |
| Receiving ETH | 1 |
| Submitting transactions | 5 |
| Confirming transactions | 6 |
| Revoking confirmations | 4 |
| Executing transactions | 7 |
| Edge cases | 4 |

Edge cases include things like: 1-of-1 wallet, revoke-then-reconfirm flow, multiple independent transactions, and trying to confirm/execute after the transaction has already been executed.

---

## 6. Reflection

Multi-sig wallets exist because a single private key is a single point of failure. Some of the biggest DeFi hacks (Ronin Bridge ~$625M, Harmony Horizon ~$100M) happened because one compromised key was enough to drain everything. Requiring M independent approvals makes that kind of attack much harder.

Beyond security, multi-sig also adds accountability — every confirmation is on-chain and tied to a specific address, which matters a lot for DAOs and protocol governance where you want transparency in how decisions are made.
