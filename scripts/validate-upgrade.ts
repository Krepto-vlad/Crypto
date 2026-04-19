import { network } from "hardhat";
import { formatEther } from "viem";
import { readFileSync } from "fs";

const addresses = JSON.parse(readFileSync("deployed-addresses.json", "utf-8"));
const preState = JSON.parse(readFileSync("pre-upgrade-state.json", "utf-8"));
const { viem, networkName } = await network.connect();
const [walletClient] = await viem.getWalletClients();

if (addresses.network !== networkName) {
  throw new Error(
    `Network mismatch: deployed-addresses.json was created for "${addresses.network}", but the current network is "${networkName}".`
  );
}

console.log(`Validating upgrade on ${networkName}...`);
console.log(`Proxy address: ${addresses.proxy}\n`);

// Use V2 ABI on the proxy
const tokenV2 = await viem.getContractAt("MyTokenV2", addresses.proxy);

// 1. Check version() - new function from V2
console.log("--- V2 Verification ---");
const ver = await tokenV2.read.version();
console.log(`  version(): "${ver}"`);

// 2. Check balances are preserved
const deployerBalance = await tokenV2.read.balanceOf([walletClient.account.address]);
const secondBalance = await tokenV2.read.balanceOf([preState.secondAddress as `0x${string}`]);
const totalSupply = await tokenV2.read.totalSupply();

console.log(`\n--- Balance Comparison (before → after upgrade) ---`);
console.log(`  Deployer: ${formatEther(BigInt(preState.deployerBalance))} → ${formatEther(deployerBalance)} MTK`);
console.log(`  Second:   ${formatEther(BigInt(preState.secondBalance))} → ${formatEther(secondBalance)} MTK`);
console.log(`  Total:    ${formatEther(BigInt(preState.totalSupply))} → ${formatEther(totalSupply)} MTK`);

// 3. Verify balances match
const deployerMatch = deployerBalance === BigInt(preState.deployerBalance);
const secondMatch = secondBalance === BigInt(preState.secondBalance);
const totalMatch = totalSupply === BigInt(preState.totalSupply);

console.log(`\n--- Validation Results ---`);
console.log(`  Deployer balance preserved: ${deployerMatch ? "✅ YES" : "❌ NO"}`);
console.log(`  Second balance preserved:   ${secondMatch ? "✅ YES" : "❌ NO"}`);
console.log(`  Total supply preserved:     ${totalMatch ? "✅ YES" : "❌ NO"}`);
console.log(`  version() returns "V2":     ${ver === "V2" ? "✅ YES" : "❌ NO"}`);

if (deployerMatch && secondMatch && totalMatch && ver === "V2") {
  console.log("\n🎉 Upgrade validated successfully!");
} else {
  console.log("\n⚠️ Some validations failed!");
  process.exitCode = 1;
}
