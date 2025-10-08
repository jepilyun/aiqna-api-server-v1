import {
  PINECONE_INDEX_NAME,
  TPineconeMetadata,
  TPineconeVectorMetadataForContent,
  TPineconeVector,
  TSqlTextDetail,
} from "aiqna_common_v1";
import { TAnalyzedContentMetadata } from "../../../types/shared.js";
import { TextMetadataAnalyzerByAI } from "./text-metadata-analyzer.js";
import DBPinecone from "../../../ctrl-db/ctrl-db-vector/db-pinecone.js";
import { EmbeddingProviderFactory } from "../../../embedding/embedding-provider-factory.js";
import { chunkTextContent } from "./chunk-text-content.js";

/**
 * Pinecone 저장 함수 (Provider 기반) - 청크별 메타데이터 추출
 */
export async function saveTextToPinecone(
  textData: TSqlTextDetail,
  textDataMetadata: Partial<TPineconeVectorMetadataForContent>,
  modelName?: string,
  indexName: string = PINECONE_INDEX_NAME.TRAVEL_SEOUL.OPENAI_SMALL,
): Promise<void> {
  const provider = EmbeddingProviderFactory.createProvider("openai");
  const embeddingModel = modelName || provider.getDefaultModel();
  const metadataExtractor = new TextMetadataAnalyzerByAI();

  // 콘텐츠 준비
  let content = "";
  if (textData.content) {
    content = textData.content;
  } 

  if (!content) {
    console.warn("⚠️ No content to process for:", textData.hash_key);
    return;
  }

  // 청크 생성
  const chunks = chunkTextContent(content, {
    maxChars: 1000,
    overlapChars: 200,
    minChars: 400,
  });

  console.log(`📦 Created ${chunks.length} chunks for ${textData.hash_key}`);

  if (chunks.length === 0) {
    console.warn("⚠️ No chunks generated, skipping...");
    return;
  }

  // 각 청크에 대해 벡터 생성
  const vectors: TPineconeVector[] = await Promise.all(
    chunks.map(async (chunk, idx) => {
      // 로그 (첫 2개만)
      if (idx < 2) {
        console.log(`Chunk ${idx}: ${chunk.text.substring(0, 50)}... (${chunk.text.length} chars)`);
      }

      // 1. 임베딩 생성
      const embedding = await provider.generateEmbedding(chunk.text, embeddingModel);

      // 2. 청크별 메타데이터 추출
      let extractedMetadata: TAnalyzedContentMetadata | null = null;
      try {
        extractedMetadata = await metadataExtractor.analyzeFromText(textData);

        if (idx < 2) {
          console.log(`→ Metadata:`, {
            categories: extractedMetadata?.categories,
            locations: extractedMetadata?.locations,
            keywords: extractedMetadata?.keywords.slice(0, 3),
          });
        }
      } catch (metadataError) {
        console.warn(`⚠️ Metadata extraction failed for chunk ${idx}:`, metadataError);
      }

      // 청크 ID 생성
      const chunkId = `${textData.hash_key}_${idx}`;

      const metadata: TPineconeMetadata = {
        hash_key: textData.hash_key,
        chunk_index: idx,
        chunk_id: chunkId,
        text: chunk.text,
        text_length: chunk.text.length,
        embedding_model: embeddingModel,
        embedding_dimensions: provider.getDimensions(embeddingModel),
        created_at: new Date().toISOString(),
        ...textDataMetadata,
      };

      // 청크별 추출된 메타데이터 추가
      if (extractedMetadata) {
        if (extractedMetadata.categories.length > 0) {
          metadata.categories = extractedMetadata.categories;
        }
        if (extractedMetadata.keywords.length > 0) {
          metadata.keywords = extractedMetadata.keywords;
        }
        if (extractedMetadata.locations.length > 0) {
          metadata.locations = extractedMetadata.locations;
        }
        if (extractedMetadata.names.length > 0) {
          metadata.names = extractedMetadata.names;
        }
        metadata.confidence_score = extractedMetadata.confidence_score;
      }

      return {
        id: chunkId,
        values: embedding,
        metadata,
      };
    })
  );

  // Pinecone 배치 업로드
  await DBPinecone.upsertBatch(indexName, vectors, 100);

  console.log(`✓ Completed ${chunks.length} chunks for ${textData.hash_key}`);
}