
import express from "express";
import { authenticateUser } from "../middleware/auth.middleware.js";
import {
  publishCampaignController,
} from "../controllers/campaign-publish.controller.js";

const router = express.Router();

router.post("/:id/publish", authenticateUser, publishCampaignController);

export default router;
