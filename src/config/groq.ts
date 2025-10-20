import Groq from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.GROQ_API_KEY;
if (!apiKey) throw new Error("GROQ_API_KEY 가 설정되지 않았습니다.");

/**
 * Groq Client
 */
const groq = new Groq({
  apiKey: apiKey,
});

export default groq;
