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
import { ContentKeyManager } from "../../utils/content-key-manager.js";
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
  // ✅ hash_key를 한 번만 생성
  const hashKey = ContentKeyManager.createContentKey(
    ERequestCreateContentType.Text, 
    content
  );

  try {
    // ✅ 로그와 기존 데이터를 동시에 확인
    const [log, existingText] = await Promise.all([
      getProcessingLogText(hashKey),
      getExistingText(hashKey)
    ]);

    // 1. Text 처리 (없으면 생성, 있으면 반환)
    const textData = existingText 
      ? existingText 
      : await createNewText(hashKey, content, title ?? null, retryCount);

    // 2. Pinecone 저장
    await processTextToPinecone(textData, log, retryCount);

    return { success: true, content };
  } catch (error) {
    await handleProcessingError(
      ERequestCreateContentType.Text, 
      content, 
      error, 
      retryCount
    );
    throw error;
  }
}

/**
 * Get Processing Log (hash_key를 인자로 받음)
 */
async function getProcessingLogText(hashKey: string) {
  const result = await DBSqlProcessingLogText.selectByHashKey(hashKey);
  return result.data?.[0];
}

/**
 * Get Existing Text (hash_key를 인자로 받음)
 */
async function getExistingText(hashKey: string) {
  const result = await DBSqlText.selectByHashKey(hashKey);
  return result.data?.[0];
}

/**
 * Create New Text
 */
async function createNewText(
  hashKey: string,
  content: string,
  title: string | null,
  retryCount: number = 0
): Promise<TSqlTextDetail> {
  console.log("📥 No data found, creating new data...");
  
  return await withRetry(
    async () => {
      const insertData: TSqlTextDetailInsert = {
        hash_key: hashKey,
        content: content,
        title: title ?? undefined,
      };

      console.log("💾 Inserting data:", insertData);
      
      await DBSqlText.upsert(insertData);

      // Processing Log 업데이트
      await DBSqlProcessingLogText.upsert({
        hash_key: hashKey,
        processing_status: EProcessingStatusType.processing,
      });

      // 방금 저장한 데이터 조회
      const created = await DBSqlText.selectByHashKey(hashKey);
      console.log("✅ Created record:", created);

      if (!created.data?.[0]) {
        throw new Error("Failed to create Text data - data not found after insert");
      }

      return created.data[0];
    },
    retryCount,
    'Text creation'
  );
}

/**
 * Pinecone 처리
 */
async function processTextToPinecone(
  textData: TSqlTextDetail,
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