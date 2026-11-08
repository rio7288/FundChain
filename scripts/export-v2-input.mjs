
import fs from "node:fs";
import path from "node:path";

const dir = "artifacts/build-info";

const outputFiles = fs.readdirSync(dir)
  .filter(file => file.endsWith(".output.json"));

let exported = false;

for (const outputFile of outputFiles) {
  const outputPath = path.join(dir, outputFile);

  const outputData = JSON.parse(
    fs.readFileSync(outputPath, "utf8")
  );

  // Hardhat 3 stores compiler output under output.contracts
  const contracts = outputData.output?.contracts ?? {};

  const found = Object.entries(contracts).some(
    ([source, names]) =>
      source.endsWith("FundChainV2.sol") &&
      Boolean(names.FundChainV2)
  );

  if (!found) continue;

  const inputFile = outputFile.replace(
    ".output.json",
    ".json"
  );

  const inputPath = path.join(dir, inputFile);

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file missing: ${inputFile}`);
  }

  const inputData = JSON.parse(
    fs.readFileSync(inputPath, "utf8")
  );

  if (!inputData.input) {
    throw new Error("Compiler input is missing from build-info.");
  }

  fs.writeFileSync(
    "FundChainV2-standard-input.json",
    JSON.stringify(inputData.input, null, 2)
  );

  console.log("SUCCESS: V2 compiler input exported.");
  console.log("Input file:", inputFile);
  console.log("Output file:", outputFile);
  console.log("Source: project/contracts/FundChainV2.sol");

  exported = true;
  break;
}

if (!exported) {
  console.error("FundChainV2 output was not found.");
  process.exit(1);
}
