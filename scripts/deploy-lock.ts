import { network } from "hardhat";

const { viem, networkName } = await network.connect();
const client = await viem.getPublicClient();

// Lock for 1 hour from now
const unlockTime = BigInt(Math.floor(Date.now() / 1000) + 3600);

console.log(`Deploying Lock to ${networkName}...`);
console.log(`Unlock time: ${new Date(Number(unlockTime) * 1000).toISOString()}`);

const lock = await viem.deployContract("Lock", [unlockTime], {
  value: 1n, // send 1 wei
});

console.log(`Lock deployed to: ${lock.address}`);
console.log(`View on Etherscan: https://sepolia.etherscan.io/address/${lock.address}`);
