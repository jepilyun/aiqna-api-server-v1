import express from "express";
// import adminAuthMiddleware from "../middlewares/admin-auth-middleware.js";
import { routeCtrlAdminYouTubeVideoRegister } from "../route-ctrl/route-ctrl-admin/youtube-video/route-ctrl-admin-youtube-video-register.js";
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
import { routeCtrlAdminYouTubeVideoList } from "../route-ctrl/route-ctrl-admin/youtube-video/route-ctrl-admin-youtube-video-list.js";
import { routeCtrlAdminYouTubeVideoDetail } from "../route-ctrl/route-ctrl-admin/youtube-video/route-ctrl-admin-youtube-video-detail.js";
import { routeCtrlAdminYouTubeVideoUpdate } from "../route-ctrl/route-ctrl-admin/youtube-video/route-ctrl-admin-youtube-video-update.js";

const router = express.Router();

// YouTube Video List
router.get(
  "/youtube-video/list/:start",
  // adminAuthMiddleware,
  routeCtrlAdminYouTubeVideoList,
);

// YouTube Video Register
router.post(
  "/youtube-video/register",
  // adminAuthMiddleware,
  routeCtrlAdminYouTubeVideoRegister,
);

// YouTube Video Detail
router.get(
  "/youtube-video/detail/:videoId",
  // adminAuthMiddleware,
  routeCtrlAdminYouTubeVideoDetail,
);

// YouTube Video Update
router.put(
  "/youtube-video/update/:videoId",
  // adminAuthMiddleware,
  routeCtrlAdminYouTubeVideoUpdate,
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


// router.get(
//   "/administrator/list/:start"
//   // adminAuthMiddleware,
//   routeCtrlAdminAdministratorList,
// );

export default router;
