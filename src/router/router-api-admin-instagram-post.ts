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

// Instagram Post Processing List
// router.get(
//   "/processing/list/:start",
//   // adminAuthMiddleware,
//   routeCtrlAdminProcessingInstagramPostList,
// );

// // Instagram Post Processing Register
// router.post(
//   "/processing/register",
//   // adminAuthMiddleware,
//   routeCtrlAdminProcessingInstagramPostRegister,
// );

// // Instagram Post Processing Detail
// router.get(
//   "/processing/detail/:uuid36",
//   // adminAuthMiddleware,
//   routeCtrlAdminProcessingInstagramPostDetail,
// );

// // Instagram Post Processing Update
// router.put(
//   "/processing/update/:uuid36",
//   // adminAuthMiddleware,
//   routeCtrlAdminProcessingInstagramPostUpdate,
// );

export default router;
