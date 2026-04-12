import { network } from "hardhat";
import { parseEther } from "viem";

const { viem, networkName } = await network.connect();
const [walletClient] = await viem.getWalletClients();

console.log(`Deploying MyToken to ${networkName}...`);
console.log(`Deployer: ${walletClient.account.address}`);

const initialSupply = parseEther("1000000"); 

const myToken = await viem.deployContract("MyToken", [initialSupply]);

console.log(`MyToken deployed to: ${myToken.address}`);
console.log(`View on Etherscan: https://sepolia.etherscan.io/address/${myToken.address}`);

const name = await myToken.read.name();
const symbol = await myToken.read.symbol();
const totalSupply = await myToken.read.totalSupply();

console.log(`\nToken name: ${name}`);
console.log(`Token symbol: ${symbol}`);
console.log(`Total supply: ${totalSupply}`);
