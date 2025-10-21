import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import routesApiAdmin from "./router/router-api-admin.js";
import routesApiUser from "./router/router-api-user.js";
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

app.use("/api/admin", routesApiAdmin);
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
