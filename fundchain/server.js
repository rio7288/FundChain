require("dotenv").config();

const express = require("express");
const { ethers } = require("ethers");

const app = express();
const port = Number(process.env.API_PORT || 3001);
const rpcUrl = process.env.FUNDCHAIN_RPC_URL || process.env.SEPOLIA_RPC_URL || "http://127.0.0.1:8545";
const campaignAbi = [
  "function campaignCount() view returns (uint256)",
  "function getCampaign(uint256 id) view returns (tuple(uint256 id,address creator,string title,string description,string imageUrl,uint256 goalWei,uint256 deadline,uint256 raisedWei,bool withdrawn))",
];

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.get("/api/campaigns", async (request, response) => {
  const address = request.query.address;
  if (typeof address !== "string" || !ethers.isAddress(address)) {
    return response.status(400).json({ error: "A valid contract address is required." });
  }

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(address, campaignAbi, provider);
    const count = Number(await contract.campaignCount());
    const campaigns = await Promise.all(
      Array.from({ length: count }, async (_, index) => {
        const campaign = await contract.getCampaign(index + 1);
        return {
          id: campaign.id.toString(),
          creator: campaign.creator,
          title: campaign.title,
          description: campaign.description,
          imageUrl: campaign.imageUrl,
          goalWei: campaign.goalWei.toString(),
          deadline: campaign.deadline.toString(),
          raisedWei: campaign.raisedWei.toString(),
          withdrawn: campaign.withdrawn,
        };
      }),
    );

    response.set("Cache-Control", "no-store").json({ campaigns: campaigns.reverse() });
  } catch (error) {
    console.error("Campaign API request failed:", error.message);
    response.status(502).json({ error: "Could not load campaigns from the configured blockchain network." });
  }
});

app.listen(port, () => {
  console.log(`FundChain API listening on http://localhost:${port}`);
});