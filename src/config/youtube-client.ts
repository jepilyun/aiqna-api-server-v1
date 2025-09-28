import { google } from "googleapis";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.YOUTUBE_API_KEY;

if (!apiKey) throw new Error("YOUTUBE_API_KEY 가 설정되지 않았습니다.");

/**
 * YouTube 클라이언트 생성
 */
const youtubeClient = google.youtube({
  version: "v3",
  auth: apiKey, // API 키 필요
});

export default youtubeClient;
