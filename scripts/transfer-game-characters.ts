import { network } from "hardhat";
import { readFileSync, writeFileSync } from "fs";
import { getAddress } from "viem";

const DEFAULT_RECEIVER = "0xCE8aD564DaC2705B7612bad8Eb572596466eE116";
const RECEIVER = getAddress(
  process.argv[2] ?? process.env.RECEIVER_WALLET ?? DEFAULT_RECEIVER
);

const deployment = JSON.parse(readFileSync("deployed-game-characters.json", "utf-8"));
const { viem, networkName } = await network.connect();
const [deployer] = await viem.getWalletClients();
const publicClient = await viem.getPublicClient();

if (deployment.network !== networkName) {
  throw new Error(
    `Network mismatch: deployed-game-characters.json was created for "${deployment.network}", current network is "${networkName}".`
  );
}

const contract = await viem.getContractAt(
  "GameCharacterCollectionERC1155",
  deployment.contract as `0x${string}`
);

const ids = [1n, 2n];
const amounts = [1n, 1n];

console.log(`Transferring ERC-1155 characters on ${networkName}...`);
console.log(`Contract: ${deployment.contract}`);
console.log(`From: ${deployer.account.address}`);
console.log(`To: ${RECEIVER}\n`);

const beforeFrom1 = await contract.read.balanceOf([deployer.account.address, 1n]);
const beforeFrom2 = await contract.read.balanceOf([deployer.account.address, 2n]);
const beforeTo1 = await contract.read.balanceOf([RECEIVER as `0x${string}`, 1n]);
const beforeTo2 = await contract.read.balanceOf([RECEIVER as `0x${string}`, 2n]);

console.log("--- Balances before transfer ---");
console.log(`  Deployer #1 Warrior: ${beforeFrom1}`);
console.log(`  Deployer #2 Mage:    ${beforeFrom2}`);
console.log(`  Receiver #1 Warrior: ${beforeTo1}`);
console.log(`  Receiver #2 Mage:    ${beforeTo2}\n`);

const transferTx = await contract.write.safeBatchTransferFrom([
  deployer.account.address,
  RECEIVER as `0x${string}`,
  ids,
  amounts,
  "0x",
]);
await publicClient.waitForTransactionReceipt({ hash: transferTx, confirmations: 1 });

const afterFrom1 = await contract.read.balanceOf([deployer.account.address, 1n]);
const afterFrom2 = await contract.read.balanceOf([deployer.account.address, 2n]);
const afterTo1 = await contract.read.balanceOf([RECEIVER as `0x${string}`, 1n]);
const afterTo2 = await contract.read.balanceOf([RECEIVER as `0x${string}`, 2n]);

console.log("--- Transfer result ---");
console.log(`  Tx: ${transferTx}`);
console.log(`  Etherscan: https://sepolia.etherscan.io/tx/${transferTx}\n`);

console.log("--- Balances after transfer ---");
console.log(`  Deployer #1 Warrior: ${afterFrom1}`);
console.log(`  Deployer #2 Mage:    ${afterFrom2}`);
console.log(`  Receiver #1 Warrior: ${afterTo1}`);
console.log(`  Receiver #2 Mage:    ${afterTo2}`);

const nextDeployment = {
  ...deployment,
  secondReceiver: RECEIVER,
  finalBatchTransferTx: transferTx,
};
writeFileSync("deployed-game-characters.json", JSON.stringify(nextDeployment, null, 2));
