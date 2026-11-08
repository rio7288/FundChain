
import "dotenv/config";

import express from "express";
import crypto from "crypto";
import { rateLimit } from "express-rate-limit";
import {
    verifyMessage,
    getAddress,
} from "ethers";
import { createClient } from "@supabase/supabase-js";

import { authenticateUser } from "../middleware/auth.middleware.js";

const router = express.Router();

const SEPOLIA_CHAIN_ID = 11155111;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const MAX_PENDING_CHALLENGES = 5000;
const MAX_CHALLENGES_PER_USER = 5;

const pendingNonces = new Map();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase environment variables are missing.");
}

const nonceLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many wallet verification requests. Try again later.",
    },
});

const verifyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many wallet signature attempts. Try again later.",
    },
});

function normalizeAddress(address) {
    try {
        if (typeof address !== "string") {
            throw new Error();
        }

        return getAddress(address.trim());
    } catch {
        throw new Error("Invalid wallet address.");
    }
}

function cleanExpiredChallenges() {
    const now = Date.now();

    for (const [nonce, challenge] of pendingNonces.entries()) {
        if (challenge.expiresAt <= now) {
            pendingNonces.delete(nonce);
        }
    }
}

function enforceChallengeLimits(userId) {
    const userChallenges = [];

    for (const [nonce, challenge] of pendingNonces.entries()) {
        if (challenge.userId === userId) {
            userChallenges.push(nonce);
        }
    }

    while (userChallenges.length >= MAX_CHALLENGES_PER_USER) {
        const oldestNonce = userChallenges.shift();
        pendingNonces.delete(oldestNonce);
    }

    while (pendingNonces.size >= MAX_PENDING_CHALLENGES) {
        const oldestNonce = pendingNonces.keys().next().value;

        if (!oldestNonce) break;

        pendingNonces.delete(oldestNonce);
    }
}

function createUserClient(accessToken) {
    return createClient(supabaseUrl, supabaseKey, {
        global: {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        },
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });
}

// Generate wallet verification challenge.
router.post(
    "/nonce",
    nonceLimiter,
    authenticateUser,
    async (req, res) => {
        try {
            const { address, chainId } = req.body || {};

            if (!address || chainId === undefined || chainId === null) {
                return res.status(400).json({
                    success: false,
                    message: "Wallet address and chain ID are required.",
                });
            }

            if (
                !Number.isSafeInteger(Number(chainId)) ||
                Number(chainId) !== SEPOLIA_CHAIN_ID
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Please connect to Ethereum Sepolia.",
                });
            }

            const walletAddress = normalizeAddress(address);

            cleanExpiredChallenges();
            enforceChallengeLimits(req.user.id);

            const nonce = crypto.randomBytes(32).toString("hex");
            const issuedAt = new Date();
            const expiration = new Date(Date.now() + CHALLENGE_TTL_MS);

            const message = [
                "FundChain Wallet Verification",
                "",
                `User ID: ${req.user.id}`,
                `Wallet: ${walletAddress}`,
                `Chain ID: ${SEPOLIA_CHAIN_ID}`,
                `Nonce: ${nonce}`,
                `Issued At: ${issuedAt.toISOString()}`,
                `Expiration Time: ${expiration.toISOString()}`,
            ].join("\n");

            pendingNonces.set(nonce, {
                userId: req.user.id,
                address: walletAddress,
                message,
                expiresAt: expiration.getTime(),
            });

            return res.status(200).json({
                success: true,
                message,
            });
        } catch (error) {
            console.error("Wallet nonce error:", error);

            return res.status(400).json({
                success: false,
                message:
                    error.message === "Invalid wallet address."
                        ? error.message
                        : "Unable to create wallet verification request.",
            });
        }
    }
);

