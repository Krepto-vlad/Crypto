import { network } from "hardhat";
import { readFileSync, writeFileSync } from "fs";

const addresses = JSON.parse(readFileSync("deployed-addresses.json", "utf-8"));
const { viem, networkName } = await network.connect();
const [walletClient] = await viem.getWalletClients();
const publicClient = await viem.getPublicClient();

if (addresses.network !== networkName) {
  throw new Error(
    `Network mismatch: deployed-addresses.json was created for "${addresses.network}", but the current network is "${networkName}".`
  );
}

console.log(`Upgrading proxy to MyTokenV2 on ${networkName}...`);
console.log(`Proxy address: ${addresses.proxy}`);
console.log(`Upgrader: ${walletClient.account.address}\n`);

// 1. Deploy V2 implementation
console.log("Step 1: Deploying MyTokenV2 implementation...");
const v2Implementation = await viem.deployContract("MyTokenV2");
console.log(`  V2 implementation: ${v2Implementation.address}`);

// 2. Call upgradeToAndCall on proxy (via V1 ABI which has UUPS)
console.log("Step 2: Calling upgradeToAndCall on proxy...");
const proxyAsV1 = await viem.getContractAt("MyTokenV1", addresses.proxy);

const upgradeTx = await proxyAsV1.write.upgradeToAndCall([
  v2Implementation.address,
  "0x", // no additional initialization call needed
]);
await publicClient.waitForTransactionReceipt({ hash: upgradeTx, confirmations: 1 });
console.log(`  Upgrade tx: ${upgradeTx}`);
console.log(`  Etherscan: https://sepolia.etherscan.io/tx/${upgradeTx}`);

// 3. Update saved addresses
addresses.v2Implementation = v2Implementation.address;
writeFileSync("deployed-addresses.json", JSON.stringify(addresses, null, 2));
console.log("\nUpgrade complete! Addresses updated in deployed-addresses.json");
