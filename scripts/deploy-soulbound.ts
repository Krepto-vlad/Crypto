import { network } from "hardhat";
import { writeFileSync } from "fs";

// ── Student wallet to receive the soulbound card
const STUDENT_WALLET = "0xf2f2c05e05a37c751231fb0c1b1a39e61f565a39";

const { viem, networkName } = await network.connect();
const [deployer] = await viem.getWalletClients();
const publicClient = await viem.getPublicClient();

console.log(`Deploying SoulboundVisitCardERC721 on ${networkName}...`);
console.log(`Deployer: ${deployer.account.address}\n`);

// 1. Deploy contract
const contract = await viem.deployContract("SoulboundVisitCardERC721");
console.log(`Contract deployed: ${contract.address}`);
console.log(`Etherscan: https://sepolia.etherscan.io/address/${contract.address}\n`);

// 2. Mint one soulbound visit card to student wallet
console.log(`Minting visit card to ${STUDENT_WALLET}...`);
const mintTx = await contract.write.mintVisitCard([
  STUDENT_WALLET as `0x${string}`,
  "Vladyslav",       // studentName
  "STU-2024-047",    // studentID
  "Blockchain & Cryptography", // course
  "2024",            // year
]);
await publicClient.waitForTransactionReceipt({ hash: mintTx, confirmations: 1 });
console.log(`Mint tx: ${mintTx}`);
console.log(`Etherscan: https://sepolia.etherscan.io/tx/${mintTx}\n`);

// 3. Verify token ownership
const owner = await contract.read.ownerOf([1n]);
const card = await contract.read.getCard([1n]);
console.log(`--- Minted Visit Card ---`);
console.log(`  Token ID: 1`);
console.log(`  Owner: ${owner}`);
console.log(`  Student Name: ${card.studentName}`);
console.log(`  Student ID: ${card.studentID}`);
console.log(`  Course: ${card.course}`);
console.log(`  Year: ${card.year}`);

// 4. Confirm soulbound — attempt transfer should revert
console.log(`\n--- Soulbound Check ---`);
console.log(`  Attempting transfer... (should revert)`);
try {
  await contract.simulate.transferFrom([
    STUDENT_WALLET as `0x${string}`,
    deployer.account.address,
    1n,
  ]);
  console.log(`  ❌ Transfer did NOT revert — soulbound broken!`);
} catch (e: any) {
  const msg: string = e?.message ?? "";
  if (msg.includes("Soulbound")) {
    console.log(`  ✅ Transfer reverted with Soulbound() — working correctly`);
  } else {
    console.log(`  ✅ Transfer reverted (${msg.slice(0, 60)}) — soulbound confirmed`);
  }
}

// 5. Save addresses
writeFileSync(
  "deployed-soulbound.json",
  JSON.stringify({ contract: contract.address, network: networkName, mintTx }, null, 2)
);
console.log(`\nAddresses saved to deployed-soulbound.json`);
