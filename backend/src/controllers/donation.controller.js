
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

function getUserClient(accessToken) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
        throw new Error("Missing Supabase user environment variables.");
    }

    if (!accessToken) {
        throw new Error("Authentication token is missing.");
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
    throw new Error(
        "Missing Supabase admin environment variables."
    );
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
        provider = new JsonRpcProvider(
            process.env.SEPOLIA_RPC_URL
        );
    }

    return provider;
}

function normalizeAddress(address) {
    try {
        return getAddress(String(address).trim().toLowerCase());
    } catch {
        throw new Error("Invalid wallet address.");
    }
}

export async function createDonationController(req, res) {
    try {
        const campaignId = req.params.id;

        const {
            transactionHash,
            walletAddress,
        } = req.body || {};

        // 1. Validate request
        if (!/^[0-9a-fA-F-]{36}$/.test(campaignId || "")) {
            return res.status(400).json({
                success: false,
                message: "Invalid campaign ID.",
            });
        }

        if (!/^0x[a-fA-F0-9]{64}$/.test(transactionHash || "")) {
            return res.status(400).json({
                success: false,
                message: "Invalid transaction hash.",
            });
        }

        if (!walletAddress) {
            return res.status(400).json({
                success: false,
                message: "Donor wallet address is required.",
            });
        }

        const wallet = normalizeAddress(walletAddress);
        const userClient = getUserClient(req.accessToken);

        // 2. Fetch the campaign
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
            return res.status(404).json({
                success: false,
                message: "Campaign not found.",
            });
        }

        if (campaign.status !== "active") {
            return res.status(409).json({
                success: false,
                message: "This campaign is not accepting donations.",
            });
        }

        if (campaign.contract_campaign_id === null) {
            throw new Error("Campaign has no verified blockchain ID.");
        }

        // 3. Verify linked wallet
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
            return res.status(403).json({
                success: false,
                message: "This wallet is not linked to your FundChain account.",
            });
        }

        // 4. Check duplicate transaction
        const {
            data: existingDonation,
            error: duplicateError,
        } = await supabaseAdmin
            .from("donations")
            .select("id,tx_hash")
            .eq("tx_hash", transactionHash)
            .maybeSingle();

        if (duplicateError) throw duplicateError;

        if (existingDonation) {
            return res.status(409).json({
                success: false,
                message: "This transaction has already been recorded.",
                donation: existingDonation,
            });
        }

        // 5. Verify Sepolia network
        const rpc = getProvider();
        const network = await rpc.getNetwork();

        if (network.chainId !== SEPOLIA_CHAIN_ID) {
            throw new Error("Backend RPC is not connected to Sepolia.");
        }

        // 6. Verify transaction receipt
        const receipt = await rpc.getTransactionReceipt(
            transactionHash
        );

        if (!receipt || receipt.status !== 1) {
            throw new Error(
                "Donation transaction is not confirmed successfully."
            );
        }

        const tx = await rpc.getTransaction(transactionHash);

        if (!tx || !tx.to) {
            throw new Error("Donation transaction was not found.");
        }

        const contractAddress = normalizeAddress(
            campaign.contract_address ||
            process.env.FUNDCHAIN_V1_CONTRACT_ADDRESS ||
            process.env.FUNDCHAIN_CONTRACT_ADDRESS
        );

        if (normalizeAddress(tx.to) !== contractAddress) {
            throw new Error(
                "Transaction was not sent to the campaign's FundChain contract."
            );
        }

        if (normalizeAddress(tx.from) !== wallet) {
            throw new Error(
                "Transaction sender does not match the linked donor wallet."
            );
        }

        // 7. Extract and verify DonationReceived event
        let donationEvent = null;

        for (const log of receipt.logs) {
            if (normalizeAddress(log.address) !== contractAddress) {
                continue;
            }

            try {
                const parsed = DONATION_EVENT.parseLog(log);

                if (
                    parsed?.name === "DonationReceived" &&
                    parsed.args.campaignId.toString() ===
                    String(campaign.contract_campaign_id) &&
                    normalizeAddress(parsed.args.donor) === wallet
                ) {
                    donationEvent = parsed;
                    break;
                }
            } catch {
                // Ignore unrelated contract events.
            }
        }

        if (!donationEvent) {
            throw new Error(
                "A matching DonationReceived event was not found."
            );
        }

        const amountWei = donationEvent.args.amount.toString();

        if (BigInt(amountWei) <= 0n) {
            throw new Error("Invalid donation amount.");
        }

        // 8. Save independently verified donation
        const { data: donation, error: insertError } =
            await supabaseAdmin
                .from("donations")
                .insert({
                    campaign_id: campaignId,
                    donor_id: req.user.id,
                    wallet_address: wallet,
                    amount_wei: amountWei,
                    tx_hash: transactionHash,
                    block_number: receipt.blockNumber,
                    is_anonymous: false,
                })
                .select()
                .single();

        if (insertError) {
            // Handle a duplicate transaction if the database
            // has a unique constraint on tx_hash.
            if (insertError.code === "23505") {
                return res.status(409).json({
                    success: false,
                    message: "This donation transaction is already recorded.",
                });
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

        return res.status(400).json({
            success: false,
            message:
                error.message || "Unable to verify donation.",
        });
    }
}
