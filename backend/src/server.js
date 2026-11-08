
import "dotenv/config";

import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";

import campaignPublishRoutes from "./routes/campaign-publish.routes.js";
import campaignRoutes from "./routes/campaign.routes.js";
import walletRoutes from "./routes/wallet.routes.js";
import dbRoutes from "./routes/db.routes.js";

const app = express();

const PORT = Number(process.env.PORT) || 5000;

// Only allow frontend origins that you actually use.
const localOrigins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
];

const deployedOrigins = (
    process.env.FRONTEND_URLS ||
    process.env.FRONTEND_URL ||
    ""
)
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);

const allowedOrigins = [
    ...new Set([...localOrigins, ...deployedOrigins]),
];
// Security headers.
app.use(helmet());

// CORS configuration.
app.use(
    cors({
        origin(origin, callback) {
            // Allow requests without an Origin header.
            if (!origin || allowedOrigins.includes(origin)) {
                return callback(null, true);
            }

            console.error("Blocked CORS origin:", origin);
            return callback(new Error("Origin not allowed by CORS"));
        },

        // FIX: Allow credentialed browser requests.
        credentials: true,

        methods: [
            "GET",
            "POST",
            "PUT",
            "PATCH",
            "DELETE",
            "OPTIONS",
        ],

        allowedHeaders: [
            "Content-Type",
            "Authorization",
        ],
    })
);

// Limit JSON request size.
app.use(express.json({ limit: "100kb" }));

// General API rate limit.
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: "draft-8",
    legacyHeaders: false,

    message: {
        success: false,
        message: "Too many requests. Please try again later.",
    },
});

// Apply rate limiting to API endpoints.
app.use("/api/v1", apiLimiter);

// Root route.
app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Welcome to FundChain API",
    });
});

// Health check.
app.get("/api/v1/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "FundChain backend is running!",
        timestamp: new Date().toISOString(),
    });
});

// Database routes.
app.use("/api/v1/db", dbRoutes);

// Wallet routes.
app.use("/api/v1/wallet", walletRoutes);

// Campaign routes.
app.use("/api/v1/campaigns", campaignRoutes);
app.use("/api/v1/campaigns", campaignPublishRoutes);

// 404 handler.
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "API route not found.",
    });
});

// Global error handler.
app.use((err, req, res, next) => {
    if (res.headersSent) {
        return next(err);
    }

    console.error("Backend Error:", err);

    if (err.message === "Origin not allowed by CORS") {
        return res.status(403).json({
            success: false,
            message: "Request origin is not allowed.",
        });
    }

    if (err.type === "entity.too.large") {
        return res.status(413).json({
            success: false,
            message: "Request body is too large.",
        });
    }

    return res.status(err.status || 500).json({
        success: false,
        message:
            err.status && err.status < 500
                ? err.message
                : "Internal server error.",
    });
});

// Start backend.
app.listen(PORT, () => {
    console.log("--------------------------------");
    console.log("       FUNDCHAIN BACKEND");
    console.log("--------------------------------");
    console.log(`Server running: http://localhost:${PORT}`);

    console.log("Allowed frontend origins:");
    allowedOrigins.forEach((origin) => {
        console.log(`- ${origin}`);
    });

    console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    console.log("CORS credentials: enabled");
    console.log("API rate limiting: 300 requests / 15 minutes");
    console.log("--------------------------------");
});
