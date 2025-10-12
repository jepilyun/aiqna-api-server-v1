import { Pinecone } from "@pinecone-database/pinecone";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.PINECONE_API_KEY;

if (!apiKey) throw new Error("PINECONE_API_KEY 가 설정되지 않았습니다.");

/**
 * Pinecone Client
 */
const pineconeClient = new Pinecone({ apiKey });

export default pineconeClient;
