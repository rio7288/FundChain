
import { z } from "zod";

const milestoneSchema = z.object({
    title: z.string().trim().min(3).max(150),
    description: z.string().trim().max(2000).optional().default(""),
    amountEth: z.string().regex(
        /^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/,
        "Invalid ETH amount"
    )
});

export const createCampaignSchema = z.object({
    title: z.string().trim().min(5).max(150),
    description: z.string().trim().min(30).max(10000),
    category: z.enum([
        "Education",
        "Healthcare",
        "Technology",
        "Environment",
        "Social",
        "Business",
        "Other"
    ]),
    targetEth: z.string().regex(
        /^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/,
        "Invalid ETH target"
    ),
    deadline: z.string().datetime(),
    milestones: z.array(milestoneSchema).min(1).max(10)
}).superRefine((data, ctx) => {
    const deadline = new Date(data.deadline);

    if (deadline <= new Date()) {
        ctx.addIssue({
            code: "custom",
            path: ["deadline"],
            message: "Campaign deadline must be in the future"
        });
    }

    const target = Number(data.targetEth);

    if (!Number.isFinite(target) || target <= 0) {
        ctx.addIssue({
            code: "custom",
            path: ["targetEth"],
            message: "Target must be greater than zero"
        });
    }

    const total = data.milestones.reduce(
        (sum, milestone) => sum + Number(milestone.amountEth),
        0
    );

    if (Math.abs(total - target) > 1e-12) {
        ctx.addIssue({
            code: "custom",
            path: ["milestones"],
            message: "Milestone amounts must equal the fundraising target"
        });
    }
});
