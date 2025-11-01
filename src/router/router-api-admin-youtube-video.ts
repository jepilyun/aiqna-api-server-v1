import express from "express";
// import adminAuthMiddleware from "../middlewares/admin-auth-middleware.js";
import { routeCtrlAdminYouTubeVideoRegister } from "../route-ctrl/route-ctrl-admin/youtube-video/route-ctrl-admin-youtube-video-register.js";
import { routeCtrlAdminYouTubeVideoList } from "../route-ctrl/route-ctrl-admin/youtube-video/route-ctrl-admin-youtube-video-list.js";
import { routeCtrlAdminYouTubeVideoDetail } from "../route-ctrl/route-ctrl-admin/youtube-video/route-ctrl-admin-youtube-video-detail.js";
import { routeCtrlAdminYouTubeVideoUpdate } from "../route-ctrl/route-ctrl-admin/youtube-video/route-ctrl-admin-youtube-video-update.js";

const router = express.Router();

// YouTube Video List
router.get(
  "/list/:start",
  // adminAuthMiddleware,
  routeCtrlAdminYouTubeVideoList,
);

// YouTube Video Register
router.post(
  "/register",
  // adminAuthMiddleware,
  routeCtrlAdminYouTubeVideoRegister,
);

// YouTube Video Detail
router.get(
  "/detail/:videoId",
  // adminAuthMiddleware,
  routeCtrlAdminYouTubeVideoDetail,
);

// YouTube Video Update
router.put(
  "/update/:videoId",
  // adminAuthMiddleware,
  routeCtrlAdminYouTubeVideoUpdate,
);

// YouTube Video Processing List
// router.get(
//   "/processing/list/:start",
//   // adminAuthMiddleware,
//   routeCtrlAdminProcessingYouTubeVideoList,
// );

// // YouTube Video Processing Register
// router.post(
//   "/processing/register",
//   // adminAuthMiddleware,
//   routeCtrlAdminProcessingYouTubeVideoRegister,
// );

// // YouTube Video Processing Detail
// router.get(
//   "/processing/detail/:videoId",
//   // adminAuthMiddleware,
//   routeCtrlAdminProcessingYouTubeVideoDetail,
// );

// // YouTube Video Processing Update
// router.put(
//   "/processing/update/:videoId",
//   // adminAuthMiddleware,
//   routeCtrlAdminProcessingYouTubeVideoUpdate,
// );

export default router;
