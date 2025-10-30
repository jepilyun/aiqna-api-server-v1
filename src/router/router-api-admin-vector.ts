import express from "express";
// import adminAuthMiddleware from "../middlewares/admin-auth-middleware.js";
import { routeCtrlAdminVectorsGetList } from "../route-ctrl/route-ctrl-admin/route-ctrl-admin-vectors-get-list.js";
import { routeCtrlAdminVectorCreate } from "../route-ctrl/route-ctrl-admin/route-ctrl-admin-vector-create.js";
import { routeCtrlAdminVectorGet } from "../route-ctrl/route-ctrl-admin/route-ctrl-admin-vector-get.js";
import { routeCtrlAdminVectorDelete } from "../route-ctrl/route-ctrl-admin/route-ctrl-admin-vector-delete.js";

const router = express.Router();


// Pinecone Vector 관리
router.get(
  "/list/:vector",
  // adminAuthMiddleware,
  routeCtrlAdminVectorsGetList,
);
router.post(
  "/create",
  // adminAuthMiddleware,
  routeCtrlAdminVectorCreate,
);
router.get(
  "/get/:id",
  // adminAuthMiddleware,
  routeCtrlAdminVectorGet,
);
router.delete(
  "/delete/:id",
  // adminAuthMiddleware,
  routeCtrlAdminVectorDelete,
);


export default router;
