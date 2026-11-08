
import "dotenv/config";

import {
    Interface,
    JsonRpcProvider,
    getAddress,
} from "ethers";

import { createClient } from "@supabase/supabase-js";

const SEPOLIA_CHAIN_ID = 11155111n;

const DONATION_EVENT = new Interface([
    "event DonationReceived(uint256 indexed campaignId,address indexed donor,uint256 amount)",
]);

class HttpError extends Error {
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
    }
}

function getUserClient(accessToken) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
        throw new Error("Missing Supabase user environment variables.");
    }

    if (!accessToken) {
        throw new HttpError(401, "Authentication token is missing.");
    }

    return createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY,
        {
            global: {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            },
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            },
        }
    );
}

if (
    !process.env.SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
) {
    throw new Error("Missing Supabase admin environment variables.");
}

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    }
);

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

function normalizeAddress(address, label = "wallet") {
    try {
        return getAddress(String(address).trim().toLowerCase());
    } catch {
        throw new HttpError(400, `Invalid ${label} address.`);
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

export async function createDonationController(req, res) {
    try {
        // 1. Validate request and normalize transaction hash.
        const campaignId = req.params.id;

        const {
            transactionHash,
            walletAddress,
        } = req.body || {};

        if (
            !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
                campaignId || ""
            )
        ) {
            throw new HttpError(400, "Invalid campaign ID.");
        }

        if (!/^0x[a-fA-F0-9]{64}$/.test(transactionHash || "")) {
            throw new HttpError(400, "Invalid transaction hash.");
        }

        if (!walletAddress) {
            throw new HttpError(400, "Donor wallet address is required.");
        }

        if (!req.user?.id) {
            throw new HttpError(401, "Authentication required.");
        }

        const normalizedHash = transactionHash.toLowerCase();
        const wallet = normalizeAddress(walletAddress);
        const userClient = getUserClient(req.accessToken);

        // 2. Fetch the campaign.
        const {
            data: campaign,
            error: campaignError,
        } = await userClient
            .from("campaigns")
            .select(`
                id,
                creator_id,
                status,
                contract_campaign_id,
                contract_address,
                target_amount_wei
            `)
            .eq("id", campaignId)
            .maybeSingle();

        if (campaignError) throw campaignError;

        if (!campaign) {
            throw new HttpError(404, "Campaign not found.");
        }

        if (campaign.status !== "active") {
            throw new HttpError(
                409,
                "This campaign is not accepting donations."
            );
        }

        if (campaign.contract_campaign_id === null) {
            throw new Error(
                "Campaign has no verified blockchain ID."
            );
        }

        // 3. Verify the campaign's contract against the configured allowlist.
        const allowedAddresses = getAllowedContractAddresses();

        if (!campaign.contract_address) {
            throw new Error(
                "Campaign does not have a configured contract address."
            );
        }

        const contractAddress = normalizeAddress(
            campaign.contract_address,
            "campaign contract"
        );

        if (!allowedAddresses.includes(contractAddress)) {
            throw new HttpError(
                403,
                "Campaign uses an unapproved FundChain contract."
            );
        }

        // 4. Verify that the donor wallet is linked to this account.
        const {
            data: walletLinks,
            error: walletError,
        } = await userClient
            .from("wallet_links")
            .select("wallet_address,chain_id")
            .eq("user_id", req.user.id)
            .eq("chain_id", Number(SEPOLIA_CHAIN_ID));

        if (walletError) throw walletError;

        const linkedWallet = (walletLinks || []).some((item) => {
            try {
                return normalizeAddress(item.wallet_address) === wallet;
            } catch {
                return false;
            }
        });

        if (!linkedWallet) {
            throw new HttpError(
                403,
                "This wallet is not linked to your FundChain account."
            );
        }

        // 5. Check whether this transaction was already recorded.
        const {
            data: existingDonation,
            error: duplicateError,
        } = await supabaseAdmin
            .from("donations")
            .select("id,tx_hash")
            .eq("tx_hash", normalizedHash)
            .maybeSingle();

        if (duplicateError) throw duplicateError;

        if (existingDonation) {
            throw new HttpError(
                409,
                "This transaction has already been recorded."
            );
        }

        // 6. Verify Sepolia network.
        const rpc = getProvider();
        const network = await rpc.getNetwork();

        if (network.chainId !== SEPOLIA_CHAIN_ID) {
            throw new Error(
                "Backend RPC is not connected to Sepolia."
            );
        }

        // 7. Verify the transaction receipt.
        const receipt = await rpc.getTransactionReceipt(normalizedHash);

        if (!receipt || receipt.status !== 1) {
            throw new HttpError(
                400,
                "Donation transaction is not confirmed successfully."
            );
        }

        const tx = await rpc.getTransaction(normalizedHash);

        if (!tx || !tx.to) {
            throw new HttpError(
                400,
                "Donation transaction was not found."
            );
        }

        // 8. Verify contract destination and transaction sender.
        if (normalizeAddress(tx.to, "transaction target") !== contractAddress) {
            throw new HttpError(
                400,
                "Transaction was not sent to the campaign's FundChain contract."
            );
        }

        if (normalizeAddress(tx.from, "transaction sender") !== wallet) {
            throw new HttpError(
                400,
                "Transaction sender does not match the linked donor wallet."
            );
        }

        // 9. Find and verify the DonationReceived event.
        let donationEvent = null;

        for (const log of receipt.logs) {
            if (
                normalizeAddress(log.address, "event contract") !==
                contractAddress
            ) {
                continue;
            }

            try {
                const parsed = DONATION_EVENT.parseLog(log);

                if (
                    parsed?.name === "DonationReceived" &&
                    parsed.args.campaignId.toString() ===
                        String(campaign.contract_campaign_id) &&
                    normalizeAddress(parsed.args.donor, "event donor") === wallet
                ) {
                    donationEvent = parsed;
                    break;
                }
            } catch {
                // Ignore unrelated logs.
            }
        }

        if (!donationEvent) {
            throw new HttpError(
                400,
                "A matching DonationReceived event was not found."
            );
        }

        const amountWei = donationEvent.args.amount.toString();

        if (BigInt(amountWei) <= 0n) {
            throw new HttpError(400, "Invalid donation amount.");
        }

        // For this FundChain payable donation flow, msg.value must
        // equal the amount recorded in DonationReceived.
        if (tx.value.toString() !== amountWei) {
            throw new HttpError(
                400,
                "Transaction value does not match the recorded donation amount."
            );
        }

        // 10. Independently save the verified donation.
        const {
            data: donation,
            error: insertError,
        } = await supabaseAdmin
            .from("donations")
            .insert({
                campaign_id: campaignId,
                donor_id: req.user.id,
                wallet_address: wallet,
                amount_wei: amountWei,
                tx_hash: normalizedHash,
                block_number: receipt.blockNumber,
                is_anonymous: false,
            })
            .select()
            .single();

        if (insertError) {
            // Handle a duplicate transaction if the database
            // has a unique constraint on tx_hash.
            if (insertError.code === "23505") {
                throw new HttpError(
                    409,
                    "This donation transaction is already recorded."
                );
            }

            throw insertError;
        }

        return res.status(201).json({
            success: true,
            message: "Donation verified and recorded successfully.",
            donation,
        });

    } catch (error) {
        console.error("Donation verification error:", error);

        const statusCode =
            error instanceof HttpError
                ? error.statusCode
                : 500;

        return res.status(statusCode).json({
            success: false,
            message:
                error instanceof HttpError
                    ? error.message
                    : "Unable to verify donation due to a server error.",
        });
    }
}
