
import "dotenv/config";

import { getAddress } from "ethers";
import { createClient } from "@supabase/supabase-js";

import {
    verifyCampaignCreation
} from "../services/chain-verification.service.js";

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
        "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY."
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

export async function publishCampaignController(req, res) {
    try {
        const campaignId = req.params.id;

        const {
            transactionHash,
            creatorWallet,
        } = req.body || {};

        // 1. Validate transaction hash and wallet
        if (
            !/^0x[a-fA-F0-9]{64}$/.test(transactionHash || "") ||
            !creatorWallet
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "A valid transaction hash and creator wallet are required.",
            });
        }

        let wallet;

        try {
            wallet = getAddress(
                String(creatorWallet).trim().toLowerCase()
            );
        } catch {
            return res.status(400).json({
                success: false,
                message: "Invalid creator wallet address.",
            });
        }

        // 2. Authenticate user
        const userClient = getUserClient(req.accessToken);

        // 3. Fetch the user's saved campaign
        const {
            data: campaign,
            error: campaignError,
        } = await userClient
            .from("campaigns")
            .select(`
                id,
                creator_id,
                target_amount_wei,
                deadline,
                status,
                contract_campaign_id,
                transaction_hash
            `)
            .eq("id", campaignId)
            .eq("creator_id", req.user.id)
            .maybeSingle();

        if (campaignError) throw campaignError;

        if (!campaign) {
            return res.status(404).json({
                success: false,
                message: "Campaign draft not found.",
            });
        }

        // 4. Handle repeated requests safely
        if (campaign.status === "active") {
            if (
                campaign.transaction_hash?.toLowerCase() ===
                transactionHash.toLowerCase()
            ) {
                return res.status(200).json({
                    success: true,
                    message: "Campaign is already published.",
                    campaign,
                });
            }

            return res.status(409).json({
                success: false,
                message: "This campaign has already been published.",
            });
        }

        if (campaign.status !== "draft") {
            return res.status(409).json({
                success: false,
                message: "Only draft campaigns can be published.",
            });
        }

        // 5. Verify the linked wallet
        const {
            data: walletLink,
            error: walletError,
        } = await userClient
            .from("wallet_links")
            .select("wallet_address,chain_id")
            .eq("user_id", req.user.id)
            .eq("wallet_address", wallet)
            .eq("chain_id", 11155111)
            .maybeSingle();

        if (walletError) throw walletError;

        if (!walletLink) {
            return res.status(403).json({
                success: false,
                message:
                    "This wallet is not verified for your FundChain account.",
            });
        }

        // 6. Fetch saved milestones
        const {
            data: milestones,
            error: milestoneError,
        } = await userClient
            .from("milestones")
            .select("id,amount_wei")
            .eq("campaign_id", campaignId)
            .order("sequence_number", {
                ascending: true,
            });

        if (milestoneError) throw milestoneError;

        if (!milestones?.length) {
            throw new Error("Campaign has no saved milestones.");
        }

        // 7. Convert saved deadline to Unix seconds
        const deadlineMilliseconds = new Date(
            campaign.deadline
        ).getTime();

        if (!Number.isFinite(deadlineMilliseconds)) {
            throw new Error("Saved campaign deadline is invalid.");
        }

        const deadline = BigInt(
            Math.floor(deadlineMilliseconds / 1000)
        );

        // 8. Verify the existing blockchain transaction.
        // Campaign ID is extracted from the CampaignCreated event.
        const verified = await verifyCampaignCreation({
            transactionHash,
            expectedCreator: wallet,
            expectedGoalWei: campaign.target_amount_wei,
            expectedDeadline: deadline,
            expectedMilestoneCount: milestones.length,
        });

        // 9. Activate the draft using the server-side admin client.
        // Ownership and draft status are explicitly checked.
        const {
            data: updated,
            error: updateError,
        } = await supabaseAdmin
            .from("campaigns")
            .update({
                contract_campaign_id: verified.contractCampaignId,
                contract_address: verified.contractAddress,
                transaction_hash: verified.transactionHash,
                status: "active",
            })
            .eq("id", campaignId)
            .eq("creator_id", req.user.id)
            .eq("status", "draft")
            .select()
            .maybeSingle();

        if (updateError) throw updateError;

        if (!updated) {
            // Check whether another request completed publication.
            const {
                data: latestCampaign,
                error: latestError,
            } = await supabaseAdmin
                .from("campaigns")
                .select("*")
                .eq("id", campaignId)
                .eq("creator_id", req.user.id)
                .maybeSingle();

            if (latestError) throw latestError;

            if (
                latestCampaign?.status === "active" &&
                latestCampaign.transaction_hash?.toLowerCase() ===
                transactionHash.toLowerCase()
            ) {
                return res.status(200).json({
                    success: true,
                    message: "Campaign successfully published.",
                    campaign: latestCampaign,
                    chain: verified,
                });
            }

            throw new Error(
                "Campaign could not be activated. Please check its status."
            );
        }

        return res.status(200).json({
            success: true,
            message: "Campaign verified on Sepolia and published.",
            campaign: updated,
            chain: verified,
        });

    } catch (error) {
        console.error("Campaign publish error:", error);

        return res.status(400).json({
            success: false,
            message:
                error.message ||
                "Campaign could not be published.",
        });
    }
}
