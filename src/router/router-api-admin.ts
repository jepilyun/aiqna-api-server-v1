import express from "express";
// import adminAuthMiddleware from "../middlewares/admin-auth-middleware.js";
import { routeCtrlAdminYouTubeVideoRegister } from "../route-ctrl/route-ctrl-admin/youtube-video/route-ctrl-admin-youtube-video-register.js";
import { routeCtrlAdminInstagramPostRegister } from "../route-ctrl/route-ctrl-admin/intagram-post/route-ctrl-admin-instagram-post-register.js";
import { routeCtrlAdminBlogPostRegister } from "../route-ctrl/route-ctrl-admin/blog-post/route-ctrl-admin-blog-post-register.js";
import { routeCtrlAdminTextRegister } from "../route-ctrl/route-ctrl-admin/text/route-ctrl-admin-text-register.js";
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
import { routeCtrlAdminInstagramPostList } from "../route-ctrl/route-ctrl-admin/intagram-post/route-ctrl-admin-instagram-post-list.js";
import { routeCtrlAdminInstagramPostDetail } from "../route-ctrl/route-ctrl-admin/intagram-post/route-ctrl-admin-instagram-post-detail.js";
import { routeCtrlAdminInstagramPostUpdate } from "../route-ctrl/route-ctrl-admin/intagram-post/route-ctrl-admin-instagram-post-update.js";
import { routeCtrlAdminBlogPostList } from "../route-ctrl/route-ctrl-admin/blog-post/route-ctrl-admin-blog-post-list.js";
import { routeCtrlAdminBlogPostDetail } from "../route-ctrl/route-ctrl-admin/blog-post/route-ctrl-admin-blog-post-detail.js";
import { routeCtrlAdminBlogPostUpdate } from "../route-ctrl/route-ctrl-admin/blog-post/route-ctrl-admin-blog-post-update.js";
import { routeCtrlAdminTextList } from "../route-ctrl/route-ctrl-admin/text/route-ctrl-admin-text-list.js";
import { routeCtrlAdminTextDetail } from "../route-ctrl/route-ctrl-admin/text/route-ctrl-admin-text-detail.js";
import { routeCtrlAdminTextUpdate } from "../route-ctrl/route-ctrl-admin/text/route-ctrl-admin-text-update.js";

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



// Instagram Post List
router.get(
  "/instagram-post/list/:start",
  // adminAuthMiddleware,
  routeCtrlAdminInstagramPostList,
);

// Instagram Post Register
router.post(
  "/instagram-post/register",
  // adminAuthMiddleware,
  routeCtrlAdminInstagramPostRegister,
);

// Instagram Post Detail
router.get(
  "/instagram-post/detail/:uuid36",
  // adminAuthMiddleware,
  routeCtrlAdminInstagramPostDetail,
);

// Instagram Post Update
router.put(
  "/instagram-post/update/:uuid36",
  // adminAuthMiddleware,
  routeCtrlAdminInstagramPostUpdate,
);



// Blog Post List
router.get(
  "/blog-post/list/:start",
  // adminAuthMiddleware,
  routeCtrlAdminBlogPostList,
);

// Blog Post Register
router.post(
  "/blog-post/register",
  // adminAuthMiddleware,
  routeCtrlAdminBlogPostRegister,
);

// Blog Post Detail
router.get(
  "/blog-post/detail/:uuid36",
  // adminAuthMiddleware,
  routeCtrlAdminBlogPostDetail,
);

// Blog Post Update
router.put(
  "/blog-post/update/:uuid36",
  // adminAuthMiddleware,
  routeCtrlAdminBlogPostUpdate,
);




// Text List
router.get(
  "/text/list/:start",
  // adminAuthMiddleware,
  routeCtrlAdminTextList,
);

// Text Register
router.post(
  "/text/register",
  // adminAuthMiddleware,
  routeCtrlAdminTextRegister,
);

// Text Detail
router.get(
  "/text/detail/:hashKey",
  // adminAuthMiddleware,
  routeCtrlAdminTextDetail,
);

// Text Update
router.put(
  "/text/update/:hashKey",
  // adminAuthMiddleware,
  routeCtrlAdminTextUpdate,
);




// Blog Post List
router.get(
  "/text/list/:start",
  // adminAuthMiddleware,
  routeCtrlAdminTextList,
);

// Blog Post Register
router.post(
  "/text/register",
  // adminAuthMiddleware,
  routeCtrlAdminTextRegister,
);

// Blog Post Detail
router.get(
  "/text/detail/:uuid36",
  // adminAuthMiddleware,
  routeCtrlAdminTextDetail,
);

// Blog Post Update
router.put(
  "/text/update/:uuid36",
  // adminAuthMiddleware,
  routeCtrlAdminTextUpdate,
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
