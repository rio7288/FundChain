
import { createCampaignSchema } from "../validators/campaign.validator.js";

import {
    createCampaign,
    getMyCampaigns,
    getPublicCampaigns,
    updateCampaignDraft,
    deleteCampaignDraft
} from "../services/campaign.service.js";

// Create a new campaign draft
export async function createCampaignController(req, res) {
    try {
        const validation = createCampaignSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({
                success: false,
                message: "Invalid campaign information",
                errors: validation.error.flatten()
            });
        }

        const campaign = await createCampaign(
            {
                ...validation.data,
                imageUrl: req.body.imageUrl || null
            },
            req.user,
            req.accessToken
        );

        return res.status(201).json({
            success: true,
            message: "Campaign draft created successfully",
            campaign
        });
    } catch (error) {
        console.error("Campaign creation error:", error);

        return res.status(500).json({
            success: false,
            message: error.message || "Unable to create campaign"
        });
    }
}

// Get campaigns created by the logged-in user
export async function myCampaignsController(req, res) {
    try {
        const campaigns = await getMyCampaigns(
            req.user,
            req.accessToken
        );

        return res.status(200).json({
            success: true,
            campaigns
        });
    } catch (error) {
        console.error("My campaigns error:", error);

        return res.status(500).json({
            success: false,
            message: error.message || "Unable to fetch your campaigns"
        });
    }
}

// Get publicly visible campaigns
export async function publicCampaignsController(req, res) {
    try {
        const campaigns = await getPublicCampaigns();

        return res.status(200).json({
            success: true,
            campaigns
        });
    } catch (error) {
        console.error("Public campaigns error:", error);

        return res.status(500).json({
            success: false,
            message: error.message || "Unable to fetch public campaigns"
        });
    }
}

// Update an existing draft
export async function updateCampaignController(req, res) {
    try {
        const validation = createCampaignSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({
                success: false,
                message: "Invalid campaign information",
                errors: validation.error.flatten()
            });
        }

        const imageUrl = req.body.imageUrl;

        if (
            imageUrl !== undefined &&
            imageUrl !== null &&
            typeof imageUrl !== "string"
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid campaign image URL"
            });
        }

        const campaign = await updateCampaignDraft(
            req.params.id,
            {
                ...validation.data,
                imageUrl: imageUrl || null
            },
            req.accessToken
        );

        return res.status(200).json({
            success: true,
            message: "Campaign draft updated successfully",
            campaign
        });
    } catch (error) {
        console.error("Campaign update error:", error);

        return res.status(400).json({
            success: false,
            message: error.message || "Unable to update campaign"
        });
    }
}

// Delete an existing draft
export async function deleteCampaignController(req, res) {
    try {
        await deleteCampaignDraft(
            req.params.id,
            req.accessToken
        );

        return res.status(200).json({
            success: true,
            message: "Campaign draft deleted successfully"
        });
    } catch (error) {
        console.error("Campaign deletion error:", error);

        return res.status(400).json({
            success: false,
            message: error.message || "Unable to delete campaign"
        });
    }
}
