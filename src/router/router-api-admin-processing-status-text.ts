import express from "express";
// import adminAuthMiddleware from "../middlewares/admin-auth-middleware.js";
import { routeCtrlAdminProcessingStatusTextList } from "../route-ctrl/route-ctrl-admin/processing-status-text/route-ctrl-admin-processing-status-text-list.js";
import { routeCtrlAdminProcessingStatusTextDetail } from "../route-ctrl/route-ctrl-admin/processing-status-text/route-ctrl-admin-processing-status-text-detail.js";
import { routeCtrlAdminProcessingStatusTextDelete } from "../route-ctrl/route-ctrl-admin/processing-status-text/route-ctrl-admin-processing-status-text-delete.js";
import { routeCtrlAdminProcessingStatusTextUpdate } from "../route-ctrl/route-ctrl-admin/processing-status-text/route-ctrl-admin-processing-status-text-update.js";

const router = express.Router();

// Processing Status Text List
router.get(
  "/list/:start",
  // adminAuthMiddleware,
  routeCtrlAdminProcessingStatusTextList,
);

// Processing Status Text Detail
router.get(
  "/detail/:id",
  // adminAuthMiddleware,
  routeCtrlAdminProcessingStatusTextDetail,
);

// Processing Status Text Delete
router.delete(
  "/delete/:id",
  // adminAuthMiddleware,
  routeCtrlAdminProcessingStatusTextDelete,
);

// Text Update
router.put(
  "/update/:id",
  // adminAuthMiddleware,
  routeCtrlAdminProcessingStatusTextUpdate,
);

export default router;
