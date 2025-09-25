import express from "express";
import { ctrlProcessYoutubeVideo } from "../ctrls/ctrl-process-youtube-video.js";

/*
 * Main Content Routes
 * /api/main/*
 */
const router = express.Router();

/*
 * MAP CATEGORY CONTENT LIST BY CONTENT CODE
 * POST /api/main/process-youtube-video
 */
router.get("/process-youtube-video", ctrlProcessYoutubeVideo);

export default router;
