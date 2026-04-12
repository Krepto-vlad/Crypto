import { network } from "hardhat";

const { viem, networkName } = await network.connect();
const client = await viem.getPublicClient();

const name = "Vlad";

console.log(`Deploying Greeter to ${networkName} with name "${name}"...`);

const greeter = await viem.deployContract("Greeter", [name]);

console.log(`Greeter deployed to: ${greeter.address}`);
console.log(`View on Etherscan: https://sepolia.etherscan.io/address/${greeter.address}`);

// Call greet() to verify
const greeting = await greeter.read.greet();
console.log(`greet() returned: "${greeting}"`);
