import express from "express";
// import adminAuthMiddleware from "../middlewares/admin-auth-middleware.js";
import { routeCtrlAdminRegisterYouTubeVideo } from "../route-ctrl/route-ctrl-admin/route-ctrl-admin-register-content/route-ctrl-admin-register-youtube-video.js";
import { routeCtrlAdminRegisterInstagramPost } from "../route-ctrl/route-ctrl-admin/route-ctrl-admin-register-content/route-ctrl-admin-register-instagram-post.js";
import { routeCtrlAdminRegisterBlogPost } from "../route-ctrl/route-ctrl-admin/route-ctrl-admin-register-content/route-ctrl-admin-register-blog-post.js";
import { routeCtrlAdminRegisterText } from "../route-ctrl/route-ctrl-admin/route-ctrl-admin-register-content/route-ctrl-admin-register-text.js";
import { routeCtrlAdminProcessStatus } from "../route-ctrl/route-ctrl-admin/route-ctrl-admin-process-status/route-ctrl-admin-process-status.js";
import { routeCtrlAdminProcessStatusYouTubeVideo } from "../route-ctrl/route-ctrl-admin/route-ctrl-admin-process-status/route-ctrl-admin-process-status-youtube-video.js";
import { routeCtrlAdminProcessStatusInstagramPost } from "../route-ctrl/route-ctrl-admin/route-ctrl-admin-process-status/route-ctrl-admin-process-status-instagram-post.js";
import { routeCtrlAdminProcessStatusBlogPost } from "../route-ctrl/route-ctrl-admin/route-ctrl-admin-process-status/route-ctrl-admin-process-status-blog-post.js";
import { routeCtrlAdminProcessStatusText } from "../route-ctrl/route-ctrl-admin/route-ctrl-admin-process-status/route-ctrl-admin-process-status-text.js";
import { routeCtrlAdminVectorsGetList } from "../route-ctrl/route-ctrl-admin/route-ctrl-admin-vectors-get-list.js";
import { routeCtrlAdminVectorCreate } from "../route-ctrl/route-ctrl-admin/route-ctrl-admin-vector-create.js";
import { routeCtrlAdminVectorGet } from "../route-ctrl/route-ctrl-admin/route-ctrl-admin-vector-get.js";
import { routeCtrlAdminVectorDelete } from "../route-ctrl/route-ctrl-admin/route-ctrl-admin-vector-delete.js";
import { routeCtrlAdminAiAsk } from "../route-ctrl/route-ctrl-admin/route-ctrl-admin-ask/route-ctrl-admin-ai-ask.js";

const router = express.Router();

/** 
 * ============================================
 * ADMIN APIs (requires admin authentication)
 * ============================================
 */
router.post(
  "/create/youtube-video",
  // adminAuthMiddleware,
  routeCtrlAdminRegisterYouTubeVideo,
);

router.post(
  "/create/instagram-post",
  // adminAuthMiddleware,
  routeCtrlAdminRegisterInstagramPost,
);

router.post(
  "/create/blog-post",
  // adminAuthMiddleware,
  routeCtrlAdminRegisterBlogPost,
);

router.post(
  "/create/text",
  // adminAuthMiddleware,
  routeCtrlAdminRegisterText,
);

// 처리 상태 확인
router.post(
  "/process-status",
  // adminAuthMiddleware,
  routeCtrlAdminProcessStatus,
);
router.get(
  "/process-status/youtube-video/:videoId",
  // adminAuthMiddleware,
  routeCtrlAdminProcessStatusYouTubeVideo,
);
router.get(
  "/process-status/instagram-post",
  // adminAuthMiddleware,
  routeCtrlAdminProcessStatusInstagramPost,
);
router.get(
  "/process-status/blog-post",
  // adminAuthMiddleware,
  routeCtrlAdminProcessStatusBlogPost,
);
router.get(
  "/process-status/text/:id",
  // adminAuthMiddleware,
  routeCtrlAdminProcessStatusText,
);

// Pinecone Vector 관리
router.get(
  "/vectors/list/:vector",
  // adminAuthMiddleware,
  routeCtrlAdminVectorsGetList,
);
router.post(
  "/vector/create",
  // adminAuthMiddleware,
  routeCtrlAdminVectorCreate,
);
router.get(
  "/vector/get/:id",
  // adminAuthMiddleware,
  routeCtrlAdminVectorGet,
);
router.delete(
  "/vector/delete/:id",
  // adminAuthMiddleware,
  routeCtrlAdminVectorDelete,
);

// AI 질의 (관리자용 - 더 많은 권한)
router.post(
  "/ai/ask",
  // adminAuthMiddleware,
  routeCtrlAdminAiAsk,
);

export default router;
