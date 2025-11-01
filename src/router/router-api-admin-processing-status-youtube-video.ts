import express from "express";
// import adminAuthMiddleware from "../middlewares/admin-auth-middleware.js";
import { routeCtrlAdminProcessingStatusYouTubeVideoList } from "../route-ctrl/route-ctrl-admin/processing-status-youtube-video/route-ctrl-admin-processing-status-youtube-video-list.js";
import { routeCtrlAdminProcessingStatusYouTubeVideoDetail } from "../route-ctrl/route-ctrl-admin/processing-status-youtube-video/route-ctrl-admin-processing-status-youtube-video-detail.js";
import { routeCtrlAdminProcessingStatusYouTubeVideoDelete } from "../route-ctrl/route-ctrl-admin/processing-status-youtube-video/route-ctrl-admin-processing-status-youtube-video-delete.js";
import { routeCtrlAdminProcessingStatusYouTubeVideoUpdate } from "../route-ctrl/route-ctrl-admin/processing-status-youtube-video/route-ctrl-admin-processing-status-youtube-video-update.js";

const router = express.Router();

// Processing Status YouTube Video List
router.get(
  "/list/:start",
  // adminAuthMiddleware,
  routeCtrlAdminProcessingStatusYouTubeVideoList,
);

// Processing Status YouTube Video Detail
router.get(
  "/detail/:videoId",
  // adminAuthMiddleware,
  routeCtrlAdminProcessingStatusYouTubeVideoDetail,
);

// Processing Status YouTube Video Delete
router.delete(
  "/delete/:videoId",
  // adminAuthMiddleware,
  routeCtrlAdminProcessingStatusYouTubeVideoDelete,
);

// YouTube Video Update
router.put(
  "/update/:videoId",
  // adminAuthMiddleware,
  routeCtrlAdminProcessingStatusYouTubeVideoUpdate,
);

export default router;
