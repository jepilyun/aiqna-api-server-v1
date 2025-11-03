import express from "express";
// import adminAuthMiddleware from "../middlewares/admin-auth-middleware.js";
import { routeCtrlAdminInstagramPostRegister } from "../route-ctrl/route-ctrl-admin/intagram-post/route-ctrl-admin-instagram-post-register.js";
import { routeCtrlAdminInstagramPostList } from "../route-ctrl/route-ctrl-admin/intagram-post/route-ctrl-admin-instagram-post-list.js";
import { routeCtrlAdminInstagramPostDetail } from "../route-ctrl/route-ctrl-admin/intagram-post/route-ctrl-admin-instagram-post-detail.js";
import { routeCtrlAdminInstagramPostUpdate } from "../route-ctrl/route-ctrl-admin/intagram-post/route-ctrl-admin-instagram-post-update.js";

const router = express.Router();

// Instagram Post List
router.get(
  "/list/:start",
  // adminAuthMiddleware,
  routeCtrlAdminInstagramPostList,
);

// Instagram Post Register
router.post(
  "/register",
  // adminAuthMiddleware,
  routeCtrlAdminInstagramPostRegister,
);

// Instagram Post Detail
router.get(
  "/detail/:uuid36",
  // adminAuthMiddleware,
  routeCtrlAdminInstagramPostDetail,
);

// Instagram Post Update
router.put(
  "/update/:uuid36",
  // adminAuthMiddleware,
  routeCtrlAdminInstagramPostUpdate,
);

export default router;
