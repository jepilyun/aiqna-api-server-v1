import express from "express";
// import adminAuthMiddleware from "../middlewares/admin-auth-middleware.js";
import { routeCtrlAdminProcessingStatusBlogPostList } from "../route-ctrl/route-ctrl-admin/processing-status-blog-post/route-ctrl-admin-processing-status-blog-post-list.js";
import { routeCtrlAdminProcessingStatusBlogPostDetail } from "../route-ctrl/route-ctrl-admin/processing-status-blog-post/route-ctrl-admin-processing-status-blog-post-detail.js";
import { routeCtrlAdminProcessingStatusBlogPostDelete } from "../route-ctrl/route-ctrl-admin/processing-status-blog-post/route-ctrl-admin-processing-status-blog-post-delete.js";
import { routeCtrlAdminProcessingStatusBlogPostUpdate } from "../route-ctrl/route-ctrl-admin/processing-status-blog-post/route-ctrl-admin-processing-status-blog-post-update.js";

const router = express.Router();

// Processing Status Blog Post List
router.get(
  "/list/:start",
  // adminAuthMiddleware,
  routeCtrlAdminProcessingStatusBlogPostList,
);

// Processing Status Blog Post Detail
router.get(
  "/detail/:id",
  // adminAuthMiddleware,
  routeCtrlAdminProcessingStatusBlogPostDetail,
);

// Processing Status Blog Post Delete
router.delete(
  "/delete/:id",
  // adminAuthMiddleware,
  routeCtrlAdminProcessingStatusBlogPostDelete,
);

// Blog Post Update
router.put(
  "/update/:id",
  // adminAuthMiddleware,
  routeCtrlAdminProcessingStatusBlogPostUpdate,
);

export default router;
