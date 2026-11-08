import "dotenv/config";

import {
    Interface,
    JsonRpcProvider,
    getAddress,
} from "ethers";

const EXPECTED_CHAIN_ID = 11155111n;

function normalizeConfiguredAddress(rawAddress, label) {
    if (!rawAddress) return null;

    try {
        return getAddress(rawAddress.trim().toLowerCase());
    } catch {
        throw new Error(`Invalid ${label} contract address configuration.`);
    }
}

function getAllowedContractAddresses() {
    // FUNDCHAIN_CONTRACT_ADDRESS remains a compatibility fallback for V1.
    const v1 = normalizeConfiguredAddress(
        process.env.FUNDCHAIN_V1_CONTRACT_ADDRESS || process.env.FUNDCHAIN_CONTRACT_ADDRESS,
        "FundChain V1"
    );
    const v2 = normalizeConfiguredAddress(
        process.env.FUNDCHAIN_V2_CONTRACT_ADDRESS,
        "FundChain V2"
    );

    const addresses = [...new Set([v1, v2].filter(Boolean))];
    if (!addresses.length) {
        throw new Error("Configure FUNDCHAIN_V1_CONTRACT_ADDRESS and/or FUNDCHAIN_V2_CONTRACT_ADDRESS.");
    }
    return addresses;
}

const FUNDCHAIN_EVENTS = new Interface([
    "event CampaignCreated(uint256 indexed campaignId,address indexed creator,uint256 goal,uint256 deadline,uint256 milestoneCount)",
]);

let provider;

function getProvider() {
    if (!process.env.SEPOLIA_RPC_URL) {
        throw new Error("SEPOLIA_RPC_URL is missing.");
    }
    if (!provider) provider = new JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
    return provider;
}

export async function verifyCampaignCreation({
    transactionHash,
    expectedCreator,
    expectedGoalWei,
    expectedDeadline,
    expectedMilestoneCount,
    expectedCampaignId,
}) {
    if (!/^0x[a-fA-F0-9]{64}$/.test(transactionHash || "")) {
        throw new Error("Invalid transaction hash.");
    }

    const rpc = getProvider();
    const allowedAddresses = getAllowedContractAddresses();
    const network = await rpc.getNetwork();

    if (network.chainId !== EXPECTED_CHAIN_ID) {
        throw new Error("Backend RPC is not connected to Sepolia.");
    }

    const receipt = await rpc.getTransactionReceipt(transactionHash);
    if (!receipt || receipt.status !== 1) {
        throw new Error("Transaction is not confirmed successfully on Sepolia.");
    }

    const tx = await rpc.getTransaction(transactionHash);
    if (!tx || !tx.to) throw new Error("Deployment transaction was not found.");

    const transactionTarget = getAddress(tx.to);
    if (!allowedAddresses.includes(transactionTarget)) {
        throw new Error("Transaction was not sent to an approved FundChain V1 or V2 contract.");
    }

    const confirmations = await receipt.confirmations();
    if (confirmations < 1) throw new Error("Transaction has no confirmations.");

    let event;
    for (const log of receipt.logs) {
        if (getAddress(log.address) !== transactionTarget) continue;
        try {
            const parsed = FUNDCHAIN_EVENTS.parseLog(log);
            if (parsed?.name === "CampaignCreated") {
                event = parsed;
                break;
            }
        } catch {
            // Ignore unrelated logs.
        }
    }

    if (!event) throw new Error("CampaignCreated event was not found in this transaction.");

    const args = event.args;
    const campaignId = args.campaignId.toString();

    if (getAddress(args.creator) !== getAddress(expectedCreator)) {
        throw new Error("Campaign creator does not match your verified wallet.");
    }
    if (args.goal.toString() !== String(expectedGoalWei)) {
        throw new Error("On-chain goal does not match the saved draft.");
    }
    if (args.deadline.toString() !== String(expectedDeadline)) {
        throw new Error("On-chain deadline does not match the saved draft.");
    }
    if (args.milestoneCount.toString() !== String(expectedMilestoneCount)) {
        throw new Error("On-chain milestone count does not match the saved draft.");
    }
    if (
        expectedCampaignId !== undefined &&
        expectedCampaignId !== null &&
        campaignId !== String(expectedCampaignId)
    ) {
        throw new Error("On-chain campaign ID does not match.");
    }

    return {
        contractAddress: transactionTarget,
        transactionHash,
        contractCampaignId: campaignId,
        blockNumber: receipt.blockNumber,
    };
}
