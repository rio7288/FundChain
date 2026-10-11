const hre = require("hardhat");

async function main() {
  const FundChain = await hre.ethers.getContractFactory("FundChain");
  const fundChain = await FundChain.deploy();
  await fundChain.waitForDeployment();
  const address = await fundChain.getAddress();
  console.log(`FundChain deployed to: ${address}`);
  console.log("Copy this address into frontend/src/contract.js");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
