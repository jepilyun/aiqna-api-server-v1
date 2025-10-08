import { 
  TSqlTextProcessingLog, 
  ERequestCreateContentType, 
  EProcessingStatusType, 
  TSqlTextDetail, 
  TSqlTextDetailInsert, 
} from "aiqna_common_v1";
import { withRetry } from "../../utils/retry-process.js";
import { handleProcessingError } from "../../utils/handle-processing-error.js";
import DBSqlProcessingLogText from "../../ctrl-db/ctrl-db-sql/db-sql-processing-log-text.js";
import { QueryHashManager } from "../../utils/query-hash-manager.js";
import DBSqlText from "../../ctrl-db/ctrl-db-sql/db-sql-text.js";
import { convertTextDataToPineconeMetadata } from "./text/convert-text-data-to-pinecone-metadata.js";
import { saveTextToPinecone } from "./text/save-text-to-pinecone.js";

/**
 * createContentText
 * Text데이터 처리
 */
export async function createContentText(
  content: string,
  title?: string | null,
  retryCount = 0
) {
  try {
    const log = await getProcessingLogText(content);

    // 1.  Text 처리
    const textData = await processText(
      content,
      title ?? null,
      log,
      retryCount
    );

    // 2. Pinecone 저장
    await processTextToPinecone(
      textData, // ✅ content 대신 textData 객체 전달
      log,
      retryCount
    );

    return { success: true, content };
  } catch (error) {
    await handleProcessingError(ERequestCreateContentType.Text, content, error, retryCount);
    throw error;
  }
}

/**
 * Get Processing Log
 */
async function getProcessingLogText(content: string) {
  const result = await DBSqlProcessingLogText.selectByHashKey(QueryHashManager.hash16(content));
  return result.data?.[0];
}

/**
 * 1. Fetch Text Content
 */
async function processText(
  content: string,
  title: string | null,
  log?: TSqlTextProcessingLog,
  retryCount: number = 0
): Promise<TSqlTextDetail> {
  // 먼저 DB에서 데이터가 실제로 있는지 확인
  const existing = await DBSqlText.selectByHashKey(QueryHashManager.hash16(content));

  // 데이터가 이미 있으면 바로 반환
  if (existing.data?.[0]) {
    console.log("✅ Data already exists in DB, returning...");
    return existing.data[0];
  }

  // 데이터가 없으면 새로 가져오기
  console.log("📥 No data found, fetching new data...");
  
  return await withRetry(
    async () => {
      // ✅ TSqlBlogPostDetailInsert 매핑
      const insertData: TSqlTextDetailInsert = {
        hash_key: QueryHashManager.hash16(content),
        content: content,
        title: title ?? undefined,
      };

      console.log("💾 Inserting data:", insertData);
      
      // ✅ DBSqlText 사용
      await DBSqlText.upsert(insertData);

      // ✅ Processing Log 업데이트
      await DBSqlProcessingLogText.upsert({
        hash_key: QueryHashManager.hash16(content),
        processing_status: EProcessingStatusType.processing,
      });

      // 방금 저장한 데이터 조회
      const created = await DBSqlText.selectByHashKey(QueryHashManager.hash16(content));
      console.log("✅ Created record:", created);

      if (!created.data?.[0]) {
        throw new Error("Failed to create Text data - data not found after insert");
      }

      return created.data[0];
    },
    retryCount,
    'API fetch'
  );
}

/**
 * 2. Pinecone 처리
 */
async function processTextToPinecone(
  textData: TSqlTextDetail, // ✅ 파라미터 타입 수정
  log?: TSqlTextProcessingLog,
  retryCount: number = 0
): Promise<void> {
  if (log?.is_pinecone_processed) {
    console.log("✅ Already processed to Pinecone");
    return;
  }

  console.log("📤 Processing to Pinecone...");

  await withRetry(
    async () => {
      const metadata = convertTextDataToPineconeMetadata(textData);
      await saveTextToPinecone(textData, metadata);
      
      // ✅ DBSqlProcessingLogText 사용
      await DBSqlProcessingLogText.updateByHashKey(textData.hash_key, {
        is_pinecone_processed: true,
        processing_status: EProcessingStatusType.completed,
      });
      
      console.log("✅ Pinecone processing completed");
    },
    retryCount,
    'Pinecone processing'
  );
}