import {
  PINECONE_INDEX_NAME,
  TPineconeMetadata,
  IPineconeVectorMetadataForText,
  TPineconeVector,
  TSqlTextDetail,
} from "aiqna_common_v1";
import { TAnalyzedContentMetadata } from "../../types/shared.js";
import { MetadataGeneratorText } from "../metadata-generator/metadata-generator-text.js";
import DBPinecone from "../../db-ctrl/db-ctrl-pinecone/db-pinecone.js";
import { OpenAIEmbeddingProvider } from "../embedding/openai-embedding.js";
import { chunkTextContent } from "../chunk/chunk-text.js";
import { ContentKeyManager } from "../../utils/content-key-manager.js";
import { ERequestCreateContentType, METADATA_GENERATOR_MODEL, METADATA_GENERATOR_PROVIDER } from "../../consts/const.js";
import { saveDataToLocal } from "../../utils/save-file.js";

/**
 * Pinecone 저장 함수 (Provider 기반) - 청크별 메타데이터 추출
 */
export async function saveTextToPinecone(
  textData: TSqlTextDetail,
  textDataMetadata: Partial<IPineconeVectorMetadataForText>,
  modelName?: string,
  indexName: string = PINECONE_INDEX_NAME.TRAVEL_SEOUL.OPENAI_SMALL,
): Promise<void> {
  // const provider = EmbeddingProviderFactory.createProvider("openai");
  const provider = new OpenAIEmbeddingProvider();
  const embeddingModel = modelName || provider.getDefaultModel();
  const metadataExtractor = new MetadataGeneratorText({
    provider: METADATA_GENERATOR_PROVIDER,              // "openai" 도 가능
    model: METADATA_GENERATOR_MODEL,
  });

  const contentKey = ContentKeyManager.createContentKey(
    ERequestCreateContentType.Text,
    textData.hash_key,
  );

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
    maxChars: 800, // ✅ 800자로 줄임
    overlapChars: 100, // ✅ 100자로 줄임
    minChars: 200, // ✅ 200자로 줄임
  });

  console.log(`chunks:>>>>>>>>>>`, chunks);
  console.log(`📦 Created ${chunks.length} chunks for ${textData.hash_key}`);

  if (chunks.length === 0) {
    console.warn("⚠️ No chunks generated, skipping...");
    return;
  }

  const rawMetadataFromFullText = await metadataExtractor.generateMetadataFromText(textData);

  if (!rawMetadataFromFullText) {
    console.warn(`⚠️  No raw metadata generated for ${textData.hash_key}, skipping...`);
    return;
  }

  // DEV Save File
  // metadata_from_XXXXXXXX_s02_full_text_raw.txt
  saveDataToLocal(rawMetadataFromFullText, `metadata_from_${textData.hash_key}_full_text_raw`, "raw", "txt", "../data/metaText");

  const parsedMetadataFromFullText = await metadataExtractor.parseResponse(rawMetadataFromFullText);

  if (!parsedMetadataFromFullText) {
    console.warn(`⚠️  No parsed metadata generated for ${textData.hash_key}, skipping...`);
    return;
  }

  // DEV Save File
  // metadata_from_XXXXXXXX_s03_full_text_parsed.json
  saveDataToLocal(parsedMetadataFromFullText, `metadata_from_${textData.hash_key}_s03_full_text_parsed`, "parsed", "json", "../data/metaText");

  // 각 청크에 대해 벡터 생성
  const vectors: TPineconeVector[] = await Promise.all(
    chunks.map(async (chunk, idx) => {
      // 로그 (첫 2개만)
      if (idx < 2) {
        console.log(`\n📄 Chunk ${idx}:`);
        console.log(`Length: ${chunk.text.length} chars`);
        console.log(`Preview: ${chunk.text.substring(0, 80)}...`);
      }

      // 1. 임베딩 생성 (청크 텍스트 사용)
      const embedding = await provider.generateEmbedding(
        chunk.text,
        embeddingModel,
      );

      // 2. ✅ 청크별 메타데이터 추출 - 각 청크의 텍스트로 분석
      let chunkParsedMetadata: TAnalyzedContentMetadata | null = null;
      try {
        // ✅ 청크 텍스트로 임시 객체 생성
        const chunkData: TSqlTextDetail = {
          ...textData,
          content: chunk.text, // ✅ 각 청크의 실제 텍스트 사용
        };

        const chunkRawMetadata =
          await metadataExtractor.generateMetadataFromText(chunkData);
        if (!chunkRawMetadata) {
          console.warn(`⚠️  No raw metadata generated for chunk ${idx}, continuing without metadata...`);
        } else {
          chunkParsedMetadata = await metadataExtractor.parseResponse(chunkRawMetadata);
          if (!chunkParsedMetadata) {
            console.warn(`⚠️  No parsed metadata generated for chunk ${idx}, continuing without metadata...`);
          } else {
            // DEV Save File
            // metadata_from_XXXXXXXX_s06_chunk_[01]_meta_parsed.json
            saveDataToLocal(chunkParsedMetadata, `metadata_from_${textData.hash_key}_s06_chunk_${idx}_meta_parsed`, "parsed", "json", "../data/metaText");
          }
        }

        if (idx < 2) {
          console.log(`   Metadata:`, {
            info_country: chunkParsedMetadata?.info_country,
            info_city: chunkParsedMetadata?.info_city,
            info_district: chunkParsedMetadata?.info_district,
            info_neighborhood: chunkParsedMetadata?.info_neighborhood,
            info_landmark: chunkParsedMetadata?.info_landmark,
            info_category: chunkParsedMetadata?.info_category,
            info_name: chunkParsedMetadata?.info_name,
            info_special_tag: chunkParsedMetadata?.info_special_tag,
            info_influencer: chunkParsedMetadata?.info_influencer,
            info_season: chunkParsedMetadata?.info_season,
            info_time_of_day: chunkParsedMetadata?.info_time_of_day,
            info_activity_type: chunkParsedMetadata?.info_activity_type,
            info_target_audience: chunkParsedMetadata?.info_target_audience,
            info_reservation_required: chunkParsedMetadata?.info_reservation_required,
            info_travel_tips: chunkParsedMetadata?.info_travel_tips,
            language: chunkParsedMetadata?.language,
            sentimentScore: chunkParsedMetadata?.sentimentScore,
            mainTopic: chunkParsedMetadata?.mainTopic,
            confidence_score: chunkParsedMetadata?.confidence_score,
          });
        }
      } catch (metadataError) {
        console.warn(
          `⚠️ Metadata extraction failed for chunk ${idx}:`,
          metadataError,
        );
      }

      // 청크 ID 생성
      const chunkId = ContentKeyManager.createChunkId(contentKey, idx);

      const metadata: TPineconeMetadata = {
        hash_key: contentKey,
        chunk_index: idx,
        chunk_id: chunkId,
        text: chunk.text, // ✅ 각 청크의 실제 텍스트
        text_length: chunk.text.length,
        embedding_model: embeddingModel,
        embedding_dimensions: provider.getDimensions(embeddingModel),
        created_at: new Date().toISOString(),
        // ✅ content 제외하고 나머지만 포함
        ...Object.fromEntries(
          Object.entries(textDataMetadata).filter(([key]) => key !== "content"),
        ),
      };

      // 청크별 추출된 메타데이터 추가
      if (chunkParsedMetadata) {
        if (chunkParsedMetadata.info_country.length > 0) {
          metadata.info_country = chunkParsedMetadata.info_country;
        }
        if (chunkParsedMetadata.info_city.length > 0) {
          metadata.info_city = chunkParsedMetadata.info_city;
        }
        if (chunkParsedMetadata.info_district.length > 0) {
          metadata.info_district = chunkParsedMetadata.info_district;
        }
        if (chunkParsedMetadata.info_neighborhood.length > 0) {
          metadata.info_neighborhood = chunkParsedMetadata.info_neighborhood;
        }
        if (chunkParsedMetadata.info_category.length > 0) {
          metadata.info_category = chunkParsedMetadata.info_category;
        }
        if (chunkParsedMetadata.info_name.length > 0) {
          metadata.info_name = chunkParsedMetadata.info_name;
        }
        if (chunkParsedMetadata.info_special_tag.length > 0) {
          metadata.info_special_tag = chunkParsedMetadata.info_special_tag;
        }
        if (chunkParsedMetadata.info_influencer.length > 0) {
          metadata.info_influencer = chunkParsedMetadata.info_influencer;
        }
        if (chunkParsedMetadata.info_season.length > 0) {
          metadata.info_season = chunkParsedMetadata.info_season;
        }
        if (chunkParsedMetadata.info_time_of_day.length > 0) {
          metadata.info_time_of_day = chunkParsedMetadata.info_time_of_day;
        }
        if (chunkParsedMetadata.info_activity_type.length > 0) {
          metadata.info_activity_type = chunkParsedMetadata.info_activity_type;
        }
        if (chunkParsedMetadata.info_target_audience.length > 0) {
          metadata.info_target_audience = chunkParsedMetadata.info_target_audience;
        }
        if (chunkParsedMetadata.info_reservation_required) {
          metadata.info_reservation_required = chunkParsedMetadata.info_reservation_required;
        }
        // if (extractedMetadata.info_travel_tips.length > 0) {
        //   metadata.info_travel_tips = extractedMetadata.info_travel_tips;
        // }
        if (chunkParsedMetadata.language) {
          metadata.language = chunkParsedMetadata.language;
        }
        if (chunkParsedMetadata.sentimentScore) {
          metadata.sentimentScore = chunkParsedMetadata.sentimentScore;
        }
        if (chunkParsedMetadata.mainTopic) {
          metadata.mainTopic = chunkParsedMetadata.mainTopic;
        }
        if (chunkParsedMetadata.confidence_score) {
          metadata.confidence_score = chunkParsedMetadata.confidence_score;
        }
      }

      return {
        id: chunkId,
        values: embedding,
        metadata,
      };
    }),
  );

  // Pinecone 배치 업로드
  console.log(`\n💾 Uploading ${vectors.length} vectors to Pinecone...`);
  await DBPinecone.upsertBatch(indexName, vectors, 100);

  console.log(
    `✅ Completed ${chunks.length} chunks for ${textData.hash_key}\n`,
  );
}
