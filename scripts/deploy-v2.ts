
import { network } from "hardhat";

async function main() {
  // Connect to the network selected using --network
  const { ethers } = await network.create();

  const [deployer] = await ethers.getSigners();

  const networkInfo = await ethers.provider.getNetwork();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log("\n========== FUNDCHAIN V2 DEPLOYMENT ==========");
  console.log("Network:", networkInfo.name);
  console.log("Chain ID:", networkInfo.chainId.toString());
  console.log("Deployer:", deployer.address);
  console.log("Wallet balance:", ethers.formatEther(balance), "ETH");

  // Safety check: Sepolia only
  if (networkInfo.chainId !== 11155111n) {
    throw new Error("Wrong network! Deployment cancelled.");
  }

  if (balance === 0n) {
    throw new Error("Deployment wallet has no Sepolia ETH.");
  }

  console.log("\nDeploying FundChainV2...");

  // Deploy the NEW V2 contract, not V1
  const fundChainV2 = await ethers.deployContract("FundChainV2");

  const deploymentTx = fundChainV2.deploymentTransaction();

  console.log("Deployment transaction:", deploymentTx?.hash);
  console.log("Waiting for confirmation...");

  await fundChainV2.waitForDeployment();

  const contractAddress = await fundChainV2.getAddress();

  console.log("\n========== DEPLOYMENT SUCCESSFUL ==========");
  console.log("Contract: FundChainV2");
  console.log("Contract address:", contractAddress);
  console.log("Transaction hash:", deploymentTx?.hash);
  console.log("Network: Ethereum Sepolia");
  console.log("Chain ID:", networkInfo.chainId.toString());

  console.log(
    "Etherscan:",
    `https://sepolia.etherscan.io/address/${contractAddress}`
  );

  console.log("============================================\n");
}

main().catch((error) => {
  console.error("\nFundChain V2 deployment failed:");
  console.error(error);
  process.exitCode = 1;
});
