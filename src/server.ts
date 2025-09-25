import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import routesMain from "./routes/routes-api-main.js";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:3100",
      "http://localhost:3101",
      "http://localhost:3102",
      "http://localhost:3103",
      "http://localhost:3104",
      "http://localhost:3105",
    ], // 프론트엔드 주소
    credentials: true, // 🔥 쿠키 허용
  }),
);

app.use(express.json());

// 1. json 파일이 있는지 sql 에서 값 체크하기 => 없으면 fetch 해서 파일 다운로드 하기
// 2. pinecone 처리되어 있는지 체크해보기 => 없으면 json 가져와서 처리
// 일단, 다양한 AI 호출해서 사용할 수 있도록 변경하기 (openAI, groq, llama3, deepseek, etc.)
// 일단, pinecone 에도 index 다르게 하면서 처리해보기 (데이터 크기 줄이기, 처리 속도 올리기, 내용 더 다양하게 넣어보기)

app.use("/api", routesMain);

const PORT = process.env.PORT || 3100;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
