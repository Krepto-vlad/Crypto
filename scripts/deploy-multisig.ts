import { network } from "hardhat";
import { parseEther } from "viem";

async function main() {
  const { viem } = await network.connect();

  const walletClients = await viem.getWalletClients();
  const publicClient = await viem.getPublicClient();

  if (walletClients.length < 3) {
    throw new Error(
      "At least 3 signer accounts are required. " +
        "Add more accounts or adjust the owners array below."
    );
  }

  const owners = [
    walletClients[0].account.address,
    walletClients[1].account.address,
    walletClients[2].account.address,
  ];
  const numConfirmationsRequired = BigInt(2); 

  console.log("Deploying MultiSigWallet…");
  console.log("  Owners:");
  owners.forEach((addr, i) => console.log(`    [${i}] ${addr}`));
  console.log(`  Confirmations required: ${numConfirmationsRequired}`);

  const wallet = await viem.deployContract("MultiSigWallet", [
    owners,
    numConfirmationsRequired,
  ]);

  console.log(`\nMultiSigWallet deployed at: ${wallet.address}`);

  const storedOwners = await wallet.read.getOwners();
  const required = await wallet.read.numConfirmationsRequired();

  console.log("\nOn-chain verification:");
  console.log("  Owners:", storedOwners);
  console.log("  Confirmations required:", required.toString());
  console.log("  Transaction count:", (await wallet.read.getTransactionCount()).toString());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
