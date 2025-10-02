import express from "express";
// import adminAuthMiddleware from "../middlewares/admin-auth-middleware.js";
import { ctrlAdminCreateContent } from "../route-ctrls/route-ctrls-admin/ctrl-admin-create-content.js";
import { ctrlAdminCreateYouTubeVideo } from "../route-ctrls/route-ctrls-admin/ctrl-admin-create-youtube-video.js";
import { ctrlAdminCreateInstagramPost } from "../route-ctrls/route-ctrls-admin/ctrl-admin-create-instagram-post.js";
import { ctrlAdminCreateBlogPost } from "../route-ctrls/route-ctrls-admin/ctrl-admin-create-blog-post.js";
import { ctrlAdminCreateText } from "../route-ctrls/route-ctrls-admin/ctrl-admin-create-text.js";
import { ctrlAdminProcessStatus } from "../route-ctrls/route-ctrls-admin/ctrl-admin-process-status.js";
import { ctrlAdminProcessStatusYouTubeVideo } from "../route-ctrls/route-ctrls-admin/ctrl-admin-process-status-youtube-video.js";
import { ctrlAdminProcessStatusInstagramPost } from "../route-ctrls/route-ctrls-admin/ctrl-admin-process-status-instagram-post.js";
import { ctrlAdminProcessStatusBlogPost } from "../route-ctrls/route-ctrls-admin/ctrl-admin-process-status-blog-post.js";
import { ctrlAdminProcessStatusText } from "../route-ctrls/route-ctrls-admin/ctrl-admin-process-status-text.js";
import { ctrlAdminVectorsGetList } from "../route-ctrls/route-ctrls-admin/ctrl-admin-vectors-get-list.js";
import { ctrlAdminVectorCreate } from "../route-ctrls/route-ctrls-admin/ctrl-admin-vector-create.js";
import { ctrlAdminVectorGet } from "../route-ctrls/route-ctrls-admin/ctrl-admin-vector-get.js";
import { ctrlAdminVectorDelete } from "../route-ctrls/route-ctrls-admin/ctrl-admin-vector-delete.js";
import { ctrlAdminAiAsk } from "../route-ctrls/route-ctrls-admin/ctrl-admin-ai-ask.js";

const router = express.Router();

// ============================================
// ADMIN APIs (requires admin authentication)
// ============================================

// 컨텐츠 추가 (자동 벡터화)
router.post("/create/content", 
  // adminAuthMiddleware, 
  ctrlAdminCreateContent
);
router.post("/create/youtube-video", 
  // adminAuthMiddleware, 
  ctrlAdminCreateYouTubeVideo
);
router.post("/create/instagram-post", 
  // adminAuthMiddleware, 
  ctrlAdminCreateInstagramPost
);
router.post("/create/blog-post", 
  // adminAuthMiddleware, 
  ctrlAdminCreateBlogPost
);
router.post("/create/text", 
  // adminAuthMiddleware, 
  ctrlAdminCreateText

);

// 처리 상태 확인
router.post("/process-status", 
  // adminAuthMiddleware, 
  ctrlAdminProcessStatus
);
router.get("/process-status/youtube-video/:videoId", 
  // adminAuthMiddleware, 
  ctrlAdminProcessStatusYouTubeVideo
);
router.get("/process-status/instagram-post/:id", 
  // adminAuthMiddleware, 
  ctrlAdminProcessStatusInstagramPost
);
router.get("/process-status/blog-post/:id", 
  // adminAuthMiddleware, 
  ctrlAdminProcessStatusBlogPost
);
router.get("/process-status/text/:id", 
  // adminAuthMiddleware, 
  ctrlAdminProcessStatusText
);

// Pinecone Vector 관리
router.get("/vectors/list/:vector", 
  // adminAuthMiddleware, 
  ctrlAdminVectorsGetList
);
router.post("/vector/create", 
  // adminAuthMiddleware, 
  ctrlAdminVectorCreate
);
router.get("/vector/get/:id", 
  // adminAuthMiddleware, 
  ctrlAdminVectorGet
);
router.delete("/vector/delete/:id", 
  // adminAuthMiddleware, 
  ctrlAdminVectorDelete
);

// AI 질의 (관리자용 - 더 많은 권한)
router.post("/ai/ask", 
  // adminAuthMiddleware, 
  ctrlAdminAiAsk
);



export default router;