import { network } from "hardhat";
import { writeFileSync } from "fs";
import { getAddress } from "viem";

// ── Student wallet to receive 2 game character NFTs
const DEFAULT_STUDENT_WALLET = "0xf2f2c05e05a37c751231fb0c1b1a39e61f565a39";
const STUDENT_WALLET = getAddress(
  process.argv[2] ?? process.env.STUDENT_WALLET ?? DEFAULT_STUDENT_WALLET
);

const { viem, networkName } = await network.connect();
const [deployer] = await viem.getWalletClients();
const publicClient = await viem.getPublicClient();

console.log(`Deploying GameCharacterCollectionERC1155 on ${networkName}...`);
console.log(`Deployer: ${deployer.account.address}\n`);

// 1. Deploy contract
const contract = await viem.deployContract("GameCharacterCollectionERC1155");
console.log(`Contract deployed: ${contract.address}`);
console.log(`Etherscan: https://sepolia.etherscan.io/address/${contract.address}\n`);

// 2. Batch mint all 10 characters to deployer (1 of each)
//    amounts[i] corresponds to token ID (i+1)
console.log(`Step 1: Batch minting 10 characters (1 each) to deployer...`);
const mintAmounts: [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint] = [
  1n, 1n, 1n, 1n, 1n, 1n, 1n, 1n, 1n, 1n,
];
const batchMintTx = await contract.write.batchMintAll([
  deployer.account.address,
  mintAmounts,
]);
await publicClient.waitForTransactionReceipt({ hash: batchMintTx, confirmations: 1 });
console.log(`  Batch mint tx: ${batchMintTx}`);
console.log(`  Etherscan: https://sepolia.etherscan.io/tx/${batchMintTx}\n`);

// 3. Verify deployer balances
console.log(`--- Deployer balances after batch mint ---`);
const characterNames = ["Warrior","Mage","Rogue","Paladin","Ranger","Necromancer","Berserker","Priest","Druid","Monk"];
for (let i = 1; i <= 10; i++) {
  const bal = await contract.read.balanceOf([deployer.account.address, BigInt(i)]);
  console.log(`  #${i} ${characterNames[i-1]}: ${bal}`);
}

// 4. Batch transfer 2 characters (#1 Warrior, #2 Mage) to student wallet
console.log(`\nStep 2: Batch transferring #1 Warrior and #2 Mage to student wallet...`);
const transferIds = [1n, 2n];
const transferAmounts = [1n, 1n];
const transferTx = await contract.write.safeBatchTransferFrom([
  deployer.account.address,
  STUDENT_WALLET as `0x${string}`,
  transferIds,
  transferAmounts,
  "0x",
]);
await publicClient.waitForTransactionReceipt({ hash: transferTx, confirmations: 1 });
console.log(`  Batch transfer tx: ${transferTx}`);
console.log(`  Etherscan: https://sepolia.etherscan.io/tx/${transferTx}\n`);

// 5. Verify final balances
console.log(`--- Final balances ---`);
const studentWarrior = await contract.read.balanceOf([STUDENT_WALLET as `0x${string}`, 1n]);
const studentMage = await contract.read.balanceOf([STUDENT_WALLET as `0x${string}`, 2n]);
const deployerWarrior = await contract.read.balanceOf([deployer.account.address, 1n]);
console.log(`  Student wallet:`);
console.log(`    #1 Warrior: ${studentWarrior}`);
console.log(`    #2 Mage:    ${studentMage}`);
console.log(`  Deployer:`);
console.log(`    #1 Warrior: ${deployerWarrior} (transferred away)`);

// 6. Save addresses
writeFileSync(
  "deployed-game-characters.json",
  JSON.stringify({
    contract: contract.address,
    network: networkName,
    batchMintTx,
    batchTransferTx: transferTx,
  }, null, 2)
);
console.log(`\nAddresses saved to deployed-game-characters.json`);
