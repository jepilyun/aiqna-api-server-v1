import express from "express";
import { ctrlProcessYoutubeVideo } from "../route-ctrls/ctrl-process-youtube-video.js";
import { ctrlVideoStatus } from "../route-ctrls/ctrl-video-status.js";

/*
 * Main Content Routes
 * /api/main/*
 */
const router = express.Router();

/*
 * MAP CATEGORY CONTENT LIST BY CONTENT CODE
 * POST /api/main/process-youtube-video
 */
router.post('/main/process-video', ctrlProcessYoutubeVideo);

/**
 * YouTube Video Status
 * GET /api/main/video-status/:videoId
 */
router.get('/main/video-status/:videoId', ctrlVideoStatus);


export default router;
