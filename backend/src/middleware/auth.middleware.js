
import { supabase } from "../config/supabase.js";

export async function authenticateUser(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Authentication required.",
            });
        }

        const token = authHeader.slice(7).trim();

        if (!token || token.split(/\s+/).length !== 1) {
            return res.status(401).json({
                success: false,
                message: "Invalid authentication token.",
            });
        }

        const { data, error } = await supabase.auth.getUser(token);

        if (error || !data?.user?.id) {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired session.",
            });
        }

        req.user = data.user;
        req.accessToken = token;

        return next();
    } catch (error) {
        console.error("Authentication service error:", error);

        return res.status(503).json({
            success: false,
            message: "Authentication service is temporarily unavailable.",
        });
    }
}
