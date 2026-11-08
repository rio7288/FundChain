import express from "express";
import { supabase } from "../config/supabase.js";

const router = express.Router();

router.get("/test", async (req, res) => {
    const { data, error } = await supabase
        .from("campaigns")
        .select("id")
        .limit(1);

    if (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }

    res.json({
        success: true,
        message: "FundChain database connected!",
        data
    });
});

export default router;