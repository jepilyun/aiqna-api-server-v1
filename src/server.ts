import cors from "cors";
import dotenv from "dotenv";
import express from "express";
// import routesApiAdmin from "./router/router-api-admin-vector.js";
import routesApiAdminAiAsk from "./router/router-api-admin-ai-ask.js";
import routesApiAdminYouTubeVideo from "./router/router-api-admin-youtube-video.js";
import routesApiAdminInstagramPost from "./router/router-api-admin-instagram-post.js";
import routesApiAdminBlogPost from "./router/router-api-admin-blog-post.js";
import routesApiAdminText from "./router/router-api-admin-text.js";
import routesApiAdminVector from "./router/router-api-admin-vector.js";
import routesApiUser from "./router/router-api-user.js";
import routesApiAdminProcessingStatusYouTubeVideo from "./router/router-api-admin-processing-status-youtube-video.js";
import routesApiAdminProcessingStatusInstagramPost from "./router/router-api-admin-processing-status-instagram-post.js";
import routesApiAdminProcessingStatusBlogPost from "./router/router-api-admin-processing-status-blog-post.js";
import routesApiAdminProcessingStatusText from "./router/router-api-admin-processing-status-text.js";
import { workerStartYouTubeVideo } from "./worker/worker-start-youtube-video.js";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
      "http://localhost:3003",
      "http://localhost:3004",
      "http://localhost:3005",
    ], // 프론트엔드 주소
    credentials: true, // 🔥 쿠키 허용
  }),
);

app.use(express.json());

app.use("/api/admin/youtube-video", routesApiAdminYouTubeVideo);
app.use(
  "/api/admin/processing-status/youtube-video",
  routesApiAdminProcessingStatusYouTubeVideo,
);

app.use("/api/admin/instagram", routesApiAdminInstagramPost);
app.use(
  "/api/admin/processing-status/instagram",
  routesApiAdminProcessingStatusInstagramPost,
);

app.use("/api/admin/blog", routesApiAdminBlogPost);
app.use(
  "/api/admin/processing-status/blog",
  routesApiAdminProcessingStatusBlogPost,
);

app.use("/api/admin/text", routesApiAdminText);
app.use(
  "/api/admin/processing-status/text",
  routesApiAdminProcessingStatusText,
);

app.use("/api/admin/ask", routesApiAdminAiAsk);
app.use("/api/admin/vector", routesApiAdminVector);

app.use("/api/user", routesApiUser);

// Worker 시작 YouTube Video Worker
workerStartYouTubeVideo().catch((error) => {
  console.error("💥 Worker crashed:", error);
  process.exit(1);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n👋 Worker shutting down...");
  process.exit(0);
});

const PORT = process.env.PORT || 3100;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
