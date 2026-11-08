
import express from "express";

import { authenticateUser } from "../middleware/auth.middleware.js";

import {
    createCampaignController,
    myCampaignsController,
    publicCampaignsController,
    updateCampaignController,
    deleteCampaignController
} from "../controllers/campaign.controller.js";

import {
    createDonationController
} from "../controllers/donation.controller.js";

const router = express.Router();

// Public campaign discovery
router.get("/", publicCampaignsController);

// Authenticated user's campaigns
router.get("/mine", authenticateUser, myCampaignsController);

// Create a campaign draft
router.post("/", authenticateUser, createCampaignController);

// Edit a campaign draft
router.put("/:id", authenticateUser, updateCampaignController);

// Delete a campaign draft
router.delete("/:id", authenticateUser, deleteCampaignController);

// Verify and record a blockchain donation
router.post(
    "/:id/donations",
    authenticateUser,
    createDonationController
);

export default router;
