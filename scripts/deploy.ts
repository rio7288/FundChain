
import { network } from "hardhat";

async function main() {
  const { ethers } = await network.create();

  const [deployer] = await ethers.getSigners();

  const networkInfo = await ethers.provider.getNetwork();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log("\n========== FUNDCHAIN DEPLOYMENT ==========");
  console.log("Network:", networkInfo.name);
  console.log("Chain ID:", networkInfo.chainId.toString());
  console.log("Deployer:", deployer.address);
  console.log("Wallet balance:", ethers.formatEther(balance), "ETH");

  // Sepolia chain ID = 11155111
  if (networkInfo.chainId !== 11155111n) {
    throw new Error("Wrong network! Deployment cancelled.");
  }

  if (balance === 0n) {
    throw new Error("Deployment wallet has no Sepolia ETH.");
  }

  console.log("\nDeploying FundChain...");

  const fundChain = await ethers.deployContract("FundChain");

  const deploymentTx = fundChain.deploymentTransaction();

  await fundChain.waitForDeployment();

  const contractAddress = await fundChain.getAddress();

  console.log("\n========== DEPLOYMENT SUCCESSFUL ==========");
  console.log("Contract address:", contractAddress);
  console.log("Transaction hash:", deploymentTx?.hash);
  console.log("Network: Ethereum Sepolia");
  console.log("Chain ID:", networkInfo.chainId.toString());
  console.log("===========================================\n");
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});
