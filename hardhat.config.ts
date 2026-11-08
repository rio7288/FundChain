
import "dotenv/config";

import { defineConfig } from "hardhat/config";
import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";

const rpcUrl = process.env.SEPOLIA_RPC_URL;
const privateKey = process.env.SEPOLIA_PRIVATE_KEY;

if (!rpcUrl) {
  throw new Error("SEPOLIA_RPC_URL is missing from .env");
}

if (!privateKey) {
  throw new Error("SEPOLIA_PRIVATE_KEY is missing from .env");
}

export default defineConfig({
  plugins: [hardhatToolboxMochaEthers],

  solidity: {
    version: "0.8.34",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },

  networks: {
    sepolia: {
      type: "http",
      chainType: "l1",
      url: rpcUrl,
      accounts: [privateKey],
    },
  },
});
