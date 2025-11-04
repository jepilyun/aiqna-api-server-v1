import express from "express";
// import adminAuthMiddleware from "../middlewares/admin-auth-middleware.js";
import { routeCtrlAdminBlogPostRegister } from "../route-ctrl/route-ctrl-admin/blog-post/route-ctrl-admin-blog-post-register.js";
import { routeCtrlAdminBlogPostList } from "../route-ctrl/route-ctrl-admin/blog-post/route-ctrl-admin-blog-post-list.js";
import { routeCtrlAdminBlogPostDetail } from "../route-ctrl/route-ctrl-admin/blog-post/route-ctrl-admin-blog-post-detail.js";
import { routeCtrlAdminBlogPostUpdate } from "../route-ctrl/route-ctrl-admin/blog-post/route-ctrl-admin-blog-post-update.js";
import { routeCtrlAdminBlogPostDelete } from "../route-ctrl/route-ctrl-admin/blog-post/route-ctrl-admin-blog-post-delete.js";

const router = express.Router();

// Blog Post List
router.get(
  "/list/:start",
  // adminAuthMiddleware,
  routeCtrlAdminBlogPostList,
);

// Blog Post Register
router.post(
  "/register",
  // adminAuthMiddleware,
  routeCtrlAdminBlogPostRegister,
);

// Blog Post Detail
router.get(
  "/detail/:uuid36",
  // adminAuthMiddleware,
  routeCtrlAdminBlogPostDetail,
);

// Blog Post Update
router.put(
  "/update/:uuid36",
  // adminAuthMiddleware,
  routeCtrlAdminBlogPostUpdate,
);

// Blog Post Delete
router.delete(
  "/delete/:uuid36",
  // adminAuthMiddleware,
  routeCtrlAdminBlogPostDelete,
);

export default router;
