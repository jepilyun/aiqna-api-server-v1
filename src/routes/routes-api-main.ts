import express from "express";
import adminAuthMiddleware from "../middlewares/admin-auth-middleware.js";
import userAuthMiddleware from "../middlewares/user-auth-middleware.js";

const router = express.Router();

// ============================================
// ADMIN APIs (requires admin authentication)
// ============================================

// Vector 관리
router.post("/admin/vectors", adminAuthMiddleware, ctrlAdminVectorCreate);
router.get("/admin/vectors/:id", adminAuthMiddleware, ctrlAdminVectorGet);
router.delete("/admin/vectors/:id", adminAuthMiddleware, ctrlAdminVectorDelete);

// 컨텐츠 추가 (자동 벡터화)
router.post("/admin/youtube-videos", adminAuthMiddleware, ctrlAdminAddYouTubeVideo);
router.post("/admin/instagram-posts", adminAuthMiddleware, ctrlAdminAddInstagram);
router.post("/admin/blog-posts", adminAuthMiddleware, ctrlAdminAddBlog);
router.post("/admin/text-contents", adminAuthMiddleware, ctrlAdminAddText);

// 처리 상태 확인
router.get("/admin/process-status/:jobId", adminAuthMiddleware, ctrlAdminCheckStatus);

// AI 질의 (관리자용 - 더 많은 권한)
router.post("/admin/ai/ask", adminAuthMiddleware, ctrlAdminAsk);



// ============================================
// USER APIs (requires user authentication)
// ============================================

// AI 질의 (일반 사용자용)
router.post("/user/ai/ask", userAuthMiddleware, ctrlUserAsk);

// 여행 검색
router.post("/user/search/travel", userAuthMiddleware, ctrlSearchTravel);



// ============================================
// PUBLIC APIs (no authentication required)
// ============================================

// 비디오 처리 상태 조회 (공개)
router.get("/public/videos/:videoId/status", ctrlVideoStatus);

export default router;



// import express from "express";
// import { ctrlProcessYoutubeVideo } from "../route-ctrls/ctrl-process-youtube-video.js";
// import { ctrlVideoStatus } from "../route-ctrls/ctrl-video-status.js";
// import { ctrlSearchTravel } from "../route-ctrls/ctrl-search-travel.js";

// /*
//  * Main Content Routes
//  * /api/main/*
//  */
// const router = express.Router();

// // post api/admin/addVector
// // post api/admin/addYouTubeVideo (Vector & SQL for video & metadata)
// // post api/admin/addInstagram (Vector & SQL for Instagram & metadata)
// // post api/admin/addBlog (Vector & Blog & metadata)
// // post api/admin/addText (Vector & Data & metadata)

// // post api/admin/vector/create/:id
// // get api/admin/vector/get/:id
// // delete api/admin/vector/delete/:id

// // get api/admin/checkStatus

// // post api/admin/ask 

// // post api/user/ask

// /*
//  * MAP CATEGORY CONTENT LIST BY CONTENT CODE
//  * POST /api/main/process-youtube-video
//  */
// router.post("/main/process-video", ctrlProcessYoutubeVideo);

// /**
//  * YouTube Video Status
//  * GET /api/main/video-status/:videoId
//  */
// router.get("/main/video-status/:videoId", ctrlVideoStatus);

// /**
//  * Search YouTube Video Transcript
//  * POST /api/main/search-travel
//  */
// router.post("/main/search-travel", ctrlSearchTravel);

// export default router;
