import { network } from "hardhat";

const { viem, networkName } = await network.connect();
const client = await viem.getPublicClient();
const [walletClient] = await viem.getWalletClients();

const address = walletClient.account.address;
console.log(`Account: ${address}`);

// Get confirmed and pending nonce
const confirmedNonce = await client.getTransactionCount({ address });
const pendingNonce = await client.getTransactionCount({ address, blockTag: "pending" });

console.log(`Confirmed nonce: ${confirmedNonce}`);
console.log(`Pending nonce: ${pendingNonce}`);

if (confirmedNonce >= pendingNonce) {
  console.log("No stuck transactions. You're good to go!");
  process.exit(0);
}

console.log(`\nCancelling ${pendingNonce - confirmedNonce} stuck transactions...`);

for (let nonce = confirmedNonce; nonce < pendingNonce; nonce++) {
  console.log(`Sending cancel tx with nonce ${nonce}...`);
  const hash = await walletClient.sendTransaction({
    to: address,
    value: 0n,
    nonce,
    maxFeePerGas: 50000000000n, // 50 gwei
    maxPriorityFeePerGas: 5000000000n, // 5 gwei
  });
  console.log(`  tx: ${hash}`);
}

console.log("\nWaiting for confirmations...");
const latestNonce = await client.getTransactionCount({ address, blockTag: "pending" });
console.log(`Pending nonce now: ${latestNonce}`);
console.log("Done! You can now deploy.");