// Verify signature and link wallet.
router.post(
    "/verify",
    verifyLimiter,
    authenticateUser,
    async (req, res) => {
        let nonce;

        try {
            const { address, signature, message } = req.body || {};

            if (
                !address ||
                typeof signature !== "string" ||
                typeof message !== "string"
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Address, signature and verification message are required.",
                });
            }

            // Standard 65-byte Ethereum signature.
            if (!/^0x[0-9a-fA-F]{130}$/.test(signature)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid wallet signature format.",
                });
            }

            const nonceMatch = message.match(/^Nonce: ([a-f0-9]{64})$/m);

            if (!nonceMatch) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid verification message.",
                });
            }

            nonce = nonceMatch[1];

            const challenge = pendingNonces.get(nonce);

            if (
                !challenge ||
                challenge.userId !== req.user.id ||
                challenge.message !== message ||
                challenge.expiresAt <= Date.now()
            ) {
                pendingNonces.delete(nonce);

                return res.status(400).json({
                    success: false,
                    message: "Invalid or expired verification request. Please try again.",
                });
            }

            const walletAddress = normalizeAddress(address);

            if (walletAddress !== challenge.address) {
                return res.status(400).json({
                    success: false,
                    message: "Wallet address mismatch.",
                });
            }

            const chainMatch = message.match(/^Chain ID: (\d+)$/m);

            if (
                !chainMatch ||
                Number(chainMatch[1]) !== SEPOLIA_CHAIN_ID
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid blockchain network.",
                });
            }

            // Recover the signer from the exact issued message.
            const recoveredAddress = normalizeAddress(
                verifyMessage(message, signature)
            );

            if (recoveredAddress !== walletAddress) {
                return res.status(401).json({
                    success: false,
                    message: "Wallet signature verification failed.",
                });
            }

            // Consume the nonce after successful signature verification.
            pendingNonces.delete(nonce);

            const userClient = createUserClient(req.accessToken);

            // Check whether this wallet is already linked.
            const {
                data: existingWallet,
                error: lookupError,
            } = await userClient
                .from("wallet_links")
                .select("id, user_id, wallet_address, chain_id")
                .eq("wallet_address", walletAddress)
                .eq("chain_id", SEPOLIA_CHAIN_ID)
                .maybeSingle();

            if (lookupError) {
                console.error("Wallet lookup error:", lookupError);

                return res.status(503).json({
                    success: false,
                    message: "Could not check the existing wallet link.",
                });
            }

            if (existingWallet) {
                if (existingWallet.user_id === req.user.id) {
                    return res.status(200).json({
                        success: true,
                        alreadyLinked: true,
                        message: "This wallet is already linked to your FundChain account.",
                        walletAddress: existingWallet.wallet_address,
                    });
                }

                return res.status(409).json({
                    success: false,
                    message: "This wallet is already linked to another FundChain account.",
                });
            }

            // Save the wallet using the authenticated user's Supabase token.
            const {
                data: savedWallet,
                error: linkError,
            } = await userClient
                .from("wallet_links")
                .insert({
                    user_id: req.user.id,
                    wallet_address: walletAddress,
                    chain_id: SEPOLIA_CHAIN_ID,
                    verified_at: new Date().toISOString(),
                })
                .select("id, user_id, wallet_address, chain_id")
                .single();

            if (linkError) {
                if (linkError.code === "23505") {
                    return res.status(409).json({
                        success: false,
                        message: "This wallet is already linked to a FundChain account.",
                    });
                }

                console.error("Wallet insert error:", linkError);

                return res.status(503).json({
                    success: false,
                    message: "Could not save the wallet link.",
                });
            }

            return res.status(200).json({
                success: true,
                alreadyLinked: false,
                message: "Wallet successfully linked to FundChain!",
                walletAddress: savedWallet.wallet_address,
            });
        } catch (error) {
            if (nonce) {
                pendingNonces.delete(nonce);
            }

            console.error("Wallet verification error:", error);

            return res.status(400).json({
                success: false,
                message:
                    error.message === "Invalid wallet address."
                        ? error.message
                        : "Wallet verification could not be completed.",
            });
        }
    }
);

export default router;
