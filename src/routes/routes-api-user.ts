import express from "express";
// import userAuthMiddleware from "../middlewares/user-auth-middleware.js";
import { ctrlUserAiAsk } from "../route-ctrls/route-ctrls-user/ctrl-user-ai-ask.js";

const router = express.Router();

// ============================================
// USER APIs (requires user authentication)
// ============================================

// AI 질의 (일반 사용자용)
router.post("/ai/ask", 
  // userAuthMiddleware, 
  ctrlUserAiAsk
);

export default router;