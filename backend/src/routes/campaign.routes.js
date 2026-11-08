
import express from "express";
import { rateLimit } from "express-rate-limit";

import { authenticateUser } from "../middleware/auth.middleware.js";

import {
    createCampaignController,
    myCampaignsController,
    publicCampaignsController,
    updateCampaignController,
    deleteCampaignController,
} from "../controllers/campaign.controller.js";

import {
    createDonationController,
} from "../controllers/donation.controller.js";

const router = express.Router();

// Limit campaign write operations.
const campaignWriteLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many campaign modification requests. Try again later.",
    },
});

// Stricter limit for donation verification.
const donationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many donation verification attempts. Try again later.",
    },
});

// Public campaign discovery.
router.get("/", publicCampaignsController);

// Authenticated user's campaigns.
router.get("/mine", authenticateUser, myCampaignsController);

// Create a campaign draft.
router.post(
    "/",
    campaignWriteLimiter,
    authenticateUser,
    createCampaignController
);

// Edit a campaign draft.
router.put(
    "/:id",
    campaignWriteLimiter,
    authenticateUser,
    updateCampaignController
);

// Delete a campaign draft.
router.delete(
    "/:id",
    campaignWriteLimiter,
    authenticateUser,
    deleteCampaignController
);

// Verify and record a blockchain donation.
router.post(
    "/:id/donations",
    donationLimiter,
    authenticateUser,
    createDonationController
);

export default router;
