
import { createClient } from "@supabase/supabase-js";
import { parseEther } from "ethers";
import "dotenv/config";

function getUserClient(accessToken) {
    return createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY,
        {
            global: {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            },
            auth: {
                persistSession: false,
                autoRefreshToken: false
            }
        }
    );
}

// =========================================
// CREATE CAMPAIGN
// =========================================

export async function createCampaign(data, user, accessToken) {
    const supabase = getUserClient(accessToken);

    const targetWei = parseEther(data.targetEth).toString();

    const milestoneRows = data.milestones.map((milestone, index) => ({
        title: milestone.title,
        description: milestone.description || "",
        amount_wei: parseEther(milestone.amountEth).toString(),
        sequence_number: index + 1,
        status: "pending"
    }));

    const { data: campaign, error: campaignError } = await supabase
        .from("campaigns")
        .insert({
            creator_id: user.id,
            title: data.title,
            description: data.description,
            category: data.category,
            image_url: data.imageUrl || null,
            target_amount_wei: targetWei,
            deadline: data.deadline,
            status: "draft",
            is_deleted: false
        })
        .select()
        .single();

    if (campaignError) throw campaignError;

    const { error: milestoneError } = await supabase
        .from("milestones")
        .insert(
            milestoneRows.map((milestone) => ({
                ...milestone,
                campaign_id: campaign.id
            }))
        );

    if (milestoneError) {
        const { error: cleanupError } = await supabase
            .from("campaigns")
            .delete()
            .eq("id", campaign.id);

        if (cleanupError) {
            console.error(
                "Campaign cleanup failed:",
                cleanupError.message
            );
        }

        throw milestoneError;
    }

    return campaign;
}

// =========================================
// GET MY CAMPAIGNS
// =========================================

export async function getMyCampaigns(user, accessToken) {
    const supabase = getUserClient(accessToken);

    const { data, error } = await supabase
        .from("campaigns")
        .select(`
            *,
            milestones (
                id,
                title,
                description,
                amount_wei,
                sequence_number,
                status
            )
        `)
        .eq("creator_id", user.id)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });

    if (error) throw error;

    return data;
}

// =========================================
// GET PUBLIC CAMPAIGNS
// =========================================

export async function getPublicCampaigns() {
    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY
    );

    const { data, error } = await supabase
        .from("campaigns")
        .select(`
            id,
            title,
            description,
            category,
            image_url,
            target_amount_wei,
            deadline,
            created_at
        `)
        .eq("status", "active")
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });

    if (error) throw error;

    return data;
}

// =========================================
// UPDATE CAMPAIGN DRAFT
// =========================================

export async function updateCampaignDraft(id, data, accessToken) {
    const supabase = getUserClient(accessToken);

    const milestoneRows = data.milestones.map((milestone, index) => ({
        title: milestone.title,
        description: milestone.description || "",
        amount_wei: parseEther(milestone.amountEth).toString(),
        sequence_number: index + 1
    }));

    const { data: campaign, error } = await supabase.rpc(
        "update_campaign_draft",
        {
            p_campaign_id: id,
            p_title: data.title,
            p_description: data.description,
            p_category: data.category,
            p_image_url: data.imageUrl || null,
            p_target_amount_wei: parseEther(data.targetEth).toString(),
            p_deadline: data.deadline,
            p_milestones: milestoneRows
        }
    );

    if (error) throw error;

    return campaign;
}

// =========================================
// SOFT DELETE CAMPAIGN
// =========================================

export async function deleteCampaignDraft(id, accessToken) {
    const supabase = getUserClient(accessToken);

    const { data, error } = await supabase.rpc(
        "soft_delete_campaign",
        {
            p_campaign_id: id
        }
    );

    if (error) throw error;

    return data;
}
