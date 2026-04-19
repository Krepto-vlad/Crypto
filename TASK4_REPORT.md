# Task 4 — Upgradeable ERC20 (UUPS Proxy Pattern)

## GitHub Repository

https://github.com/Krepto-vlad/Crypto/tree/task_3

## Solidity Contracts

| Contract | File | Description |
|---|---|---|
| ERC20 V1 | `contracts/MyTokenV1.sol` | ERC20 + Ownable + UUPSUpgradeable, `initialize(initialSupply)`, `mint()` |
| ERC20 V2 | `contracts/MyTokenV2.sol` | Extends V1, adds `version()` returning `"V2"` |
| Proxy | ERC1967Proxy (OpenZeppelin) | Deployed via `scripts/deploy-v1-proxy.ts` using OZ prebuilt bytecode |

## Deployment Scripts

| Script | Purpose |
|---|---|
| `scripts/deploy-v1-proxy.ts` | Deploys V1 implementation + ERC1967Proxy, initializes with 1M MTK |
| `scripts/interact-v1.ts` | Mints 5,000 MTK, transfers 100 MTK |
| `scripts/upgrade-to-v2.ts` | Deploys V2 implementation, calls `upgradeToAndCall` on proxy |
| `scripts/validate-upgrade.ts` | Verifies balances preserved + `version()` returns `"V2"` |

## Deployed Addresses (Sepolia)

| Contract | Address | Etherscan |
|---|---|---|
| V1 Implementation | `0xe7d7bff41f82202467e4ccc6d5d5e6f08102a72a` | [View](https://sepolia.etherscan.io/address/0xe7d7bff41f82202467e4ccc6d5d5e6f08102a72a) |
| ERC1967 Proxy | `0x28edb245b964cc5af85f25527510009255e2bdc6` | [View](https://sepolia.etherscan.io/address/0x28edb245b964cc5af85f25527510009255e2bdc6) |
| V2 Implementation | `0x820f9ccee1cd4d463cee772cbd95d4d6c33ddaf7` | [View](https://sepolia.etherscan.io/address/0x820f9ccee1cd4d463cee772cbd95d4d6c33ddaf7) |

## Explorer Links — Key Transactions

| Action | Tx Hash | Etherscan |
|---|---|---|
| Mint 5,000 MTK | `0xac35172c...` | [View Tx](https://sepolia.etherscan.io/tx/0xac35172ca0bca95956336acb5add4512fef9ec9493f19a11a1ed14dc122d23b4) |
| Transfer 100 MTK | `0x05aec53b...` | [View Tx](https://sepolia.etherscan.io/tx/0x05aec53bec0db791c0749428ee2ee391a91543356b9c8efd0a316b5cfccef5d0) |
| Upgrade to V2 | `0xb41a992c...` | [View Tx](https://sepolia.etherscan.io/tx/0xb41a992cca04b2e2b5eb880dfe5c5fb8efb40cfc0ce1eefede64e8b562ab9919) |

---

## Console Logs

### 1. Deploy V1 + Proxy

```
Deploying MyTokenV1 + ERC1967 Proxy to sepolia...
Deployer: 0xf2f2c05e05a37c751231fb0c1b1a39e61f565a39

Step 1: Deploying MyTokenV1 implementation...
  V1 implementation: 0xe7d7bff41f82202467e4ccc6d5d5e6f08102a72a
Step 2: Deploying ERC1967Proxy...
  Proxy address: 0x28edb245b964cc5af85f25527510009255e2bdc6

--- Token Info (via Proxy) ---
  Name: MyToken
  Symbol: MTK
  Total Supply: 1000000000000000000000000
  Owner: 0xF2F2c05e05A37C751231Fb0C1b1A39E61F565A39

--- Addresses ---
  V1 Implementation: 0xe7d7bff41f82202467e4ccc6d5d5e6f08102a72a
  Proxy: 0x28edb245b964cc5af85f25527510009255e2bdc6
```

### 2. Interact with V1 (Mint + Transfer)

```
Interacting with MyTokenV1 via Proxy on sepolia
Proxy address: 0x28edb245b964cc5af85f25527510009255e2bdc6
Deployer: 0xf2f2c05e05a37c751231fb0c1b1a39e61f565a39

--- Initial Balances ---
  Deployer: 1000000 MTK

--- Minting 5,000 MTK to deployer ---
  Mint tx: 0xac35172ca0bca95956336acb5add4512fef9ec9493f19a11a1ed14dc122d23b4
  Deployer balance after mint: 1005000 MTK

--- Transferring 100 MTK to 0xf2f2c05e05a37c751231fb0c1b1a39e61f565a39 ---
  Transfer tx: 0x05aec53bec0db791c0749428ee2ee391a91543356b9c8efd0a316b5cfccef5d0

--- Final Balances ---
  Deployer: 1005000 MTK
  Second:   1005000 MTK
  Total Supply: 1005000 MTK
```

### 3. Upgrade to V2

```
Upgrading proxy to MyTokenV2 on sepolia...
Proxy address: 0x28edb245b964cc5af85f25527510009255e2bdc6

Step 1: Deploying MyTokenV2 implementation...
  V2 implementation: 0x820f9ccee1cd4d463cee772cbd95d4d6c33ddaf7
Step 2: Calling upgradeToAndCall on proxy...
  Upgrade tx: 0xb41a992cca04b2e2b5eb880dfe5c5fb8efb40cfc0ce1eefede64e8b562ab9919

Upgrade complete! Addresses updated in deployed-addresses.json
```

### 4. Validate Upgrade (Balances + version())

```
Validating upgrade on sepolia...
Proxy address: 0x28edb245b964cc5af85f25527510009255e2bdc6

--- V2 Verification ---
  version(): "V2"

--- Balance Comparison (before → after upgrade) ---
  Deployer: 1005000 → 1005000 MTK
  Second:   1005000 → 1005000 MTK
  Total:    1005000 → 1005000 MTK

--- Validation Results ---
  Deployer balance preserved: ✅ YES
  Second balance preserved:   ✅ YES
  Total supply preserved:     ✅ YES
  version() returns "V2":     ✅ YES

🎉 Upgrade validated successfully!
```
