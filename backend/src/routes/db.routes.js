
import express from "express";
import { createClient } from "@supabase/supabase-js";
import { rateLimit } from "express-rate-limit";
import { authenticateUser } from "../middleware/auth.middleware.js";

const router = express.Router();

const databaseTestLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
});

router.get(
    "/test",
    databaseTestLimiter,
    authenticateUser,
    async (req, res) => {
        try {
            const userClient = createClient(
                process.env.SUPABASE_URL,
                process.env.SUPABASE_ANON_KEY,
                {
                    global: {
                        headers: {
                            Authorization: `Bearer ${req.accessToken}`,
                        },
                    },
                    auth: {
                        persistSession: false,
                        autoRefreshToken: false,
                    },
                }
            );

            const { error } = await userClient
                .from("campaigns")
                .select("id")
                .limit(1);

            if (error) {
                console.error("Database test failed:", error.message);

                return res.status(503).json({
                    success: false,
                    message: "Database connection test failed.",
                });
            }

            return res.status(200).json({
                success: true,
                message: "FundChain database connected!",
            });
        } catch (error) {
            console.error("Database test error:", error);

            return res.status(503).json({
                success: false,
                message: "Database service is temporarily unavailable.",
            });
        }
    }
);

export default router;
