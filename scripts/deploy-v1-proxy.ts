import { network } from "hardhat";
import { parseEther, encodeFunctionData, getAddress } from "viem";
import { readFileSync } from "fs";

const { viem, networkName } = await network.connect();
const [walletClient] = await viem.getWalletClients();
const publicClient = await viem.getPublicClient();

console.log(`Deploying MyTokenV1 + ERC1967 Proxy to ${networkName}...`);
console.log(`Deployer: ${walletClient.account.address}\n`);

// 1. Deploy the V1 implementation contract
console.log("Step 1: Deploying MyTokenV1 implementation...");
const v1Implementation = await viem.deployContract("MyTokenV1");
console.log(`  V1 implementation: ${v1Implementation.address}`);

// 2. Encode the initialize() call
const initialSupply = parseEther("1000000");
const initData = encodeFunctionData({
  abi: v1Implementation.abi,
  functionName: "initialize",
  args: [initialSupply],
});

// 3. Deploy the ERC1967Proxy using raw bytecode
console.log("Step 2: Deploying ERC1967Proxy...");
// ERC1967Proxy ABI: constructor(address implementation, bytes memory _data)
const proxyArtifactPath = new URL(
  "../node_modules/@openzeppelin/contracts/build/contracts/ERC1967Proxy.json",
  import.meta.url
);
let proxyBytecode: `0x${string}`;
let proxyAbi: any[];
try {
  const artifact = JSON.parse(readFileSync(proxyArtifactPath, "utf-8"));
  proxyBytecode = artifact.bytecode as `0x${string}`;
  proxyAbi = artifact.abi;
} catch {
  // If build artifacts don't exist, use the compiled bytecode from Hardhat build-info
  // Fallback: deploy using walletClient directly
  throw new Error(
    "ERC1967Proxy artifact not found. Ensure @openzeppelin/contracts is installed."
  );
}

const proxyHash = await walletClient.deployContract({
  abi: proxyAbi,
  bytecode: proxyBytecode,
  args: [v1Implementation.address, initData],
});
const receipt = await publicClient.waitForTransactionReceipt({
  hash: proxyHash,
  confirmations: 1,
});
const proxyAddress = receipt.contractAddress!;
console.log(`  Proxy address: ${proxyAddress}`);

// 4. Attach MyTokenV1 ABI to the proxy address for interaction
const tokenViaProxy = await viem.getContractAt("MyTokenV1", proxyAddress);

const name = await tokenViaProxy.read.name();
const symbol = await tokenViaProxy.read.symbol();
const totalSupply = await tokenViaProxy.read.totalSupply();
const owner = await tokenViaProxy.read.owner();

console.log(`\n--- Token Info (via Proxy) ---`);
console.log(`  Name: ${name}`);
console.log(`  Symbol: ${symbol}`);
console.log(`  Total Supply: ${totalSupply}`);
console.log(`  Owner: ${owner}`);

console.log(`\n--- Addresses ---`);
console.log(`  V1 Implementation: ${v1Implementation.address}`);
console.log(`  Proxy: ${proxyAddress}`);
console.log(`  Etherscan (Proxy): https://sepolia.etherscan.io/address/${proxyAddress}`);

// Save addresses for later scripts
const fs = await import("fs");
const addresses = {
  v1Implementation: v1Implementation.address,
  proxy: proxyAddress,
  network: networkName,
};
fs.writeFileSync("deployed-addresses.json", JSON.stringify(addresses, null, 2));
console.log("\nAddresses saved to deployed-addresses.json");
