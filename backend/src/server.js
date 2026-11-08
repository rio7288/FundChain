
import "dotenv/config";

import express from "express";
import cors from "cors";
import helmet from "helmet";
import campaignPublishRoutes from "./routes/campaign-publish.routes.js";
import campaignRoutes from "./routes/campaign.routes.js";
import walletRoutes from "./routes/wallet.routes.js";
import dbRoutes from "./routes/db.routes.js";

// Initialize Express
const app = express();

// Server configuration
const PORT = process.env.PORT || 5000;

// Allowed frontend origins
const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174"
];

// Security middleware
app.use(helmet());

// CORS configuration
app.use(
    cors({
        origin: function (origin, callback) {
            // Allow requests without an Origin header
            if (!origin || allowedOrigins.includes(origin)) {
                return callback(null, true);
            }

            console.error("Blocked CORS origin:", origin);
            return callback(new Error("Not allowed by CORS"));
        },
        methods: [
            "GET",
            "POST",
            "PUT",
            "PATCH",
            "DELETE",
            "OPTIONS"
        ],
        allowedHeaders: [
            "Content-Type",
            "Authorization"
        ]
    })
);

// Parse JSON requests
app.use(express.json());

// Root route
app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Welcome to FundChain API"
    });
});

// Health check
app.get("/api/v1/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "FundChain backend is running!",
        timestamp: new Date().toISOString()
    });
});

// Database routes
app.use("/api/v1/db", dbRoutes);

// Wallet routes
app.use("/api/v1/wallet", walletRoutes);

// Campaign routes
app.use("/api/v1/campaigns", campaignRoutes);
app.use("/api/v1/campaigns", campaignPublishRoutes);
// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "API route not found"
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error("Backend Error:", err.message);

    if (res.headersSent) {
        return next(err);
    }

    res.status(err.status || 500).json({
        success: false,
        message: err.message || "Internal server error"
    });
});

// Start backend
app.listen(PORT, () => {
    console.log("--------------------------------");
    console.log("       FUNDCHAIN BACKEND");
    console.log("--------------------------------");
    console.log(`Server running: http://localhost:${PORT}`);
    console.log("Allowed frontend origins:");
    allowedOrigins.forEach(origin => console.log(`- ${origin}`));
    console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    console.log("--------------------------------");
});
