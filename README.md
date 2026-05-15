# Task 5: ERC-721 Soulbound + ERC-1155 Game Collection

This project contains two separate NFT contracts:

1. `SoulboundVisitCardERC721.sol`
2. `GameCharacterCollectionERC1155.sol`

Both are implemented with Solidity `0.8.28` and OpenZeppelin audited contracts.

## Contracts

### 1) SoulboundVisitCardERC721

File: `contracts/SoulboundVisitCardERC721.sol`

Features:
- Uses OpenZeppelin `ERC721` + `Ownable`
- Owner/admin-only minting via `mintVisitCard(...)`
- One unique token per student wallet (`_hasMinted` guard)
- On-chain metadata (`tokenURI`) with base64 JSON + SVG image
- Includes student attributes:
  - `studentName`
  - `studentID`
  - `course`
  - `year`
- Soulbound behavior:
  - Transfers blocked by overriding `_update(...)`
  - `approve(...)` disabled
  - `setApprovalForAll(...)` disabled

### 2) GameCharacterCollectionERC1155

File: `contracts/GameCharacterCollectionERC1155.sol`

Features:
- Uses OpenZeppelin `ERC1155` + `Ownable`
- 10 distinct token IDs (`1..10`), each mapped to a different character
- On-chain metadata (`uri(tokenId)`) with base64 JSON + SVG image
- Character metadata includes:
  - `color`
  - `speed`
  - `strength`
  - `rarity`
- Owner/admin-only minting
- Batch operations supported:
  - `batchMintAll(...)`
  - `batchMint(...)`
  - `batchTransfer(...)` (helper over `safeBatchTransferFrom`)

## Metadata Structure

### ERC-721 `tokenURI`
Returns base64 JSON:
- `name`
- `description`
- `image` (base64 SVG)
- `attributes` (Student Name, Student ID, Course, Year, Soulbound)

### ERC-1155 `uri(tokenId)`
Returns base64 JSON:
- `name`
- `description`
- `image` (base64 SVG)
- `attributes` (Color, Speed, Strength, Rarity)

This is marketplace-compatible metadata JSON format.

## Deployment and Testing

### Prerequisites
- Node.js + npm
- Hardhat project dependencies installed
- `SEPOLIA_RPC_URL` and `SEPOLIA_PRIVATE_KEY` in Hardhat keystore
- `ETHERSCAN_API_KEY` in Hardhat keystore

### Compile

```bash
npx hardhat compile
```

### Deploy Soulbound ERC-721

```bash
npx hardhat run scripts/deploy-soulbound.ts --network sepolia
```

What script does:
- Deploys contract
- Mints one soulbound visit card to student wallet
- Tries transfer simulation and confirms revert (soulbound check)

### Deploy ERC-1155 Game Collection

```bash
npx hardhat run scripts/deploy-game-characters.ts --network sepolia
```

What script does:
- Deploys contract
- Batch mints 10 NFTs (1 per ID)
- Performs an initial batch transfer demonstration
- Reads balances after transfer

### Final ERC-1155 Transfer To Second Wallet

```bash
npx hardhat run scripts/transfer-game-characters.ts --network sepolia
```

What script does:
- Uses the already deployed ERC-1155 contract
- Batch transfers token IDs `#1` and `#2`
- Sends them to `0xCE8aD564DaC2705B7612bad8Eb572596466eE116`
- Confirms balances before and after transfer

### Verify Contracts

```bash
npx hardhat verify --network sepolia 0x94ba11625be5e1ebcff3983c57d466c46175eeac
npx hardhat verify --network sepolia 0x7d8a25ce9f8e6922241da626359c034d21c18919
```

## Sepolia Deployment Results

### SoulboundVisitCardERC721
- Contract: `0x94ba11625be5e1ebcff3983c57d466c46175eeac`
- Etherscan: https://sepolia.etherscan.io/address/0x94ba11625be5e1ebcff3983c57d466c46175eeac
- Mint tx (1 soulbound card):
  - `0x376c56092e8efa04af96cc7063e8a93e63a6e757e2eeff0cde7fd7a3ec78fa17`
  - https://sepolia.etherscan.io/tx/0x376c56092e8efa04af96cc7063e8a93e63a6e757e2eeff0cde7fd7a3ec78fa17

### GameCharacterCollectionERC1155
- Contract: `0x7d8a25ce9f8e6922241da626359c034d21c18919`
- Etherscan: https://sepolia.etherscan.io/address/0x7d8a25ce9f8e6922241da626359c034d21c18919
- Batch mint tx (10 NFTs, IDs 1..10):
  - `0x2a7fc4461d10e2eaca94f691d1044d9b184919af96d3f0b8284ba6ef2c50b40b`
  - https://sepolia.etherscan.io/tx/0x2a7fc4461d10e2eaca94f691d1044d9b184919af96d3f0b8284ba6ef2c50b40b
- Final batch transfer tx to second wallet `0xCE8aD564DaC2705B7612bad8Eb572596466eE116`:
  - `0xe23c4f5000b5d855fe15bf029e5887996dcba2c727cabfcab56a927a9c1f040f`
  - https://sepolia.etherscan.io/tx/0xe23c4f5000b5d855fe15bf029e5887996dcba2c727cabfcab56a927a9c1f040f

## Proof Artifacts

Use screenshots to demonstrate:
- Soulbound card mint transaction success
- Soulbound transfer revert behavior
- ERC-1155 batch mint transaction
- ERC-1155 final batch transfer transaction to the second wallet
- ERC-1155 balances showing token IDs `#1` and `#2` on the second wallet

Suggested folder:
- `screenshots/Assigment 8/`

## Notes

- Contracts are intentionally separated to avoid interface/event conflicts between ERC-721 and ERC-1155 standards.
- Metadata is on-chain (base64 JSON + SVG), so no external IPFS pinning is required.
- A dedicated follow-up script `scripts/transfer-game-characters.ts` was used to move ERC-1155 tokens `#1` and `#2` to the second wallet for final proof screenshots.
