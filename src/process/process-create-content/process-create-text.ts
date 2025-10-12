import {
  TSqlTextProcessingLog,
  ERequestCreateContentType,
  EProcessingStatusType,
  TSqlTextDetail,
  TSqlTextDetailInsert,
} from "aiqna_common_v1";
import { withRetry } from "../../utils/retry/retry-common.js";
import { handleProcessingError } from "../../services/handle-processing-error.js";
import DBSqlProcessingLogText from "../../db-ctrl/db-ctrl-sql/db-sql-processing-log-text.js";
import { ContentKeyManager } from "../../utils/content-key-manager.js";
import DBSqlText from "../../db-ctrl/db-ctrl-sql/db-sql-text.js";
import { generateVectorMetadataText } from "../../services/text/generate-vector-metadata-text.js";
import { saveTextToPinecone } from "../../services/text/save-text-to-pinecone.js";

/**
 * processCreateText
 * Text 데이터 처리 (생성 → Pinecone 저장)
 *
 * @param content - 텍스트 본문 (필수)
 * @param title - 텍스트 제목
 * @returns 처리 결과
 */
export async function processCreateText(
  content: string,
  title?: string | null,
): Promise<{ success: boolean; content: string; hashKey: string }> {
  // hash_key를 한 번만 생성
  const hashKey = ContentKeyManager.createContentKey(
    ERequestCreateContentType.Text,
    content,
  );

  try {
    console.log(`\n🚀 Starting text processing: ${hashKey.slice(0, 16)}...`);

    // 로그와 기존 데이터를 동시에 확인
    const [log, existingText] = await Promise.all([
      getProcessingLogText(hashKey),
      getExistingText(hashKey),
    ]);

    // 1. Text 처리 (없으면 생성, 있으면 반환)
    const textData = existingText
      ? existingText
      : await createNewText(hashKey, content, title ?? null);

    // 2. Pinecone 저장
    await processTextToPinecone(textData, log);

    console.log(`✅ Text processing completed: ${hashKey.slice(0, 16)}...\n`);
    return { success: true, content, hashKey };
  } catch (error) {
    console.error(
      `❌ Text processing failed: ${hashKey.slice(0, 16)}...`,
      error,
    );

    await handleProcessingError(
      ERequestCreateContentType.Text,
      hashKey, // ✅ content 대신 hashKey 전달 (고유 식별자)
      error,
      0,
    );

    throw error;
  }
}

/**
 * Get Processing Log
 */
async function getProcessingLogText(
  hashKey: string,
): Promise<TSqlTextProcessingLog | undefined> {
  const result = await DBSqlProcessingLogText.selectByHashKey(hashKey);
  return result.data?.[0];
}

/**
 * Get Existing Text
 */
async function getExistingText(
  hashKey: string,
): Promise<TSqlTextDetail | undefined> {
  const result = await DBSqlText.selectByHashKey(hashKey);
  return result.data?.[0];
}

/**
 * Create New Text
 * 새로운 텍스트 데이터 생성 및 DB 저장
 */
async function createNewText(
  hashKey: string,
  content: string,
  title: string | null,
): Promise<TSqlTextDetail> {
  console.log("📥 No data found, creating new text...");

  return await withRetry(
    async () => {
      const insertData: TSqlTextDetailInsert = {
        hash_key: hashKey,
        content: content,
        title: title ?? undefined,
      };

      console.log("💾 Inserting text data...");
      await DBSqlText.upsert(insertData);

      // Processing Log 업데이트
      await DBSqlProcessingLogText.upsert({
        hash_key: hashKey,
        processing_status: EProcessingStatusType.processing,
      });

      // 방금 저장한 데이터 조회
      const created = await DBSqlText.selectByHashKey(hashKey);

      if (!created.data?.[0]) {
        throw new Error(
          "Failed to create text data - data not found after insert",
        );
      }

      console.log("✅ Text data saved to DB");
      return created.data[0];
    },
    {
      maxRetries: 3,
      baseDelay: 1000,
      operationName: "Create text",
    },
  );
}

/**
 * Pinecone 처리
 * 텍스트를 벡터화하여 Pinecone에 저장
 */
async function processTextToPinecone(
  textData: TSqlTextDetail,
  log?: TSqlTextProcessingLog,
): Promise<void> {
  if (log?.is_pinecone_processed) {
    console.log("✅ Already processed to Pinecone");
    return;
  }

  console.log("📤 Processing to Pinecone...");

  await withRetry(
    async () => {
      const metadata = generateVectorMetadataText(textData);
      await saveTextToPinecone(textData, metadata);

      await DBSqlProcessingLogText.updateByHashKey(textData.hash_key, {
        is_pinecone_processed: true,
        processing_status: EProcessingStatusType.completed,
      });

      console.log("✅ Pinecone processing completed");
    },
    {
      maxRetries: 3,
      baseDelay: 1000,
      operationName: "Pinecone processing",
    },
  );
}
