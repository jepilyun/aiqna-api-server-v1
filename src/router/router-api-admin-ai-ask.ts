import express from "express";
// import adminAuthMiddleware from "../middlewares/admin-auth-middleware.js";
import { routeCtrlAdminAiAsk } from "../route-ctrl/route-ctrl-admin/ask/route-ctrl-admin-ai-ask.js";

const router = express.Router();


// AI 질의 (관리자용 - 더 많은 권한)
router.post(
  "/",
  // adminAuthMiddleware,
  routeCtrlAdminAiAsk,
);


export default router;
