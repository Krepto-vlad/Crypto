import { network } from "hardhat";
import { parseEther, formatEther } from "viem";
import { readFileSync, writeFileSync } from "fs";

const addresses = JSON.parse(readFileSync("deployed-addresses.json", "utf-8"));
const { viem, networkName } = await network.connect();
const [walletClient, secondClient] = await viem.getWalletClients();
const publicClient = await viem.getPublicClient();

const token = await viem.getContractAt("MyTokenV1", addresses.proxy);

console.log(`Interacting with MyTokenV1 via Proxy on ${networkName}`);
console.log(`Proxy address: ${addresses.proxy}`);
console.log(`Deployer: ${walletClient.account.address}`);

// Use second account if available, otherwise self-transfer (single-key testnets)
const secondAddress = secondClient
  ? secondClient.account.address
  : walletClient.account.address;
if (!secondClient) {
  console.log(`(!) Only one wallet configured — transfer will be a self-transfer`);
}
console.log(`Second account: ${secondAddress}\n`);

// 1. Show initial balances
const deployerBalance = await token.read.balanceOf([walletClient.account.address]);
console.log(`--- Initial Balances ---`);
console.log(`  Deployer: ${formatEther(deployerBalance)} MTK`);

// 2. Mint 5000 tokens to deployer
console.log(`\n--- Minting 5,000 MTK to deployer ---`);
const mintTx = await token.write.mint([walletClient.account.address, parseEther("5000")]);
await publicClient.waitForTransactionReceipt({ hash: mintTx, confirmations: 1 });
console.log(`  Mint tx: ${mintTx}`);

const balanceAfterMint = await token.read.balanceOf([walletClient.account.address]);
console.log(`  Deployer balance after mint: ${formatEther(balanceAfterMint)} MTK`);

// 3. Transfer 100 tokens to second address
console.log(`\n--- Transferring 100 MTK to ${secondAddress} ---`);
const transferTx = await token.write.transfer([secondAddress, parseEther("100")]);
await publicClient.waitForTransactionReceipt({ hash: transferTx, confirmations: 1 });
console.log(`  Transfer tx: ${transferTx}`);

const deployerFinal = await token.read.balanceOf([walletClient.account.address]);
const secondFinal = await token.read.balanceOf([secondAddress]);
const totalSupply = await token.read.totalSupply();

console.log(`\n--- Final Balances ---`);
console.log(`  Deployer: ${formatEther(deployerFinal)} MTK`);
console.log(`  Second:   ${formatEther(secondFinal)} MTK`);
console.log(`  Total Supply: ${formatEther(totalSupply)} MTK`);

// Save balances for validation after upgrade
const state = {
  deployerAddress: walletClient.account.address,
  deployerBalance: deployerFinal.toString(),
  secondBalance: secondFinal.toString(),
  secondAddress,
  totalSupply: totalSupply.toString(),
  network: networkName,
};
writeFileSync("pre-upgrade-state.json", JSON.stringify(state, null, 2));
console.log("\nPre-upgrade state saved to pre-upgrade-state.json");
