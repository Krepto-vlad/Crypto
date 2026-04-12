import { configVariable, defineConfig } from "hardhat/config";
import HardhatToolboxViem from "@nomicfoundation/hardhat-toolbox-viem";
import HardhatKeystore from "@nomicfoundation/hardhat-keystore";

export default defineConfig({
  solidity: {
    version: "0.8.28",
  },
  plugins: [HardhatToolboxViem, HardhatKeystore],
  networks: {
    sepolia: {
      type: "http",
      chainType: "l1",
      url: configVariable("SEPOLIA_RPC_URL"),
      accounts: [configVariable("SEPOLIA_PRIVATE_KEY")],
    },
  },
});
