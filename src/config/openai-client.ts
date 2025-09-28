import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) throw new Error("OPENAI_API_KEY 가 설정되지 않았습니다.");

/**
 * OpenAI Client
 */
const openaiClient = new OpenAI({ apiKey });

export default openaiClient;
