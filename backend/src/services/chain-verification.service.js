
import "dotenv/config";

import {
    Interface,
    JsonRpcProvider,
    getAddress,
} from "ethers";

const EXPECTED_CHAIN_ID = 11155111n;

function normalizeAddress(address, label = "wallet") {
    try {
        return getAddress(String(address).trim().toLowerCase());
    } catch {
        throw new Error(`Invalid ${label} address.`);
    }
}

function getAllowedContractAddresses() {
    const configuredAddresses = [
        process.env.FUNDCHAIN_V1_CONTRACT_ADDRESS ||
            process.env.FUNDCHAIN_CONTRACT_ADDRESS,
        process.env.FUNDCHAIN_V2_CONTRACT_ADDRESS,
    ];

    const addresses = configuredAddresses
        .filter(Boolean)
        .map((address, index) =>
            normalizeAddress(address, `FundChain contract ${index + 1}`)
        );

    const uniqueAddresses = [...new Set(addresses)];

    if (uniqueAddresses.length === 0) {
        throw new Error(
            "Configure at least one FundChain V1 or V2 contract address."
        );
    }

    return uniqueAddresses;
}

const FUNDCHAIN_EVENTS = new Interface([
    "event CampaignCreated(uint256 indexed campaignId,address indexed creator,uint256 goal,uint256 deadline,uint256 milestoneCount)",
]);

let provider;

function getProvider() {
    if (!process.env.SEPOLIA_RPC_URL) {
        throw new Error("SEPOLIA_RPC_URL is missing.");
    }

    if (!provider) {
        provider = new JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
    }

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

    const normalizedHash = transactionHash.toLowerCase();
    const creator = normalizeAddress(expectedCreator, "creator");

    const rpc = getProvider();
    const allowedAddresses = getAllowedContractAddresses();

    const network = await rpc.getNetwork();

    if (network.chainId !== EXPECTED_CHAIN_ID) {
        throw new Error("Backend RPC is not connected to Sepolia.");
    }

    const receipt = await rpc.getTransactionReceipt(normalizedHash);

    if (!receipt || receipt.status !== 1) {
        throw new Error(
            "Campaign creation transaction was not confirmed successfully."
        );
    }

    const tx = await rpc.getTransaction(normalizedHash);

    if (!tx || !tx.to) {
        throw new Error("Campaign creation transaction was not found.");
    }

    const transactionTarget = normalizeAddress(
        tx.to,
        "transaction target"
    );

    if (!allowedAddresses.includes(transactionTarget)) {
        throw new Error(
            "Transaction was not sent to an approved FundChain contract."
        );
    }

    if (normalizeAddress(tx.from, "transaction sender") !== creator) {
        throw new Error(
            "Transaction sender does not match the campaign creator."
        );
    }

    if (await receipt.confirmations() < 1) {
        throw new Error("Transaction has no confirmations.");
    }

    let campaignEvent = null;

    for (const log of receipt.logs) {
        if (
            normalizeAddress(log.address, "event contract") !==
            transactionTarget
        ) {
            continue;
        }

        try {
            const parsed = FUNDCHAIN_EVENTS.parseLog(log);

            if (parsed?.name === "CampaignCreated") {
                campaignEvent = parsed;
                break;
            }
        } catch {
            // Ignore unrelated events.
        }
    }

    if (!campaignEvent) {
        throw new Error(
            "CampaignCreated event was not found in this transaction."
        );
    }

    const args = campaignEvent.args;
    const campaignId = args.campaignId.toString();

    if (normalizeAddress(args.creator, "event creator") !== creator) {
        throw new Error("On-chain campaign creator does not match.");
    }

    if (args.goal.toString() !== String(expectedGoalWei)) {
        throw new Error("On-chain goal does not match the saved draft.");
    }

    if (args.deadline.toString() !== String(expectedDeadline)) {
        throw new Error("On-chain deadline does not match the saved draft.");
    }

    if (
        args.milestoneCount.toString() !==
        String(expectedMilestoneCount)
    ) {
        throw new Error(
            "On-chain milestone count does not match the saved draft."
        );
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
        transactionHash: normalizedHash,
        contractCampaignId: campaignId,
        blockNumber: receipt.blockNumber,
    };
}
