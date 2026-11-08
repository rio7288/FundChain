import "dotenv/config";
import express from "express";
import crypto from "crypto";
import {
    verifyMessage,
    getAddress
} from "ethers";
import { createClient } from "@supabase/supabase-js";
import { authenticateUser } from "../middleware/auth.middleware.js";


const router = express.Router();

const pendingNonces = new Map();

const SEPOLIA_CHAIN_ID = 11155111;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase environment variables are missing.");
}

// Generate wallet verification message
router.post("/nonce", authenticateUser, async (req, res) => {
    try {
        const { address, chainId } = req.body;

        if (!address || !chainId) {
            return res.status(400).json({
                success: false,
                message: "Wallet address and chain ID are required."
            });
        }

        if (Number(chainId) !== SEPOLIA_CHAIN_ID) {
            return res.status(400).json({
                success: false,
                message: "Please connect to Ethereum Sepolia."
            });
        }

        const walletAddress = getAddress(address);

        const nonce = crypto.randomBytes(32).toString("hex");
        const issuedAt = new Date();
        const expiration = new Date(Date.now() + 5 * 60 * 1000);

        const message = [
            "FundChain Wallet Verification",
            "",
            `User ID: ${req.user.id}`,
            `Wallet: ${walletAddress}`,
            `Chain ID: ${SEPOLIA_CHAIN_ID}`,
            `Nonce: ${nonce}`,
            `Issued At: ${issuedAt.toISOString()}`,
            `Expiration Time: ${expiration.toISOString()}`
        ].join("\n");

        pendingNonces.set(nonce, {
            userId: req.user.id,
            address: walletAddress,
            message,
            expiresAt: expiration.getTime()
        });

        return res.status(200).json({
            success: true,
            message
        });

    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Verify signature and link wallet
router.post("/verify", authenticateUser, async (req, res) => {
    try {
        const { address, signature, message } = req.body;

        if (!address || !signature || typeof message !== "string") {
            return res.status(400).json({
                success: false,
                message: "Address, signature and verification message are required."
            });
        }

        const nonceMatch = message.match(/Nonce: ([a-f0-9]+)/);

        if (!nonceMatch) {
            return res.status(400).json({
                success: false,
                message: "Invalid verification message."
            });
        }

        const nonce = nonceMatch[1];
        const challenge = pendingNonces.get(nonce);

        if (
            !challenge ||
            challenge.userId !== req.user.id ||
            challenge.message !== message ||
            challenge.expiresAt < Date.now()
        ) {
            pendingNonces.delete(nonce);

            return res.status(400).json({
                success: false,
                message: "Invalid or expired verification request. Please try again."
            });
        }

        const walletAddress = getAddress(address);

        if (walletAddress !== challenge.address) {
            return res.status(400).json({
                success: false,
                message: "Wallet address mismatch."
            });
        }

        if (Number(message.match(/Chain ID: (\d+)/)?.[1]) !== SEPOLIA_CHAIN_ID) {
            return res.status(400).json({
                success: false,
                message: "Invalid blockchain network."
            });
        }

        // Verify the wallet signature
        const recoveredAddress = getAddress(
            verifyMessage(message, signature)
        );

        if (recoveredAddress !== walletAddress) {
            return res.status(401).json({
                success: false,
                message: "Wallet signature verification failed."
            });
        }

        // Consume nonce so it cannot be reused
        pendingNonces.delete(nonce);

        // Create Supabase client using the authenticated user's token
        const userClient = createClient(
            supabaseUrl,
            supabaseKey,
            {
                global: {
                    headers: {
                        Authorization: `Bearer ${req.accessToken}`
                    }
                },
                auth: {
                    persistSession: false,
                    autoRefreshToken: false
                }
            }
        );

        // Check whether this wallet is already linked to this user
        const { data: existingWallet, error: lookupError } =
            await userClient
                .from("wallet_links")
                .select("id, user_id, wallet_address, chain_id")
                .eq("wallet_address", walletAddress)
                .maybeSingle();

        if (lookupError) {
            console.error("Wallet lookup error:", lookupError.message);

            return res.status(500).json({
                success: false,
                message: "Could not check the existing wallet link."
            });
        }

        // Wallet already belongs to this user
        if (existingWallet) {
            if (existingWallet.user_id === req.user.id) {
                return res.status(200).json({
                    success: true,
                    alreadyLinked: true,
                    message: "This wallet is already linked to your FundChain account.",
                    walletAddress: existingWallet.wallet_address
                });
            }

            return res.status(409).json({
                success: false,
                message: "This wallet is already linked to another FundChain account."
            });
        }

        // Save a new wallet link
        const { data: savedWallet, error: linkError } =
            await userClient
                .from("wallet_links")
                .insert({
                    user_id: req.user.id,
                    wallet_address: walletAddress,
                    chain_id: SEPOLIA_CHAIN_ID,
                    verified_at: new Date().toISOString()
                })
                .select("id, user_id, wallet_address, chain_id")
                .single();

        if (linkError) {
            // Handle a simultaneous duplicate insertion
            if (linkError.code === "23505") {
                return res.status(409).json({
                    success: false,
                    message: "This wallet is already linked to a FundChain account."
                });
            }

            console.error("Wallet insert error:", linkError.message);

            return res.status(400).json({
                success: false,
                message: linkError.message
            });
        }

        return res.status(200).json({
            success: true,
            alreadyLinked: false,
            message: "Wallet successfully linked to FundChain!",
            walletAddress: savedWallet.wallet_address
        });

    } catch (error) {
        console.error("Wallet verification error:", error.message);

        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

export default router;
