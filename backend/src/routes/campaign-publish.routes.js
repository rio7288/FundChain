
import express from "express";
import { rateLimit } from "express-rate-limit";

import { authenticateUser } from "../middleware/auth.middleware.js";
import {
    publishCampaignController,
} from "../controllers/campaign-publish.controller.js";

const router = express.Router();

const publishLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many campaign publishing attempts. Please try again later.",
    },
});

router.post(
    "/:id/publish",
    publishLimiter,
    authenticateUser,
    publishCampaignController
);

export default router;
