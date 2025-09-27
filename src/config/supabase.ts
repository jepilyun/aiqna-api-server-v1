/**
 * Supabase 클라이언트 생성
 * Docs: https://supabase.com/docs/guides/auth/server-side/node
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAPIKeyServiceRole = process.env.SUPABASE_SERVICE_ROLE;

if (!supabaseUrl || !supabaseAPIKeyServiceRole) {
  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL 가 설정되지 않았습니다.");
  }
  if (!supabaseAPIKeyServiceRole) {
    throw new Error("SUPABASE_SERVICE_ROLE 가 설정되지 않았습니다.");
  }
}

const sbdb = createClient(supabaseUrl, supabaseAPIKeyServiceRole);

export default sbdb;
