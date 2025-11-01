import express from "express";
// import adminAuthMiddleware from "../middlewares/admin-auth-middleware.js";
import { routeCtrlAdminProcessingStatusInstagramPostList } from "../route-ctrl/route-ctrl-admin/processing-status-instagram-post/route-ctrl-admin-processing-status-instagram-post-list.js";
import { routeCtrlAdminProcessingStatusInstagramPostDetail } from "../route-ctrl/route-ctrl-admin/processing-status-instagram-post/route-ctrl-admin-processing-status-instagram-post-detail.js";
import { routeCtrlAdminProcessingStatusInstagramPostDelete } from "../route-ctrl/route-ctrl-admin/processing-status-instagram-post/route-ctrl-admin-processing-status-instagram-post-delete.js";
import { routeCtrlAdminProcessingStatusInstagramPostUpdate } from "../route-ctrl/route-ctrl-admin/processing-status-instagram-post/route-ctrl-admin-processing-status-instagram-post-update.js";

const router = express.Router();

// Processing Status Instagram Post List
router.get(
  "/list/:start",
  // adminAuthMiddleware,
  routeCtrlAdminProcessingStatusInstagramPostList,
);

// Processing Status Instagram Post Detail
router.get(
  "/detail/:id",
  // adminAuthMiddleware,
  routeCtrlAdminProcessingStatusInstagramPostDetail,
);

// Processing Status Instagram Post Delete
router.delete(
  "/delete/:id",
  // adminAuthMiddleware,
  routeCtrlAdminProcessingStatusInstagramPostDelete,
);

// Instagram Post Update
router.put(
  "/update/:id",
  // adminAuthMiddleware,
  routeCtrlAdminProcessingStatusInstagramPostUpdate,
);

export default router;
