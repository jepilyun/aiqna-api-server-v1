import express from "express";
// import adminAuthMiddleware from "../middlewares/admin-auth-middleware.js";
import { routeCtrlAdminTextRegister } from "../route-ctrl/route-ctrl-admin/text/route-ctrl-admin-text-register.js";
import { routeCtrlAdminTextList } from "../route-ctrl/route-ctrl-admin/text/route-ctrl-admin-text-list.js";
import { routeCtrlAdminTextDetail } from "../route-ctrl/route-ctrl-admin/text/route-ctrl-admin-text-detail.js";
import { routeCtrlAdminTextUpdate } from "../route-ctrl/route-ctrl-admin/text/route-ctrl-admin-text-update.js";

const router = express.Router();

// Text List
router.get(
  "/list/:start",
  // adminAuthMiddleware,
  routeCtrlAdminTextList,
);

// Text Register
router.post(
  "/register",
  // adminAuthMiddleware,
  routeCtrlAdminTextRegister,
);

// Text Detail
router.get(
  "/detail/:hashKey",
  // adminAuthMiddleware,
  routeCtrlAdminTextDetail,
);

// Text Update
router.put(
  "/update/:hashKey",
  // adminAuthMiddleware,
  routeCtrlAdminTextUpdate,
);

// Text List
// router.get(
//   "/processing/list/:start",
//   // adminAuthMiddleware,
//   routeCtrlAdminProcessingTextList,
// );

// // Text Register
// router.post(
//   "/processing/register",
//   // adminAuthMiddleware,
//   routeCtrlAdminProcessingTextRegister,
// );

// // Text Detail
// router.get(
//   "/processing/detail/:hashKey",
//   // adminAuthMiddleware,
//   routeCtrlAdminProcessingTextDetail,
// );

// // Text Update
// router.put(
//   "/processing/update/:hashKey",
//   // adminAuthMiddleware,
//   routeCtrlAdminProcessingTextUpdate,
// );

export default router;
